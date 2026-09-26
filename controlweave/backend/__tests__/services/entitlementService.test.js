'use strict';

jest.mock('../../src/config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../../src/services/licenseService', () => ({
  loadLicenseFromEnv: jest.fn(() => null),
  loadLicenseKeyFromDb: jest.fn(async () => ({})),
  validateLicenseKey: jest.fn()
}));
jest.mock('../../src/utils/logger', () => ({ log: jest.fn(), serializeError: (e) => e }));

const pool = require('../../src/config/database');
const licenseService = require('../../src/services/licenseService');
const ent = require('../../src/services/entitlementService');
const { billingStatusFor } = require('../../src/routes/billing');

function res() {
  const r = { statusCode: 200 };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

describe('entitlements', () => {
  const original = process.env.COMMERCIAL_MODE;
  afterEach(() => {
    process.env.COMMERCIAL_MODE = original;
    ent.clearCache();
    jest.clearAllMocks();
  });

  it('grants everything when commercial mode is off', async () => {
    delete process.env.COMMERCIAL_MODE;
    const e = await ent.getEntitlements('org');
    expect(e.commercialMode).toBe(false);
    expect(e.features).toContain('scim');
    expect(pool.query).not.toHaveBeenCalled();
    const next = jest.fn();
    await ent.requireFeature('scim')({ user: { organization_id: 'org' } }, res(), next);
    expect(next).toHaveBeenCalled();
  });

  it('maps billing statuses to plans', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(ent.subscriptionPlan({ tier: 'pro', billing_status: 'active_paid' }).plan).toBe('pro');
    expect(ent.subscriptionPlan({ tier: 'enterprise', billing_status: 'comped' }).source).toBe('comped');
    expect(ent.subscriptionPlan({ tier: 'pro', billing_status: 'trial', trial_ends_at: future }).source).toBe('trial');
    expect(ent.subscriptionPlan({ tier: 'pro', billing_status: 'trial', trial_ends_at: '2020-01-01' }).plan).toBe('community');
    expect(ent.subscriptionPlan({ tier: 'enterprise', billing_status: 'canceled' }).plan).toBe('community');
    expect(ent.subscriptionPlan({ tier: 'govcloud', billing_status: 'license' }).plan).toBe('gov');
  });

  it('returns 402 with the required plan for a gated feature', async () => {
    process.env.COMMERCIAL_MODE = 'true';
    pool.query.mockResolvedValueOnce({ rows: [{ tier: 'community', billing_status: 'community' }] });
    const r = res();
    const next = jest.fn();
    await ent.requireFeature('hipaa_sra')({ user: { organization_id: 'org' } }, r, next);
    expect(next).not.toHaveBeenCalled();
    expect(r.statusCode).toBe(402);
    expect(r.body).toEqual(expect.objectContaining({ code: 'plan_upgrade_required', required_plan: 'pro' }));
  });

  it('applies a plan change immediately (no per-organization cache)', async () => {
    process.env.COMMERCIAL_MODE = 'true';
    pool.query
      .mockResolvedValueOnce({ rows: [{ tier: 'enterprise', billing_status: 'active_paid' }] })
      .mockResolvedValueOnce({ rows: [{ tier: 'enterprise', billing_status: 'canceled' }] });
    expect(await ent.hasFeature('org', 'scim')).toBe(true);
    expect(await ent.hasFeature('org', 'scim')).toBe(false);
  });

  it('re-verifies the license only when its text changes', async () => {
    process.env.COMMERCIAL_MODE = 'true';
    licenseService.loadLicenseKeyFromDb.mockResolvedValue({ licenseKey: 'key-1' });
    licenseService.validateLicenseKey.mockReturnValue({ valid: true, tier: 'pro', seats: 5, features: [] });
    await ent.getEntitlements('org');
    await ent.getEntitlements('org');
    expect(licenseService.validateLicenseKey).toHaveBeenCalledTimes(1);
    licenseService.loadLicenseKeyFromDb.mockResolvedValue({ licenseKey: 'key-2' });
    licenseService.validateLicenseKey.mockReturnValue({ valid: true, tier: 'enterprise', seats: 50, features: [] });
    expect((await ent.getEntitlements('org')).plan).toBe('enterprise');
    expect(licenseService.validateLicenseKey).toHaveBeenCalledTimes(2);
    licenseService.loadLicenseKeyFromDb.mockResolvedValue({});
  });

  it('uses the license tier and seat count, and enforces seats', async () => {
    process.env.COMMERCIAL_MODE = 'true';
    licenseService.loadLicenseFromEnv.mockReturnValue({ valid: true, tier: 'enterprise', seats: 2, licensee: 'Acme', features: [] });
    pool.query.mockResolvedValueOnce({ rows: [{ n: 2 }] });
    await expect(ent.assertSeatAvailable('org')).rejects.toMatchObject({ code: 'SEAT_LIMIT' });
    expect((await ent.getEntitlements('org')).source).toBe('license');
  });
});

describe('Stripe status mapping', () => {
  it('maps subscription states onto organizations.billing_status values', () => {
    expect(billingStatusFor({ status: 'active' })).toBe('active_paid');
    expect(billingStatusFor({ status: 'active', cancel_at_period_end: true })).toBe('canceling');
    expect(billingStatusFor({ status: 'trialing' })).toBe('trial');
    expect(billingStatusFor({ status: 'unpaid' })).toBe('canceled');
    expect(billingStatusFor({ status: 'incomplete' })).toBe('community');
  });
});
