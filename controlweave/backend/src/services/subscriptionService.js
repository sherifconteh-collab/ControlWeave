const pool = require('../config/database');
const { normalizeTier } = require('../config/tierPolicy');
const { log } = require('../utils/logger');

const VALID_PAID_TIERS = new Set(['starter', 'professional', 'enterprise', 'utilities']);
const DEFAULT_TRIAL_DAYS = 7;
const DEFAULT_TRIAL_TIER = 'utilities';

function parseTrialDays(rawValue) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TRIAL_DAYS;
  }
  return Math.min(365, Math.floor(parsed));
}

function getTrialConfig() {
  const configuredTier = normalizeTier(process.env.TRIAL_INITIAL_TIER || DEFAULT_TRIAL_TIER);
  const trialTier = configuredTier === 'free' ? DEFAULT_TRIAL_TIER : configuredTier;
  const trialDays = parseTrialDays(process.env.TRIAL_DAYS || DEFAULT_TRIAL_DAYS);
  return { trialTier, trialDays };
}

function getTrialSeedData() {
  const { trialTier, trialDays } = getTrialConfig();
  return {
    tier: trialTier,
    billingStatus: 'trial',
    trialSourceTier: trialTier,
    trialStatus: 'active',
    trialDays
  };
}

function normalizePaidTier(candidateTier) {
  const normalized = normalizeTier(candidateTier);
  if (!VALID_PAID_TIERS.has(normalized)) {
    return null;
  }
  return normalized;
}

async function expireOrganizationTrialIfNeeded({
  organizationId,
  actorUserId = null,
  db = pool
}) {
  if (!organizationId) return false;

  const updateResult = await db.query(
    `UPDATE organizations
     SET tier = 'free',
         billing_status = 'free',
         trial_status = 'expired',
         trial_expired_at = COALESCE(trial_expired_at, NOW()),
         updated_at = NOW()
     WHERE id = $1
       AND trial_status = 'active'
       AND trial_ends_at IS NOT NULL
       AND trial_ends_at <= NOW()
       AND billing_status = 'trial'
     RETURNING id, name, trial_source_tier, trial_started_at, trial_ends_at`,
    [organizationId]
  );

  if (updateResult.rows.length === 0) {
    return false;
  }

  const expired = updateResult.rows[0];
  const details = {
    from_tier: expired.trial_source_tier || null,
    to_tier: 'free',
    trial_started_at: expired.trial_started_at || null,
    trial_ended_at: expired.trial_ends_at || null,
    reason: 'trial_expired'
  };

  try {
    await db.query(
      `INSERT INTO audit_logs (organization_id, user_id, event_type, resource_type, details, success)
       VALUES ($1, $2, 'organization_trial_expired', 'organization', $3::jsonb, true)`,
      [organizationId, actorUserId, JSON.stringify(details)]
    );
  } catch (auditError) {
    log('warn', 'subscription.trial_expiry.audit_failed', {
      organizationId,
      error: { message: auditError.message, code: auditError.code }
    });
  }

  return true;
}

async function expireAllTrials({ db = pool } = {}) {
  const result = await db.query(
    `UPDATE organizations
     SET tier = 'free',
         billing_status = 'free',
         trial_status = 'expired',
         trial_expired_at = COALESCE(trial_expired_at, NOW()),
         updated_at = NOW()
     WHERE trial_status = 'active'
       AND trial_ends_at IS NOT NULL
       AND trial_ends_at <= NOW()
       AND billing_status = 'trial'
     RETURNING id, name, trial_source_tier, trial_started_at, trial_ends_at`
  );

  if (result.rowCount === 0) {
    return 0;
  }

  for (const row of result.rows) {
    const details = {
      from_tier: row.trial_source_tier || null,
      to_tier: 'free',
      trial_started_at: row.trial_started_at || null,
      trial_ended_at: row.trial_ends_at || null,
      reason: 'trial_expired'
    };
    try {
      await db.query(
        `INSERT INTO audit_logs (organization_id, user_id, event_type, resource_type, details, success)
         VALUES ($1, NULL, 'organization_trial_expired', 'organization', $2::jsonb, true)`,
        [row.id, JSON.stringify(details)]
      );
    } catch (auditError) {
      log('warn', 'subscription.trial_expiry.audit_failed', {
        organizationId: row.id,
        error: { message: auditError.message, code: auditError.code }
      });
    }
  }

  return result.rowCount;
}

module.exports = {
  getTrialConfig,
  getTrialSeedData,
  normalizePaidTier,
  expireOrganizationTrialIfNeeded,
  expireAllTrials
};

