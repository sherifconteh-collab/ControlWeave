'use strict';

/**
 * Regression tests for the monolith split (4.1).
 *
 * These tests lock in the public contracts of the extracted helper/config
 * modules so future refactors cannot silently drop exports or change return
 * shapes. They do NOT require a database — only the pure-function parts of
 * the modules are exercised here.
 */

describe('monolith-split: services/ai/providerConfig', () => {
  const providerConfig = require('../../src/services/ai/providerConfig');

  test('exports the expected symbols', () => {
    expect(Object.keys(providerConfig).sort()).toEqual([
      'FEATURE_TASK_PROFILE',
      'PROVIDERS',
      'TASK_PROFILES',
      'resolveTaskModel',
    ]);
  });

  test('PROVIDERS has all six supported providers', () => {
    expect(Object.keys(providerConfig.PROVIDERS).sort())
      .toEqual(['claude', 'gemini', 'grok', 'groq', 'ollama', 'openai']);
  });

  test('resolveTaskModel returns profile temperature when no override', () => {
    const res = providerConfig.resolveTaskModel('claude', 'evidence_suggestion');
    expect(res.temperature).toBe(0.2);
    expect(typeof res.model).toBe('string');
  });

  test('resolveTaskModel preserves profile temperature with callerModel override', () => {
    const res = providerConfig.resolveTaskModel('claude', 'gap_analysis', 'custom-model');
    expect(res.model).toBe('custom-model');
    expect(res.temperature).toBe(0.4);
  });
});

describe('monolith-split: services/ai/prompts', () => {
  const prompts = require('../../src/services/ai/prompts');

  test('exports the expected symbols', () => {
    expect(Object.keys(prompts).sort()).toEqual([
      'GRC_CORE',
      'GRC_MODULES',
      'GRC_SYSTEM',
      'PROMPT_PROFILES',
      'buildGrcSystem',
    ]);
  });

  test('buildGrcSystem("full") includes all modules', () => {
    const out = prompts.buildGrcSystem('full');
    expect(out).toContain('GRC (Governance, Risk, and Compliance)');
    expect(out).toContain('NIST Publications');
    expect(out).toContain('MITRE ATT&CK');
    expect(out).toContain('MAESTRO');
  });

  test('buildGrcSystem("lean") returns only the core prompt', () => {
    const out = prompts.buildGrcSystem('lean');
    expect(out).toContain('GRC (Governance, Risk, and Compliance)');
    expect(out).not.toContain('NIST Publications');
  });

  test('GRC_SYSTEM equals buildGrcSystem("full")', () => {
    expect(prompts.GRC_SYSTEM).toBe(prompts.buildGrcSystem('full'));
  });
});

describe('monolith-split: llmService public API is preserved', () => {
  const llm = require('../../src/services/llmService');

  test('re-exports providerConfig symbols on the public module', () => {
    const providerConfig = require('../../src/services/ai/providerConfig');
    expect(llm.PROVIDERS).toBe(providerConfig.PROVIDERS);
    expect(llm.TASK_PROFILES).toBe(providerConfig.TASK_PROFILES);
    expect(llm.FEATURE_TASK_PROFILE).toBe(providerConfig.FEATURE_TASK_PROFILE);
    expect(llm.resolveTaskModel).toBe(providerConfig.resolveTaskModel);
  });

  test('re-exports prompts symbols on the public module', () => {
    const prompts = require('../../src/services/ai/prompts');
    expect(llm.PROMPT_PROFILES).toBe(prompts.PROMPT_PROFILES);
    expect(llm.buildGrcSystem).toBe(prompts.buildGrcSystem);
  });
});

describe('monolith-split: routes/assessments/_shared', () => {
  const shared = require('../../src/routes/assessments/_shared');

  test('exports the expected constants', () => {
    expect(shared.VALID_ENGAGEMENT_TYPES).toEqual(['internal_audit', 'external_audit', 'readiness', 'assessment']);
    expect(shared.VALID_FINDING_SEVERITIES).toContain('critical');
    expect(shared.TEMPLATE_MAX_CHARS).toBe(250000);
    expect(Array.isArray(shared.SIGNOFF_ROLE_CONFIG)).toBe(true);
  });

  test('pure helpers behave identically to original definitions', () => {
    expect(shared.toInt('42', 0)).toBe(42);
    expect(shared.toInt('nope', 7)).toBe(7);
    expect(shared.parseFrameworkCodes('nist, iso_27001,soc2')).toEqual(['nist', 'iso_27001', 'soc2']);
    expect(shared.truncateText('hello world', 5)).toEqual({ value: 'hello', truncated: true });
    expect(shared.normalizeNullableText('  ')).toBeNull();
    expect(shared.normalizeNullableText('  a  ')).toBe('a');
    expect(shared.parseBooleanFlag('true', false)).toBe(true);
    expect(shared.parseBooleanFlag('no', true)).toBe(false);
    expect(shared.parseBooleanFlag(undefined, true)).toBe(true);
  });

  test('assertEngagementChildAccess helper is present and is a function', () => {
    expect(typeof shared.assertEngagementChildAccess).toBe('function');
  });
});

