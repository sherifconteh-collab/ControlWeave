'use strict';

/**
 * Open-core plan catalog. Only consulted when COMMERCIAL_MODE=true (see
 * services/entitlementService.js); otherwise every feature is available, which
 * keeps the open-source build and existing deployments unchanged.
 *
 * `users: -1` means unlimited. Prices are informational (the checkout uses
 * the Stripe prices with these lookup keys).
 */

const FEATURES = Object.freeze({
  sso: 'Single sign-on (SAML 2.0 and OpenID Connect)',
  connectors: 'Identity, ticketing and security connectors with evidence snapshots',
  hipaa_sra: 'HIPAA security risk assessment',
  scim: 'SCIM 2.0 user provisioning',
  sso_enforcement: 'Require SSO for all users',
  priority_support: 'Priority support and onboarding'
});

const PLANS = Object.freeze({
  community: {
    label: 'Community',
    rank: 0,
    users: 10,
    features: [],
    description: 'Core GRC: frameworks, controls, evidence, assessments, risks, POA&M, policies, reports and audit trail.'
  },
  pro: {
    label: 'Pro',
    rank: 1,
    users: 100,
    features: ['sso', 'connectors', 'hipaa_sra'],
    lookupKeys: ['pro_monthly', 'pro_annual'],
    description: 'For growing compliance teams and healthcare practices: SSO, connectors and the HIPAA risk assessment.'
  },
  enterprise: {
    label: 'Enterprise',
    rank: 2,
    users: -1,
    features: ['sso', 'connectors', 'hipaa_sra', 'scim', 'sso_enforcement', 'priority_support'],
    lookupKeys: ['enterprise_monthly', 'enterprise_annual'],
    description: 'For hospitals, enterprises and regulated industries: SCIM provisioning, enforced SSO and priority support.'
  },
  gov: {
    label: 'Government',
    rank: 3,
    users: -1,
    features: ['sso', 'connectors', 'hipaa_sra', 'scim', 'sso_enforcement', 'priority_support'],
    description: 'Enterprise plus deployment support for federal and defense environments (self-hosted, license key).'
  }
});

// Legacy tier names stored on organizations and in older license keys.
const TIER_ALIASES = Object.freeze({ govcloud: 'gov', professional: 'pro', free: 'community', open: 'enterprise' });

function normalizePlan(tier) {
  const key = String(tier || '').toLowerCase();
  const resolved = TIER_ALIASES[key] || key;
  return PLANS[resolved] ? resolved : null;
}

/** Cheapest plan that includes a feature. */
function minimumPlanFor(feature) {
  return Object.entries(PLANS)
    .sort((a, b) => a[1].rank - b[1].rank)
    .find(([, plan]) => plan.features.includes(feature))?.[0] || 'enterprise';
}

module.exports = { FEATURES, PLANS, normalizePlan, minimumPlanFor };
