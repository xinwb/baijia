// The browser only talks to the local server-side proxy. Configure the provider
// endpoint and token with YADILO_AI_ENDPOINT / YADILO_AI_API_KEY on the server.
window.YADILO_AI_CONFIG = {
  endpoint: './api/ai/generate',
  model: 'gpt-image-2',
  timeoutMs: 60000
};