describe('monolith-split: routes/organizations/_helpers', () => {
  const helpers = require('../../src/routes/organizations/_helpers');

  test('exports every constant referenced from organizations.js', () => {
    // Regression for PR review feedback: the original split omitted these
    // exports and would have ReferenceError'd at request time. Lock them in.
    const REQUIRED = [
      'RMF_FRAMEWORK_CODES',
      'VALID_DEPLOYMENT_MODELS',
      'VALID_DATA_SENSITIVITY_TYPES',
      'NIST_800_53_REQUIRED_INFORMATION_TYPE_CODES',
      'VALID_CONTROL_IMPLEMENTATION_STATUSES',
      'VALID_CRITICALITY_LEVELS',
      'VALID_COTS_PRODUCT_TYPES',
      'VALID_COTS_LIFECYCLE_STATUSES',
      'VALID_COTS_DEPLOYMENT_MODELS',
      'VALID_COTS_DATA_ACCESS_LEVELS',
      'VALID_CONTRACT_TYPES',
      'VALID_CONTRACT_STATUSES',
    ];
    for (const name of REQUIRED) {
      expect(helpers[name]).toBeInstanceOf(Set);
    }
  });

  test('exports the expected constants', () => {
    expect(helpers.VALID_CIA_LEVELS.has('low')).toBe(true);
    expect(helpers.VALID_RMF_STAGES.has('authorize')).toBe(true);
    expect(helpers.VALID_COMPLIANCE_PROFILES.has('federal')).toBe(true);
    expect(helpers.STRICT_CROSSWALK_MAPPING_TYPES).toEqual(['equivalent', 'exact']);
  });

  test('escapeIlike escapes %, _ and backslash', () => {
    expect(helpers.escapeIlike('100%_test\\data')).toBe('100\\%\\_test\\\\data');
  });

  test('toBoolean coerces common truthy/falsy representations', () => {
    expect(helpers.toBoolean('true')).toBe(true);
    expect(helpers.toBoolean('false')).toBe(false);
    expect(helpers.toBoolean('yes')).toBe(true);
    expect(helpers.toBoolean('no')).toBe(false);
    expect(helpers.toBoolean(undefined, true)).toBe(true);
  });

  test('toNullableString trims and returns null for empty', () => {
    expect(helpers.toNullableString('  hi  ')).toBe('hi');
    expect(helpers.toNullableString('   ')).toBeNull();
    expect(helpers.toNullableString(null)).toBeNull();
  });

  test('verifyOrgAccess returns orgId when it matches the user org', () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const ok = helpers.verifyOrgAccess(
      { params: { orgId: 'abc' }, user: { organization_id: 'abc' } },
      res
    );
    expect(ok).toBe('abc');
    expect(res.status).not.toHaveBeenCalled();
  });

  test('verifyOrgAccess returns null and sends 403 when org mismatches', () => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const bad = helpers.verifyOrgAccess(
      { params: { orgId: 'abc' }, user: { organization_id: 'xyz' } },
      res
    );
    expect(bad).toBeNull();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});

describe('monolith-split: router modules still load and preserve stack size', () => {
  test('routes/assessments exports an Express router with middleware + handlers', () => {
    const router = require('../../src/routes/assessments');
    expect(typeof router).toBe('function');
    expect(Array.isArray(router.stack)).toBe(true);
    // Pin the current count so accidental route removal is caught.
    expect(router.stack.length).toBeGreaterThanOrEqual(40);
  });

  test('routes/organizations exports an Express router with middleware + handlers', () => {
    const router = require('../../src/routes/organizations');
    expect(typeof router).toBe('function');
    expect(Array.isArray(router.stack)).toBe(true);
    expect(router.stack.length).toBeGreaterThanOrEqual(20);
  });
});
