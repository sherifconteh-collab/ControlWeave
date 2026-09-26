/**
 * Provider API-key resolution, key caching, org/platform defaults, and
 * provider client construction (BYOK plumbing).
 *
 * Extracted from services/llmService.js as part of the monolith split.
 * The logic here is identical to the original inline definitions; only the
 * location has changed. llmService.js re-exports the public symbols so no
 * downstream require path changes.
 */

'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const { assertSafeUrl, safeFetch } = require('../../utils/netGuard');

/** Reject an organization's Ollama URL that points at a private network (see utils/netGuard). */
async function assertTenantOllamaUrl(value) {
  try {
    await assertSafeUrl(String(value).trim());
  } catch (error) {
    const wrapped = new Error(`Ollama URL not allowed: ${error.message}. Self-hosted deployments that run Ollama on a private network set CONNECTOR_ALLOW_PRIVATE_HOSTS=true.`);
    wrapped.status = 400;
    throw wrapped;
  }
}
const OpenAI = require('openai');
const pool = require('../../config/database');
const { decrypt } = require('../../utils/encrypt');

const GEMINI_API_BASE = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta';
const XAI_API_BASE = process.env.XAI_API_BASE || 'https://api.x.ai/v1';
const GROQ_API_BASE = 'https://api.groq.com/openai/v1';

// ---------- Org default provider ----------
const VALID_PROVIDERS = new Set(['claude', 'openai', 'gemini', 'grok', 'groq', 'ollama']);
const PROVIDER_SETTING_KEY_MAP = {
  claude: 'anthropic_api_key',
  openai: 'openai_api_key',
  gemini: 'gemini_api_key',
  grok: 'xai_api_key',
  groq: 'groq_api_key',
  ollama: 'ollama_base_url'
};
const SETTING_KEY_PROVIDER_MAP = Object.fromEntries(
  Object.entries(PROVIDER_SETTING_KEY_MAP).map(([provider, settingKey]) => [settingKey, provider])
);
const PLATFORM_API_KEYS_CACHE_KEY = 'platform:all';

function getDefaultModelForProvider(provider) {
  if (provider === 'claude') return 'claude-haiku-4-5-20251001';
  if (provider === 'openai') return 'gpt-5.4-mini';
  if (provider === 'grok') return 'grok-4.1-fast';
  if (provider === 'gemini') return 'gemini-3.5-flash';
  if (provider === 'groq') return 'openai/gpt-oss-20b';
  if (provider === 'ollama') return 'llama3.2';
  return null;
}

async function getOrgDefaultProvider(organizationId) {
  try {
    const result = await pool.query(
      `SELECT setting_value FROM organization_settings
       WHERE organization_id = $1 AND setting_key = 'default_provider' LIMIT 1`,
      [organizationId]
    );
    const value = result.rows[0]?.setting_value;
    if (VALID_PROVIDERS.has(value)) {
      return value;
    }
    return 'claude';
  } catch {
    return 'claude';
  }
}

async function getPlatformDefaultProvider() {
  try {
    const result = await pool.query(
      `SELECT setting_value FROM platform_settings
       WHERE setting_key = 'default_provider'
       LIMIT 1`
    );
    const value = result.rows[0]?.setting_value;
    return VALID_PROVIDERS.has(value) ? value : 'claude';
  } catch {
    return 'claude';
  }
}

/**
 * Returns the configured default model for an organization, falling back to
 * the platform-level default model setting, then null (provider built-in default).
 * @param {string} organizationId
 * @returns {Promise<string|null>}
 */
async function getOrgDefaultModel(organizationId) {
  try {
    if (organizationId) {
      const orgResult = await pool.query(
        `SELECT setting_value FROM organization_settings
         WHERE organization_id = $1 AND setting_key = 'default_model' LIMIT 1`,
        [organizationId]
      );
      const orgModel = orgResult.rows[0]?.setting_value;
      if (orgModel) return orgModel;
    }

    const platformResult = await pool.query(
      `SELECT setting_value FROM platform_settings
       WHERE setting_key = 'default_model' LIMIT 1`
    );
    const platformModel = platformResult.rows[0]?.setting_value;
    return platformModel || null;
  } catch {
    return null;
  }
}

