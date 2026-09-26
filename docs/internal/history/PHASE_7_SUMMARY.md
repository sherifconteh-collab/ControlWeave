# Phase 7: External Integrations (Threat Intelligence, Vendor Security, Regulatory News)

Phase 7 adds three categories of external data integration: threat
intelligence feeds (NVD, CISA KEV, MITRE ATT&CK, AlienVault OTX), vendor
security posture APIs (SecurityScorecard, BitSight), and regulatory news
aggregation.

> **Note on source documents**: of the four originals,
> `PHASE_7_EXTERNAL_INTEGRATIONS_PLAN.md` was an early, superseded design
> — its service class names (`ThreatIntelligenceService`,
> `VendorPostureService`), table names
> (`threat_intelligence_matches`, `vendor_security_ratings`,
> `regulatory_news`), and API paths (`/api/v1/integrations/...`) do
> **not** match what was actually built. It also proposed `node-cron`-based
> fixed schedules and LLM-based news relevance scoring that were not
> confirmed in the current code. `PHASE_7_EXTERNAL_INTEGRATIONS.md`
> (not the "PLAN" file) is the spec that was actually followed — its
> table names, route paths, and connector list match the shipped code.
> Everything below is verified against
> `controlweave/backend/src/routes/{threatIntel,vendorSecurity,regulatoryNews}.js`,
> the corresponding `services/`, and the migrations directory.

## What was actually built

**Migrations** — the implementation-summary docs claimed migration
numbers 057-060 and, in a later revision, 061-064; **neither is
correct**. The tables actually live in:
- `065_external_threat_feeds.sql`
- `066_threat_intelligence_items.sql`
- `067_vendor_security_scores.sql`
- `068_regulatory_news.sql`

**Services** (`controlweave/backend/src/services/`):
- `threatIntelService.js` — feed CRUD, sync orchestration, `scheduleAutoSync()` (enqueues `threat_intel_sync` jobs via the job queue, not a raw cron schedule)
- `nvdService.js`, `cisaKevService.js`, `mitreService.js`, `alienVaultService.js` — per-feed fetch/normalize logic
- `vendorSecurityService.js` — SecurityScorecard (A-F) and BitSight (250-900) integration, score trend calculation
- `regulatoryNewsService.js` — RSS feed aggregation

**Routes** (mounted in `server.js`):
- `POST/GET/PATCH/DELETE /api/v1/threat-intel/*` — `routes/threatIntel.js`
- `GET/POST/DELETE /api/v1/vendor-security/*` — `routes/vendorSecurity.js`
- `GET/PATCH/POST /api/v1/regulatory-news/*` — `routes/regulatoryNews.js`

Full endpoint list (unchanged from the original spec and confirmed
present in the route files):

```
# Threat Intelligence
GET    /api/v1/threat-intel/feeds
POST   /api/v1/threat-intel/feeds
GET    /api/v1/threat-intel/feeds/:id
PATCH  /api/v1/threat-intel/feeds/:id
DELETE /api/v1/threat-intel/feeds/:id
POST   /api/v1/threat-intel/feeds/:id/sync
GET    /api/v1/threat-intel/items
GET    /api/v1/threat-intel/stats
POST   /api/v1/threat-intel/sync-all

# Vendor Security
GET    /api/v1/vendor-security/scores
GET    /api/v1/vendor-security/scores/:id
POST   /api/v1/vendor-security/scores
POST   /api/v1/vendor-security/scores/:id/refresh
POST   /api/v1/vendor-security/monitor
DELETE /api/v1/vendor-security/scores/:id
GET    /api/v1/vendor-security/trends/:domain

# Regulatory News
GET    /api/v1/regulatory-news
GET    /api/v1/regulatory-news/unread-count
GET    /api/v1/regulatory-news/:id
PATCH  /api/v1/regulatory-news/:id
POST   /api/v1/regulatory-news/refresh
POST   /api/v1/regulatory-news/mark-all-read
GET    /api/v1/regulatory-news/sources/list
```

**Dependencies added**: `axios`, `rss-parser`, `node-cron` (present in
`package.json`; the job-queue-based `scheduleAutoSync()` is what's
actually wired up for threat-intel sync, not a standalone node-cron
schedule — `node-cron` usage elsewhere in the codebase was not verified
as part of this review).

