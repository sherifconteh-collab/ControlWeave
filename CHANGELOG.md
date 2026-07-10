# Changelog — ControlWeave

All notable changes to ControlWeave are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Maintained by:** Cowork Automation + Jaja Conteh  
> **Repo:** ControlWeave (Private)  
> **Last Updated:** 2026-03-29

---

## [4.3.0] — 2026-07-10

### Added

- **RMF Leveraged Authorizations**: RMF packages can now inherit controls and authorization posture from COTS/SaaS products, following the FedRAMP-style leveraged-authorization model. New table `rmf_leveraged_authorizations` (migration 111) links `rmf_packages` to `cots_products` with inheritance type (full/partial/hybrid), an inherited-control list, shared-responsibility notes, and expiration tracking. New route module `routes/rmfInheritance.js` provides CRUD, an eligible-products lookup, and at-risk flagging when the underlying COTS product is deprecated/retired or its authorization has lapsed.
- **Customer Responsibility Matrix (CRM) export**: generate a CRM as JSON, CSV, or PDF directly from a package's leveraged authorizations.
- **OSCAL SSP export**: export an RMF package as a NIST OSCAL 1.1.2 System Security Plan, including leveraged authorizations and per-control shared-responsibility annotations (`services/oscalService.js`).
- **Trust Center**: organizations can publish an opt-in, token-gated public page showing aggregate framework compliance and active-authorization counts (migration 112, `routes/trustCenter.js`, public page at `/trust/[token]`).
- **Classroom mode**: guided, step-by-step training scenarios (migration 113, `routes/training.js`, `dashboard/training`) with three built-in templates plus an instructor progress view.
- **Anonymized industry benchmarking**: compare framework compliance against a k-anonymity-guarded peer aggregate (minimum 5 participating organizations), with an org-level opt-out (`routes/benchmarks.js`, `dashboard/reports`).
- **Compliance-as-code CI gate**: `GET /compliance/gate` returns HTTP 200/412 based on whether framework compliance meets a threshold, for direct use in CI pipelines with a service-account token.
- **Cyber Resilience module**: BC/DR, incident-response, and ransomware-playbook plan tracking with tabletop/functional/full-scale exercise logging and RTO/RPO attainment (migration 114, `routes/cyberResilience.js`, `dashboard/resilience`). A computed Cyber Resilience Score blends plan coverage, test cadence, RTO/RPO attainment, and existing backup-log health.
- COTS products gained `authorization_status`, `authorization_impact_level`, and `external_authorization_id` fields.

### Changed

- `GET /rmf/packages`, `/rmf/packages/:id`, and `/rmf/summary` now include leveraged-authorization counts and at-risk entries.
- **LLM provider/model catalog refreshed**: `providerConfig.js`'s `PROVIDERS` and `TASK_PROFILES`, plus every other place in the codebase that independently hardcoded a copy of the same model list (routing/fallback logic in `modelRouter.js` and `keyResolution.js`, quota-downgrade paths in `multiAgentOrchestrator.js`, API-key connectivity-check pings in `orgSettings.js`/`platformAdmin.js`, and the BYOK provider-picker UI in three frontend settings pages/components), now reference current model IDs across all six providers. Groq's entire prior lineup (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `mixtral-8x7b-32768`, `gemma2-9b-it`, `deepseek-r1-distill-llama-70b`) had been fully deprecated/decommissioned upstream and is replaced with `openai/gpt-oss-120b`/`20b`, `groq/compound`, `groq/compound-mini`, and `meta-llama/llama-4-scout-17b-16e-instruct`.
- **TEVV-DB-6/7 checks made real**: the `tevv-db` job's "syntactically valid SQL" and "unclosed DO block" checks previously never failed the build regardless of what they found, due to an uninitialized `FAILED` flag; TEVV-DB-6 also only scanned `migrations/07*.sql`/`08*.sql`, missing migration 104 (the RLS bug below) entirely. Both fixed, and TEVV-DB-6's detection logic replaced: its `DO \$\$`/`END \$\$` regex relied on a POSIX-basic-regex quirk that meant it almost never matched a real dollar-quoted block, so it now counts literal `$$` token pairs instead.
- **`tevv-db` job now runs real migrations**: added a `postgres:17` service container and an actual `npm run migrate` step to the job branded "Database & Migration Integrity," which previously never touched a database — pure grep over `.sql` text.
- **`security-pipeline.yml`'s migration step un-neutered**: `run: npm run migrate || echo "Migrations skipped for CI"` swallowed any real failure unconditionally; now a migration failure actually fails the build.

### Fixed

