/**
 * Social AI — configuration
 *
 * Optional: set apiUrl to your secure backend proxy (OpenAI, etc.)
 * Never expose production API keys in client-side code.
 */
window.SP_SOCIAL_AI_CONFIG = {
  /** Custom backend: POST { messages: [{role, content}] } → { reply: string } */
  apiUrl: '',
  enabled: true
};
