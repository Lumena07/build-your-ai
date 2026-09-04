/* Optional bridge to the GPU backend. The local learning simulator remains
 * available when apiBaseUrl is blank or the backend is unreachable. */
window.BuildAICloud = (() => {
  const base = () => (window.BUILD_AI_CONFIG?.apiBaseUrl || '').replace(/\/$/, '');
  const request = async (path, options = {}) => {
    const response = await fetch(`${base()}${path}`, {
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail || 'The GPU service could not complete the request.');
    return body;
  };
  return {
    enabled: () => Boolean(base()),
    startTraining: (project) => request('/v1/training-jobs', {
      method: 'POST', body: JSON.stringify({
        project_id: project.id, model_name: project.name, base_model: project.baseModel,
        examples: project.examples, evaluation_prompts: project.evaluation,
        behavior: project.behavior, languages: project.languages,
      }),
    }),
    trainingStatus: (jobId) => request(`/v1/training-jobs/${encodeURIComponent(jobId)}`),
    chat: (project, message) => request('/v1/generate', {
      method: 'POST', body: JSON.stringify({
        project_id: project.id, adapter_key: project.model?.adapterKey,
        message, system_instruction: project.behavior, temperature: project.temperature,
        knowledge: project.knowledge.slice(0, 4),
      }),
    }),
  };
})();
