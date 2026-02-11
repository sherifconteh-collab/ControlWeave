// ControlWeave Community Edition — no trials, all users start on free tier.
// For the full-featured hosted product, see: https://app.controlweave.io

const { normalizeTier } = require('../config/tierPolicy');

const VALID_PAID_TIERS = new Set(['starter', 'professional', 'enterprise', 'utilities']);

function getTrialConfig() {
  return { trialTier: 'free', trialDays: 0 };
}

function getTrialSeedData() {
  return {
    tier: 'free',
    billingStatus: 'free',
    trialSourceTier: null,
    trialStatus: 'none',
    trialDays: 0
  };
}

function normalizePaidTier(candidateTier) {
  const normalized = normalizeTier(candidateTier);
  if (!VALID_PAID_TIERS.has(normalized)) {
    return null;
  }
  return normalized;
}

// No-op in Community Edition — there are no trials to expire.
async function expireOrganizationTrialIfNeeded() {
  return false;
}

// No-op in Community Edition.
async function expireAllTrials() {
  return 0;
}

module.exports = {
  getTrialConfig,
  getTrialSeedData,
  normalizePaidTier,
  expireOrganizationTrialIfNeeded,
  expireAllTrials
};

