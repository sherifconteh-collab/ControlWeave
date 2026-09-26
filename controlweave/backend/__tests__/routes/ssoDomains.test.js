'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_that_is_at_least_32_chars';

jest.mock('../../src/config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req, res, next) => next(),
  requirePermission: () => (req, res, next) => next(),
  requireTier: () => (req, res, next) => next()
}));
jest.mock('../../src/middleware/rateLimit', () => ({ createRateLimiter: () => (req, res, next) => next() }));
jest.mock('../../src/services/entitlementService', () => ({
  requireFeature: () => (req, res, next) => next(),
  hasFeature: jest.fn(async () => true),
  commercialMode: () => false
}));
jest.mock('../../src/services/auditService', () => ({ logFromRequest: jest.fn(async () => {}), extractAuditContext: () => ({}) }));
jest.mock('../../src/utils/logger', () => ({ log: jest.fn() }));

const dns = require('dns');
const pool = require('../../src/config/database');
const auditService = require('../../src/services/auditService');
const router = require('../../src/routes/sso');
const sso = require('../../src/services/ssoService');
const { invokeRoute, makeReq, makeRes } = require('./_testUtils');

const USER = { id: 'user-1', organization_id: 'org-1', email: 'admin@acme.com', role: 'admin' };
const CLAIM = { domain: 'acme.com', verification_token: 'abc123', verified_at: null };

function verify(domain = 'acme.com') {
  const res = makeRes();
  return invokeRoute(router, 'post', '/domains/verify', makeReq({ user: USER, body: { domain } }), res).then(() => res);
}

describe('SSO email domain verification', () => {
  let client;
  beforeEach(() => {
    jest.restoreAllMocks();
    pool.query.mockReset();
    client = { query: jest.fn(async () => ({ rows: [{ verified_at: '2026-09-25T00:00:00Z' }] })), release: jest.fn() };
    pool.connect.mockResolvedValue(client);
  });

  it('rejects a malformed domain', async () => {
    const res = await verify('not a domain');
    expect(res.statusCode).toBe(400);
  });

  it('refuses a domain the organization has not claimed', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await verify();
    expect(res.statusCode).toBe(404);
  });

  it('keeps the claim pending when the TXT record is missing, and says what to publish', async () => {
    pool.query.mockResolvedValueOnce({ rows: [CLAIM] });
    jest.spyOn(dns.promises, 'resolveTxt').mockRejectedValue(Object.assign(new Error('nx'), { code: 'ENOTFOUND' }));
    const res = await verify();
    expect(res.statusCode).toBe(422);
    expect(res._json.txt_record).toEqual({ name: '_controlweave-verification.acme.com', value: 'controlweave-verification=abc123' });
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('refuses a TXT record carrying another token', async () => {
    pool.query.mockResolvedValueOnce({ rows: [CLAIM] });
    jest.spyOn(dns.promises, 'resolveTxt').mockResolvedValue([['controlweave-verification=someone-else']]);
    const res = await verify();
    expect(res.statusCode).toBe(422);
  });

  it('verifies with a matching TXT record, removes other pending claims and audits', async () => {
    pool.query.mockResolvedValueOnce({ rows: [CLAIM] });
    const resolveTxt = jest.spyOn(dns.promises, 'resolveTxt').mockResolvedValue([['v=spf1 -all'], ['controlweave-', 'verification=abc123']]);
    const res = await verify();
    expect(res.statusCode).toBe(200);
    expect(res._json.data.verified).toBe(true);
    expect(resolveTxt).toHaveBeenCalledWith('_controlweave-verification.acme.com');
    const sql = client.query.mock.calls.map((c) => String(c[0]));
    expect(sql.some((q) => /UPDATE sso_email_domains SET verified_at = NOW\(\)/.test(q))).toBe(true);
    expect(sql.some((q) => /DELETE FROM sso_email_domains WHERE domain = \$1 AND organization_id <> \$2 AND verified_at IS NULL/.test(q))).toBe(true);
    expect(auditService.logFromRequest).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ eventType: 'sso.domain_verified' }));
  });

  it('reports a conflict when another organization verified first', async () => {
    pool.query.mockResolvedValueOnce({ rows: [CLAIM] });
    jest.spyOn(dns.promises, 'resolveTxt').mockResolvedValue([['controlweave-verification=abc123']]);
    client.query.mockImplementation(async (q) => {
      if (/^UPDATE/.test(String(q).trim())) throw Object.assign(new Error('dup'), { code: '23505' });
      return { rows: [] };
    });
    const res = await verify();
    expect(res.statusCode).toBe(409);
  });

  it('uses only verified domains for sign-in discovery', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await sso.findSsoByEmail('user@acme.com');
    expect(String(pool.query.mock.calls[0][0])).toMatch(/d\.verified_at IS NOT NULL/);
  });
});