- **Row-Level Security was silently broken**: migration `104_row_level_security.sql` used invalid `ROW SECURITY` syntax (should be `ROW LEVEL SECURITY`) and had a dollar-quoting bug that broke policy creation for `evidence`/`audit_engagements`/`controls` — found and fixed by actually executing the full migration chain against a real Postgres instance for the first time.
- **AIBOM now genuinely derived from code**: `scripts/generate-aibom.js` previously hardcoded 4 of its 6 AI providers as fabricated "service" entries with made-up model lists (e.g. `gemini-1.5-pro`, which never matched the real `providerConfig.js` models); rewritten to derive the provider/model inventory from the live `PROVIDERS` object so it can no longer drift from the actual integration.
- **CodeQL `js/missing-rate-limiting`**: added an explicit per-router rate limiter to each of the six new route files (matching the existing `trustCenter.js` pattern), for parity with the companion `ai-grc-platform` fix — every flagged route was already covered by the app-wide `apiRateLimiter` mounted on `/api/v1`, which CodeQL's cross-file analysis can't trace; this closes the detection gap and adds a real second layer of defense.
- **Per-router rate limiter ran before `authenticate`**: the six new route files applied their org-scoped rate limiter ahead of `authenticate`, so `req.user` was always unset when the limiter's key was built and every request silently fell back to a shared IP-based bucket instead of an org-scoped one. Fixed with a 3-way order — a cheap IP-based limiter first (bounds unauthenticated request volume before `authenticate`'s own DB/JWT work runs, and is what CodeQL's static analysis traces as covering the router), then `authenticate`, then the org-scoped limiter last, since it needs `req.user` for its key.
- **AIBOM listed unused-capability providers as bundled dependencies**: the AI Bill of Materials treated all six BYOK LLM providers as `components` regardless of whether they have any real, shipped code dependency. Only `claude`/`openai` have actual npm SDK dependencies; `gemini`/`grok`/`groq`/`ollama` are called over plain HTTP only if an operator configures a key, with zero shipped SDK. Moved the latter into CycloneDX's dedicated `services` array alongside the existing internal AI Copilot/Analysis service entries, and added metadata clarifying that every provider reflects supported integration surface, not per-deployment runtime usage.
- **Controls list page mislabeled `verified` controls as "Not Started"**: `getStatusBadgeClass`/`getStatusLabel` only handled `implemented`/`satisfied_via_crosswalk`/`in_progress`, falling through to a gray "Not Started" badge for `verified`, `needs_review`, and `not_applicable` — so a control an auditor had verified rendered as if untouched. The control detail page already handled `verified` correctly; brought the list page in line with it and added the missing statuses to the status filter and both inline status-edit dropdowns.
- **Compliance gate undercounted `verified` controls**: `GET /compliance/gate` only treated `implemented`/`satisfied_via_crosswalk` as compliant, omitting `verified`, which every other progress query (`frameworks.js`, `dashboard.js`, `controls.js`) already counts as compliant — could return a false 412 even when the dashboard showed the threshold met.
- **Reverted migration idempotency edits on already-numbered files**: an earlier pass added `IF NOT EXISTS` guards to `001`, `005`, `057`, `105`, `107`, `108`, `109`, but editing an already-numbered (and likely already-deployed) migration changes its stored checksum, which makes `scripts/migrate-all.js` hard-fail with "Checksum mismatch" on any existing database — blocking the deploy of this PR's real new migrations, and contradicting this repo's own "never edit a deployed migration" rule. Reverted those seven files to their original content; the RLS syntax fix in `104_row_level_security.sql` is unaffected since it fixes a genuine bug rather than being purely defensive.
- **Cyber Resilience test date silently defaulted on malformed input**: `POST /resilience/plans/:id/tests` treated an invalid `test_date` (e.g. `not-a-date`) the same as an omitted one, silently recording the test against today's date instead of rejecting the request with 400 like every other date field in this route.
- **Dependency vulnerabilities**: resolved all 27 backend + 21 frontend `npm audit` findings. `form-data`, `multer`, `ws`, `js-yaml` (backend and frontend) fixed via non-breaking `npm audit fix`; `nodemailer` bumped to `9.0.3` (breaking, limited to stricter default TLS certificate validation, which this project's SMTP usage doesn't rely on bypassing); `@sentry/node`/`@sentry/nextjs` bumped to `10.65.0` and `pm2` bumped to `7.0.3` (both breaking-flagged, verified against this codebase's minimal usage of each — basic `Sentry.init()`/`setupExpressErrorHandler()` with only `dsn`/`environment`/sample-rate options, and `pm2`'s standard `apps`/`script`/`instances`/`exec_mode` config).

---

## [3.5.0] — 2026-05-18

### Added
- **Expanded LLM model catalog** — Added Claude 4.x models (`claude-opus-4-7`, `claude-sonnet-4-6`), GPT-4.1 family (`gpt-4.1`, `gpt-4.1-mini`, `o3`, `o4-mini`), Gemini 2.0 (`gemini-2.0-flash`, `gemini-2.0-flash-lite`), and additional Groq models (`mixtral-8x7b-32768`, `gemma2-9b-it`, `deepseek-r1-distill-llama-70b`) across all provider dropdowns in the frontend and backend `providerConfig.js`.
- **BYOK-required AI access** — Platform no longer shares API keys with customer organizations. Each org must configure its own provider key. The `checkAIUsage` middleware now returns `422 NO_PROVIDER_CONFIGURED` before any LLM call is attempted when no key is found, replacing the previous silent 400 error from the LLM service.
- **AI Provider Setup modal** — Global `AiProviderSetupModal` component rendered from `DashboardLayout` covers all dashboard pages. When any AI feature is invoked without a configured key, the modal appears and highlights free providers (Google Gemini, Groq, Ollama) with direct links to obtain API keys, plus a CTA to Settings → LLM Configuration.
- **Global AI event interceptors** — Axios response interceptor in `api.ts` dispatches `ai:quota-exceeded` (429 + `upgradeRequired`) and `ai:no-provider` (422 + `NO_PROVIDER_CONFIGURED`) browser custom events; `DashboardLayout` listens and opens the appropriate modal without prop-drilling.
- **AiQuotaModal component** — Reusable modal for future quota-enforcement scenarios with "Add your own API key" and "Upgrade plan" CTAs.

### Changed
- **TASK_PROFILES defaults updated** — `reasoning`, `chat`, and `ideation` profiles now default to `claude-sonnet-4-6` (was `claude-sonnet-4-5-20250929`) and `gpt-4.1` (was `gpt-4o`); `extraction` profile defaults to `gpt-4.1-mini` (was `gpt-4o-mini`). Existing org-level saved defaults are unaffected.
- **Community tier AI quota** — Removed the platform-key-sharing monthly cap; `aiRequestsPerMonth` restored to `-1` (unlimited) for all tiers since each org now supplies its own key.
- **Assets page upgrade modal removed** — The inline "Upgrade Required" modal in `assets/page.tsx` is replaced by the global `AiProviderSetupModal`; quota-exceeded errors on the assets page are now handled by the shared modal.