/**
 * In-memory cache for API keys with 5-minute TTL
 * Reduces database queries for frequently accessed keys
 */
const apiKeyCache = new Map();
const API_KEY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Clears API key cache for an organization (call on key updates)
 * @param {string} organizationId
 */
function invalidateApiKeyCache(organizationId) {
  for (const provider of Object.keys(PROVIDER_SETTING_KEY_MAP)) {
    const cacheKey = `${organizationId}:${provider}`;
    apiKeyCache.delete(cacheKey);
  }
  apiKeyCache.delete(`${organizationId}:all`);
}

function invalidatePlatformApiKeyCache() {
  apiKeyCache.delete(PLATFORM_API_KEYS_CACHE_KEY);
  for (const provider of Object.keys(PROVIDER_SETTING_KEY_MAP)) {
    apiKeyCache.delete(`platform:${provider}`);
  }
}

/**
 * Get all API keys for an organization in a single batched query
 * Returns a map of provider -> decrypted API key
 * @param {string} organizationId
 * @returns {Promise<Object>} Map of provider names to API keys
 */
async function getAllOrgApiKeys(organizationId) {
  const cacheKey = `${organizationId}:all`;
  const cached = apiKeyCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < API_KEY_CACHE_TTL_MS)) {
    return cached.data;
  }
  
  const settingKeys = Object.keys(SETTING_KEY_PROVIDER_MAP);
  const result = await pool.query(
    'SELECT setting_key, setting_value, is_encrypted FROM organization_settings WHERE organization_id = $1 AND setting_key = ANY($2)',
    [organizationId, settingKeys]
  );

  const apiKeys = {};
  for (const row of result.rows) {
    const provider = SETTING_KEY_PROVIDER_MAP[row.setting_key];
    if (provider) {
      apiKeys[provider] = row.is_encrypted ? decrypt(row.setting_value) : row.setting_value;
    }
  }

  // Cache the result
  apiKeyCache.set(cacheKey, { data: apiKeys, timestamp: Date.now() });
  return apiKeys;
}

async function getAllPlatformApiKeys() {
  const cached = apiKeyCache.get(PLATFORM_API_KEYS_CACHE_KEY);
  if (cached && (Date.now() - cached.timestamp < API_KEY_CACHE_TTL_MS)) {
    return cached.data;
  }

  try {
    const settingKeys = Object.keys(SETTING_KEY_PROVIDER_MAP);
    const result = await pool.query(
      'SELECT setting_key, setting_value, is_encrypted FROM platform_settings WHERE setting_key = ANY($1)',
      [settingKeys]
    );

    const apiKeys = {};
    for (const row of result.rows) {
      const provider = SETTING_KEY_PROVIDER_MAP[row.setting_key];
      if (provider) {
        apiKeys[provider] = row.is_encrypted ? decrypt(row.setting_value) : row.setting_value;
      }
    }

    apiKeyCache.set(PLATFORM_API_KEYS_CACHE_KEY, { data: apiKeys, timestamp: Date.now() });
    return apiKeys;
  } catch {
    return {};
  }
}

async function getPlatformApiKey(provider) {
  if (!PROVIDER_SETTING_KEY_MAP[provider]) return null;

  const cacheKey = `platform:${provider}`;
  const cached = apiKeyCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < API_KEY_CACHE_TTL_MS)) {
    return cached.data;
  }

  const allKeys = await getAllPlatformApiKeys();
  const apiKey = allKeys[provider] || null;
  apiKeyCache.set(cacheKey, { data: apiKey, timestamp: Date.now() });
  return apiKey;
}

