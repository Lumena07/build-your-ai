(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AI102Blocks = root.AI102Blocks || {};
  root.AI102Blocks.classroomUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const VERSION = '0.1.0';
  const labels = Object.freeze({
    speaking: 'Eve is guiding this step',
    preparing: 'Eve is preparing the next idea',
    connecting: 'Getting Eve ready',
    ready: 'Eve will guide the next step automatically',
    idle: 'Eve will begin with the lesson',
    error: 'Eve could not continue'
  });

  function renderTeacherStatus(host, options = {}) {
    if (!host) return null;
    const documentRef = options.document || host.ownerDocument;
    const state = labels[options.state] ? options.state : 'idle';
    let controls = host.querySelector('#eve-live-controls');
    if (!controls) {
      controls = documentRef.createElement('div');
      controls.id = 'eve-live-controls';
      controls.className = 'eve-live-controls';
      host.append(controls);
    }
    controls.replaceChildren();
    const loading = ['connecting', 'preparing'].includes(state);
    controls.setAttribute('aria-busy', String(loading));
    controls.dataset.eveState = state;
    if (loading) {
      const animation = documentRef.createElement('div');
      animation.className = 'eve-loading-animation';
      animation.setAttribute('aria-hidden', 'true');
      animation.innerHTML = `<img src="${options.portraitUrl || 'assets/eve-teacher.png'}" alt=""><div class="eve-loading-dots"><i></i><i></i><i></i></div>`;
      controls.append(animation);
    }
    const status = documentRef.createElement('span');
    status.setAttribute('role', 'status');
    status.textContent = labels[state] + '. ' + (state === 'error' ? 'Use Try again below.' : loading ? 'She’ll continue automatically.' : '');
    controls.append(status);
    return controls;
  }

  function renderJourneyStrip(documentRef, activePhase, onRevisit) {
    const journey = (typeof globalThis !== 'undefined' && globalThis.AI102Blocks?.learningJourney);
    const steps = journey ? journey.stepModel(activePhase) : [];
    const strip = documentRef.createElement('div');
    strip.className = 'chapter-phase';
    for (const step of steps) {
      const item = documentRef.createElement(step.active ? 'b' : 'span');
      item.textContent = `${step.number}. ${step.label}`;
      strip.append(item);
    }
    if (activePhase === 'practice' && onRevisit) {
      const button = documentRef.createElement('button');
      button.className = 'button ghost';
      button.textContent = 'Revisit the idea';
      button.addEventListener('click', onRevisit);
      strip.append(button);
    }
    return strip;
  }

  return { VERSION, labels, renderTeacherStatus, renderJourneyStrip };
});
