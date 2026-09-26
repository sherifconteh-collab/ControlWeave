'use strict';

jest.mock('../../src/config/database', () => ({ query: jest.fn(), connect: jest.fn() }));

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a'.repeat(64);

const connectors = require('../../src/services/connectors');
const { assessIdentities } = require('../../src/services/connectors/identityFindings');
const { summarizeIssues } = require('../../src/services/connectors/jira');
const { assertSafeUrl } = require('../../src/utils/netGuard');
const { isEncrypted } = require('../../src/utils/encrypt');

describe('connector credentials', () => {
  it('encrypts secrets wherever they are submitted and never returns them', () => {
    const { auth, settings } = connectors.prepareConfig('okta', {
      authConfig: { apiToken: 'secret-token' },
      connectorConfig: { domain: 'acme.okta.com', clientSecret: 'misplaced' }
    });
    expect(settings).toEqual({ domain: 'acme.okta.com' });
    expect(isEncrypted(auth.apiToken)).toBe(true);
    expect(isEncrypted(auth.clientSecret)).toBe(true);
    const row = connectors.redact({ connector_type: 'okta', auth_config: auth, connector_config: settings });
    expect(JSON.stringify(row)).not.toContain('secret-token');
    expect(row.credentials_set.sort()).toEqual(['apiToken', 'clientSecret']);
    expect(connectors.runtimeConfig({ auth_config: auth, connector_config: settings }).apiToken).toBe('secret-token');
  });

  it('keeps stored secrets when an edit submits the mask or a blank', () => {
    const first = connectors.prepareConfig('jira', { authConfig: { apiToken: 't1' } });
    const next = connectors.prepareConfig('jira', { authConfig: { apiToken: connectors.MASK, personalAccessToken: '' } }, first.auth);
    expect(next.auth).toEqual(first.auth);
  });

  it('reports missing required settings', () => {
    expect(connectors.missingRequired('entra_id', {}, { tenantId: 't' })).toEqual(['clientId', 'clientSecret']);
  });
});

describe('identity assessment', () => {
  const now = Date.parse('2026-06-01T00:00:00Z');
  it('flags admins and users without MFA and inactive accounts', () => {
    const { findings, metrics } = assessIdentities([
      { login: 'admin', enabled: true, isAdmin: true, mfaRegistered: false, lastLoginAt: '2026-05-30', createdAt: '2025-01-01' },
      { login: 'user', enabled: true, isAdmin: false, mfaRegistered: false, lastLoginAt: '2026-01-01', createdAt: '2025-01-01' },
      { login: 'ok', enabled: true, isAdmin: false, mfaRegistered: true, lastLoginAt: '2026-05-30', createdAt: '2025-01-01' },
      { login: 'off', enabled: false, isAdmin: false, mfaRegistered: false, lastLoginAt: null, createdAt: '2020-01-01' }
    ], { now });
    expect(findings.map((f) => `${f.rule}:${f.resource}:${f.severity}`).sort()).toEqual([
      'admin_without_mfa:admin:critical', 'inactive_account:user:medium', 'user_without_mfa:user:high'
    ]);
    expect(metrics).toEqual(expect.objectContaining({ active_accounts: 3, mfa_registered: 1, mfa_coverage_percent: 33.3, inactive_accounts: 1 }));
  });
});

describe('jira summary', () => {
  it('counts open, overdue and resolved tickets', () => {
    const now = Date.parse('2026-06-01T00:00:00Z');
    const done = { statusCategory: { key: 'done' } };
    const open = { statusCategory: { key: 'indeterminate' } };
    const { findings, metrics } = summarizeIssues([
      { key: 'SEC-1', fields: { summary: 'Patch', status: open, priority: { name: 'Low' }, duedate: '2026-05-01' } },
      { key: 'SEC-2', fields: { summary: 'MFA', status: open, priority: { name: 'Highest' } } },
      { key: 'SEC-3', fields: { summary: 'Done', status: done, created: '2026-05-01', resolutiondate: '2026-05-11' } }
    ], { now });
    expect(metrics).toEqual({ issues_retrieved: 3, open: 2, overdue: 1, resolved_last_30_days: 1, mean_days_to_resolve: 10 });
    expect(findings.map((f) => [f.resource, f.severity])).toEqual([['SEC-1', 'high'], ['SEC-2', 'critical']]);
  });
});

describe('netGuard', () => {
  it('refuses private, loopback and metadata addresses and plain http', async () => {
    await expect(assertSafeUrl('http://example.com')).rejects.toThrow(/https/);
    await expect(assertSafeUrl('https://169.254.169.254/latest')).rejects.toThrow(/private/);
    await expect(assertSafeUrl('https://localhost:5432')).rejects.toThrow(/private/);
    const lookup = jest.fn().mockResolvedValue([{ address: '10.0.0.5' }]);
    await expect(assertSafeUrl('https://jira.example.com', { lookup })).rejects.toThrow(/private/);
    lookup.mockResolvedValue([{ address: '104.192.141.1' }]);
    await expect(assertSafeUrl('https://acme.atlassian.net', { lookup })).resolves.toBeInstanceOf(URL);
  });
});
