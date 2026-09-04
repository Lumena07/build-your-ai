# Build Your AI — runnable MVP

Open `index.html` in any modern browser. No installation, account, or server is needed.

This is a complete local learning/product prototype for the seven-lab experience. It stores projects in the browser, includes six presets plus a custom option, supports training examples, evaluation prompts, model version creation, a knowledge library, calculator/notes/tasks tools, an agent playground, and JSON export.

## Eve — a live AI teacher

Eve is built to teach like a real, attentive tutor: she responds to what the
learner actually says, keeps the current lesson small, and asks one useful next
question instead of repeatedly asking whether the learner understands. Her
conversation notes are kept in the learner's browser so she can use an interest
or earlier answer later in the course.

For natural speech, the private teacher service uses OpenAI for three things:
understanding a recorded learner answer, deciding Eve's response, and speaking
that response. The key never goes in the website or GitHub.

### Turn on Eve on this computer

1. Open `gpu-service/api/.env` in a text editor.
2. Paste the OpenAI key after `OPENAI_API_KEY=`. Do not add quotation marks.
3. In PowerShell, open `gpu-service/api` and run:

   ```powershell
   .\.teacher-venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8787
   ```

4. Keep that small window open, then refresh `index.html` and choose **Begin
   with Eve**. The learner can type, or click **Speak to Eve** and allow the
   microphone when their browser asks.

Recorded audio is sent to OpenAI only to transcribe that turn. The site stores
the written lesson conversation in that browser; it does not put the API key,
audio files, or lesson conversation on GitHub.

## Important product truth

The local prototype uses an educational model simulator so it works without a GPU or an API key. It does **not** claim to fine-tune a neural network. In production, replace the simulator at `generateReply()` and `createModel()` with a model-serving endpoint and a queued LoRA fine-tuning job. Each learner can create unlimited projects/model versions; each version is a derivative configuration of a shared open-weight base checkpoint, not a new foundation model.

## Presets

- Biology tutor (English + Swahili)
- Study assistant
- Small-business helper
- Aviation compliance assistant
- Writing assistant
- Personal coach
