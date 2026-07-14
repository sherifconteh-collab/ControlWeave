# Closed PRs: Recovered/Integrated Work

Record of feature work from closed GitHub PRs that was recovered and merged
into mainline branches (rather than lost when the PRs were closed due to
merge conflicts). Kept as a reference for what shipped, which migrations/
dependencies/routes came from where, and what to check if something in one
of these areas looks unexpectedly absent.

## Closed-PR Audit (as of Feb 18, 2026)

Of 55 closed PRs reviewed:
- **41 already in main**: #4-29, #31-32, #36, #39-40, #42, #47, #50-52, #58, #60, #62, #72, #75, #77, #83
- **14 not yet merged**: #30, #33-35, #37, #64, #66, #68, #70
- **Excluded on purpose**: #30 (branch deleted, superseded by later work); #33-35, #37 (Stripe billing sub-PRs that were reverted in PR #36)
- **Recovered and merged** (this batch): #64, #66, #68, #70 — see below

### PR #64 — Phase 4 Frontend Dashboards
72 files changed, +24,931/-57.

- **AI Monitoring Dashboard** (`/dashboard/ai-monitoring`): real-time AI usage vs. tier limits, AI decision review workflow with bias flagging, usage analytics/charts.
- **Data Governance Dashboard** (`/dashboard/data-governance`): retention policy management with auto-delete, legal hold tracking/release, GDPR/HIPAA compliance monitoring.
- **Vendor Risk Dashboard** (`/dashboard/vendor-risk`): vendor contract CRUD, AI-powered risk assessments, risk matrix visualization.
- 50+ new React components (~2,268 lines TS/TSX), chart components via Recharts, Sidebar nav updated.

### PR #66 — Phase 5 Real-Time Features
26 files changed, +2,844/-19, 9 commits.

- WebSocket server (Socket.IO) with Redis pub/sub, browser push notifications + service worker, real-time event streaming, online-user tracking, 8+ event types.
- Dependencies: `ioredis@^5.4.1`, `@socket.io/redis-adapter@^8.3.0`.
- Routes: `/api/v1/realtime/*`.

### PR #68 — Phase 6 AI-Powered Analysis
72 files changed, +25,793/-46, 7 commits.

- **Predictive Risk Scoring**: 0-100 score, weighted multi-factor (controls 40%, vulnerabilities 25%, evidence 20%, assessments 15%), trend analysis, A-F grading, 30/60/90-day predictions.
- **Regulatory Impact Analysis**: impact scoring (0-100), effort estimation, affected-systems identification, timeline analysis.
- **Smart Remediation Plans**: priority scoring (0-100), timeline estimation, cost-benefit analysis, step-by-step actions.
- Migration 057 (UUID-based schema for Phase 6 tables).
- Routes: 10 endpoints under `/api/v1/phase6/*`.

### PR #70 — Phase 7 External Integrations
84 files changed, +26,738/-47, 12 commits.

- **Threat intelligence feeds**: NIST NVD CVE parser (CVSS v2/v3/v3.1), CISA KEV with exploit-maturity tracking, MITRE ATT&CK STIX parser, AlienVault OTX pulse aggregation.
- **Vendor security monitoring**: SecurityScorecard (A-F) and BitSight (250-900) integration with score normalization and automatic trend calculation.
- **Regulatory news aggregation**: RSS feed parsing, keyword extraction, framework relevance matching.
- Dependencies: `axios@^1.13.5`, `rss-parser@^3.13.0`.
- Migrations 065-068: `external_threat_feeds`, `threat_intelligence_items`, `vendor_security_scores`, `regulatory_news_items`.
- Routes: 20 endpoints — `/api/v1/threat-intel/*`, `/api/v1/vendor-security/*`, `/api/v1/regulatory-news/*` (tier-gated access at the time; tier gating has since been removed platform-wide, see `.claude/rules/tier-system.md`).

### Conflict resolution notes (PRs #64/#66/#68/#70)
When merging these branches against main:
- Doc/implementation-summary conflicts (`PHASE_4_FRONTEND_DASHBOARDS.md`, `PHASE_4_IMPLEMENTATION_COMPLETE.md`, `PHASE_6_AI_POWERED_ANALYSIS.md`, `PHASE_7_EXTERNAL_INTEGRATIONS.md`) were resolved by keeping the PR-branch ("implementation") version.
- `package.json`: all unique dependencies from both sides merged.
- `server.js`: all route `require`s and `app.use()` calls combined.
- Fixed incorrect pool destructuring (`const pool` vs. `const { pool }`) in `routes/aiMonitoring.js` and `routes/dataSovereignty.js` introduced by the merge.

