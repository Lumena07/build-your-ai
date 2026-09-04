"""RunPod Serverless worker for real LoRA training and adapter inference.

Deploy the same image as two endpoints: a queued training endpoint and a
low-latency inference endpoint. Give both a protected persistent adapter
location (ADAPTERS_ROOT). The worker never receives the RunPod API key.
"""
from __future__ import annotations

import gc
import os
import re
from pathlib import Path

import runpod
import torch
from datasets import Dataset
from peft import LoraConfig, PeftModel, TaskType, get_peft_model
from transformers import AutoModelForCausalLM, AutoTokenizer, DataCollatorForLanguageModeling, Trainer, TrainingArguments

ROOT = Path(os.getenv("ADAPTERS_ROOT", "/workspace/adapters"))
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "1024"))

def safe_key(key: str) -> Path:
    if not re.fullmatch(r"[A-Za-z0-9_/-]+", key) or ".." in key:
        raise ValueError("Unsafe adapter key")
    return ROOT / key

def load_base(model_id: str):
    tokenizer = AutoTokenizer.from_pretrained(model_id, use_fast=True)
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token = tokenizer.eos_token
    dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
    model = AutoModelForCausalLM.from_pretrained(model_id, torch_dtype=dtype, device_map="auto")
    model.config.use_cache = False
    return model, tokenizer

def make_text(example: dict, behavior: str) -> str:
    instruction = behavior.strip() or "Answer clearly, accurately, and honestly."
    return f"<|system|>\n{instruction}\n<|user|>\n{example['input']}\n<|assistant|>\n{example['output']}"

def prompt_tokens(model, tokenizer, system: str, message: str):
    messages = [{"role": "system", "content": system}, {"role": "user", "content": message}]
    if getattr(tokenizer, "chat_template", None):
        return tokenizer.apply_chat_template(messages, add_generation_prompt=True, return_tensors="pt").to(model.device)
    return tokenizer(f"System: {system}\nUser: {message}\nAssistant:", return_tensors="pt").input_ids.to(model.device)

def answer(model, tokenizer, tokens, temperature: float = 0.0) -> str:
    with torch.inference_mode():
        output = model.generate(tokens, max_new_tokens=280, do_sample=temperature > 0,
            temperature=max(temperature, 0.05), pad_token_id=tokenizer.eos_token_id)
    return tokenizer.decode(output[0][tokens.shape[-1]:], skip_special_tokens=True).strip()

def train(data: dict) -> dict:
    examples = data.get("examples", [])
    if len(examples) < 3:
        return {"error": "At least three learner-approved examples are required."}
    base_model = data["base_model"]
    adapter_dir = safe_key(data["adapter_key"])
    adapter_dir.mkdir(parents=True, exist_ok=True)
    model, tokenizer = load_base(base_model)
    config = LoraConfig(task_type=TaskType.CAUSAL_LM, r=16, lora_alpha=32, lora_dropout=0.05,
                        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"])
    model = get_peft_model(model, config)
    texts = [make_text(x, data.get("behavior", "")) for x in examples]
    encoded = tokenizer(texts, truncation=True, max_length=MAX_TOKENS, padding=False)
    dataset = Dataset.from_dict(encoded)
    args = TrainingArguments(output_dir=str(adapter_dir / "checkpoints"), num_train_epochs=2,
        per_device_train_batch_size=1, gradient_accumulation_steps=8, learning_rate=2e-4,
        bf16=torch.cuda.is_bf16_supported(), fp16=not torch.cuda.is_bf16_supported(), logging_steps=1,
        save_strategy="no", report_to=[])
    trainer = Trainer(model=model, args=args, train_dataset=dataset,
        data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False))
    trainer.train()
    model.save_pretrained(adapter_dir, safe_serialization=True)
    tokenizer.save_pretrained(adapter_dir)
    # The same held-out prompts are run before and after enabling the adapter.
    # They are not part of `examples`, so this is an actual generalisation check.
    model.config.use_cache = True
    evaluation = []
    system = data.get("behavior", "Answer clearly and say when uncertain.")
    for prompt in data.get("evaluation_prompts", [])[:12]:
        tokens = prompt_tokens(model, tokenizer, system, prompt)
        with model.disable_adapter():
            starting_model = answer(model, tokenizer, tokens)
        learner_model = answer(model, tokenizer, tokens)
        evaluation.append({"prompt": prompt, "base": starting_model, "model": learner_model})
    del trainer, model
    gc.collect(); torch.cuda.empty_cache()
    return {"message": "LoRA adapter trained and saved.", "model_name": f"{data['model_name']}-1",
            "version": int(data["adapter_key"].rsplit("v", 1)[-1]), "base_model": base_model,
            "adapter_key": data["adapter_key"], "evaluation": evaluation}

def generate(data: dict) -> dict:
    adapter_dir = safe_key(data["adapter_key"])
    if not adapter_dir.exists():
        return {"error": "Adapter was not found in persistent storage."}
    model, tokenizer = load_base(os.getenv("BASE_MODEL_ID", data.get("base_model", "")))
    model = PeftModel.from_pretrained(model, adapter_dir)
    model.config.use_cache = True
    knowledge = data.get("knowledge", [])
    sources = "\n\n".join(f"SOURCE: {x.get('title', 'Untitled')}\n{x.get('content', '')[:1600]}" for x in knowledge)
    system = data.get("system_instruction", "Answer clearly and say when uncertain.")
    prompt = f"{system}\n\n{sources}" if sources else system
    encoded = prompt_tokens(model, tokenizer, prompt, data["message"])
    text = answer(model, tokenizer, encoded, float(data.get("temperature", 0.3)))
    del model
    gc.collect(); torch.cuda.empty_cache()
    return {"text": text, "usage": {"prompt_tokens": int(encoded.shape[-1])}}

def handler(job: dict) -> dict:
    data = job.get("input", {})
    try:
        operation = data.get("operation")
        if operation == "train":
            return train(data)
        if operation == "generate":
            return generate(data)
        return {"error": "operation must be train or generate"}
    except Exception as exc:
        return {"error": str(exc)}

runpod.serverless.start({"handler": handler})
