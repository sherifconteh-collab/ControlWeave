'use strict';

/**
 * Resolves what an organization is entitled to under the open-core model.
 *
 * COMMERCIAL_MODE is off by default: every organization gets every feature
 * with no seat limit, exactly as before. With COMMERCIAL_MODE=true the plan
 * comes from, in order:
 *   1. a valid self-hosted license key (LICENSE_KEY or one activated through
 *      /api/v1/license), which applies to the whole deployment; its seat count
 *      replaces the plan's user limit
 *   2. the organization's subscription: a paid (active_paid), past-due (grace),
 *      canceling (until period end) or comped billing status, or a trial that
 *      has not ended, grants its tier
 *   3. otherwise the Community plan
 */

const pool = require('../config/database');
const { PLANS, FEATURES, normalizePlan, minimumPlanFor } = require('../config/plans');
const licenseService = require('./licenseService');

// Plans are read from the organization row on every check (one primary-key
// lookup), so an upgrade, cancellation, trial expiry or platform-admin change
// applies at once on every replica. Only license signature verification is
// memoized, keyed by the license text so a new or removed key applies at once.
const LICENSE_RECHECK_MS = 60 * 1000;
const licenseMemo = new Map();

function commercialMode() {
  return String(process.env.COMMERCIAL_MODE || '').toLowerCase() === 'true';
}

function verifiedLicense(memoKey, verify) {
  const hit = licenseMemo.get(memoKey);
  if (hit && Date.now() - hit.at < LICENSE_RECHECK_MS) return hit.value;
  const result = verify();
  const value = result && result.valid ? result : null;
  if (licenseMemo.size >= 8) licenseMemo.clear(); // only replaced keys accumulate
  licenseMemo.set(memoKey, { at: Date.now(), value });
  return value;
}

async function deploymentLicense() {
  const envKey = process.env.LICENSE_KEY || process.env.CONTROLWEAVE_LICENSE_KEY || '';
  const fromEnv = verifiedLicense(`env:${envKey}`, () => licenseService.loadLicenseFromEnv());
  if (fromEnv) return fromEnv;
  const { licenseKey, localPublicKey } = await licenseService.loadLicenseKeyFromDb(pool).catch(() => ({}));
  if (!licenseKey) return null;
  return verifiedLicense(`db:${licenseKey}|${localPublicKey || ''}`, () => licenseService.validateLicenseKey(licenseKey, localPublicKey || null));
}

function subscriptionPlan(org) {
  if (!org) return { plan: 'community', source: 'default' };
  const tier = normalizePlan(org.tier) || 'community';
  // organizations.billing_status values (see its check constraint).
  const status = String(org.billing_status || '').toLowerCase();
  if (['active_paid', 'past_due', 'canceling', 'comped', 'license'].includes(status)) {
    return { plan: tier, source: status === 'comped' ? 'comped' : 'subscription' };
  }
  const trialOpen = org.trial_ends_at && new Date(org.trial_ends_at).getTime() > Date.now();
  if ((status === 'trial' || org.trial_status === 'active') && trialOpen) return { plan: tier, source: 'trial', trialEndsAt: org.trial_ends_at };
  return { plan: 'community', source: 'default' };
}

/**
 * { commercialMode, plan, label, source, features[], userLimit, activeUsers }
 */
async function getEntitlements(organizationId) {
  if (!commercialMode()) {
    return { commercialMode: false, plan: 'enterprise', label: 'Open source', source: 'open', features: Object.keys(FEATURES), userLimit: -1 };
  }
  const license = await deploymentLicense();
  let resolved;
  if (license) {
    const plan = normalizePlan(license.tier) || 'community';
    resolved = { plan, source: 'license', licensee: license.licensee, userLimit: typeof license.seats === 'number' ? license.seats : PLANS[plan].users, extraFeatures: license.features || [] };
  } else {
    const { rows } = await pool.query(
      'SELECT tier, billing_status, trial_status, trial_ends_at FROM organizations WHERE id = $1',
      [organizationId]
    );
    const sub = subscriptionPlan(rows[0]);
    resolved = { ...sub, userLimit: PLANS[sub.plan].users, extraFeatures: [] };
  }
  const plan = PLANS[resolved.plan];
  const value = {
    commercialMode: true,
    plan: resolved.plan,
    label: plan.label,
    source: resolved.source,
    licensee: resolved.licensee,
    trialEndsAt: resolved.trialEndsAt,
    features: [...new Set([...plan.features, ...resolved.extraFeatures.filter((f) => FEATURES[f])])],
    userLimit: resolved.userLimit
  };
  return value;
}

async function hasFeature(organizationId, feature) {
  const ent = await getEntitlements(organizationId);
  return ent.features.includes(feature);
}

async function activeUserCount(organizationId, executor = pool) {
  const { rows } = await executor.query('SELECT COUNT(*)::int AS n FROM users WHERE organization_id = $1 AND is_active = true', [organizationId]);
  return rows[0].n;
}

/** Throws a SeatLimitError when adding `adding` active users would exceed the plan. */
async function assertSeatAvailable(organizationId, adding = 1, executor = pool) {
  const ent = await getEntitlements(organizationId);
  if (!ent.commercialMode || ent.userLimit < 0) return;
  const active = await activeUserCount(organizationId, executor);
  if (active + adding > ent.userLimit) {
    const error = new Error(`Your ${ent.label} plan includes ${ent.userLimit} active users. Upgrade or deactivate a user to add more.`);
    error.code = 'SEAT_LIMIT';
    throw error;
  }
}

/** Forget memoized license verification (plans are never cached). */
function clearCache() {
  licenseMemo.clear();
}

/**
 * Express middleware: 402 with an upgrade hint when the organization's plan
 * lacks `feature`. A no-op unless COMMERCIAL_MODE=true.
 */
function requireFeature(feature) {
  return async (req, res, next) => {
    try {
      if (!commercialMode()) return next();
      const orgId = (req.user && req.user.organization_id) || (req.scim && req.scim.organizationId);
      if (orgId && (await hasFeature(orgId, feature))) return next();
      const required = minimumPlanFor(feature);
      return res.status(402).json({
        success: false,
        error: `${FEATURES[feature] || feature} requires the ${PLANS[required].label} plan.`,
        code: 'plan_upgrade_required',
        feature,
        required_plan: required
      });
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { commercialMode, getEntitlements, hasFeature, assertSeatAvailable, activeUserCount, requireFeature, clearCache, subscriptionPlan };