Result: 254 files changed, +78,325/-169 across the four PRs; backend syntax
check passed on all 95 JS files.

## Feb 19, 2026 Batch — PRs #90, #91, #102, #103, #106, #108

Integrated into a deployment branch; several were config/CI-only and
required no code changes beyond what was already present.

### PR #91 — Stripe Billing Integration
- `stripeService.js`: lazy init with API-key validation, price resolution from lookup keys (starter/professional/enterprise/utilities), customer/subscription management, webhook signature verification, checkout session creation.
- `routes/billing.js`: `POST /api/v1/billing/checkout`, `POST /api/v1/billing/webhook`, `GET /api/v1/billing/portal`.
- `subscriptionService.js`: tier↔Stripe sync, trial lifecycle, billing status tracking.
- Migration 027: `billing_status` (`free|trial|active_paid|past_due|canceled`), `trial_status` (`none|active|expired|converted`), `paid_tier` validation.
- Migration 055: `stripe_customer_id`, `stripe_subscription_id` (both indexed).
- Test script: `test-stripe-integration.js`. Dependency: `stripe@^17.5.0`.
- Env vars: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.

Note: billing/tier gating described here predates the platform-wide tier
removal — Stripe checkout/portal routes now return `410 Gone` per
`.claude/rules/tier-system.md`. The migrations and schema history remain
accurate as a record of what shipped when.

### PR #103 — Stripe Billing Status Constraint Fix
```sql
ALTER TABLE organizations ADD CONSTRAINT organizations_billing_status_check
  CHECK (billing_status IN ('free', 'trial', 'active_paid', 'past_due', 'canceled'));
ALTER TABLE organizations ADD CONSTRAINT organizations_trial_status_check
  CHECK (trial_status IN ('none', 'active', 'expired', 'converted'));
ALTER TABLE organizations ADD CONSTRAINT organizations_paid_tier_valid_check
  CHECK (paid_tier IS NULL OR paid_tier IN ('starter', 'professional', 'enterprise', 'utilities'));
```
All constraints added with `IF NOT EXISTS` guards, plus backfill logic for
existing orgs and trial-expiry normalization.

### PR #102 — CodeQL Workflow Enablement
- Scans JavaScript and TypeScript (matrix strategy), query suites `security-extended` + `security-and-quality`, results posted to the GitHub Security tab.

### PR #106 — SARIF Upload Fix for GHAS
- `security-events: write` permission enabled; CodeQL and Trivy container-scan SARIF results both upload to the Security tab with proper category labels.

### PR #108 — CodeQL Action v3 → v4
- `.github/workflows/security-pipeline.yml`: `init`, `autobuild`, `analyze`, `upload-sarif` all bumped to `github/codeql-action/*@v4`.

### PR #90 — Railway Deployment Fixes + npm Audit Resolution
- `railway.json`: Dockerfile builder, healthcheck at `/health` (100s timeout), restart-on-failure (max 3 retries).
- `nixpacks.toml` (backend and frontend): Node 22 / npm 10 toolchain, standard install/build/start phases.
- `.gitignore` updated to allow committing `package-lock.json`.
- At merge time: backend prod lockfile — 416 packages, 0 vulnerabilities; frontend prod lockfile — 430 packages, 0 high/critical (10 moderate dev-only, non-exploitable).

### Deployment reference (for this batch)
```bash
# Migrate
cd controlweave/backend && npm run migrate

# Verify Stripe wiring (if billing enabled)
node test-stripe-integration.js

# Inspect billing constraints
psql $DATABASE_URL -c "
  SELECT conname, contype, pg_get_constraintdef(oid)
  FROM pg_constraint
  WHERE conrelid = 'organizations'::regclass
  AND (conname LIKE '%billing%' OR conname LIKE '%trial%');
"
```

Required env vars at the time: `DATABASE_URL`, `JWT_SECRET`, `PORT`,
`NODE_ENV` (backend); `STRIPE_SECRET_KEY`/`STRIPE_PUBLISHABLE_KEY`/
`STRIPE_WEBHOOK_SECRET` (backend, optional); `NEXT_PUBLIC_API_URL`,
`NEXT_PUBLIC_APP_NAME` (frontend).