---

## [3.4.0] — 2026-05-16

### Added
- Redis-backed distributed rate limiting replaces per-instance in-memory Map; falls back to in-memory when Redis is absent so single-instance deployments are unaffected.
- PostgreSQL Row-Level Security (migration 104) on `controls`, `control_implementations`, `evidence`, `audit_engagements`, `audit_logs`, and `users`; `withOrgContext(orgId, fn)` in `database.js` activates the second enforcement layer per-request without touching existing routes.
- Sentry error tracking: `@sentry/node` wired to Express via `setupExpressErrorHandler`; `logger.setSentryClient()` forwards error-level log events; `@sentry/nextjs` added to the frontend with `sentry.client.config.ts` and `sentry.server.config.ts`.
- Automated database backups via `node-cron` (`backupScheduler.js`); optional S3 upload in `db-backup.js`; activated with `BACKUP_ENABLED=true`.
- PM2 cluster mode: `ecosystem.config.js` with `instances: max`; `start:cluster` script and updated `start:railway` for Railway deployments.
- Redis response caching for dashboard: `redisCache.js` utility (`getCached`, `invalidateCached`, `invalidateCachedPattern`) with org-scoped keys; replaces single-instance in-memory cache Map in `dashboard.js`.
- CDN-friendly cache headers in `next.config.ts`: static assets (`/_next/static/*`) served with `Cache-Control: public, max-age=31536000, immutable`; HTML pages served with `no-cache`.
- Refresh token rotation on `POST /refresh`: every refresh issues a new refresh token and invalidates the previous one.
- Concurrent session limits at login: configurable via `MAX_CONCURRENT_SESSIONS` (default 10); oldest session evicted when limit is reached.
- Optional HMAC signature layer on TPRM public endpoints: vendors send `X-TPRM-Signature: sha256=<hex>` when `TPRM_HMAC_SECRET` is configured; backward compatible with token-only auth.
- `verifyIncomingWebhook(secret, signature, body)` in `webhookService.js` for verifying incoming webhook callbacks from external systems.
- Local DB-backed integration harness at `controlweave/backend/scripts/qa-local-integration.js` for exact postcondition checks across framework adoption, control implementation, notifications, audit writes, org LLM settings, and cross-org isolation.

### Changed
- Hardened legacy backend QA scripts so they assert persisted behavior and current route contracts instead of allowing ambiguous `200 or 403` outcomes.
- RBAC QA now verifies evidence upload behavior, control-write persistence, audit-log access via `/api/v1/audit/logs`, and org LLM setting persistence.
- Endpoint smoke tests now derive tier-gating expectations from the authenticated org tier rather than treating both blocked and allowed responses as passing.
- Hardened the backend migration toolchain by rejecting unsupported migration files, rejecting duplicate SQL bodies, and defaulting checksum drift plus automatic baseline-on-error to off.
- Replaced the broken configuration-management migration with a UUID-safe SQL migration and removed duplicated TPRM schema replays from fresh installs.
- Backend startup now skips license DB lookup, reminder sweeps, AI-monitoring sync, and seed jobs when database config is intentionally absent in development, and `/health` reports a fast degraded `database:not_configured` status instead of cascading connection/auth errors.
- Passkey and SSO session rows now honor the configured refresh-token lifetime instead of hardcoding seven days, and the SSO callback now returns tokens in the URL fragment so they do not leak through query-string logging or referrers.
- Platform-admin overview now requires platform-owner authentication, audit log responses decrypt stored user emails before returning them to the UI, and QA coverage now asserts passkey email lookup, org switching session rotation, and the SSO callback fragment contract.

## [2.8.10] — 2026-03-28

### Overview

This release includes 1 improvement.

### Changed
- Fix dashboard overview and auth email hydration

## [2.8.9] — 2026-03-28

### Overview

This release includes 1 improvement.

### Changed
- Add duplicate user email cleanup

## [2.8.8] — 2026-03-28

### Overview

This release includes 1 improvement.

### Changed
- Add email hash backfill script

## [2.8.7] — 2026-03-28

### Overview

This release includes 1 improvement.

### Changed
- Fix GovCloud assessment seed query

## [2.8.6] — 2026-03-28

### Overview

This release includes 1 improvement.

### Changed
- Fix demo seed account targeting

## [2.8.5] — 2026-03-28

### Overview

This release includes 1 improvement.

### Changed
- Auto-seed demo accounts on startup

## [2.8.4] — 2026-03-28

### Overview

This release includes 1 improvement.

### Changed
- Seed platform admin self-assessment data

## [2.8.3] — 2026-03-28

### Overview

This release includes 1 improvement.

### Changed
- Harden demo seed prerequisites

## [2.8.2] — 2026-03-28

### Overview

This release includes 1 improvement.

### Changed
- Fix platform admin password rotation

## [2.8.1] — 2026-03-28

### Overview

This release includes 1 new feature.

### Added
- Optimize code and enhance features

## [2.8.0] — 2026-03-27

### Added
- Backend ESLint configuration (`eslint.config.js`, flat config format) with ESLint 9.x and `globals` for Node.js environment declarations.
- `STAGING_ENVIRONMENT.md` deployment guide covering architecture, environment variables, Docker-based local staging, and promotion workflow.

### Fixed
- ESLint version corrected to 9.x flat config after Gemini code review.
- `globals` import comment clarified for editor tooling compatibility.
- Staging environment documentation table formatting corrected.

### Security
- `path-to-regexp` bumped to 0.1.13 resolving HIGH-severity ReDoS (GHSA-37ch-88jc-xwx2).
- Structured Express error handling with explicit `next(err)` propagation in `server.js`.
- Frontend `layout.tsx` updated with `viewport` export for proper mobile scaling.

## [2.7.3] — 2026-03-26

