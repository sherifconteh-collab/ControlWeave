> **⚠️ DEPRECATED — historical reference only.** As of v4.0, the tier-limit system was
> removed. All tier limits are unlimited for every organization, and every feature is
> available to every authenticated user. See `.claude/rules/tier-system.md` for current
> behavior. The content below describes the system as it existed before removal, kept for
> historical/audit reference only.

# Tier Policy & Replication Guidelines

## Purpose
This document helps identify which features should be replicated to the public Controlweaver repository vs. which should remain exclusive to ControlWeaver-Pro (paid tiers).

---

## Quick Decision Matrix

| Feature Type | Replicate to Public? | Example |
|-------------|---------------------|---------|
| **Database optimization** | ✅ YES | Caching, indexing, query optimization |
| **Performance improvement** | ✅ YES | Window functions, batching, connection pooling |
| **Security patch** | ✅ YES | Authentication fixes, SQL injection prevention |
| **Bug fix (core feature)** | ✅ YES | Fixing broken pagination, UI glitches |
| **Core feature enhancement** | ✅ YES | Improving existing free-tier features |
| **Premium feature** | ❌ NO | SIEM integration, SSO, advanced analytics |
| **Tier-gated capability** | ❌ NO | Features requiring professional/enterprise tier |
| **Usage limit increase** | ❌ NO | Raising AI request limits for paid tiers |
| **Enterprise integration** | ❌ NO | Splunk, Enterprise ITSM, Active Directory |

---

## Tier Structure (from tierPolicy.js)

### Community Tier (Public Repo Default)
- 2 frameworks maximum
- Unlimited AI requests (BYOK — users provide their own API keys)
- All 25+ AI analysis features, AI Threat Library, Regulatory News
- CMDB disabled
- Basic features only

### Pro Tier (Paid)
- 20 frameworks
- 50 AI requests per month
- CMDB enabled (50 assets, 5 environments)

### Pro Tier (Paid)
- Unlimited frameworks
- Unlimited AI requests
- Unlimited CMDB

### Enterprise Tier (Paid)
- Everything in Professional
- Plus: SSO, SIEM, advanced integrations
- Premium support

---

## How to Identify Paid Features in Code

### 1. Check for Tier Policy Imports
```javascript
// ❌ Likely paid-only if checking tier
const { isPaidTier, isTierAtLeast } = require('../config/tierPolicy');

if (isPaidTier(tier)) {
  // This feature is behind paywall
}

if (isTierAtLeast(tier, 'enterprise')) {
  // Enterprise-only feature
}
```

### 2. Look for Feature Gates
```javascript
// ❌ This is tier-restricted
if (!canUseCmdb(tier)) {
  return res.status(403).json({ 
    error: 'CMDB requires Pro tier or higher' 
  });
}

// ❌ This limits based on tier
const limit = getTierLimits(tier).frameworks;
if (frameworkCount > limit) {
  return res.status(403).json({
    error: 'Framework limit reached',
    upgradeRequired: true
  });
}
```

### 3. Check Route/Endpoint Protection
```javascript
// ❌ Paid-only routes
router.get('/siem/events', requireTier('enterprise'), ...);
router.post('/saml/login', requireTier('enterprise'), ...);

// ✅ Core routes (maybe usage-limited but available to all)
router.get('/frameworks', authenticate, ...);
router.post('/ai/chat', authenticate, checkAiLimit, ...);
```

### 4. Look for "Upgrade" Messaging
```javascript
// ❌ Indicates paid feature
return res.json({
  error: 'Feature not available',
  message: 'Upgrade to Professional for advanced analytics',
  upgradeRequired: true
});
```

---

## Examples from Current Codebase

### ✅ REPLICATE - Core Optimizations

**Organization Context Caching:**
```javascript
// File: orgContextService.js
// This is a performance optimization for existing feature
// AI context is available to all tiers (just usage-limited)
const cached = contextCache.get(cacheKey);
```

**API Key Caching:**
```javascript
// File: llmService.js
// All tiers can set API keys, this just makes it faster
async function getAllOrgApiKeys(organizationId) {
  // Batched query - performance improvement
}
```

