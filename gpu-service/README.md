# GPU integration — RunPod Serverless

This folder turns the local seven-lab prototype into a genuine GPU product.

## Architecture

```text
Browser app ──HTTPS──> private API gateway ──RunPod API──> training endpoint
       │                       │                         (queued LoRA job)
       │                       └──────────────RunPod API──> inference endpoint
       │                                                   (live learner chat)
       └──────────── learner projects, data and results ──> product database
```

The browser never receives the RunPod API key. The backend uses `/run` for
asynchronous training and `/runsync` for interactive inference. RunPod documents
those as the appropriate request types for background and quick jobs, respectively.
The training worker also runs each learner's held-out prompts with the adapter
disabled and enabled, then returns both outputs to the evaluation screen.

## What the learner actually gets

One learner can create many model versions. Every version is:

```text
approved examples + LoRA adapter + generation settings + a shared base model
```

It is a real fine-tuned derivative, not a new foundation model. The agent layer
adds instructions, knowledge retrieval, calculator, notes and tasks separately.

## Deploy in this order

1. Choose and approve the open-weight base model. Put its Hugging Face model ID in `BASE_MODEL_ID`; do not blindly use the placeholder in `test_input.json`.
2. Build and push `worker/Dockerfile` to a private container registry.
3. In RunPod, create two Serverless endpoints from that image:
   - **training** — queue-based, one worker at a time, longer timeout;
   - **inference** — low-latency, one warm worker at first, scale out only after load testing.
4. Give both workers access to the same protected durable adapter location mounted at `ADAPTERS_ROOT`. Before production, replace the filesystem implementation with tenant-scoped S3-compatible storage if your worker configuration cannot guarantee shared durable storage.
5. Deploy `api/main.py` to a normal CPU web service, set the server-side values in `.env`, and add proper learner authentication plus a database before public launch.
6. Set only the API gateway URL in `../runtime-config.js`; leave RunPod secrets exclusively on the API service.

RunPod’s job API uses `/run` for background work, `/runsync` for fast interactive work, and `/status` for polling. It warns that asynchronous results expire after 30 minutes, so a production backend must save final model metadata and evaluation results in its own database rather than treating RunPod as the system of record. [RunPod request documentation](https://docs.runpod.io/serverless/endpoints/send-requests)

## Local checks

The CPU machine can syntax-check the API, but it cannot execute the GPU worker.

```powershell
cd gpu-service/api
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

For local browser testing, set `apiBaseUrl: "http://localhost:8000"` in `../runtime-config.js`. The browser will use GPU mode only after the backend reports configured endpoints.

## Non-negotiable production controls

- Authenticate every learner; never trust a browser-provided project ID as proof of ownership.
- Add per-user quotas, maximum dataset and prompt sizes, and rate limits before enabling public access.
- Encrypt learner source files and adapters; use per-tenant authorization on storage paths.
- Keep original documents, LoRA adapters, models, and generated logs on documented retention/deletion schedules.
- Verify the licence and commercial terms of the selected base checkpoint before launch.
- Store job records, model cards, evaluation reports, audit logs, and billing/cost attribution in your application database.
