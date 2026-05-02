# ControlWeave Community Edition — Release Notes

> This document contains release notes for features available on the **Free tier** of ControlWeave.
> Premium-only features (CMDB, Vulnerability Management, Threat Intelligence, Vendor Risk,
> Enterprise Integrations, etc.) are excluded.
>
> For the full changelog see the private repository. For upgrade information visit
> [controlweave.com/pricing](https://controlweave.com/pricing).

---

## [Unreleased]


> Changes staged but not yet released to production.

### Added
- Local DB-backed integration harness at `controlweave/backend/scripts/qa-local-integration.js` for exact postcondition checks across framework adoption, control implementation, notifications, audit writes, org LLM settings, and cross-org isolation.

### Changed
- Hardened legacy backend QA scripts so they assert persisted behavior and current route contracts instead of allowing ambiguous `200 or 403` outcomes.
- RBAC QA now verifies evidence upload behavior, control-write persistence, audit-log access via `/api/v1/audit/logs`, and org LLM setting persistence.
> 🛡️ **RBAC** is enforced at the API layer — every endpoint checks the caller's role permissions before returning data.

- Endpoint smoke tests now derive tier-gating expectations from the authenticated org tier rather than treating both blocked and allowed responses as passing.
- Hardened the backend migration toolchain by rejecting unsupported migration files, rejecting duplicate SQL bodies, and defaulting checksum drift plus automatic baseline-on-error to off.
- Backend startup now skips license DB lookup, reminder sweeps, AI-monitoring sync, and seed jobs when database config is intentionally absent in development, and `/health` reports a fast degraded `database:not_configured` status instead of cascading connection/auth errors.


---

## [2.8.10] — 2026-03-28

> **Released:** 2026-03-28


### Overview

This release includes 1 improvement.

### Changed
- Fix dashboard overview and auth email hydration


---

## [2.8.9] — 2026-03-28

> **Released:** 2026-03-28


### Overview

This release includes 1 improvement.

### Changed
- Add duplicate user email cleanup


---

## [2.8.8] — 2026-03-28

> **Released:** 2026-03-28


### Overview

This release includes 1 improvement.

### Changed
- Add email hash backfill script


---

## [2.8.7] — 2026-03-28

> **Released:** 2026-03-28


### Overview

This release includes 1 improvement.

### Changed
- Fix GovCloud assessment seed query


---

## [2.8.6] — 2026-03-28

> **Released:** 2026-03-28


### Overview

This release includes 1 improvement.

### Changed
- Fix demo seed account targeting


---

## [2.8.5] — 2026-03-28

> **Released:** 2026-03-28


### Overview

This release includes 1 improvement.

### Changed
- Auto-seed demo accounts on startup


---

## [2.8.3] — 2026-03-28

> **Released:** 2026-03-28


### Overview

This release includes 1 improvement.

### Changed
- Harden demo seed prerequisites


---

## [2.8.1] — 2026-03-28

> **Released:** 2026-03-28


### Overview

This release includes 1 new feature.

### Added
- Optimize code and enhance features


---

## [2.8.0] — 2026-03-27

> **Released:** 2026-03-27


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


---

## [2.7.3] — 2026-03-26

> **Released:** 2026-03-26


### Changed
- Restored v2.7.3 entry (originally a single-line placeholder) with full detail describing its retroactive rewrite of v2.5.0–v2.7.2 release notes to match v2.4.4 quality standard across `RELEASE_NOTES.md`, `INTERNAL_RELEASE_NOTES.md`, `controlweave/docs/RELEASE_NOTES.md`, and `CHANGELOG.md`.
- Release dates added to documentation file headings for all versions.
- Internal release metadata enriched with `Tag` and `Release branch` fields for traceability.


---

## [2.7.2] — 2026-03-26

> **Released:** 2026-03-26


### Changed
- Release-notes auto-generation now strips redundant type-prefix verbs and capitalizes 30+ GRC/tech acronyms via `clean_desc()`.
- Auto-generated overview produces grammatically correct counts with singular/plural and Oxford comma.
- Auto-generated release title derived from change categories and applied to all release-note file headings.
- Conventional commit regex synced between `release-notes.yml` and `cm-branch-naming.yml` — added `migration` and `test` types.
- American English normalization applied across workflow files (`categorised` → `categorized`).


---

## [2.7.1] — 2026-03-26

> **Released:** 2026-03-26


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


---

## [2.7.0] — 2026-03-26

> **Released:** 2026-03-26


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


---

## [2.6.0] — 2026-03-26

> **Released:** 2026-03-26


### Added
- Quantized GGUF model support for Ollama — configurable quantization levels for smaller memory footprints and faster local AI inference.

### Fixed
- Stale tier names on `/privacy` page.
- Missing `next/link` import and React type declarations in frontend components.

### Security
- `picomatch` upgraded to `2.3.2` (HIGH-severity ReDoS); `tinyglobby` updated to `4.0.4` in frontend.


---

## [2.5.0] — 2026-03-25

> **Released:** 2026-03-25


### Added
- DISA STIG 5-framework quarterly pipeline: 4 new assessment functions, CKLB export/import, 209 automated compliance checks (up from 43).
- `.cklb` file upload/import in vulnerability scanner with `not_a_finding` → `remediated` status mapping fix.
- ControlWeave self-assessment seed (`seed-controlweave-self-assessment.js`): all frameworks, 10 policies, 15 evidence artifacts, ~85% compliance.
> 📎 **Evidence** can be uploaded as files (PDF, DOCX, XLSX, images) or linked as external URLs and is versioned automatically.

- PR title validation in CM workflow — conventional commit format, Copilot exempt, PR-title-based type fallback.

### Fixed
- Release-notes workflow no longer creates empty entries or draft releases on every push to main.
- Release metadata restored to v2.4.4 across README badges and package versions.
- MCP localhost regex corrected to match URLs without trailing slash.
> 🤖 **MCP server** lets AI coding tools (Cursor, GitHub Copilot, Claude Desktop) query your compliance data as structured context.

- Bash regex variables for patterns containing `)` in workflow files.

### Security
- HMAC key floor raised to 48 bytes for CNSA Suite 1.0 compliance.
- Lazy backfill now encrypts both `email` and `email_hash` columns on first login.
- `email_hash` column init guards added to `/register`, `/forgot-password`, `/accept-invite`.
- Password policy raised to 15-character minimum across all account flows including demo accounts.
- Security report retention workflow handles missing reports directory gracefully.


---

## [2.4.4] — 2026-03-22

> **Released:** 2026-03-22


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


---

## [2.4.3] — 2026-03-20

> **Released:** 2026-03-20


### Changed
- Release automation now syncs root/community README badges plus backend/frontend package versions on release-note updates.
- Release-note generation on `main` now has stronger idempotency guards to skip workflow-authored commits and duplicate version headings.
- v2.4.2 release documentation was backfilled with the missing PR coverage and aligned across CHANGELOG/release-note files.


---

## [2.4.2] — 2026-03-20

> **Released:** 2026-03-20


### Added

#### 🔒 AI Security Hub

> ✅ **Tier availability:** Free · Starter · Professional · Enterprise

Security fixes are applied across all tiers. The following improvements shipped in this release to harden the platform against identified vulnerabilities.

- Consolidated AI security view with six GRC-native pillars: OWASP Top 10 for LLMs, NIST AI RMF alignment, EU AI Act readiness, PLOT4ai threat modeling, AI supply-chain risk, and agentic AI (AIUC-1) certification status.


> 💡 **Action required:** Update to this version to benefit from all security patches.
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
- Public mirror: removed CLA-related files from allowlist, added defense-in-depth workflow directory stripping to prevent push failures.

### Security
- CLA workflow: corrected SHA pin to full 40-char hash (`ca4a40a7d1004f18d9960b404b97e5f30a505a08`), hardened bot allowlist from wildcard `bot*` to explicit `dependabot[bot]`, `github-actions[bot]`, `copilot[bot]`.

---

### Added

#### 📋 AIUC-1 Agentic AI Certification Framework (v2.4.0)

> ✅ **Tier availability:** Free · Starter · Professional · Enterprise

ControlWeave supports **25+ compliance frameworks** out of the box. Free-tier organizations can activate up to 2 frameworks simultaneously and benefit from automatic crosswalk mappings between them.

- **`seed-aiuc1-framework.js`** — New seed script adding AIUC-1 as a supported compliance framework in ControlWeave. AIUC-1 is the first independently-audited certification standard purpose-built for agentic (autonomous) AI systems, developed by the Artificial Intelligence Underwriting Company (AIUC) with Schellman as the first accredited auditor.
- **31 controls** across six risk domains: Data & Privacy (DP-1–DP-6), Security (SEC-1–SEC-6), Safety (SAF-1–SAF-5), Reliability (REL-1–REL-5), Accountability (ACC-1–ACC-5), Societal Impact (SOC-1–SOC-5).
- **Crosswalk mappings** to NIST AI RMF 1.0, EU AI Act 2024, and ISO/IEC 42001:2023. OWASP Agentic AI Top 10 crosswalks included when that framework is pre-seeded.
> 🔗 **Crosswalk mapping** automatically surfaces overlapping controls across frameworks so you comply once and satisfy many.

- AIUC-1 added to `seed-frameworks.js` framework list with 13 core crosswalk pairs to existing AI governance frameworks.
> 🔗 **Crosswalk mapping** automatically surfaces overlapping controls across frameworks so you comply once and satisfy many.

- **AI Governance check** (`llmService.js`) updated to include `aiuc_1` alongside `eu_ai_act`, `nist_ai_rmf`, `iso_42001`, and `iso_42005`. Analysis prompt extended with AIUC-1 readiness assessment across all six domains.
- **Enterprise tier** — AIUC-1 gated at enterprise tier consistent with its use case (organizations deploying autonomous AI agents at scale).
- `npm run seed:aiuc1` — new seed script entry in `backend/package.json`.
- Landing page (`page.tsx`) updated to display AIUC-1 in the framework marquee and Enterprise pricing features list.
- Help content (`help.js`) updated to list AIUC-1 in supported frameworks and Enterprise tier features.


> 💡 **Getting started:** Go to *Frameworks* in the sidebar → click *Activate* on any framework to begin.
#### 🔔 Self-Service Community License Generation & Admin Notification (v2.3.3)

> ✅ **Tier availability:** Free · Starter · Professional · Enterprise

**Notifications** keep your team aware of control status changes, assessment completions, and approaching due dates — delivered in-app and optionally via email.

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


> 💡 **Getting started:** Click the bell icon in the top-right corner to view and manage notifications.
#### 🔌 Community License Key Support & Self-Hosted License API (v2.3.2)

> ✅ **Tier availability:** Free · Starter · Professional · Enterprise

The **REST API** follows OpenAPI 3.1 and is fully documented at `/docs/openapi.yaml`. Every endpoint requires a JWT bearer token and respects your organization's tier limits.

- `licenseService.js`: Added `'community'` to `VALID_TIERS` — community-tier JWTs are now accepted by `validateLicenseKey()`. Previously, community license keys were silently rejected with "Invalid license tier".
- `edition.js`: Added `community: 'community'` to `LICENSE_TIER_TO_EDITION` — startup validation (`validateEdition()`) now correctly maps a community license to the community edition.
- New route `backend/src/routes/license.js` (`@tier: community`): provides `GET /api/v1/license` (current edition + persistence status) and `POST /api/v1/license/activate` (runtime license key activation with audit log). Both endpoints added to `server.js` and the public mirror allowlist.
> 🗂️ **Audit trail** entries are immutable and include the acting user, timestamp, affected resource, and change delta.

- Migration `096_server_license.sql`: new `server_license` table stores the activated key so it survives restarts. Users activate once via the UI — no `.env` editing required.
- `server.js`: new `ensureLicenseFromDb()` startup function loads the DB-persisted license key and restores the edition automatically on restart.
- `licenseService.js`: added `heartbeatCheck()` — optional async background ping to `LICENSE_HEARTBEAT_URL` (disabled by default). Fires-and-forgets; connectivity failures are logged as warnings and **never revoke access**. Community self-hosted works fully offline.
- `backend/src/services/licenseService.js` and `backend/migrations/096_server_license.sql` added to the public mirror allowlist.
- Frontend: `licenseAPI.getInfo()` and `licenseAPI.activate(key)` added to `src/lib/api.ts`.
- `.env.example`: updated to explain that license keys are DB-persisted automatically, and to document the optional `LICENSE_HEARTBEAT_URL`.


> 💡 **Getting started:** See `docs/openapi.yaml` or run the local dev server and visit `http://localhost:3001/api-docs`.
### Fixed

### Security

### Added (prior unreleased)

#### 🔵 RMF Lifecycle (NIST SP 800-37 Rev 2)

> ✅ **Tier availability:** Free · Starter · Professional · Enterprise

The **RMF Lifecycle** module walks your team through the full NIST SP 800-37 Rev 2 process — from system categorization through authorization and continuous monitoring — without leaving ControlWeave.

- Full RMF lifecycle dashboard with 7-step tracking: Prepare → Categorize → Select → Implement → Assess → Authorize → Monitor
- RMF packages linked to organization systems via nullable FK to `organization_systems`
- Authorization decision recording (ATO / DATO / IATT / Denial) with automatic deactivation of prior decisions
- Step transition history with audit trail (user, timestamp, notes, artifacts)
> 🗂️ **Audit trail** entries are immutable and include the acting user, timestamp, affected resource, and change delta.

- CIA triad impact level tracking (Low / Moderate / High) per system categorization
- Sidebar entry gated on NIST 800-53, NIST 800-171, or CMMC 2.0 framework selection
- Migration 085: `rmf_packages`, `rmf_step_history`, `rmf_authorization_decisions` tables with CHECK constraints


> 💡 **Getting started:** Navigate to *RMF Lifecycle* in the sidebar (visible once you activate NIST 800-53, NIST 800-171, or CMMC 2.0).
#### 🤖 AI Platform

> ✅ **Tier availability:** Free · Starter · Professional · Enterprise

ControlWeave ships with a **built-in AI layer** that any user can activate with their own API key (BYOK). Free users receive **10 AI requests per month** across gap analysis, policy generation, crosswalk optimization, compliance forecasting, and remediation playbooks.

- AI Copilot — org-aware conversational assistant with 25+ analysis features (gap analysis, compliance forecast, etc.)
> 🎯 **Gap analysis** compares your current implementation status against a target framework baseline and lists missing controls.

- Per-framework LLM guardrails for BYOK configurations
- Platform fallback LLM defaults and provider model dropdowns
- AI Governance module — governance dashboard for AI risk management


> 💡 **Getting started:** Go to *Settings* → *LLM Configuration* → enter your API key for Anthropic, OpenAI, Gemini, Grok, Groq, or Ollama.
#### 📋 Compliance Frameworks

> ✅ **Tier availability:** Free · Starter · Professional · Enterprise

ControlWeave supports **25+ compliance frameworks** out of the box. Free-tier organizations can activate up to 2 frameworks simultaneously and benefit from automatic crosswalk mappings between them.

- CMMC 2.0 framework module with crosswalk mappings
> 🔗 **Crosswalk mapping** automatically surfaces overlapping controls across frameworks so you comply once and satisfy many.

- HIPAA/HITECH framework module
- MAESTRO framework — 16 attack class controls for AI security
- ISO/IEC AI standards coverage: 23894, 38507, 22989, 23053, 5259, TR 24027, TR 24028, TR 24368
- OWASP Top 10:2025 + NIST AI guidance implementation
- Financial Services compliance workspace
- EU AI Act Article 17 compliance checklist enhancements


> 💡 **Getting started:** Go to *Frameworks* in the sidebar → click *Activate* on any framework to begin.
#### 🔒 Security & Risk Management

> ✅ **Tier availability:** Free · Starter · Professional · Enterprise

Security fixes are applied across all tiers. The following improvements shipped in this release to harden the platform against identified vulnerabilities.

- PII data labeling and classification for evidence uploads
> 📎 **Evidence** can be uploaded as files (PDF, DOCX, XLSX, images) or linked as external URLs and is versioned automatically.

- Zero Trust Architecture implementation guide (NIST SP 800-207)


> 💡 **Action required:** Update to this version to benefit from all security patches.
#### 🚀 CI/CD & Release Management

> ✅ **Tier availability:** Free · Starter · Professional · Enterprise

**CI/CD and Release Management** improvements keep the development pipeline reliable and auditable — branch naming enforcement, automated release notes, and hardened security scanning.

- CM branch naming convention enforcement via GitHub Actions (`<type>/CW-<number>/<short-desc>`)
- Release workflow — tag-triggered GitHub Release creation from CHANGELOG.md
- Docs pipeline automation — screenshots, quality checklist, auto-close
- CodeQL v4 upgrade with dedicated scanning workflow
- Gitleaks configuration for secrets detection (with false positive handling)
- Container security scan pipeline fixes
- IP hygiene CI checks for marketing copy


> 💡 **Getting started:** See `.github/workflows/` for the full pipeline definitions.
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
- Production build failure — `useSearchParams()` missing Suspense boundary in `register/page.tsx`
- Demo login credentials — passwords updated to comply with 12-char minimum policy
- Authentication middleware — resilient to missing `feature_overrides` column, non-fatal trial check failures
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

> **Released:** 2026-02-18


### Added
- NERC CIP framework module: initial control library with 47 requirements mapped to NIST 800-53 Rev. 5
- Feature gating system: tiered access control tied to pricing plan (Starter / Professional / Enterprise)
- EU AI Act Article 17 compliance checklist: 22-point evidence collection workflow
> 📎 **Evidence** can be uploaded as files (PDF, DOCX, XLSX, images) or linked as external URLs and is versioned automatically.

- PostgreSQL 18 schema: `evidence_items`, `control_mappings`, `audit_events` tables
- GitHub Actions CI pipeline: lint + test on push to `main` and `develop`

### Changed
- Pricing tiers revised: $179 / $799 / $2,999 per month (previously $149 / $699 / $2,499)
- Dashboard navigation restructured: Controls → Evidence → Reports → Settings
> 📎 **Evidence** can be uploaded as files (PDF, DOCX, XLSX, images) or linked as external URLs and is versioned automatically.

- NIST AI RMF mapping updated to align with January 2026 NIST publication errata

### Fixed
- Evidence upload widget: file size validation now correctly rejects files > 50MB
- Control status badge: no longer shows "Unknown" when evidence count = 0



---

## [0.2.1] — 2026-02-05

> **Released:** 2026-02-05


### Fixed
- Database migration script: resolved foreign key constraint error on `framework_controls` table
- API route `/api/v1/controls`: corrected pagination offset bug returning duplicate records on page 2+



---

## [0.2.0] — 2026-01-22

> **Released:** 2026-01-22


### Added
- NIST 800-53 Rev. 5 full control library: 1,007 controls with baseline overlays (Low / Moderate / High)
- Evidence ingestion pipeline: bulk upload via CSV with field mapping UI
> 📎 **Evidence** can be uploaded as files (PDF, DOCX, XLSX, images) or linked as external URLs and is versioned automatically.

- Audit trail: immutable log of all evidence submissions, status changes, and user actions
> 🗂️ **Audit trail** entries are immutable and include the acting user, timestamp, affected resource, and change delta.

- User roles: Admin, ISSE, Auditor, Read-Only with RBAC enforcement at API layer
> 🛡️ **RBAC** is enforced at the API layer — every endpoint checks the caller's role permissions before returning data.

- Branding assets: ControlWeave logo, color palette (#0D1B2A / #2E75B6), favicon

### Changed
- API authentication: migrated from API key to OAuth 2.0 with JWT
- Evidence status workflow: Pending → Under Review → Accepted / Rejected (previously binary)
> 📎 **Evidence** can be uploaded as files (PDF, DOCX, XLSX, images) or linked as external URLs and is versioned automatically.


### Deprecated
- Legacy CSV import format (v1): will be removed in v0.4.0

### Security
- Implemented field-level encryption for PII in `user_profiles` table
- Rate limiting added to all public API endpoints: 100 req/min per IP



---

## [0.1.0] — 2026-01-05

> **Released:** 2026-01-05


### Added
- Initial project scaffolding: Next.js frontend, Node.js API, PostgreSQL database
- NIST AI RMF framework: Govern, Map, Measure, Manage categories with evidence placeholders
> 📎 **Evidence** can be uploaded as files (PDF, DOCX, XLSX, images) or linked as external URLs and is versioned automatically.

- Basic dashboard: control status overview, evidence count, completion percentage
> 📎 **Evidence** can be uploaded as files (PDF, DOCX, XLSX, images) or linked as external URLs and is versioned automatically.

- Authentication: email/password login with bcrypt hashing
- VS Code dev environment: ESLint, Prettier, Husky pre-commit hooks configured
- README.md: project overview, setup instructions, environment variable reference



---

<!-- Generated by generate-public-release-notes.js on 2026-05-02T13:34:28.925Z -->
