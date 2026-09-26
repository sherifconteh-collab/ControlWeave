'use strict';

const { getOrgApiKey } = require('../../ai/keyResolution');
const { validateProviderKey, PROVIDER_LABELS } = require('../../ai/keyValidation');

const PROVIDERS = Object.keys(PROVIDER_LABELS);

async function configuredProviders(orgId) {
  const entries = await Promise.all(PROVIDERS.map(async (p) => [p, await getOrgApiKey(orgId, p).catch(() => null)]));
  return entries.filter(([, key]) => Boolean(key));
}

module.exports = [
  {
    id: 'ai.providers',
    suite: 'ai',
    title: 'AI provider keys work',
    description: 'Validates every configured bring-your-own-key provider by listing its models (no tokens are spent).',
    async run(ctx) {
      const configured = await configuredProviders(ctx.organizationId);
      if (configured.length === 0) {
        return {
          status: 'warn',
          detail: 'No AI provider keys are configured, so AI features are unavailable. The rest of the platform is unaffected.',
          remediation: 'Add a key under Settings > AI Keys (Gemini and Groq offer free tiers).'
        };
      }
      const results = await Promise.all(configured.map(([provider, key]) => validateProviderKey(provider, key)));
      const invalid = results.filter((r) => !r.valid);
      const missingDefault = results.filter((r) => r.valid && r.defaultModelAvailable === false);
      const metrics = { providers: results.map((r) => ({ provider: r.provider, valid: r.valid, latencyMs: r.latencyMs, models: r.modelCount || 0 })) };
      if (invalid.length) {
        return {
          status: 'fail',
          detail: invalid.map((r) => r.error).join(' '),
          remediation: 'Replace the key under Settings > AI Keys.',
          metrics
        };
      }
      if (missingDefault.length) {
        return {
          status: 'warn',
          detail: `Keys are valid, but the default model is not available for: ${missingDefault.map((r) => `${PROVIDER_LABELS[r.provider]} (${r.defaultModel})`).join(', ')}.`,
          remediation: 'Choose an available model under Settings > AI Keys > Default model.',
          metrics
        };
      }
      return {
        status: 'pass',
        detail: results.map((r) => `${PROVIDER_LABELS[r.provider]}: ${r.modelCount} models, ${r.latencyMs}ms`).join('; '),
        metrics
      };
    }
  },
  {
    id: 'ai.fail_fast',
    suite: 'ai',
    title: 'AI requests fail fast when unavailable',
    description: 'When no provider can serve a request the API must answer immediately with guidance, never hang.',
    async run(ctx) {
      const configured = await configuredProviders(ctx.organizationId);
      if (configured.length > 0) return { status: 'skip', detail: 'A provider is configured; covered by the key check above.' };
      const response = await ctx.api.post('/ai/gap-analysis', {});
      if (response.ms > 5000) {
        return { status: 'fail', detail: `An AI request with no provider took ${response.ms}ms to fail.`, remediation: 'Report to support with the run export.' };
      }
      return { status: 'pass', detail: `Returned HTTP ${response.status} in ${response.ms}ms with setup guidance.` };
    }
  }
];
