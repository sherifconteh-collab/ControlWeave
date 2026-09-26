'use strict';

jest.mock('../../src/config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ log: jest.fn(), serializeError: (e) => e }));

const pool = require('../../src/config/database');
const ssoPolicy = require('../../src/services/ssoPolicy');

describe('SSO policy (TEVV-SEC-7)', () => {
  afterEach(() => jest.clearAllMocks());

  it('requires SSO for a member of an enforcing organization', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    await expect(ssoPolicy.ssoRequiredFor({ organization_id: 'o', role: 'user' })).resolves.toBe(true);
  });

  it('keeps break-glass access for organization and platform administrators', async () => {
    await expect(ssoPolicy.ssoRequiredFor({ organization_id: 'o', role: 'admin' })).resolves.toBe(false);
    await expect(ssoPolicy.ssoRequiredFor({ organization_id: 'o', role: 'user', is_platform_admin: true })).resolves.toBe(false);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('fails closed when the policy cannot be read', async () => {
    pool.query.mockRejectedValueOnce(new Error('db down'));
    await expect(ssoPolicy.ssoRequiredFor({ organization_id: 'o', role: 'user' })).rejects.toThrow('db down');
  });
});

describe('tenant-supplied URLs are guarded (TEVV-SEC-5)', () => {
  const original = process.env.CONNECTOR_ALLOW_PRIVATE_HOSTS;
  afterEach(() => { process.env.CONNECTOR_ALLOW_PRIVATE_HOSTS = original; });

  it('refuses an organization Ollama URL on a private network', async () => {
    delete process.env.CONNECTOR_ALLOW_PRIVATE_HOSTS;
    const { assertTenantOllamaUrl } = require('../../src/services/ai/keyResolution');
    await expect(assertTenantOllamaUrl('http://169.254.169.254/v1')).rejects.toThrow(/Ollama URL not allowed/);
    await expect(assertTenantOllamaUrl('https://10.0.0.5:11434/v1')).rejects.toMatchObject({ status: 400 });
  });

  it('reports an ITSM or Qualys failure instead of an empty clean result', async () => {
    delete process.env.CONNECTOR_ALLOW_PRIVATE_HOSTS;
    const snow = await require('../../src/services/serviceNowService').syncFindings({ instanceUrl: 'https://127.0.0.1', username: 'u', password: 'p' });
    expect(snow.error).toMatch(/private network/);
    expect(snow.findings).toEqual([]);
    const qualys = await require('../../src/services/qualysService').syncFindings({ baseUrl: 'https://169.254.169.254', username: 'u', password: 'p' });
    expect(qualys.error).toMatch(/private network/);
  });
});
