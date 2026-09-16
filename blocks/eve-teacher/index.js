(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AI102Blocks = root.AI102Blocks || {};
  root.AI102Blocks.eveTeacher = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const VERSION = '0.1.0';

  function text(element) {
    return (element?.textContent || '').trim().replace(/\s+/g, ' ');
  }

  function defaultVisible(element) {
    return Boolean(element && element.offsetParent !== null && !element.hidden);
  }

  function groundVisibleAction(options = {}) {
    const documentRef = options.document || (typeof document !== 'undefined' ? document : null);
    if (!documentRef) return { visibleActions: 'None', nextAction: 'No learner action is currently available. Do not invent one.' };
    const dialog = documentRef.querySelector('dialog[open]');
    const scope = options.scope || dialog || documentRef.querySelector('main');
    const visible = options.isVisible || defaultVisible;
    const buttons = Array.from(scope?.querySelectorAll('button') || [])
      .filter(button => visible(button) && !button.disabled && !button.closest('#eve-live-controls,#eve-debug,.topbar'))
      .map(button => ({ label: text(button), element: button }))
      .filter(item => item.label && !/^Restart this learner$/i.test(item.label));
    const labels = [...new Set(buttons.map(item => item.label))].slice(0, 8);
    const retry = buttons.find(item => item.element.closest('#eve-retry') && /^Try again$/i.test(item.label));

    if (retry) return { visibleActions: labels.join(' | '), nextAction: 'Select “Try again”.' };

    if (dialog) {
      const save = labels.find(label => /Save name.*begin Mission 1/i.test(label));
      return {
        visibleActions: labels.join(' | ') || 'Agent naming box',
        nextAction: save ? `Type an agent name, then select “${save}”.` : 'Type an agent name in the open naming box.'
      };
    }
    if (options.welcomeMode === 'mission_briefing') {
      return {
        visibleActions: (options.presetLabels || ['Biology tutor', 'Business helper', 'Personal coach']).join(' | '),
        nextAction: 'Choose one starting mission on the page.'
      };
    }
    if (options.writingBox && !options.reviewedAnswer) {
      const check = labels.find(label => /Check with Eve/i.test(label));
      return {
        visibleActions: labels.join(' | ') || 'Writing box',
        nextAction: `Type an answer in the visible writing box${check ? `, then select “${check}”` : ''}.`
      };
    }
    if (options.choiceMode === 'before_choice') {
      return { visibleActions: 'Unanswered multiple-choice options', nextAction: 'Select one answer on the page.' };
    }
    const forward = buttons.filter(item => !item.element.closest('.chapter-choices') && !item.element.matches('.ghost') && !/^(Previous|Back|Revisit|Review)/i.test(item.label));
    if (options.choiceMode === 'after_choice' && !forward.length) {
      return { visibleActions: 'Multiple-choice options', nextAction: 'Select another answer on the page.' };
    }
    const preferred = forward.filter(item => !item.element.matches('.secondary')).at(-1) || forward.at(-1) || buttons.at(-1);
    if (preferred) return { visibleActions: labels.join(' | '), nextAction: `Select “${preferred.label}”.` };
    return { visibleActions: 'None', nextAction: 'No learner action is currently available. Do not invent one.' };
  }

  function createTurnQueue(run) {
    let active = false;
    let latest = null;
    async function drain() {
      if (active || !latest) return;
      active = true;
      const item = latest;
      latest = null;
      try { await run(...item); } finally { active = false; if (latest) await drain(); }
    }
    return {
      enqueue(...args) { latest = args; return drain(); },
      clear() { latest = null; },
      get busy() { return active; }
    };
  }

  return { VERSION, groundVisibleAction, createTurnQueue };
});
