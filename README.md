# Build Your AI — runnable MVP

Serve this folder locally and open `http://127.0.0.1:8000/index.html`. The practice activities do not require a GPU. Eve's natural voice requires the private teacher service and an OpenAI key.

This is a learning prototype for the seven-lab experience. It stores projects in the browser and includes six presets, training examples, test questions, practice versions, reference notes, tools, three guided final tests and JSON export.

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

4. Keep the service running, then choose **Start AI 102**. Allow the microphone when requested. Eve's button starts recording; **Finish speaking** submits that turn. **Stop Eve** stops speech. **Try again** retries a failed turn. Returning learners choose **Resume with Eve**.

Activities appear one at a time. Small questions check understanding before completion. **Restart this learner** asks for confirmation and removes only the active project; other saved projects remain. Updates no longer automatically erase learner data.

Run `node test-all.cjs` for the complete verification suite. It checks JavaScript and Python syntax, every lesson page and visible activity, Eve's reply contract, one continuous Eve-guided learner journey through Days 1–7, button and navigation states, saved lesson work, lesson recaps and connections, answered-question isolation, the active Eve service, live OpenAI teaching responses on every day, speech generation, command transcription, and live browser navigation. Keep Eve's teacher service running before starting it. The suite synthesizes and transcribes a test recording; testing a person's physical microphone still requires a learner.

For faster checks that do not call the live OpenAI service, run `node test-course.cjs`, `node test-experience.cjs`, `node test-next-navigation.cjs`, and `gpu-service/api/.teacher-venv/Scripts/python.exe gpu-service/api/test_teacher.py`.

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