### Changed
- Restored v2.7.3 entry (originally a single-line placeholder) with full detail describing its retroactive rewrite of v2.5.0–v2.7.2 release notes to match v2.4.4 quality standard across `RELEASE_NOTES.md`, `INTERNAL_RELEASE_NOTES.md`, `controlweave/docs/RELEASE_NOTES.md`, and `CHANGELOG.md`.
- Release dates added to documentation file headings for all versions.
- Internal release metadata enriched with `Tag` and `Release branch` fields for traceability.

## [2.7.2] — 2026-03-26

### Changed
- Release-notes auto-generation now strips redundant type-prefix verbs and capitalizes 30+ GRC/tech acronyms via `clean_desc()`.
- Auto-generated overview produces grammatically correct counts with singular/plural and Oxford comma.
- Auto-generated release title derived from change categories and applied to all release-note file headings.
- Conventional commit regex synced between `release-notes.yml` and `cm-branch-naming.yml` — added `migration` and `test` types.
- American English normalization applied across workflow files (`categorised` → `categorized`).

## [2.7.1] — 2026-03-26

### Added
- TEVV-API: 4 new behavioral tests — route `require()` + `.stack` verification, auth middleware import check, `module.exports` verification, frontend `api.ts` client coverage.
- TEVV-DB: Migration file SQL keyword validation.
- TEVV-UI: 7 new page-level tests covering `ai-security`, `assets`, `plot4ai`, `organization`, `my-organizations`, `report-issue`, and all 9 CMDB sub-pages.
- TEVV-UI-39 safety-net test auto-fails CI when a new dashboard page is added without a TEVV check.

### Changed
- Removed duplicate `security-reports-export.yml` and `security-reports-stig-quarterly.yml` workflows.
- Merged `sync-wiki.yml` and `wiki-health-check.yml` into `docs-pipeline.yml` with preflight routing.

### Fixed
- `security-pipeline.yml`: CodeQL language identifier corrected (`javascript` → `javascript-typescript`); `npm install` → `npm ci`; QA report no longer hardcodes pass status.
- `codeql.yml`: Narrowed triggers to `schedule`/`workflow_dispatch` only.
- `copilot-pr-review.yml`: Removed comment-triggered fires.
- `compliance-labeler.yml`: Removed `synchronize` trigger.
- `docs-pipeline.yml`: Fixed bare `push:` trigger firing on all branches.

## [2.7.0] — 2026-03-26

### Added
- NIST AI 800-4 compliance-layer monitoring with cross-feature navigation cards across 8 dashboard pages.
- `stateAiLawsAPI` added to frontend `api.ts` closing coverage gap on 4 backend routes.
- Cross-feature card section added to `plot4ai/page.tsx`.
- `validateCategorySync()` startup guard comparing DB CHECK constraints against JS constants.

### Fixed
- AI Monitoring and AI Governance sidebar visibility corrected — wrong `isVisible` gate and permission (`settings.manage` → `ai.use`).
- Division-by-zero guard added to `coverage_percentage` calculation.
- `Promise.allSettled` used in frontend so rules/events still render when `/coverage` fails.
- Covering index `idx_ai_monitoring_rules_org_cat_coverage` added for monitoring view JOIN pattern.

## [2.6.0] — 2026-03-26

### Added
- Quantized GGUF model support for Ollama — configurable quantization levels for smaller memory footprints and faster local AI inference.

### Fixed
- Stale tier names on `/privacy` page.
- Missing `next/link` import and React type declarations in frontend components.

### Security
- `picomatch` upgraded to `2.3.2` (HIGH-severity ReDoS); `tinyglobby` updated to `4.0.4` in frontend.

## [2.5.0] — 2026-03-25

### Added
- DISA STIG 5-framework quarterly pipeline: 4 new assessment functions, CKLB export/import, 209 automated compliance checks (up from 43).
- `.cklb` file upload/import in vulnerability scanner with `not_a_finding` → `remediated` status mapping fix.
- ControlWeave self-assessment seed (`seed-controlweave-self-assessment.js`): all frameworks, 10 policies, 15 evidence artifacts, ~85% compliance.
- PR title validation in CM workflow — conventional commit format, Copilot exempt, PR-title-based type fallback.

### Fixed
- Release-notes workflow no longer creates empty entries or draft releases on every push to main.
- Release metadata restored to v2.4.4 across README badges and package versions.
- MCP localhost regex corrected to match URLs without trailing slash.
- Bash regex variables for patterns containing `)` in workflow files.

### Security
- HMAC key floor raised to 48 bytes for CNSA Suite 1.0 compliance.
- Lazy backfill now encrypts both `email` and `email_hash` columns on first login.
- `email_hash` column init guards added to `/register`, `/forgot-password`, `/accept-invite`.
- Platform admin bootstrap queries org-scoped to close cross-tenant path.
- Password policy raised to 15-character minimum across all account flows including demo accounts.
- Security report retention workflow handles missing reports directory gracefully.

## [2.4.4] — 2026-03-22

### Added
- Self-hosted update awareness via `GET /api/v1/license/update-check`, including latest-version checks against the public GitHub release feed.
- Organization-level SMTP settings and test-email endpoints (`GET/PUT /api/v1/settings/smtp`, `POST /api/v1/settings/smtp/test`) surfaced in Settings → Notifications.

### Changed
- Email delivery now resolves SMTP configuration per organization first, then falls back to environment/platform defaults when needed.
- Settings UI now surfaces self-hosted release status alongside expanded notification and SMTP controls for org admins.

### Fixed
- Framework answers now persist when users switch between frameworks mid-session.
- Frontend session handling hardened with in-memory token storage and a global error boundary for safer recovery from runtime failures.
- Self-hosted release-check and notification flows tightened across license, auth, and notification paths.

## [2.4.3] — 2026-03-20

