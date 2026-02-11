const TIER_LEVELS = Object.freeze({
  free: 0,
  starter: 1,
  professional: 2,
  enterprise: 3,
  utilities: 3
});

const TIER_LIMITS = Object.freeze({
  free: {
    frameworks: 2,
    aiRequestsPerMonth: 3,
    cmdbEnabled: false,
    cmdbAssetLimit: 0,
    cmdbEnvironmentLimit: 0
  },
  starter: {
    frameworks: 5,
    aiRequestsPerMonth: 25,
    cmdbEnabled: true,
    cmdbAssetLimit: 50,
    cmdbEnvironmentLimit: 5
  },
  professional: {
    frameworks: 999,
    aiRequestsPerMonth: -1,
    cmdbEnabled: true,
    cmdbAssetLimit: -1,
    cmdbEnvironmentLimit: -1
  },
  enterprise: {
    frameworks: 999,
    aiRequestsPerMonth: -1,
    cmdbEnabled: true,
    cmdbAssetLimit: -1,
    cmdbEnvironmentLimit: -1
  },
  utilities: {
    frameworks: 999,
    aiRequestsPerMonth: -1,
    cmdbEnabled: true,
    cmdbAssetLimit: -1,
    cmdbEnvironmentLimit: -1
  }
});

const DEFAULT_TIER = 'free';
const PAID_TIERS = Object.freeze(['starter', 'professional', 'enterprise', 'utilities']);

function normalizeTier(tier) {
  const value = String(tier || '').toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(TIER_LEVELS, value)) {
    return DEFAULT_TIER;
  }
  return value;
}

function tierLevel(tier) {
  return TIER_LEVELS[normalizeTier(tier)];
}

function getTierLimits(tier) {
  return TIER_LIMITS[normalizeTier(tier)] || TIER_LIMITS[DEFAULT_TIER];
}

function getFrameworkLimit(tier) {
  return getTierLimits(tier).frameworks;
}

function getAiUsageLimit(tier) {
  return getTierLimits(tier).aiRequestsPerMonth;
}

function canUseCmdb(tier) {
  return getTierLimits(tier).cmdbEnabled;
}

function getCmdbAssetLimit(tier) {
  return getTierLimits(tier).cmdbAssetLimit;
}

function getCmdbEnvironmentLimit(tier) {
  return getTierLimits(tier).cmdbEnvironmentLimit;
}

function isTierAtLeast(currentTier, minTier) {
  return tierLevel(currentTier) >= tierLevel(minTier);
}

function isPaidTier(tier) {
  return PAID_TIERS.includes(normalizeTier(tier));
}

function parseTierList(raw, fallbackCsv) {
  const source = String(raw || fallbackCsv || '')
    .split(',')
    .map((tier) => normalizeTier(tier))
    .filter(Boolean);
  return new Set(source.length ? source : [normalizeTier(DEFAULT_TIER)]);
}

function getByokPolicy() {
  const legacyFlag = process.env.AI_LIMIT_APPLIES_TO_BYOK;
  if (typeof legacyFlag === 'string' && legacyFlag.trim().length > 0) {
    const enforce = legacyFlag.toLowerCase() === 'true';
    return {
      mode: enforce ? 'enforce_all' : 'bypass_all',
      enforceByokForTier: () => enforce
    };
  }

  const bypassTiers = parseTierList(
    process.env.AI_BYOK_BYPASS_TIERS,
    'professional,enterprise,utilities'
  );

  return {
    mode: 'tiered',
    bypassTiers: Array.from(bypassTiers),
    enforceByokForTier: (tier) => !bypassTiers.has(normalizeTier(tier))
  };
}

function shouldEnforceAiLimitForByok(tier) {
  const policy = getByokPolicy();
  return policy.enforceByokForTier(tier);
}

module.exports = {
  DEFAULT_TIER,
  TIER_LEVELS,
  TIER_LIMITS,
  normalizeTier,
  tierLevel,
  getTierLimits,
  getFrameworkLimit,
  getAiUsageLimit,
  canUseCmdb,
  getCmdbAssetLimit,
  getCmdbEnvironmentLimit,
  isTierAtLeast,
  isPaidTier,
  PAID_TIERS,
  getByokPolicy,
  shouldEnforceAiLimitForByok
};
