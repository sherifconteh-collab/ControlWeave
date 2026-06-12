'use strict';

/**
 * Tests for the console bridge in utils/logger.js — legacy console.error /
 * console.warn calls must come out as structured JSON log lines.
 *
 * The bridge captures raw console refs at module load, so the spies are
 * installed on the global console BEFORE requiring the module (resetModules
 * per test) — the raw refs then point at the spies.
 */

const ORIGINAL_ERROR = console.error;
const ORIGINAL_WARN = console.warn;

let logger;
let errorSpy;
let warnSpy;

function lastPayload(spy) {
  const calls = spy.mock.calls;
  return JSON.parse(calls[calls.length - 1][0]);
}

beforeEach(() => {
  jest.resetModules();
  errorSpy = jest.fn();
  warnSpy = jest.fn();
  console.error = errorSpy;
  console.warn = warnSpy;
  logger = require('../../src/utils/logger');
  logger.installConsoleBridge();
});

afterEach(() => {
  logger.uninstallConsoleBridge();
  console.error = ORIGINAL_ERROR;
  console.warn = ORIGINAL_WARN;
});

describe('installConsoleBridge', () => {
  test('console.error with label and Error emits structured JSON', () => {
    console.error('Create user error:', new Error('boom'));
    const payload = lastPayload(errorSpy);
    expect(payload.level).toBe('error');
    expect(payload.message).toBe('Create user error');
    expect(payload.error.message).toBe('boom');
    expect(payload.timestamp).toBeTruthy();
  });

  test('console.warn is bridged to a structured warn line', () => {
    console.warn('Bulk classification skipped:', 'bad file');
    const payload = lastPayload(warnSpy);
    expect(payload.level).toBe('warn');
    expect(payload.message).toBe('Bulk classification skipped');
    expect(payload.details).toEqual(['bad file']);
  });

  test('console.error with extra primitives captures them as details', () => {
    console.error('Splunk scan failed:', 'connection refused');
    const payload = lastPayload(errorSpy);
    expect(payload.message).toBe('Splunk scan failed');
    expect(payload.details).toEqual(['connection refused']);
  });

  test('console.error with a non-string first arg still logs', () => {
    console.error({ some: 'object' });
    const payload = lastPayload(errorSpy);
    expect(payload.message).toBe('console.error');
    expect(payload.details).toEqual([{ some: 'object' }]);
  });

  test('log() itself is not double-bridged (no recursion)', () => {
    logger.log('error', 'direct.structured', { key: 'value' });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const payload = lastPayload(errorSpy);
    expect(payload.message).toBe('direct.structured');
    expect(payload.key).toBe('value');
  });

  test('uninstall restores the original console functions', () => {
    logger.uninstallConsoleBridge();
    console.error('plain output', 123);
    const lastCall = errorSpy.mock.calls[errorSpy.mock.calls.length - 1];
    expect(lastCall).toEqual(['plain output', 123]);
  });
});