// ---------- BYOK: Fetch user-provided keys from org settings ----------
async function getOrgApiKey(organizationId, provider) {
  // Check cache first
  const cacheKey = `${organizationId}:${provider}`;
  const cached = apiKeyCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < API_KEY_CACHE_TTL_MS)) {
    return cached.data;
  }

  const settingKey = PROVIDER_SETTING_KEY_MAP[provider];
  if (!settingKey) return null;

  const result = await pool.query(
    'SELECT setting_value, is_encrypted FROM organization_settings WHERE organization_id = $1 AND setting_key = $2',
    [organizationId, settingKey]
  );
  if (result.rows.length === 0) {
    // Cache "no key" too: every AI call walks the whole provider chain, and
    // uncached misses cost one database round trip per unconfigured provider.
    // Saving a key calls invalidateApiKeyCache, so a new key is seen at once.
    apiKeyCache.set(cacheKey, { data: null, timestamp: Date.now() });
    return null;
  }
  const row = result.rows[0];
  // Decrypt if the value was stored with AES-256-GCM encryption.
  // decrypt() gracefully returns plain-text for legacy unencrypted rows.
  const apiKey = row.is_encrypted ? decrypt(row.setting_value) : row.setting_value;
  
  // Cache the result
  apiKeyCache.set(cacheKey, { data: apiKey, timestamp: Date.now() });
  return apiKey;
}

async function resolveApiKey(provider, organizationId) {
  if (!PROVIDER_SETTING_KEY_MAP[provider]) {
    return { key: null, source: null };
  }

  if (organizationId) {
    const orgKey = await getOrgApiKey(organizationId, provider);
    if (orgKey) {
      // For Ollama the "key" is a base URL the organization typed in, so the
      // server would otherwise call any host it names (cloud metadata, the
      // database): check it like every other tenant-supplied URL.
      if (provider === 'ollama') await assertTenantOllamaUrl(orgKey);
      return { key: orgKey, source: 'organization' };
    }
  }

  return { key: null, source: null };
}

// Per-request ceiling for a single provider call. The SDK defaults (10 minute
// timeout, 2 internal retries) stacked under our own retry and fallback loops
// could hold one AI request for well over half an hour; our loop in chatCore
// owns retries, so the SDK makes exactly one attempt within this bound.
const AI_PROVIDER_TIMEOUT_MS = Math.max(5000, parseInt(process.env.AI_PROVIDER_TIMEOUT_MS || '60000', 10));
const SDK_CLIENT_OPTIONS = Object.freeze({ timeout: AI_PROVIDER_TIMEOUT_MS, maxRetries: 0 });

function getClient(provider, orgApiKey) {
  if (provider === 'claude') {
    if (!orgApiKey) return null;
    return new Anthropic.default({ apiKey: orgApiKey, ...SDK_CLIENT_OPTIONS });
  }
  if (provider === 'openai') {
    if (!orgApiKey) return null;
    return new OpenAI.default({ apiKey: orgApiKey, ...SDK_CLIENT_OPTIONS });
  }
  if (provider === 'grok') {
    if (!orgApiKey) return null;
    return new OpenAI.default({ apiKey: orgApiKey, baseURL: XAI_API_BASE, ...SDK_CLIENT_OPTIONS });
  }
  if (provider === 'gemini') {
    return orgApiKey ? { apiKey: orgApiKey } : null;
  }
  if (provider === 'groq') {
    if (!orgApiKey) return null;
    return new OpenAI.default({ apiKey: orgApiKey, baseURL: GROQ_API_BASE, ...SDK_CLIENT_OPTIONS });
  }
  if (provider === 'ollama') {
    if (!orgApiKey) return null;
    // orgApiKey is the organization's base URL for Ollama (Ollama ignores the
    // Authorization header). safeFetch pins each connection to a checked
    // address, so the URL cannot be rebound to a private host after the check.
    return new OpenAI.default({ apiKey: 'ollama', baseURL: orgApiKey, fetch: safeFetch, ...SDK_CLIENT_OPTIONS });
  }
  return null;
}

module.exports = {
  assertTenantOllamaUrl,
  AI_PROVIDER_TIMEOUT_MS,
  GEMINI_API_BASE,
  VALID_PROVIDERS,
  PROVIDER_SETTING_KEY_MAP,
  getDefaultModelForProvider,
  getOrgDefaultProvider,
  getPlatformDefaultProvider,
  getOrgDefaultModel,
  invalidateApiKeyCache,
  invalidatePlatformApiKeyCache,
  getAllOrgApiKeys,
  getAllPlatformApiKeys,
  getPlatformApiKey,
  getOrgApiKey,
  resolveApiKey,
  getClient,
};
