(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AI102Blocks = root.AI102Blocks || {};
  root.AI102Blocks.learningJourney = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const VERSION = '0.1.0';
  const PHASES = Object.freeze(['learn', 'see', 'practice', 'recap', 'done']);

  function canTransition(current, next, evidence = {}) {
    if (!PHASES.includes(current) || !PHASES.includes(next)) return false;
    if (current === 'learn' && next === 'see') return true;
    if (current === 'see' && next === 'practice') return Boolean(evidence.demonstrationSeen);
    if (current === 'practice' && next === 'recap') return Boolean(evidence.practiceFinished);
    if (current === 'recap' && next === 'done') return Boolean(evidence.lessonCompleted);
    if (['recap', 'done'].includes(current) && next === 'practice') return Boolean(evidence.lessonCompleted);
    return false;
  }

  function transition(state, next, evidence = {}) {
    const current = state?.phase || 'learn';
    if (!canTransition(current, next, evidence)) return { ...state, phase: current, changed: false };
    return { ...state, phase: next, changed: true };
  }

  function stepModel(active = 'learn') {
    return ['learn', 'see', 'practice', 'recap'].map((phase, index) => ({
      phase,
      number: index + 1,
      label: phase === 'practice' ? 'Practise' : phase[0].toUpperCase() + phase.slice(1),
      active: active === phase,
      complete: PHASES.indexOf(active) > index
    }));
  }

  return { VERSION, PHASES, canTransition, transition, stepModel };
});
