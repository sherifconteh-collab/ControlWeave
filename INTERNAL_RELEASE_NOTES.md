# ControlWeave Internal Release Notes

> **⚠️ INTERNAL — PRIVATE REPOSITORY ONLY**  
> This document covers **all tiers** (Free through Utilities) and is **not** mirrored to the
> public ControlWeave repository. It is generated automatically from `CHANGELOG.md` by
> `.github/scripts/generate-internal-release-notes.js` on every release.
>
> For public-facing (community-tier only) release notes see `PUBLIC_RELEASE_NOTES.md` (generated
> during mirror runs) or the GitHub Release page.

## CM Release Management Reference

| Item | Convention |
|------|-----------|
| Branch format | `<type>/CW-<number>/<short-description>` |
| Release branch | `release/CW-<number>/<version>` or `release/<version>` |
| Tag format | `v<major>.<minor>.<patch>` |
| Commit format | `<type>(<scope>): <description>` |
| Merge into | `staging` → `main` |
| Notes commit | `docs(release): generate internal release notes for v<ver> [skip ci]` |

---

## v4.3.0 — 2026-07-10

> | Field | Value |
> |-------|-------|
> | **Version** | `4.3.0` |
> | **Release date** | 2026-07-10 |
> | **Tag** | `v4.3.0` |
> | **Release branch** | `release/4.3.0` |
> | **Built from** | `0cb7bebe` |
> | **Ref** | `refs/heads/main` |

### ⚠️ Breaking Changes

> **Action required** — review the migration steps below before deploying.

- **Dependency vulnerabilities**: resolved all 27 backend + 21 frontend `npm audit` findings. `form-data`, `multer`, `ws`, `js-yaml` (backend and frontend) fixed via non-breaking `npm audit fix`; `nodemailer` bumped to `9.0.3` (breaking, limited to stricter default TLS certificate validation, which this project's SMTP usage doesn't rely on bypassing); `@sentry/node`/`@sentry/nextjs` bumped to `10.65.0` and `pm2` bumped to `7.0.3` (both breaking-flagged, verified against this codebase's minimal usage of each — basic `Sentry.init()`/`setupExpressErrorHandler()` with only `dsn`/`environment`/sample-rate options, and `pm2`'s standard `apps`/`script`/`instances`/`exec_mode` config).


### Added

- **RMF Leveraged Authorizations**: RMF packages can now inherit controls and authorization posture from COTS/SaaS products, following the FedRAMP-style leveraged-authorization model. New table `rmf_leveraged_authorizations` (migration 111) links `rmf_packages` to `cots_products` with inheritance type (full/partial/hybrid), an inherited-control list, shared-responsibility notes, and expiration tracking. New route module `routes/rmfInheritance.js` provides CRUD, an eligible-products lookup, and at-risk flagging when the underlying COTS product is deprecated/retired or its authorization has lapsed.  <!-- `📦 DB migration required` -->
- **Customer Responsibility Matrix (CRM) export**: generate a CRM as JSON, CSV, or PDF directly from a package's leveraged authorizations.
- **OSCAL SSP export**: export an RMF package as a NIST OSCAL 1.1.2 System Security Plan, including leveraged authorizations and per-control shared-responsibility annotations (`services/oscalService.js`).
- **Trust Center**: organizations can publish an opt-in, token-gated public page showing aggregate framework compliance and active-authorization counts (migration 112, `routes/trustCenter.js`, public page at `/trust/[token]`).  <!-- `📦 DB migration required` -->
- **Classroom mode**: guided, step-by-step training scenarios (migration 113, `routes/training.js`, `dashboard/training`) with three built-in templates plus an instructor progress view.  <!-- `📦 DB migration required` -->
- **Anonymized industry benchmarking**: compare framework compliance against a k-anonymity-guarded peer aggregate (minimum 5 participating organizations), with an org-level opt-out (`routes/benchmarks.js`, `dashboard/reports`).
- **Compliance-as-code CI gate**: `GET /compliance/gate` returns HTTP 200/412 based on whether framework compliance meets a threshold, for direct use in CI pipelines with a service-account token.
- **Cyber Resilience module**: BC/DR, incident-response, and ransomware-playbook plan tracking with tabletop/functional/full-scale exercise logging and RTO/RPO attainment (migration 114, `routes/cyberResilience.js`, `dashboard/resilience`). A computed Cyber Resilience Score blends plan coverage, test cadence, RTO/RPO attainment, and existing backup-log health.  <!-- `📦 DB migration required` -->
- COTS products gained `authorization_status`, `authorization_impact_level`, and `external_authorization_id` fields.

