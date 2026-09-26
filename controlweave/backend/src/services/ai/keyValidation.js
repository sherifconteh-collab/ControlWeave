'use strict';

/**
 * Bring-your-own-key validation.
 *
 * Validates a provider credential by listing the models it can access rather
 * than by sending a prompt: listing is free, answers in well under a second,
 * does not depend on any particular model name existing, and tells us whether
 * the model ControlWeaver would call by default is available to this key.
 */

const {
  GEMINI_API_BASE,
  getDefaultModelForProvider
} = require('./keyResolution');

const XAI_API_BASE = process.env.XAI_API_BASE || 'https://api.x.ai/v1';
const GROQ_API_BASE = 'https://api.groq.com/openai/v1';
const KEY_VALIDATION_TIMEOUT_MS = Math.max(2000, parseInt(process.env.AI_KEY_VALIDATION_TIMEOUT_MS || '10000', 10));
const PROVIDER_LABELS = Object.freeze({
  claude: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  grok: 'xAI Grok',
  groq: 'Groq',
  ollama: 'Ollama'
});

function friendlyError(provider, err) {
  const status = err && (err.status || err.statusCode);
  const label = PROVIDER_LABELS[provider] || provider;
  // Gemini reports an invalid key as 400 API_KEY_INVALID rather than 401.
  if (status === 401 || status === 403 || (provider === 'gemini' && status === 400)) {
    return `${label} rejected this API key. Check that it was copied correctly and is still active.`;
  }
  if (status === 429) return `${label} accepted the key but is rate limiting it right now. Try again shortly.`;
  const message = String((err && err.message) || '');
  if (err && (err.name === 'TimeoutError' || /timed out|timeout|abort/i.test(message))) {
    return `${label} did not respond within ${KEY_VALIDATION_TIMEOUT_MS / 1000}s. Check network access to the provider.`;
  }
  if (/ENOTFOUND|ECONNREFUSED|fetch failed/i.test(message)) {
    return `Could not reach ${label}. Check the URL and outbound network access.`;
  }
  return `${label} key validation failed: ${message.slice(0, 200)}`;
}

async function fetchJson(url, headers = {}, { tenantUrl = false } = {}) {
  // A tenant-supplied URL goes through safeFetch, which pins the connection to
  // an address that passed the private-network check.
  const send = tenantUrl ? require('../../utils/netGuard').safeFetch : fetch;
  const response = await send(url, { headers, signal: AbortSignal.timeout(KEY_VALIDATION_TIMEOUT_MS) });
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function listModelIds(provider, credential) {
  const sdkOptions = { timeout: KEY_VALIDATION_TIMEOUT_MS, maxRetries: 0 };
  if (provider === 'claude') {
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic.default({ apiKey: credential, ...sdkOptions });
    const page = await client.models.list({ limit: 100 });
    return page.data.map((m) => m.id);
  }
  if (provider === 'openai' || provider === 'grok' || provider === 'groq') {
    const OpenAI = require('openai');
    const baseURL = provider === 'grok' ? XAI_API_BASE : provider === 'groq' ? GROQ_API_BASE : undefined;
    const client = new OpenAI.default({ apiKey: credential, ...(baseURL ? { baseURL } : {}), ...sdkOptions });
    const page = await client.models.list();
    return page.data.map((m) => m.id);
  }
  if (provider === 'gemini') {
    const data = await fetchJson(`${GEMINI_API_BASE}/models?pageSize=200`, { 'x-goog-api-key': credential });
    return (data.models || []).map((m) => String(m.name || '').replace(/^models\//, ''));
  }
  if (provider === 'ollama') {
    // An organization-supplied URL is checked like any tenant URL; the
    // operator's OLLAMA_BASE_URL is trusted.
    if (credential) await require('./keyResolution').assertTenantOllamaUrl(credential);
    const base = String(credential || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1').replace(/\/v1\/?$/, '');
    const data = await fetchJson(`${base}/api/tags`, {}, { tenantUrl: Boolean(credential) });
    return (data.models || []).map((m) => String(m.name || '').replace(/:latest$/, ''));
  }
  const error = new Error('Unsupported provider');
  error.status = 400;
  throw error;
}

/**
 * @returns {Promise<{ valid: boolean, provider: string, latencyMs: number,
 *   modelCount?: number, defaultModel?: string|null, defaultModelAvailable?: boolean|null,
 *   sampleModels?: string[], error?: string }>}
 */
async function validateProviderKey(provider, credential) {
  const started = Date.now();
  if (!PROVIDER_LABELS[provider]) {
    return { valid: false, provider, latencyMs: 0, error: 'Unsupported provider' };
  }
  try {
    const ids = await listModelIds(provider, credential);
    const defaultModel = getDefaultModelForProvider(provider);
    const defaultModelAvailable = defaultModel
      ? ids.some((id) => id === defaultModel || id.startsWith(`${defaultModel}-`) || defaultModel.startsWith(`${id}-`))
      : null;
    return {
      valid: true,
      provider,
      latencyMs: Date.now() - started,
      modelCount: ids.length,
      defaultModel,
      defaultModelAvailable,
      sampleModels: ids.slice(0, 8)
    };
  } catch (err) {
    return { valid: false, provider, latencyMs: Date.now() - started, error: friendlyError(provider, err) };
  }
}

module.exports = { validateProviderKey, PROVIDER_LABELS, KEY_VALIDATION_TIMEOUT_MS };
