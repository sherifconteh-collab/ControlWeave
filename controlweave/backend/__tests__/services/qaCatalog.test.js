'use strict';

jest.mock('../../src/config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ log: jest.fn(), serializeError: (e) => e }));

const { SUITES, listChecks, summarize } = require('../../src/services/qa/runner');
const { validateProviderKey } = require('../../src/services/ai/keyValidation');

describe('QA self-test catalog', () => {
  it('gives every check a unique id and a known suite', () => {
    const checks = listChecks();
    const suiteIds = new Set(SUITES.map((s) => s.id));
    expect(checks.length).toBeGreaterThan(15);
    expect(new Set(checks.map((c) => c.id)).size).toBe(checks.length);
    for (const check of checks) {
      expect(suiteIds.has(check.suite)).toBe(true);
      expect(check.title).toEqual(expect.any(String));
      expect(check.description).toEqual(expect.any(String));
    }
    for (const suite of SUITES) {
      expect(checks.some((c) => c.suite === suite.id)).toBe(true);
    }
  });

  it('summarizes a run: any fail fails it, otherwise warnings downgrade it', () => {
    expect(summarize([{ status: 'pass' }, { status: 'skip' }]).status).toBe('passed');
    expect(summarize([{ status: 'pass' }, { status: 'warn' }]).status).toBe('passed_with_warnings');
    expect(summarize([{ status: 'warn' }, { status: 'fail' }])).toEqual({
      status: 'failed',
      counts: { pass: 0, warn: 1, fail: 1, skip: 0 },
      total: 2
    });
  });
});

describe('validateProviderKey', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('rejects unsupported providers without a network call', async () => {
    global.fetch = jest.fn();
    const result = await validateProviderKey('unknown', 'x');
    expect(result.valid).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reports an invalid Gemini key (HTTP 400) as rejected', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({}) });
    const result = await validateProviderKey('gemini', 'bad');
    expect(result).toEqual(expect.objectContaining({ valid: false }));
    expect(result.error).toMatch(/rejected this API key/);
  });

  it('lists models and reports whether the default model is available', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ models: [{ name: 'models/some-other-model' }] })
    });
    const result = await validateProviderKey('gemini', 'good');
    expect(result.valid).toBe(true);
    expect(result.modelCount).toBe(1);
    expect(result.defaultModelAvailable).toBe(false);
  });
});
