# AI 102: course and Eve's purpose

The learner starts with no AI knowledge and builds one assistant from six preset ideas. The outcome is understanding how a model, instructions, examples, information and tools work together, and knowing when an answer needs checking.

| Page | What the learner should understand | Small activity |
| --- | --- | --- |
| Start here | An assistant needs a clear job | Choose one of six presets and save a name and language |
| Day 1 | AI learns patterns and can make mistakes | Use a preset question and add a useful detail |
| Day 2 | Tokens are small pieces of text | Inspect the illustrated text pieces |
| Day 3 | Good examples pair questions with useful answers | Approve three examples; distinguish reference notes |
| Day 4 | Instructions guide behaviour | Write one clear rule and separate test questions |
| Day 5 | Versions must be tested fairly | Create a version and compare answers without an invented score |
| Day 6 | Tools perform specific actions | Choose a tool and inspect the calculator example |
| Day 7 | An assistant needs testing before use | Try a preset question, a tool and a difficult question |

Eve teaches the current page and current step. She uses the learner's name, chosen preset, visible work and recent conversation. She acknowledges a clear answer, explains one idea, and invites one small action. When a learner struggles she changes the explanation; she does not diagnose a fixed learning style or repeatedly ask generic comprehension questions. Speech does not automatically save form fields.

The page and Eve share the goals in curriculum.js. Task actions update her context. All days remain open. The diagnostics panel is available but collapsed. Conversation state stays in the existing browser project; this update does not reset learners.

Local training and answer comparisons are demonstrations. Real training requires a separately configured GPU service and explicit `gpuEnabled: true` in runtime-config.js. Connecting Eve's API alone does not enable GPU training. Text-piece colouring is illustrative, not a real model tokenizer. The course does not claim to create foundation models or publish a public assistant when saving a local launch.

Checks: run `node test-course.cjs` and `node --check app.js`. Live microphone and natural speech quality still require listening in the learner's browser with the teacher service running.
