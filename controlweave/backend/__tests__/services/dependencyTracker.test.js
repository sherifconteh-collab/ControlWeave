'use strict';

jest.mock('../../src/config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ log: jest.fn(), serializeError: (e) => e }));

const tracker = require('../../src/services/dependencyTracker');
const { lockPackages, directDependencies } = require('../../src/utils/dependencyInventory');

describe('dependency inventory', () => {
  const lock = {
    packages: {
      '': { name: 'app' },
      'node_modules/express': { version: '4.22.1' },
      'node_modules/body-parser/node_modules/qs': { version: '6.5.0' },
      'node_modules/qs': { version: '6.14.0' },
      'node_modules/@scope/pkg': { version: '1.0.0' }
    }
  };
  it('collects every resolved version, including nested copies', () => {
    expect(lockPackages(lock)).toEqual({ express: ['4.22.1'], qs: ['6.14.0', '6.5.0'], '@scope/pkg': ['1.0.0'] });
  });
  it('reports direct dependencies with range, installed version and dev flag', () => {
    expect(directDependencies({ dependencies: { express: '^4.21.0' }, devDependencies: { '@scope/pkg': '^1.0.0' } }, lock)).toEqual([
      { name: '@scope/pkg', range: '^1.0.0', installed: '1.0.0', dev: true },
      { name: 'express', range: '^4.21.0', installed: '4.22.1', dev: false }
    ]);
  });
});

describe('dependency scoring', () => {
  it('classifies updates', () => {
    expect(tracker.updateType('4.22.1', '5.2.1')).toBe('major');
    expect(tracker.updateType('4.22.1', '4.23.0')).toBe('minor');
    expect(tracker.updateType('4.22.1', '4.22.2')).toBe('patch');
    expect(tracker.updateType('4.22.1', '4.22.1')).toBe('none');
    expect(tracker.updateType('git+https://x', '1.0.0')).toBe('unknown');
  });

  it('keeps the highest advisory severity', () => {
    expect(tracker.maxSeverity([{ severity: 'low' }, { severity: 'high' }, { severity: 'moderate' }])).toBe('high');
    expect(tracker.maxSeverity([])).toBeNull();
  });

  it('flags end of life passed and approaching', () => {
    expect(tracker.eolNote('2020-01-01', 'Node.js 12')).toMatch(/reached end of life/);
    const soon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    expect(tracker.eolNote(soon, 'PostgreSQL 14')).toMatch(/reaches end of life/);
    expect(tracker.eolNote('2099-01-01', 'Node.js 99')).toBeNull();
  });

  it('keeps only advisories that affect an installed version', async () => {
    const original = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        express: [
          { id: 1, title: 'old bug', url: 'u1', severity: 'high', vulnerable_versions: '<4.20.0' },
          { id: 2, title: 'current bug', url: 'u2', severity: 'moderate', vulnerable_versions: '>=4.22.0 <4.22.2' }
        ]
      })
    });
    try {
      const result = await tracker.advisoriesFor({ express: ['4.22.1'] });
      expect(result.get('express').map((a) => a.id)).toEqual([2]);
    } finally {
      global.fetch = original;
    }
  });

  it('summarizes security, outdated and end-of-life counts', () => {
    const summary = tracker.summarize([
      { direct: true, update_type: 'major', max_severity: 'critical' },
      { direct: false, update_type: 'unknown', max_severity: 'high' },
      { direct: true, update_type: 'patch', max_severity: null, eol_date: '2020-01-01' }
    ]);
    expect(summary).toEqual(expect.objectContaining({
      total: 3, security: { critical: 1, high: 1, moderate: 0, low: 0 }, outdated: { major: 1, minor: 0, patch: 1 }, end_of_life: 1
    }));
  });
});