### Changed

- `GET /rmf/packages`, `/rmf/packages/:id`, and `/rmf/summary` now include leveraged-authorization counts and at-risk entries.
- **LLM provider/model catalog refreshed**: `providerConfig.js`'s `PROVIDERS` and `TASK_PROFILES`, plus every other place in the codebase that independently hardcoded a copy of the same model list (routing/fallback logic in `modelRouter.js` and `keyResolution.js`, quota-downgrade paths in `multiAgentOrchestrator.js`, API-key connectivity-check pings in `orgSettings.js`/`platformAdmin.js`, and the BYOK provider-picker UI in three frontend settings pages/components), now reference current model IDs across all six providers. Groq's entire prior lineup (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `mixtral-8x7b-32768`, `gemma2-9b-it`, `deepseek-r1-distill-llama-70b`) had been fully deprecated/decommissioned upstream and is replaced with `openai/gpt-oss-120b`/`20b`, `groq/compound`, `groq/compound-mini`, and `meta-llama/llama-4-scout-17b-16e-instruct`.  <!-- `🕐 Deprecation notice` -->
- **TEVV-DB-6/7 checks made real**: the `tevv-db` job's "syntactically valid SQL" and "unclosed DO block" checks previously never failed the build regardless of what they found, due to an uninitialized `FAILED` flag; TEVV-DB-6 also only scanned `migrations/07*.sql`/`08*.sql`, missing migration 104 (the RLS bug below) entirely. Both fixed, and TEVV-DB-6's detection logic replaced: its `DO \$\$`/`END \$\$` regex relied on a POSIX-basic-regex quirk that meant it almost never matched a real dollar-quoted block, so it now counts literal `$$` token pairs instead.  <!-- `📦 DB migration required` -->
- **`tevv-db` job now runs real migrations**: added a `postgres:17` service container and an actual `npm run migrate` step to the job branded "Database & Migration Integrity," which previously never touched a database — pure grep over `.sql` text.
- **`security-pipeline.yml`'s migration step un-neutered**: `run: npm run migrate || echo "Migrations skipped for CI"` swallowed any real failure unconditionally; now a migration failure actually fails the build.

### Fixed

