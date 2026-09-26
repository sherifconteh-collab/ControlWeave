// @tier: community
'use strict';

/**
 * Billing and plan entitlements.
 *
 * With COMMERCIAL_MODE unset (the default, and the open-source build) every
 * endpoint answers as before: everything is free and nothing is charged.
 * With COMMERCIAL_MODE=true and Stripe configured, organizations subscribe
 * through Stripe Checkout, manage the subscription in the Stripe customer
 * portal, and the signed webhook keeps organizations.tier / billing_status in
 * sync (see services/entitlementService.js for how plans are resolved).
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const pool = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const auditService = require('../services/auditService');
const stripeService = require('../services/stripeService');
const entitlements = require('../services/entitlementService');
const { PLANS, FEATURES, ADDONS, normalizePlan } = require('../config/plans');
const { log, serializeError } = require('../utils/logger');

router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
const OPEN_SOURCE_RESPONSE = {
  tier: 'open',
  billing_status: 'open_source',
  billing_enabled: false,
  message: 'ControlWeaver is open source — no subscription required.'
};

function billingEnabled() {
  return entitlements.commercialMode() && stripeService.isStripeConfigured();
}

function notAvailable(res) {
  return res.status(410).json({ success: false, error: 'Billing is not enabled on this deployment.' });
}

router.get('/config', authenticate, (_req, res) => {
  res.json({
    success: true,
    data: {
      stripe_publishable_key: billingEnabled() ? process.env.STRIPE_PUBLISHABLE_KEY || null : null,
      billing_enabled: billingEnabled(),
      commercial_mode: entitlements.commercialMode()
    }
  });
});

// GET /billing/entitlements -- current plan, features and seat usage.
router.get('/entitlements', authenticate, async (req, res) => {
  try {
    const ent = await entitlements.getEntitlements(req.user.organization_id);
    const activeUsers = await entitlements.activeUserCount(req.user.organization_id);
    res.json({
      success: true,
      data: {
        ...ent,
        activeUsers,
        catalog: Object.entries(PLANS).map(([id, plan]) => ({ id, label: plan.label, users: plan.users, features: plan.features, description: plan.description })),
        addonCatalog: Object.entries(ADDONS).map(([id, addon]) => ({ id, label: addon.label, features: addon.features, description: addon.description })),
        featureLabels: FEATURES
      }
    });
  } catch (error) {
    log('error', 'billing.entitlements_failed', { error: serializeError(error) });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/subscription', authenticate, async (req, res) => {
  if (!entitlements.commercialMode()) return res.json({ success: true, data: OPEN_SOURCE_RESPONSE });
  try {
    const { rows } = await pool.query(
      'SELECT tier, billing_status, trial_status, trial_ends_at, stripe_customer_id IS NOT NULL AS has_customer FROM organizations WHERE id = $1',
      [req.user.organization_id]
    );
    const ent = await entitlements.getEntitlements(req.user.organization_id);
    res.json({ success: true, data: { ...rows[0], plan: ent.plan, plan_source: ent.source, billing_enabled: billingEnabled() } });
  } catch (error) {
    log('error', 'billing.subscription_failed', { error: serializeError(error) });
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/** Resolve a checkout request body to a Stripe lookup key, or an error message. */
function checkoutLookupKey(body) {
  const fromKey = typeof body.lookupKey === 'string' ? body.lookupKey.split('_') : [];
  const interval = (body.interval || fromKey[1]) === 'annual' ? 'annual' : 'monthly';
  const addon = String(body.addon || (ADDONS[fromKey[0]] ? fromKey[0] : '')).toLowerCase();
  if (addon) {
    const lookupKey = `${addon}_${interval}`;
    return ADDONS[addon] && stripeService.addonFromLookupKey(lookupKey) === addon
      ? { lookupKey, addon }
      : { error: `Unknown add-on. Available: ${Object.keys(ADDONS).join(', ')}` };
  }
  const plan = normalizePlan(body.plan || fromKey[0]);
  const lookupKey = `${plan}_${interval}`;
  return plan && stripeService.isValidLookupKey(lookupKey) ? { lookupKey } : { error: 'Choose the Pro or Enterprise plan' };
}

