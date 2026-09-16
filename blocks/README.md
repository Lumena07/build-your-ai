# AI 102 shippable blocks

These dependency-free browser modules separate the reusable teaching product from the AI 102 subject content.

1. Load `learning-journey/index.js`.
2. Load `classroom-ui/index.js`.
3. Load `eve-teacher/index.js`.
4. Read them from `window.AI102Blocks`.

Each file also supports `require(...)` in Node for testing and server-side composition.

The blocks do not contain learner names, course answers, API keys, OpenAI calls, or AI 102 lesson copy. A host system supplies those through the documented functions. See `SHIPPABLE-BLOCKS.md` for complete contracts and examples.