### Changed
- Release automation now syncs root/community README badges plus backend/frontend package versions on release-note updates.
- Release-note generation on `main` now has stronger idempotency guards to skip workflow-authored commits and duplicate version headings.
- v2.4.2 release documentation was backfilled with the missing PR coverage and aligned across CHANGELOG/release-note files.

## [2.4.2] — 2026-03-20

### Added

#### AI Security Hub
- Consolidated AI security view with six GRC-native pillars: OWASP Top 10 for LLMs, NIST AI RMF alignment, EU AI Act readiness, PLOT4ai threat modeling, AI supply-chain risk, and agentic AI (AIUC-1) certification status.

#### Community Tier Expansion
- **BYOK Unlimited AI**: Community-tier organizations with their own API key now receive unlimited AI requests (`aiRequestsPerMonth: -1`).
- **Plot4AI**: Unlocked for Community tier — 138 AI threat cards now available without a Pro license.
- **Regulatory News**: Removed from `PRO_FEATURES` gate — available to all tiers.
- **AI Analysis**: All 9 AI analysis features accessible at Community tier with BYOK.

#### Crosswalk Engine Enhancements
- ISO 27001:2022 crosswalk mappings added to the engine.
- Coverage matrix API endpoint for framework overlap analysis.
- Versioned framework names for clarity in multi-framework views.

### Fixed
- Community edition license label corrected: MIT → AGPL v3.
- Broken Docker container link in root README.
- Settings/billing page broken links and incorrect Gemini model name (`gemini-2.5-pro`).
- Pricing page: Enterprise "Contact Sales" now routes to `/contact`; removed CLA gate.
- Community mirror: fixed server startup crash, missing migrations, and self-hosted install guide.
- Toast UX hardened across dashboard pages.

### Changed
- Dual READMEs consolidated into single source of truth (root `README.md`).
- All `@controlweave.com` contact emails replaced with `contehconsulting@gmail.com`.
- Canonical documentation map added; release notes, security checks, and tier marketing aligned.
- Documentation diagrams standardized on Mermaid (mermaid-js/mermaid).
- Release notes workflow now auto-triggers on push to `main` with patch version auto-increment, preventing stale badges and release notes.
- CLA and CONTRIBUTING.md added to community repo (`controlweave/`); LICENSE email casing corrected; tier labels aligned (`[free]` → `[community]`, SSO `Enterprise+` → `Pro+` in mirror allowlist).
- Public mirror: removed CLA-related files from allowlist, added defense-in-depth workflow directory stripping to prevent push failures.

### Security
- CLA workflow: corrected SHA pin to full 40-char hash (`ca4a40a7d1004f18d9960b404b97e5f30a505a08`), hardened bot allowlist from wildcard `bot*` to explicit `dependabot[bot]`, `github-actions[bot]`, `copilot[bot]`.

---

### Added

#### Multi-Organization Membership (v2.4.1)
- Users can now belong to and switch between **multiple organizations** under one account.
- New `user_organizations` junction table (migration `095`) with backfill for all existing users.
- `GET /auth/my-organizations` — list all orgs the authenticated user belongs to (includes `is_active` flag).
- `POST /auth/switch-organization/:orgId` — validates membership, updates active org, and issues new JWT tokens.
- `POST /organizations/me/new` — create a new blank organization at Community tier for the current user.
- `POST /organizations/me/clone` — create a new org pre-loaded with the current org's framework selections (template clone).
- New **My Organizations** page at `/dashboard/my-organizations` with switch, create, and template-clone UI.
- Sidebar now displays the current organization name under the user info section.
- `AuthContext.switchOrganization()` — swaps tokens and refreshes user state after a successful org switch.
- `authAPI.getMyOrganizations()` and `authAPI.switchOrganization()` added to frontend API client.
- `organizationAPI.createNew()` and `organizationAPI.cloneFromTemplate()` added to frontend API client.

#### AIUC-1 Agentic AI Certification Framework (v2.4.0)
- **`seed-aiuc1-framework.js`** — New seed script adding AIUC-1 as a supported compliance framework in ControlWeave. AIUC-1 is the first independently-audited certification standard purpose-built for agentic (autonomous) AI systems, developed by the Artificial Intelligence Underwriting Company (AIUC) with Schellman as the first accredited auditor.
- **31 controls** across six risk domains: Data & Privacy (DP-1–DP-6), Security (SEC-1–SEC-6), Safety (SAF-1–SAF-5), Reliability (REL-1–REL-5), Accountability (ACC-1–ACC-5), Societal Impact (SOC-1–SOC-5).
- **Crosswalk mappings** to NIST AI RMF 1.0, EU AI Act 2024, and ISO/IEC 42001:2023. OWASP Agentic AI Top 10 crosswalks included when that framework is pre-seeded.
- AIUC-1 added to `seed-frameworks.js` framework list with 13 core crosswalk pairs to existing AI governance frameworks.
- **AI Governance check** (`llmService.js`) updated to include `aiuc_1` alongside `eu_ai_act`, `nist_ai_rmf`, `iso_42001`, and `iso_42005`. Analysis prompt extended with AIUC-1 readiness assessment across all six domains.
- **Enterprise tier** — AIUC-1 gated at enterprise tier consistent with its use case (organizations deploying autonomous AI agents at scale).
- `npm run seed:aiuc1` — new seed script entry in `backend/package.json`.
- Landing page (`page.tsx`) updated to display AIUC-1 in the framework marquee and Enterprise pricing features list.
- Help content (`help.js`) updated to list AIUC-1 in supported frameworks and Enterprise tier features.