- **Row-Level Security was silently broken**: migration `104_row_level_security.sql` used invalid `ROW SECURITY` syntax (should be `ROW LEVEL SECURITY`) and had a dollar-quoting bug that broke policy creation for `evidence`/`audit_engagements`/`controls` — found and fixed by actually executing the full migration chain against a real Postgres instance for the first time.
- **AIBOM now genuinely derived from code**: `scripts/generate-aibom.js` previously hardcoded 4 of its 6 AI providers as fabricated "service" entries with made-up model lists (e.g. `gemini-1.5-pro`, which never matched the real `providerConfig.js` models); rewritten to derive the provider/model inventory from the live `PROVIDERS` object so it can no longer drift from the actual integration.
- **CodeQL `js/missing-rate-limiting`**: added an explicit per-router rate limiter to each of the six new route files (matching the existing `trustCenter.js` pattern), for parity with the companion `ai-grc-platform` fix — every flagged route was already covered by the app-wide `apiRateLimiter` mounted on `/api/v1`, which CodeQL's cross-file analysis can't trace; this closes the detection gap and adds a real second layer of defense.  <!-- `🔌 New API endpoint` -->
- **Per-router rate limiter ran before `authenticate`**: the six new route files applied their org-scoped rate limiter ahead of `authenticate`, so `req.user` was always unset when the limiter's key was built and every request silently fell back to a shared IP-based bucket instead of an org-scoped one. Fixed with a 3-way order — a cheap IP-based limiter first (bounds unauthenticated request volume before `authenticate`'s own DB/JWT work runs, and is what CodeQL's static analysis traces as covering the router), then `authenticate`, then the org-scoped limiter last, since it needs `req.user` for its key.  <!-- `🔌 New API endpoint` -->
- **AIBOM listed unused-capability providers as bundled dependencies**: the AI Bill of Materials treated all six BYOK LLM providers as `components` regardless of whether they have any real, shipped code dependency. Only `claude`/`openai` have actual npm SDK dependencies; `gemini`/`grok`/`groq`/`ollama` are called over plain HTTP only if an operator configures a key, with zero shipped SDK. Moved the latter into CycloneDX's dedicated `services` array alongside the existing internal AI Copilot/Analysis service entries, and added metadata clarifying that every provider reflects supported integration surface, not per-deployment runtime usage.
- **Controls list page mislabeled `verified` controls as "Not Started"**: `getStatusBadgeClass`/`getStatusLabel` only handled `implemented`/`satisfied_via_crosswalk`/`in_progress`, falling through to a gray "Not Started" badge for `verified`, `needs_review`, and `not_applicable` — so a control an auditor had verified rendered as if untouched. The control detail page already handled `verified` correctly; brought the list page in line with it and added the missing statuses to the status filter and both inline status-edit dropdowns.
- **Compliance gate undercounted `verified` controls**: `GET /compliance/gate` only treated `implemented`/`satisfied_via_crosswalk` as compliant, omitting `verified`, which every other progress query (`frameworks.js`, `dashboard.js`, `controls.js`) already counts as compliant — could return a false 412 even when the dashboard showed the threshold met.
- **Reverted migration idempotency edits on already-numbered files**: an earlier pass added `IF NOT EXISTS` guards to `001`, `005`, `057`, `105`, `107`, `108`, `109`, but editing an already-numbered (and likely already-deployed) migration changes its stored checksum, which makes `scripts/migrate-all.js` hard-fail with "Checksum mismatch" on any existing database — blocking the deploy of this PR's real new migrations, and contradicting this repo's own "never edit a deployed migration" rule. Reverted those seven files to their original content; the RLS syntax fix in `104_row_level_security.sql` is unaffected since it fixes a genuine bug rather than being purely defensive.
- **Cyber Resilience test date silently defaulted on malformed input**: `POST /resilience/plans/:id/tests` treated an invalid `test_date` (e.g. `not-a-date`) the same as an omitted one, silently recording the test against today's date instead of rejecting the request with 400 like every other date field in this route.
- **Dependency vulnerabilities**: resolved all 27 backend + 21 frontend `npm audit` findings. `form-data`, `multer`, `ws`, `js-yaml` (backend and frontend) fixed via non-breaking `npm audit fix`; `nodemailer` bumped to `9.0.3` (breaking, limited to stricter default TLS certificate validation, which this project's SMTP usage doesn't rely on bypassing); `@sentry/node`/`@sentry/nextjs` bumped to `10.65.0` and `pm2` bumped to `7.0.3` (both breaking-flagged, verified against this codebase's minimal usage of each — basic `Sentry.init()`/`setupExpressErrorHandler()` with only `dsn`/`environment`/sample-rate options, and `pm2`'s standard `apps`/`script`/`instances`/`exec_mode` config).

---


### 🕐 Deprecation Notices

- **RMF Leveraged Authorizations**: RMF packages can now inherit controls and authorization posture from COTS/SaaS products, following the FedRAMP-style leveraged-authorization model. New table `rmf_leveraged_authorizations` (migration 111) links `rmf_packages` to `cots_products` with inheritance type (full/partial/hybrid), an inherited-control list, shared-responsibility notes, and expiration tracking. New route module `routes/rmfInheritance.js` provides CRUD, an eligible-products lookup, and at-risk flagging when the underlying COTS product is deprecated/retired or its authorization has lapsed.
- **LLM provider/model catalog refreshed**: `providerConfig.js`'s `PROVIDERS` and `TASK_PROFILES`, plus every other place in the codebase that independently hardcoded a copy of the same model list (routing/fallback logic in `modelRouter.js` and `keyResolution.js`, quota-downgrade paths in `multiAgentOrchestrator.js`, API-key connectivity-check pings in `orgSettings.js`/`platformAdmin.js`, and the BYOK provider-picker UI in three frontend settings pages/components), now reference current model IDs across all six providers. Groq's entire prior lineup (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `mixtral-8x7b-32768`, `gemma2-9b-it`, `deepseek-r1-distill-llama-70b`) had been fully deprecated/decommissioned upstream and is replaced with `openai/gpt-oss-120b`/`20b`, `groq/compound`, `groq/compound-mini`, and `meta-llama/llama-4-scout-17b-16e-instruct`.

### 📦 Database Migrations

> Run these migrations in order before starting the updated server.

- **Migration 104**: (the RLS bug below) entirely. Both fixed, and TEVV-DB-6's detection logic replaced: its `DO \$\$`/`END \$\$` regex relied on a POSIX-basic-regex quirk that meant it almost never matched a real dollar-quoted block, so it now counts literal `$$` token pairs instead.

```bash
# Apply all pending migrations
cd controlweave/backend && npm run migrate
```

### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

<!-- Generated by generate-internal-release-notes.js on 2026-07-10T13:02:36.783Z -->
<!-- CM commit convention: docs(release): generate internal release notes for v<version> [skip ci] -->