// POST /billing/checkout { plan: 'pro' | 'enterprise' } or { addon: 'erp' }, with
// interval 'monthly' | 'annual'; or { lookupKey }. An add-on is its own
// subscription, independent of the plan.
router.post('/checkout', authenticate, requirePermission('settings.manage'), async (req, res) => {
  if (!billingEnabled()) return notAvailable(res);
  try {
    const { lookupKey, addon, error } = checkoutLookupKey(req.body || {});
    if (error) return res.status(400).json({ success: false, error });
    if (addon) {
      const { rows: held } = await pool.query(
        `SELECT 1 FROM organization_addons WHERE organization_id = $1 AND addon = $2 AND source = 'subscription'
            AND status IN ('active', 'trial', 'past_due', 'canceling')`,
        [req.user.organization_id, addon]
      );
      if (held.length) return res.status(409).json({ success: false, error: `${ADDONS[addon].label} is already on your subscription. Manage it from Manage billing.` });
    }
    const { rows } = await pool.query('SELECT stripe_customer_id, trial_ends_at FROM organizations WHERE id = $1', [req.user.organization_id]);
    const session = await stripeService.createCheckoutSession({
      orgId: req.user.organization_id,
      orgEmail: req.user.email,
      stripeCustomerId: rows[0] && rows[0].stripe_customer_id,
      lookupKey,
      trialEndsAt: rows[0] && rows[0].trial_ends_at,
      successUrl: `${FRONTEND_URL}/dashboard/settings/plan?checkout=success`,
      cancelUrl: `${FRONTEND_URL}/dashboard/settings/plan?checkout=cancelled`
    });
    await auditService.logFromRequest(req, { eventType: 'billing.checkout_started', resourceType: 'organization', resourceId: req.user.organization_id, details: { lookupKey } });
    res.json({ success: true, data: session });
  } catch (error) {
    log('error', 'billing.checkout_failed', { error: serializeError(error) });
    res.status(502).json({ success: false, error: 'Could not start checkout. Try again shortly.' });
  }
});

router.post('/portal', authenticate, requirePermission('settings.manage'), async (req, res) => {
  if (!billingEnabled()) return notAvailable(res);
  try {
    const { rows } = await pool.query('SELECT stripe_customer_id FROM organizations WHERE id = $1', [req.user.organization_id]);
    if (!rows[0] || !rows[0].stripe_customer_id) return res.status(409).json({ success: false, error: 'No subscription yet. Choose a plan first.' });
    const session = await stripeService.createBillingPortalSession({
      stripeCustomerId: rows[0].stripe_customer_id,
      returnUrl: `${FRONTEND_URL}/dashboard/settings/plan`
    });
    res.json({ success: true, data: session });
  } catch (error) {
    log('error', 'billing.portal_failed', { error: serializeError(error) });
    res.status(502).json({ success: false, error: 'Could not open the billing portal.' });
  }
});

// Plan changes and cancellation happen in the Stripe customer portal.
for (const path of ['/cancel', '/change-plan', '/downgrade-to-free', '/mobile-upgrade']) {
  router.post(path, authenticate, (_req, res) => {
    if (!entitlements.commercialMode()) return res.json({ success: true, message: 'All features are free — nothing to change.' });
    return res.status(410).json({ success: false, error: 'Change or cancel your plan from Manage billing (Stripe customer portal).' });
  });
}

router.post('/activate-license', authenticate, requirePermission('settings.manage'), (_req, res) => {
  res.json({ success: true, message: 'Activate self-hosted license keys under Settings → License (POST /api/v1/license/activate).' });
});

// organizations.billing_status -> organization_addons.status for add-on items.
const ADDON_STATUS = { active_paid: 'active', canceling: 'canceling', trial: 'trial', past_due: 'past_due' };

/**
 * Sync the add-on items on a subscription into organization_addons. Add-ons
 * that were on this subscription but no longer are are canceled. A
 * platform-granted (comped) add-on is only replaced by a subscription that
 * grants it, never canceled by one.
 */
async function applyAddons(orgId, subscription, addons, billingStatus) {
  const status = ADDON_STATUS[billingStatus] || 'canceled';
  const trialEndsAt = status === 'trial' && subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;
  for (const addon of addons) {
    await pool.query(
      `INSERT INTO organization_addons (organization_id, addon, status, source, stripe_subscription_id, trial_ends_at)
       VALUES ($1, $2, $3, 'subscription', $4, $5)
       ON CONFLICT (organization_id, addon) DO UPDATE
         SET status = EXCLUDED.status, source = 'subscription', stripe_subscription_id = EXCLUDED.stripe_subscription_id,
             trial_ends_at = EXCLUDED.trial_ends_at, expires_at = NULL, updated_at = NOW()
       WHERE organization_addons.source = 'subscription' OR EXCLUDED.status <> 'canceled'`,
      [orgId, addon, status, subscription.id, trialEndsAt]
    );
  }
  await pool.query(
    `UPDATE organization_addons SET status = 'canceled', updated_at = NOW()
      WHERE organization_id = $1 AND stripe_subscription_id = $2 AND source = 'subscription' AND NOT (addon = ANY($3::text[]))`,
    [orgId, subscription.id, addons]
  );
}