#### Self-Service Community License Generation & Admin Notification (v2.3.3)
- `licenseService.js`: added `generateCommunityKey(licensee, seats)` — generates a local RSA-2048 keypair, signs a community-tier JWT (perpetual, no `exp`), returns `{ licenseKey, publicKey }`. Private key is discarded after signing.
- `licenseService.js`: added `setLocalPublicKey(pem)` — stores a PEM public key in-module as fallback when `CONTROLWEAVE_LICENSE_PUBKEY` env var is not set. Used to verify self-generated keys.
- `licenseService.js`: `validateLicenseKey()` now accepts an optional `overridePubKey` parameter for self-validation during key generation.
- `licenseService.js`: `saveLicenseToDb()` now accepts an optional `localPublicKey` parameter (persists PEM to new `server_license.local_public_key` column).
- `licenseService.js`: `loadLicenseKeyFromDb()` now returns `{ licenseKey, localPublicKey }` instead of a plain string.
- Migration `097_server_license_pubkey.sql`: adds `local_public_key TEXT` column to `server_license` — stores the public key from `generate-community` so self-signed keys survive server restarts without env var changes.
- New endpoint `POST /api/v1/license/generate-community` (platform owner only): generates, activates, and persists a community license key in one step.
- New script `scripts/generate-community-license.js` (`@tier: exclude`): CLI tool to generate a community license key. Prints keys for `.env` by default; `--activate` mode writes to database directly.
- `server.js`: `ensureLicenseFromDb()` now loads `local_public_key` from DB and calls `setLocalPublicKey()` so self-generated keys validate correctly on restart.
- `server.js`: `ensureLicenseFromDb()` sends a one-time email notification to `PLATFORM_ADMIN_EMAIL` when no license is active on startup. Silent if SMTP is not configured (logs structured warning instead).

#### Community License Key Support & Self-Hosted License API (v2.3.2)
- `licenseService.js`: Added `'community'` to `VALID_TIERS` — community-tier JWTs are now accepted by `validateLicenseKey()`. Previously, community license keys were silently rejected with "Invalid license tier".
- `edition.js`: Added `community: 'community'` to `LICENSE_TIER_TO_EDITION` — startup validation (`validateEdition()`) now correctly maps a community license to the community edition.
- New route `backend/src/routes/license.js` (`@tier: community`): provides `GET /api/v1/license` (current edition + persistence status) and `POST /api/v1/license/activate` (runtime license key activation with audit log). Both endpoints added to `server.js` and the public mirror allowlist.
- Migration `096_server_license.sql`: new `server_license` table stores the activated key so it survives restarts. Users activate once via the UI — no `.env` editing required.
- `server.js`: new `ensureLicenseFromDb()` startup function loads the DB-persisted license key and restores the edition automatically on restart.
- `licenseService.js`: added `heartbeatCheck()` — optional async background ping to `LICENSE_HEARTBEAT_URL` (disabled by default). Fires-and-forgets; connectivity failures are logged as warnings and **never revoke access**. Community self-hosted works fully offline.
- `backend/src/services/licenseService.js` and `backend/migrations/096_server_license.sql` added to the public mirror allowlist.
- Frontend: `licenseAPI.getInfo()` and `licenseAPI.activate(key)` added to `src/lib/api.ts`.
- `.env.example`: updated to explain that license keys are DB-persisted automatically, and to document the optional `LICENSE_HEARTBEAT_URL`.

#### BYOK — Unlimited AI Calls for Any Tier (v2.1.2)
- Community-tier orgs with a BYOK API key now receive unlimited AI requests. `AI_BYOK_BYPASS_TIERS` default changed from `'pro,enterprise,govcloud'` → `'community,pro,enterprise,govcloud'` in `tierPolicy.js`; propagates to `checkAIUsage`, `enforceDraftAiLimit`, `enforceImportAiLimit`.
- `/ai/status` endpoint now reports `limit: 'unlimited'`, `remaining: 'unlimited'`, `byokUnlimited: true` when bypass applies and org has ≥1 provider key configured. Previously returned the numeric cap regardless of actual enforcement.

#### Contributor License Agreement (v2.1.2)
- `docs/CLA.md` — Contributor License Agreement granting ControlWeave Inc. commercial relicense rights while contributors retain copyright.
- `CONTRIBUTING.md` — updated with CLA requirement and signing instructions.
- `.github/workflows/cla.yml` — automated CLA enforcement via `contributor-assistant/github-action`; signatures stored at `signatures/version1/cla.json`.

### Fixed

#### AI Monitoring (v2.1.2)
- AI Monitoring page usage card was always rendering `0 / 0` — `AIStatus` interface used non-existent flat fields (`usedThisMonth`, `monthlyLimit`); corrected to match actual API response shape (`usage: { used, limit, remaining, byokUnlimited }`).
- BYOK users now see ∞ Unlimited with a full green progress bar and "🔑 Using your own API key — no monthly cap" label.

#### Copy / Documentation (v2.1.2)
- Settings page: "3 AI requests per month" → "10 AI requests/month (unlimited with own API key)".
- Landing page Community tier: "AI-assisted assessments (10/mo)" → "(10/mo — unlimited with own API key)".
- Settings LLM section: surfaces BYOK unlimited benefit inline.

### Security

#### CLA Workflow Hardening (v2.1.2)
- Action pinned from mutable `cla-assistant/github-action@v2.6.1` to SHA `contributor-assistant/github-action@ca4a40a7d1004f18d9960b404b97e5f30a505a08` to eliminate supply-chain risk.
- Removed bot actor exclusions from job `if` condition — previously caused missing status checks for bot PRs, which could block branch protection. Bot auto-approval delegated to action's `allowlist`.

---

### Added (prior unreleased)

#### RMF Lifecycle (NIST SP 800-37 Rev 2)
- Full RMF lifecycle dashboard with 7-step tracking: Prepare → Categorize → Select → Implement → Assess → Authorize → Monitor
- RMF packages linked to organization systems via nullable FK to `organization_systems`
- Authorization decision recording (ATO / DATO / IATT / Denial) with automatic deactivation of prior decisions
- Step transition history with audit trail (user, timestamp, notes, artifacts)
- CIA triad impact level tracking (Low / Moderate / High) per system categorization
- Sidebar entry gated on NIST 800-53, NIST 800-171, or CMMC 2.0 framework selection
- Migration 085: `rmf_packages`, `rmf_step_history`, `rmf_authorization_decisions` tables with CHECK constraints