**Integration Hub**: 6 new connector templates in `integrationsHub.js`
— NIST NVD, CISA KEV, MITRE ATT&CK, AlienVault OTX (Threat Intelligence
category), SecurityScorecard, BitSight (Vendor Security category).

## Database schema (as built)

- **`external_threat_feeds`** — per-org feed config, encrypted API key, sync status/error, rate-limit tracking.
- **`threat_intelligence_items`** — normalized CVEs/KEVs/ATT&CK techniques/OTX pulses; CVSS score/vector, CWE IDs, affected products, exploit availability, due date; unique per `(organization_id, feed_id, external_id)`.
- **`vendor_security_scores`** — vendor name/domain, provider (`securityscorecard`/`bitsight`), score/grade, risk factors, trend (`improving`/`stable`/`declining`).
- **`regulatory_news_items`** — source, relevant frameworks, impact level, read/archived state; unique per `(organization_id, source, url)`.

## Access control — stale claim corrected

Both original implementation docs describe a tiered feature matrix
(Community/Starter/Professional/Enterprise) enforced via `requireTier()`,
and the route code still calls `requireTier('enterprise')` in several
places (e.g. all of `vendorSecurity.js`, most of `threatIntel.js`). Per
`.claude/rules/tier-system.md`, **`requireTier()` is a no-op in this
codebase** — every authenticated user can reach these routes today. The
markers are legacy and were not removed from Phase 7's route files, but
they no longer restrict access. `regulatoryNews.js` does not call
`requireTier()` at all. Actual access control is `authenticate` +
route-specific `requirePermission()` calls (e.g.
`organizations.write` on mutating threat-intel endpoints) plus the
rate limiters below — not tier.

## Security: rate limiting (CodeQL fix)

An initial CodeQL scan flagged 14 alerts for missing route-specific rate
limiting across the three new route files. Fixed by adding
`createRateLimiter()`-based, organization-scoped limiters to each router
(confirmed present in code):

| Route | Limit | Window |
|---|---|---|
| `threatIntel.js` (`threat-intel` label) | 200 req | 15 min |
| `vendorSecurity.js` (`vendor-security` label) | 100 req | 15 min |
| `regulatoryNews.js` (`regulatory-news` label) | 300 req | 15 min |

Each key is generated per-organization (`org:${organization_id}`,
falling back to IP). Standard rate-limit headers
(`X-RateLimit-Limit/Remaining/Reset`, `Retry-After`) are returned. This
sits on top of authentication, global `/api/v1` rate limiting,
parameterized SQL, and audit logging.

## Other security notes (carried forward, still applicable)

- API keys for feeds are encrypted at rest (AES-256-GCM per project
  convention — see `.claude/rules/security.md`), never returned in API
  responses, masked in UI to last 4 characters.
- Threat intel / vendor / news data is organization-scoped throughout.
- CVE correlation with `vulnerability_findings` was proposed via a
  `metadata` JSONB merge keyed on `vulnerability_id LIKE 'CVE-%'` — this
  was in the spec but was not independently re-verified against current
  vulnerability-route code in this review; treat as likely-but-unconfirmed.

## Planned but not confirmed built

From `PHASE_7_EXTERNAL_INTEGRATIONS_PLAN.md` (the superseded design) and
the "Future Enhancements" sections of the other docs — none of the
following were found in current route/service code and should be
treated as unbuilt:

- A separate `threat_intelligence_matches` table that auto-matches
  threats against organization assets/SBOM components.
- LLM-based regulatory news relevance scoring (`analyzeRelevance()`
  calling `callLLM`) — the shipped `regulatoryNewsService.js` does RSS
  aggregation; keyword/LLM relevance scoring was not confirmed.
- Fixed `node-cron` schedules for threat intel (6h), vendor posture
  (daily 2am), and regulatory news (4h) sync — actual sync is
  triggered via manual `POST /sync` endpoints and a job-queue-based
  `scheduleAutoSync()`, not confirmed fixed-interval cron jobs.
- UpGuard as a third vendor-posture provider (only SecurityScorecard
  and BitSight were built).
- Phase 7.1/7.2 ideas: webhook notifications for critical threats,
  custom threat feeds, ML-based threat prioritization, ISAC/ISAO
  integration, commercial feeds (Recorded Future, CrowdStrike),
  automated response playbooks.