**Window Function Pagination:**
```javascript
// File: ai.js
// Database optimization - doesn't enable new features
WITH ordered_decisions AS (
  SELECT *, ROW_NUMBER() OVER(...) as row_num
  FROM ai_decision_log
)
```

### ❌ DO NOT REPLICATE - Paid Features

**SIEM Integration (hypothetical example):**
```javascript
// File: siemService.js
// Enterprise-only feature
router.post('/siem/configure', requireTier('enterprise'), async (req, res) => {
  // Configure Splunk integration
});
```

**SSO Authentication (hypothetical example):**
```javascript
// File: ssoService.js
// Enterprise-only feature
if (!isTierAtLeast(tier, 'enterprise')) {
  return res.status(403).json({
    error: 'SSO requires Enterprise tier'
  });
}
```

**Advanced Analytics (hypothetical example):**
```javascript
// File: analytics.js
// Professional+ feature
if (!isTierAtLeast(tier, 'professional')) {
  return res.status(403).json({
    error: 'Advanced analytics requires Pro tier or higher',
    upgradeRequired: true
  });
}
```

---

## Special Cases

### Usage Limits vs Feature Gates

**Usage Limits** (✅ Replicate the code, free tier just has lower limits):
```javascript
// This code is fine to replicate
const limit = getAiUsageLimit(tier); // free: 10, paid: unlimited
if (usageCount >= limit) {
  return res.status(429).json({ error: 'Rate limit exceeded' });
}
```

**Feature Gates** (❌ Do NOT replicate):
```javascript
// This blocks free users entirely - don't replicate
if (!isPaidTier(tier)) {
  return res.status(403).json({ 
    error: 'This feature requires a paid subscription' 
  });
}
```

### Shared Infrastructure

Database migrations, connection pooling, authentication middleware - **always replicate** these unless they're specifically for a paid-only feature.

---

## Replication Checklist for Each PR

Before replicating any PR to public repo:

- [ ] Review all modified files
- [ ] Check for `tierPolicy` imports
- [ ] Search for `isPaidTier`, `isTierAtLeast`, `requireTier`
- [ ] Look for "upgrade", "premium", "enterprise" in strings
- [ ] Verify features work with free tier defaults
- [ ] Test with tier='free' in local environment
- [ ] Document any features NOT replicated
- [ ] Update REPLICATION_CHECKLIST.md with decision

---

## When in Doubt

**Ask these questions:**

1. ❓ Does this enable a NEW capability that free users don't have?
   - YES → Probably don't replicate
   - NO → Probably safe to replicate

2. ❓ Does this optimize/fix an EXISTING feature?
   - YES → Replicate
   - NO → Check tier restrictions

3. ❓ Would a free-tier user benefit from this change?
   - YES → Replicate
   - NO → Don't replicate

4. ❓ Is there messaging about "upgrade required"?
   - YES → Don't replicate
   - NO → Probably safe to replicate

**If still unsure:** Document the feature and ask for clarification before replicating.

---

## Maintaining Both Repositories

### Public Controlweaver (Open Source)
- Core features
- Community tier defaults
- Performance optimizations
- Security patches
- Bug fixes

### ControlWeaver-Pro (Private/Paid)
- Everything from public repo
- PLUS paid-tier exclusive features
- PLUS usage limit increases
- PLUS premium integrations
- PLUS enterprise capabilities

### Development Flow
1. Develop new feature in ControlWeaver-Pro
2. Determine if core or paid-only
3. If core → replicate to public
4. If paid → document in Pro changelog
5. Keep security/bugs synchronized

---

## Version Alignment

Both repos should maintain:
- ✅ Same core version numbers
- ✅ Same database schema (for core tables)
- ✅ Same API structure (for core endpoints)
- ✅ Same dependencies (for core features)

But can differ on:
- 🔒 Premium features (Pro only)
- 🔒 Enterprise integrations (Pro only)
- 🔒 Tier enforcement logic (Pro stricter)

---

**Last Updated:** 2026-02-13
**Policy Owner:** Development Team
**Review Frequency:** Every major release