#### AI Platform
- Multi-Agent Orchestrator — parallel agent execution with configurable timeout, consensus scoring, and structured output
- RAG Knowledge Base — document ingestion with semantic chunking, vector search, org-scoped retrieval
- Reasoning Memory — persistent chain-of-thought memory with TTL-based cache eviction and configurable cap
- Multi-Model AI Router — support for Anthropic Claude, OpenAI, Gemini, Grok, Groq, Ollama with automatic failover
- AI Copilot — org-aware conversational assistant with 25+ analysis features (gap analysis, compliance forecast, etc.)
- Per-framework LLM guardrails for BYOK configurations
- Platform fallback LLM defaults and provider model dropdowns
- AI Governance module — governance dashboard for AI risk management

#### Compliance Frameworks
- CMMC 2.0 framework module with crosswalk mappings
- HIPAA/HITECH framework module
- MAESTRO framework — 16 attack class controls for AI security
- ISO/IEC AI standards coverage: 23894, 38507, 22989, 23053, 5259, TR 24027, TR 24028, TR 24368
- OWASP Top 10:2025 + NIST AI guidance implementation
- Financial Services compliance workspace
- EU AI Act Article 17 compliance checklist enhancements

#### Security & Risk Management
- Threat Intelligence feed — real-time threat monitoring with filtering and sanitized output
- Vendor Risk / TPRM module — third-party risk management with questionnaires, SMTP notifications, AI risk assessment
- Regulatory News tracker — compliance news aggregation
- Vulnerability tracking with CVSS scoring and risk acceptance workflow
- PII data labeling and classification for evidence uploads
- Zero Trust Architecture implementation guide (NIST SP 800-207)

#### CMDB (Asset Management)
- AI Agent asset type, service accounts, environments, password vaults
- SBOM/AIBOM support for software and AI asset inventories
- CMDB import with AI-powered field mapping
- Vulnerability badges on asset cards

#### Platform & Administration
- Tier-based user seat limits and external contacts for control assignment
- Feature flags and subscription/trial control for platform admin
- Platform admin auto-provisioning on server startup
- Gov Cloud & Advisory tier with self-serve pricing
- Help Center — in-app help and documentation hub
- RBAC enhancements — role cloning, admin rights callout, `GET /roles/:roleId`
- Document review auto-close and compliance control labeling
- Auditor demo accounts with E2E stress tests
- Session timeout and secure logout with data clearing

#### CI/CD & Release Management
- CM branch naming convention enforcement via GitHub Actions (`<type>/CW-<number>/<short-desc>`)
- Release workflow — tag-triggered GitHub Release creation from CHANGELOG.md
- Docs pipeline automation — screenshots, quality checklist, auto-close
- CodeQL v4 upgrade with dedicated scanning workflow
- Gitleaks configuration for secrets detection (with false positive handling)
- Container security scan pipeline fixes
- IP hygiene CI checks for marketing copy

#### Frontend & Marketing
- SEO infrastructure — blog pages, framework landing pages, SEO components, OG image previews
- Marketing overhaul — landing pages with self-serve Stripe checkout
- Privacy policy page and footer links
- Responsive pricing grid with 1→2→3→5 column breakpoints
- CW emblem branding across app shell and auth screens
- Production-safe Redis adapter mode for real-time features

### Changed
- RMF step tracking is now observational only (not a deployment gate), consistent with NIST SP 800-37 philosophy
- Auth `/me` endpoint now returns `framework_codes` array for client-side feature gating
- Trial period updated from 7 to 14 days across all references
- Branding updated to "From Policy to Proof"
- Pro tier framework limit bumped to 20
- Dashboard sidebar reorganized with framework-gated entries (RMF Lifecycle, Auditor Workspace)
- Pricing tiers restructured: Starter / Professional / Enterprise / Utilities
- `console.error` replaced with structured logger across all backend routes

### Fixed
- Stripe billing flow — redirect after registration, checkout session creation, portal session `returnUrl` validation
- Production build failure — `useSearchParams()` missing Suspense boundary in `register/page.tsx`
- Demo login credentials — passwords updated to comply with 12-char minimum policy
- Authentication middleware — resilient to missing `feature_overrides` column, non-fatal trial check failures
- Platform admin — bypass lockout, `is_active`, org requirements, and trial checks during login
- Railway deployment — correct builders, `startCommand`, PORT configuration, standalone runtime compatibility
- Docker frontend build — bake correct `NEXT_PUBLIC_API_URL` via `.env.production`
- Pagination offset bug returning duplicate records on page 2+
- Pro tier incorrectly showing unlimited frameworks
- Menu path consistency: Settings → External Contacts
- Sidebar rail full-height with internal scroll
- CW emblem centering within branding
- Aria-current logic in Breadcrumbs and format-safe date parsing
- Vulnerability suppression — removed hardcoded MEDIUM severity filter so accepted items at any severity are hidden
- IP hygiene CI failures from marketing copy
- SARIF upload gracefully skipped when GitHub Code Scanning is not enabled
- `articles` variable renamed to `articleRequirements` for clarity in EU AI Act page
- Missing `keywords` property in `soc-2/page.tsx` metadata restored

