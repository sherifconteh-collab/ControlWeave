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
    pool.query.mockResolvedValueOnce({ rows: [{ tier: 'community', billing_status: 'community' }] }).mockResolvedValueOnce({ rows: [] });
    const r = res();
    const next = jest.fn();
    await ent.requireFeature('hipaa_sra')({ user: { organization_id: 'org' } }, r, next);
    expect(next).not.toHaveBeenCalled();
    expect(r.statusCode).toBe(402);
    expect(r.body).toEqual(expect.objectContaining({ code: 'plan_upgrade_required', required_plan: 'pro' }));
  });

  it('applies a plan change immediately (no per-organization cache)', async () => {
    process.env.COMMERCIAL_MODE = 'true';
    const orgRows = [{ tier: 'enterprise', billing_status: 'active_paid' }, { tier: 'enterprise', billing_status: 'canceled' }];
    pool.query.mockImplementation(async (sql) => (/FROM organizations/.test(sql) ? { rows: [orgRows.shift()] } : { rows: [] }));
    expect(await ent.hasFeature('org', 'scim')).toBe(true);
    expect(await ent.hasFeature('org', 'scim')).toBe(false);
    pool.query.mockReset();
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

describe('add-on modules', () => {
  const original = process.env.COMMERCIAL_MODE;
  beforeEach(() => { process.env.COMMERCIAL_MODE = 'true'; });
  afterEach(() => {
    process.env.COMMERCIAL_MODE = original;
    ent.clearCache();
    jest.clearAllMocks();
    licenseService.loadLicenseFromEnv.mockReturnValue(null);
  });

  it('keeps ERP out of every plan, Enterprise and Government included', () => {
    const { PLANS, addonFor } = require('../../src/config/plans');
    for (const plan of Object.values(PLANS)) expect(plan.features).not.toContain('erp_governance');
    expect(addonFor('erp_governance')).toBe('erp');
    expect(addonFor('scim')).toBeNull();
  });

  it('returns 402 addon_required for an Enterprise organization without the add-on', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ tier: 'enterprise', billing_status: 'active_paid' }] }).mockResolvedValueOnce({ rows: [] });
    const r = res();
    const next = jest.fn();
    await ent.requireFeature('erp_governance')({ user: { organization_id: 'org' } }, r, next);
    expect(next).not.toHaveBeenCalled();
    expect(r.statusCode).toBe(402);
    expect(r.body).toEqual(expect.objectContaining({ code: 'addon_required', required_addon: 'erp', feature: 'erp_governance' }));
  });

  it('grants the add-on on the Community plan through organization_addons', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ tier: 'community', billing_status: 'community' }] }).mockResolvedValueOnce({ rows: [{ addon: 'erp' }] });
    const e = await ent.getEntitlements('org');
    expect(e.plan).toBe('community');
    expect(e.addons).toEqual(['erp']);
    expect(e.features).toContain('erp_governance');
    expect(e.features).not.toContain('sso');
    const next = jest.fn();
    await ent.requireFeature('erp_governance')({ user: { organization_id: 'org' } }, res(), next);
    expect(next).toHaveBeenCalled();
  });

  it('grants the add-on from the license key addons claim, ignoring unknown names', async () => {
    licenseService.loadLicenseFromEnv.mockReturnValue({ valid: true, tier: 'pro', seats: -1, licensee: 'Agency', features: [], addons: ['erp', 'bogus'] });
    const e = await ent.getEntitlements('org');
    expect(e.addons).toEqual(['erp']);
    expect(e.features).toEqual(expect.arrayContaining(['sso', 'erp_governance']));
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('does not grant the add-on to an Enterprise license without the claim', async () => {
    licenseService.loadLicenseFromEnv.mockReturnValue({ valid: true, tier: 'enterprise', seats: -1, licensee: 'Acme', features: [] });
    const e = await ent.getEntitlements('org');
    expect(e.features).not.toContain('erp_governance');
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

describe('Stripe webhook add-on sync', () => {
  const { handleEvent } = require('../../src/routes/billing');
  afterEach(() => jest.clearAllMocks());

  const subscription = (keys, extra = {}) => ({
    id: 'sub_1', status: 'active', metadata: { organization_id: 'org' },
    items: { data: keys.map((k) => ({ price: { id: `price_${k}`, lookup_key: k } })) }, ...extra
  });

  it('records an add-on-only subscription without touching the plan', async () => {
    pool.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await handleEvent({ type: 'customer.subscription.updated', data: { object: subscription(['erp_annual']) } });
    const sql = pool.query.mock.calls.map((c) => c[0]);
    expect(pool.query.mock.calls.find((c) => /INSERT INTO organization_addons/.test(c[0]))[1]).toEqual(['org', 'erp', 'active', 'sub_1', null]);
    expect(sql.some((q) => /UPDATE organizations/.test(q))).toBe(false);
  });

  it('updates the plan and the add-on when one subscription carries both', async () => {
    pool.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await handleEvent({ type: 'customer.subscription.updated', data: { object: subscription(['enterprise_annual', 'erp_annual']) } });
    const orgUpdate = pool.query.mock.calls.find((c) => /UPDATE organizations/.test(c[0]));
    expect(orgUpdate[1][1]).toBe('enterprise');
  });

  it('cancels the add-on when the subscription is deleted', async () => {
    pool.query.mockResolvedValue({ rows: [], rowCount: 0 });
    await handleEvent({ type: 'customer.subscription.deleted', data: { object: subscription(['erp_monthly']) } });
    expect(pool.query.mock.calls.find((c) => /INSERT INTO organization_addons/.test(c[0]))[1][2]).toBe('canceled');
  });
});
