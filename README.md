# Build Your AI Agent — runnable MVP

Serve this folder locally and open `http://127.0.0.1:8000/index.html`. The practice activities do not require a GPU. Eve's natural voice requires the private teacher service and an OpenAI key.

AI 102 teaches beginners how to create AI agents using an existing model, instructions, answer examples, reference information and tools for a clear job. There is no model-training workflow or GPU requirement. This learning prototype stores projects in the browser and includes three presets, test questions, saved agent configurations, reference notes, tools, three guided final tests and JSON export.

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

The local prototype demonstrates agent configurations, saved example responses and local tools without a GPU or an API key. Live generated answers require a connection to an existing-model service, not model training. Each learner can save multiple agent projects and configuration versions. The legacy `project.model` field stores configuration versions for compatibility with saved browser projects; saving it never submits a training job. Eve's private API service powers the teacher, not the learner's local agent.

## Presets

- Biology tutor
- Business helper
- Personal coach

Older saved projects from the retired templates remain available; the new-project chooser offers only these three.

## Invite-only online course

Sites serves the course and Eve from the same protected origin. Its custom access policy allows only the owner and specifically invited email addresses. Students sign in with the account matching their invitation. Manage students through the Site's sharing controls; do not switch the audience to public.

The hosting secret `OPENAI_API_KEY` is server-only. The Worker uses Sites' trusted authenticated-user header, limits recordings and replies, checks request origins, and stores atomic usage counters in D1. Limits are 600 teacher requests per course per UTC day, 180 per student per UTC day, and 20 per student per minute. These are request limits, not a guaranteed dollar spending cap; set an OpenAI project budget separately.

Each signed-in account gets its own browser storage namespace. Restart affects only that account's active project. Progress does not yet sync between devices, and clearing browser storage removes it. The hosted key powers Eve, not live generation by the learner's agent.

Build with `npm run build`; generate migrations with `npm run db:generate`. `node test-online.cjs` tests authentication/error limits and actual browser controls using mocked identity, D1, OpenAI and audio hardware. Add `--live` to also check a real OpenAI reply and speech with the approved ignored local key. Actual email delivery/sign-in acceptance requires the student's account and is not covered by those tests.

Rollback: redeploy a previous saved version if protected sign-in or lesson loading fails. If Eve fails, keep written activities available and use Try again. Do not loosen student access to repair a deployment. The usage migration only adds a table, so previous static versions remain compatible.