### Security
- **12-finding security audit remediation:**
  - Permission escalation — enforced `assessments.write` / `settings.write` on 10 organization mutation routes
  - Open redirect — validated Stripe billing `returnUrl` against allowlist
  - Multer DoS — added file size (50 MB) and file count (10) limits
  - RAG error leakage — sanitized internal error messages in AI responses
  - Billing webhook disclosure — masked internal errors in Stripe webhook handler
  - Billing rate limiting — per-IP throttling on payment endpoints
  - ILIKE wildcard injection — escape `%` and `_` in user-supplied SQL LIKE patterns
  - Portal session returnUrl — restrict to configured `FRONTEND_URL`
  - Threat intelligence filtering — sanitize output before returning to client
  - Frontend `alert()` replaced with inline error messages
  - Reasoning memory cache cap — prevent unbounded memory growth
  - Multi-agent timeout — enforce configurable execution deadline
  - Model router stats cap — prevent stats object from growing without bound
- CM branch naming enforcement — regex validation on all PRs and pushes (excludes `main`, `staging`, `release/*`)
- Multi-layer edition security to prevent community bypass of Pro features
- Hardened security pipeline: removed 3 redundant workflows, consolidated into single enhanced pipeline
- Pruned 144 stale remote branches for repository hygiene

---

## [0.3.0] — 2026-02-18

### Added
- NERC CIP framework module: initial control library with 47 requirements mapped to NIST 800-53 Rev. 5
- Feature gating system: tiered access control tied to pricing plan (Starter / Professional / Enterprise)
- EU AI Act Article 17 compliance checklist: 22-point evidence collection workflow
- PostgreSQL 18 schema: `evidence_items`, `control_mappings`, `audit_events` tables
- GitHub Actions CI pipeline: lint + test on push to `main` and `develop`

### Changed
- Pricing tiers revised: $179 / $799 / $2,999 per month (previously $149 / $699 / $2,499)
- Dashboard navigation restructured: Controls → Evidence → Reports → Settings
- NIST AI RMF mapping updated to align with January 2026 NIST publication errata

### Fixed
- Evidence upload widget: file size validation now correctly rejects files > 50MB
- Control status badge: no longer shows "Unknown" when evidence count = 0

---

## [0.2.1] — 2026-02-05

### Fixed
- Database migration script: resolved foreign key constraint error on `framework_controls` table
- API route `/api/v1/controls`: corrected pagination offset bug returning duplicate records on page 2+
- Login flow: fixed redirect loop when session token expired during SSO handoff

---

## [0.2.0] — 2026-01-22

### Added
- NIST 800-53 Rev. 5 full control library: 1,007 controls with baseline overlays (Low / Moderate / High)
- Evidence ingestion pipeline: bulk upload via CSV with field mapping UI
- Audit trail: immutable log of all evidence submissions, status changes, and user actions
- User roles: Admin, ISSE, Auditor, Read-Only with RBAC enforcement at API layer
- Branding assets: ControlWeave logo, color palette (#0D1B2A / #2E75B6), favicon

### Changed
- API authentication: migrated from API key to OAuth 2.0 with JWT
- Evidence status workflow: Pending → Under Review → Accepted / Rejected (previously binary)

### Deprecated
- Legacy CSV import format (v1): will be removed in v0.4.0

### Security
- Implemented field-level encryption for PII in `user_profiles` table
- Rate limiting added to all public API endpoints: 100 req/min per IP

---

## [0.1.0] — 2026-01-05

### Added
- Initial project scaffolding: Next.js frontend, Node.js API, PostgreSQL database
- NIST AI RMF framework: Govern, Map, Measure, Manage categories with evidence placeholders
- Basic dashboard: control status overview, evidence count, completion percentage
- Authentication: email/password login with bcrypt hashing
- VS Code dev environment: ESLint, Prettier, Husky pre-commit hooks configured
- README.md: project overview, setup instructions, environment variable reference

---

## Commit Message Conventions

Cowork uses the following format for all commits:

```
<type>(<scope>): <short description>

[optional body]
[optional footer]
```

**Types:**
- `feat` — new feature
- `fix` — bug fix
- `chore` — maintenance, deps, config
- `docs` — documentation only
- `refactor` — code change with no feature/fix
- `test` — adding or updating tests
- `security` — security-related change

**CM branch naming:**
- `<type>/CW-<number>/<short-description>` — standard work branches
- `release/CW-<major>.<minor>.<patch>` — release preparation branches
- Allowed `<type>` values: `feat`, `fix`, `hotfix`, `security`, `refactor`, `migration`, `docs`, `test`, `chore`
- `<short-description>` must be lowercase, hyphenated, and 3-5 words

**Examples:**
```
feat(evidence): add bulk CSV upload with field mapping UI
fix(api): correct pagination offset on /controls endpoint
chore(db): add index on audit_events.created_at for query performance
docs(changelog): update v0.3.0 release notes
security(auth): enforce rate limiting on public API routes
```

## Release Management & Version Control

1. When a feature branch is ready to ship, add its changes directly as a new dated `## [<major>.<minor>.<patch>] — YYYY-MM-DD` section at the top of this file (below this Contributing block) — do not stage under a generic `[Unreleased]` heading first. Pick the version per the semver rule in `.claude/rules/git-workflow.md` (`feat/` → MINOR, everything else → PATCH).
2. Cut a release branch as `release/CW-<major>.<minor>.<patch>` if the release needs its own branch.
3. Create and push a git tag `v<major>.<minor>.<patch>` to trigger `.github/workflows/release.yml`.
4. `release-notes.yml` picks up the exact-matching `## [<version>]` entry on merge to `main` and republishes it as `RELEASE_NOTES.md` — if no entry with that exact version exists yet, it falls back to auto-generating one from commit history instead, so an entry written ahead of time is always preferred and should be kept accurate.

---

## How Cowork Maintains This File

After every development session, Cowork will:
1. Add a new dated `## [<version>]` section directly (not staged under `[Unreleased]`) with entries in the appropriate category
2. Suggest a conventional commit message referencing the changelog update
3. Flag any breaking changes with a `⚠️ BREAKING` label in the entry

---

*ControlWeave is proprietary software. All rights reserved — Conteh Consulting LLC.*
