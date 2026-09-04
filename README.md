# Build Your AI — runnable MVP

Open `index.html` in any modern browser. No installation, account, or server is needed.

This is a complete local learning/product prototype for the seven-lab experience. It stores projects in the browser, includes six presets plus a custom option, supports training examples, evaluation prompts, model version creation, a knowledge library, calculator/notes/tasks tools, an agent playground, and JSON export.

## Beginner-first daily teaching

The app now starts a one-lab-per-day path after the learner creates a blueprint.
An adaptive **AI Teacher** stays available throughout the experience. Learners can
choose whether they learn best through a demonstration, small steps, everyday
examples, or a tiny practice activity, and can choose short or slightly fuller
explanations.
It also supports browser voice input and spoken replies where the learner's
browser provides the Web Speech API. Voice preference phrases such as “show me”,
“go slowly”, “give an example”, and “let me try” switch the teacher's style.
The learner grants microphone access in their browser; this local app does not
save audio recordings.

## Important product truth

The local prototype uses an educational model simulator so it works without a GPU or an API key. It does **not** claim to fine-tune a neural network. In production, replace the simulator at `generateReply()` and `createModel()` with a model-serving endpoint and a queued LoRA fine-tuning job. Each learner can create unlimited projects/model versions; each version is a derivative configuration of a shared open-weight base checkpoint, not a new foundation model.

## Presets

- Biology tutor (English + Swahili)
- Study assistant
- Small-business helper
- Aviation compliance assistant
- Writing assistant
- Personal coach
