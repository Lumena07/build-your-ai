# Shippable learning blocks

AI 102 is now assembled from three portable blocks. Another course can keep the teaching behaviour and interface while replacing the missions and subject matter.

## 1. Eve teacher

`blocks/eve-teacher/index.js` owns the reusable teaching behaviour around the model connection:

- reads the action the learner can actually take now;
- prevents Eve from inventing a hidden or later action;
- distinguishes unanswered writing, unanswered choices and checked answers;
- provides a latest-turn queue so duplicate teaching triggers do not overlap.

The host still owns its model provider, voice provider, lesson content and learner storage.

```js
const action = AI102Blocks.eveTeacher.groundVisibleAction({
  document,
  writingBox,
  reviewedAnswer,
  choiceMode: 'before_choice',
  welcomeMode: ''
});
// Send action.visibleActions and action.nextAction with the private teacher context.
```

## 2. Learning journey

`blocks/learning-journey/index.js` owns the predictable sequence:

`Learn → See → Practise → Recap → Done`

The host provides evidence before moving forward. For example, See cannot move to Practise until the demonstration has been shown, and Practise cannot move to Recap until the activity is finished. The state is plain data, so it can be stored in a browser, database or learning platform.

```js
const result = AI102Blocks.learningJourney.transition(
  { phase: 'see' },
  'practice',
  { demonstrationSeen: true }
);
```

## 3. Classroom UI

`blocks/classroom-ui/index.js` renders the parts that must stay consistent across courses:

- Eve’s speaking, preparing, ready and error states;
- the Learn, See, Practise and Recap strip;
- accessible live status text and themed loading animation.

```js
AI102Blocks.classroomUI.renderTeacherStatus(host, {
  state: 'preparing',
  portraitUrl: '/teacher.png'
});
```

The host can reuse its own CSS tokens, typography and teacher portrait. This avoids forcing the AI 102 brand onto a different product.

## What a new system supplies

- course title, lessons, examples and checks;
- selected learner/project data;
- model and voice endpoints;
- authentication and storage;
- CSS theme tokens and visual assets.

## Integration rule

The course screen is the source of truth. Eve receives the current lesson, phase, checked-answer state, visible actions and one correct next action. She may explain the current idea, but must not invent the next screen or reveal an unanswered multiple-choice answer.

Run `npm run blocks:test` to verify the public contracts, and `npm run blocks:build` to create a clean `dist-blocks` folder ready to copy into another system.
