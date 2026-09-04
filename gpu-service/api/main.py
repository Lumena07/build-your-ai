"""Private application backend for Build Your AI.

Only this service knows the RunPod API key. A real product must put normal
learner authentication in front of these routes and derive project ownership
from the authenticated user; this starter accepts project IDs to stay usable
for a local proof-of-concept.
"""
from __future__ import annotations

import os
import re
import sqlite3
from pathlib import Path
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

RUNPOD_API = "https://api.runpod.ai/v2"
API_KEY = os.getenv("RUNPOD_API_KEY", "")
TRAINING_ENDPOINT = os.getenv("RUNPOD_TRAINING_ENDPOINT_ID", "")
INFERENCE_ENDPOINT = os.getenv("RUNPOD_INFERENCE_ENDPOINT_ID", "")
BASE_MODEL = os.getenv("BASE_MODEL_ID", "")
DB_PATH = Path(os.getenv("DATABASE_PATH", "./data/build-your-ai.db"))

app = FastAPI(title="Build Your AI GPU gateway", version="0.1.0")
origins = [x.strip() for x in os.getenv("ALLOWED_ORIGIN", "http://localhost:8000").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"], allow_headers=["content-type"])

def database() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection

def initialize_database() -> None:
    with database() as connection:
        connection.execute("""CREATE TABLE IF NOT EXISTS model_versions (
            project_id TEXT NOT NULL, version INTEGER NOT NULL, adapter_key TEXT NOT NULL,
            model_name TEXT NOT NULL, base_model TEXT NOT NULL, runpod_job_id TEXT,
            status TEXT NOT NULL, PRIMARY KEY (project_id, version), UNIQUE(adapter_key)
        )""")

@app.on_event("startup")
def startup() -> None:
    initialize_database()

class Example(BaseModel):
    input: str = Field(min_length=3, max_length=8_000)
    output: str = Field(min_length=3, max_length=12_000)

class TrainingRequest(BaseModel):
    project_id: str = Field(min_length=8, max_length=128)
    model_name: str = Field(min_length=1, max_length=80)
    base_model: str | None = Field(default=None, max_length=250)
    examples: list[Example] = Field(min_length=3, max_length=500)
    evaluation_prompts: list[str] = Field(default_factory=list, max_length=40)
    behavior: str = Field(default="", max_length=4_000)
    languages: str = Field(default="English", max_length=80)

    @field_validator("project_id")
    @classmethod
    def project_id_is_safe(cls, value: str) -> str:
        if not re.fullmatch(r"[A-Za-z0-9_-]+", value):
            raise ValueError("project_id may contain only letters, numbers, hyphens, and underscores")
        return value

class GenerateRequest(BaseModel):
    project_id: str = Field(min_length=8, max_length=128)
    adapter_key: str = Field(min_length=3, max_length=300)
    message: str = Field(min_length=1, max_length=12_000)
    system_instruction: str = Field(default="", max_length=4_000)
    temperature: float = Field(default=0.3, ge=0, le=1.3)
    knowledge: list[dict[str, str]] = Field(default_factory=list, max_length=4)

def require_config(endpoint: str) -> None:
    if not API_KEY or not endpoint or not BASE_MODEL:
        raise HTTPException(503, "GPU service is not configured. Set server-side RunPod endpoint IDs, API key, and base model.")

async def runpod(endpoint: str, operation: str, payload: dict, *, asynchronous: bool) -> dict:
    require_config(endpoint)
    path = "run" if asynchronous else "runsync"
    request = {"input": {"operation": operation, **payload}}
    if asynchronous:
        request["policy"] = {"executionTimeout": 3_600_000, "ttl": 7_200_000}
    async with httpx.AsyncClient(timeout=90) as client:
        response = await client.post(f"{RUNPOD_API}/{endpoint}/{path}", headers={"authorization": f"Bearer {API_KEY}"}, json=request)
    if response.status_code >= 400:
        raise HTTPException(502, f"GPU provider rejected the request: {response.text[:300]}")
    return response.json()

@app.get("/health")
def health() -> dict:
    return {"ready": bool(API_KEY and TRAINING_ENDPOINT and INFERENCE_ENDPOINT and BASE_MODEL)}

@app.post("/v1/training-jobs")
async def start_training(body: TrainingRequest) -> dict:
    # SQLite is suitable for the single small gateway in this starter. When the
    # API is scaled horizontally, replace this reservation with a Postgres
    # transaction or a unique sequence owned by the project row.
    with database() as connection:
        connection.execute("BEGIN IMMEDIATE")
        row = connection.execute("SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM model_versions WHERE project_id = ?", (body.project_id,)).fetchone()
        version = int(row["next_version"])
        adapter_key = f"{body.project_id}/v{version}"
        connection.execute("INSERT INTO model_versions (project_id, version, adapter_key, model_name, base_model, status) VALUES (?, ?, ?, ?, ?, ?)",
            (body.project_id, version, adapter_key, body.model_name, body.base_model or BASE_MODEL, "SUBMITTING"))
    try:
        result = await runpod(TRAINING_ENDPOINT, "train", {
            "project_id": body.project_id, "model_name": body.model_name,
            "base_model": body.base_model or BASE_MODEL, "adapter_key": adapter_key,
            "examples": [x.model_dump() for x in body.examples],
            "evaluation_prompts": body.evaluation_prompts, "behavior": body.behavior,
            "languages": body.languages,
        }, asynchronous=True)
    except Exception:
        with database() as connection:
            connection.execute("UPDATE model_versions SET status = ? WHERE project_id = ? AND version = ?", ("SUBMISSION_FAILED", body.project_id, version))
        raise
    with database() as connection:
        connection.execute("UPDATE model_versions SET runpod_job_id = ?, status = ? WHERE project_id = ? AND version = ?", (result["id"], result.get("status", "IN_QUEUE"), body.project_id, version))
    return {"id": result["id"], "status": result.get("status", "IN_QUEUE"), "adapter_key": adapter_key, "version": version}

@app.get("/v1/training-jobs/{job_id}")
async def training_status(job_id: str) -> dict:
    require_config(TRAINING_ENDPOINT)
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(f"{RUNPOD_API}/{TRAINING_ENDPOINT}/status/{job_id}", headers={"authorization": f"Bearer {API_KEY}"})
    if response.status_code >= 400:
        raise HTTPException(502, "Could not retrieve training-job status.")
    result = response.json()
    output = result.get("output") or {}
    with database() as connection:
        saved = connection.execute("SELECT * FROM model_versions WHERE runpod_job_id = ?", (job_id,)).fetchone()
        if saved:
            connection.execute("UPDATE model_versions SET status = ? WHERE runpod_job_id = ?", (result.get("status", "UNKNOWN"), job_id))
    return {
        "id": job_id, "status": result.get("status", "UNKNOWN"),
        "message": output.get("message", result.get("error", "")),
        "model_name": output.get("model_name") or (saved["model_name"] if saved else None),
        "version": output.get("version") or (saved["version"] if saved else None),
        "base_model": output.get("base_model") or (saved["base_model"] if saved else BASE_MODEL),
        "adapter_key": output.get("adapter_key") or (saved["adapter_key"] if saved else None),
        "evaluation": output.get("evaluation", []),
    }

@app.post("/v1/generate")
async def generate(body: GenerateRequest) -> dict:
    result = await runpod(INFERENCE_ENDPOINT, "generate", body.model_dump(), asynchronous=False)
    output = result.get("output") or {}
    if result.get("status") not in {"COMPLETED", None}:
        raise HTTPException(502, output.get("error", "The GPU response did not complete."))
    return {"text": output.get("text", ""), "usage": output.get("usage", {})}