// Stripe subscription status -> organizations.billing_status (whose check
// constraint allows community, trial, active_paid, past_due, canceling,
// canceled, comped, license).
function billingStatusFor(subscription) {
  switch (subscription.status) {
    case 'active': return subscription.cancel_at_period_end ? 'canceling' : 'active_paid';
    case 'trialing': return 'trial';
    case 'past_due': return 'past_due';
    case 'incomplete': return 'community';
    default: return 'canceled';
  }
}

async function applySubscription(subscription) {
  const orgId = subscription.metadata && subscription.metadata.organization_id;
  if (!orgId) return null;
  const lookupKeys = await stripeService.getLookupKeysFromSubscription(subscription);
  const status = billingStatusFor(subscription);
  const addons = [...new Set(lookupKeys.map(stripeService.addonFromLookupKey).filter(Boolean))];
  await applyAddons(orgId, subscription, addons, status);
  const planKey = lookupKeys.find((key) => stripeService.tierFromLookupKey(key));
  // A subscription that only carries add-ons leaves the plan alone.
  if (!planKey && addons.length) return orgId;
  const paidTier = stripeService.tierFromLookupKey(planKey);
  const tier = status === 'canceled' || status === 'community' ? 'community' : paidTier;
  await pool.query(
    `UPDATE organizations
        SET tier = COALESCE($2, tier), paid_tier = COALESCE($6, paid_tier), billing_status = $3,
            stripe_subscription_id = $4, stripe_customer_id = COALESCE($5, stripe_customer_id), updated_at = NOW()
      WHERE id = $1`,
    [orgId, tier, status, subscription.id, typeof subscription.customer === 'string' ? subscription.customer : null, paidTier]
  );
  return orgId;
}

async function handleEvent(event) {
  const object = event.data && event.data.object;
  if (event.type === 'checkout.session.completed' && object.mode === 'subscription') {
    const orgId = object.metadata && object.metadata.organization_id;
    if (orgId) {
      // The subscription id is recorded by applySubscription: on the
      // organization for a plan, on organization_addons for an add-on.
      await pool.query('UPDATE organizations SET stripe_customer_id = COALESCE($2, stripe_customer_id) WHERE id = $1', [orgId, object.customer || null]);
      if (object.subscription) await applySubscription(await stripeService.getSubscription(object.subscription));
    }
    return orgId || null;
  }
  if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
    return applySubscription(event.type === 'customer.subscription.deleted' ? { ...object, status: 'canceled' } : object);
  }
  return null;
}

// POST /billing/webhook -- raw body (mounted with express.raw in server.js).
router.post('/webhook', async (req, res) => {
  if (!billingEnabled()) return res.json({ received: true });
  let event;
  try {
    event = stripeService.constructWebhookEvent(req.body, req.headers['stripe-signature']);
  } catch (error) {
    log('warn', 'billing.webhook_signature_invalid', { detail: error.message });
    return res.status(400).json({ error: 'Invalid signature' });
  }
  try {
    const claim = await pool.query(
      'INSERT INTO stripe_webhook_events (event_id, event_type) VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING RETURNING event_id',
      [event.id, event.type]
    );
    if (!claim.rows.length) return res.json({ received: true, duplicate: true });
    const orgId = await handleEvent(event);
    if (orgId) {
      await pool.query('UPDATE stripe_webhook_events SET organization_id = $2 WHERE event_id = $1', [event.id, orgId]);
      entitlements.clearCache(orgId);
      await auditService.createAuditLog({
        organizationId: orgId, userId: null, eventType: 'billing.subscription_synced', resourceType: 'organization',
        resourceId: orgId, details: { stripe_event: event.type, stripe_event_id: event.id }, success: true
      }).catch(() => {});
    }
    return res.json({ received: true });
  } catch (error) {
    // Let Stripe retry: release the claim so the retry is processed.
    await pool.query('DELETE FROM stripe_webhook_events WHERE event_id = $1', [event.id]).catch(() => {});
    log('error', 'billing.webhook_failed', { error: serializeError(error), type: event.type });
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
module.exports.handleEvent = handleEvent;
module.exports.billingStatusFor = billingStatusFor;
