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

## [Unreleased]

> | Field | Value |
> |-------|-------|
> | **Status** | Unreleased — changes staged for next release |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |

### ⚠️ Breaking Changes

> **Action required** — review the migration steps below before deploying.

- **Migration schema drift guard, ported from the ai-grc mirror.** The mirror repository found that a `CREATE TABLE IF NOT EXISTS` shadowed by an earlier migration declaring the same table silently drops the second file's columns from every database the schema is built on, and confirmed it live-breaking four subsystems there (SSO, SIEM, the job runner's retry path, data-retention-policy creation). This repository has no live instance of that defect — verified by running the new check against the full migration set — but shares the same duplicate-migration-number history (the `TEVV-DB-2` grandfathered list in `ci.yml`) that made it possible in the mirror. `backend/scripts/check-migration-schema-drift.js` (`npm run check:migration-drift`, wired into CI as `TEVV-DB-2a`) now fails the build if that ever changes; verified by injecting a synthetic shadowed table with an orphaned column and confirming the check catches it, then removing it. — @sherifconteh-collab
- **`js-yaml` and `nanoid` were both sitting on vulnerable transitive versions with no direct pin.** `js-yaml` resolved to a pre-4.3.1 release vulnerable to prototype pollution via a crafted document; now pinned `^4.3.1` in both backend and frontend `overrides` (the frontend override was added after the backend fix shipped, closing a devDependency gap that let an unpinned copy back in through `eslint`'s toolchain). `nanoid` resolved below 3.3.8, vulnerable to predictable ID generation from a broken CSPRNG fallback; capped `>=3.3.17 <4.0.0` so the fix applies without pulling the breaking 4.x ESM-only line into a CommonJS backend.


### Added

- **An end-to-end verification harness for the link surface** — `scripts/qa-link-routes-e2e.sh` (`npm run qa:e2e:links`), shared with the ai-grc mirror. 35 assertions against a running API covering both directions of every link added in migrations `140`–`143`, the `asset_control_mappings` mapping that migration `005` never had an API for, generated-column arithmetic, `relevance` validation returning a 400 that names the options rather than a 500 from the CHECK constraint, `ON CONFLICT` idempotency, unlink, and cross-organization isolation on all three new read paths. The evidence expiry column is taken from `EVIDENCE_EXPIRY_FIELD` (`expires_at` here, `retention_until` in the mirror) because asserting the specific column is what catches a blind port between the two repositories.

- **Risk register: evidence linkage.** Migration 143 adds `risk_evidence_links`,  <!-- `📦 DB migration required` -->
  completing the register's connections. Evidence has been linkable to controls
  since migration 009, so a risk's evidence was only reachable transitively —
  via its controls, and only when those controls happened to carry the document.
  `relevance` (`assessment` / `treatment` / `monitoring` / `acceptance`) lives on
  the link because the same document supports different risks for different
  reasons. `POST`/`DELETE /risks/:id/evidence/:evidenceId`, evidence in
  `GET /risks/:id`, and `GET /evidence/:id/risks` for the reverse view.

- **Risk register: vendor linkage.** Migration 142 adds `risk_vendor_links`, the  <!-- `📦 DB migration required` -->
  fourth link table alongside controls, assets and objectives. `tprm_vendors`
  already carried a `risk_tier`, but that is a static onboarding classification,
  not a scored and reviewed risk — so vendor concentration was invisible to the
  register and the register was invisible during a vendor review.
  `POST`/`DELETE /risks/:id/vendors/:vendorId`, vendors included in
  `GET /risks/:id`, and the TPRM vendor detail response now carries `risks`,
  `open_risk_count` and `max_residual_score`. The vendor panel flags a tier that
  disagrees with the risks recorded against it.

- **CMDB: risk exposure on assets.** `risk_asset_links` shipped with migration
  136 but only the risk half was reachable — an asset could be attached to a
  risk and then never seen from the asset again. Adds
  `GET /cmdb/assets/:assetId/risks` and
  `GET /cmdb/risk-exposure[?category=]` (open-risk count, worst residual and top
  risk per asset, one query for the estate), plus a Risk Exposure panel on the
  asset drawer showing the inherent-to-residual movement and linking through to
  the register. Read-only by design: linking stays on the risk so one screen
  owns the relationship.

- **CMDB: asset-to-control mapping.** `asset_control_mappings` has been in the
  schema since migration 005 with no API and no UI, so an asset inventory could
  not evidence CM-8 — the control it exists to satisfy. Adds
  `GET`/`POST /cmdb/assets/:assetId/controls`,
  `PUT`/`DELETE /cmdb/assets/:assetId/controls/:controlId` and
  `GET /cmdb/controls/:controlId/assets`, plus a Compliance Controls section in
  the asset drawer to link, status and unlink.
- **CMDB: bulk import and inventory export.** `POST /cmdb/import/analyze` is a
  true dry run that writes nothing and returns a per-row verdict with source
  line numbers; `POST /cmdb/import/commit` inserts every valid row in one
  transaction. `GET /cmdb/import/template` and `/cmdb/import/export` round-trip
  the same columns. New Bulk import & export panel on the CMDB dashboard, with
  Import disabled until a dry run has run. Both import and export are
  audit-logged.
- **CMDB: editing on every register.** Hardware, Software, AI Agents, Service
  Accounts, Environments and Password Vaults each had only Add and Delete, so
  fixing a typo meant deleting the record and retyping it. The PUT endpoints and
  the `update` client method already existed and had never been called.

- **Risk register, incidents, obligations, objectives, indicators, and departments** (migrations `135`–`139`): ControlWeave ships ISO 31000, ISO 27005 and the NIST AI RMF as frameworks a customer can assess against, but had nowhere to record the risks those frameworks are about. The only risk-shaped table was `risk_scores` (migration `057`) — one computed 0-100 posture number per organization, which is a metric, not a register. Six modules close that gap:
  - `departments` (hierarchical business units) and `business_objectives` (COSO's four categories), the organizational spine every other register hangs off. ISO 31000 defines risk as the effect of uncertainty *on objectives*; without recorded objectives a register is a list of bad things with nothing to be bad for.
  - `risks` / `risk_treatments` / `risk_reviews` plus control, asset and objective link tables (ISO 31000 / ISO 27005 / NIST SP 800-30). Inherent **and** residual assessment as likelihood × impact on 1–5 scales, the product a stored generated column so 5×5 heat-map queries cannot drift from their inputs. Acceptance is a named decision with a rationale and an optional expiry, and a lapsed acceptance is surfaced as such rather than left reading "accepted". Reviews snapshot the assessment as it stood, so history survives later edits to the risk row.
  - `incidents` / `incident_timeline` plus risk, control and asset link tables (NIST SP 800-61r2). Per-phase timestamps rather than a status history, because the intervals *are* the metrics — dwell time, time to contain, time to resolve. Transitions are validated against an explicit graph: an incident cannot be eradicated before it is contained, and allowing that produces response metrics that are quietly nonsense. Breach notification is first class, with the 72-hour class of clock tracked and overdue reported as how far past rather than a generic flag.
  - `compliance_obligations` / `obligation_attestations` / `obligation_control_links`: what the organization is bound to, by whom, by when. Distinct from controls because obligations have a source with authority and they expire. Recurring due dates advance from the *due date*, never from the attestation date, so a repeatedly-late annual obligation cannot drift its own deadline out of the period the regulator expects.
  - `indicators` / `indicator_measurements`: KRI / KPI / KCI with amber and red thresholds and an explicit `direction`, so "higher is worse" and "higher is better" indicators are both handled instead of whichever case the author had in mind. `breach_level` is persisted at write time so retuning a threshold does not silently rewrite historic breaches.

  Twelve permissions (`risks.*`, `incidents.*`, `obligations.*`, `objectives.*`, `indicators.*`, `departments.*`) are seeded and granted in the same migrations that introduce the routes using them. Incident *write* goes to `user` as well as `admin`: incident reporting has to be available to whoever noticed the problem, or it gets reported by email and never reaches the register. Six new dashboard pages (`/dashboard/risks` with the 5×5 residual heat map, `/dashboard/incidents`, `/dashboard/obligations`, `/dashboard/indicators`, `/dashboard/objectives`, `/dashboard/departments`). All routes are org-scoped, paginated, rate-limited at both the IP and per-organization level, and audit-logged on mutation.

- **Federal POA&M structure — milestones, resources, and slippage tracking** ([#569](https://github.com/sherifconteh-collab/ControlWeaver-Pro/issues/569), migration `134`): `poam_items` carried the core lifecycle but was short of what a federal POA&M requires. New `poam_milestones` table with discrete milestones, each with its own target date, status (`pending` / `in_progress` / `completed` / `delayed` / `cancelled`, enforced by a CHECK constraint) and completion date, exposed as a sub-resource at `/poam/:id/milestones` (list, create, patch, delete) with a completed/overdue summary. New `resources_required` records the funding, staff, and tooling estimate reviewers ask for. New `scheduled_completion_date` holds the *originally scheduled* completion date and is set once, while `due_date` carries the current target — so revising a date makes the slippage visible instead of erasing it. Existing rows are backfilled from `due_date` so slippage reporting does not silently skip them.  <!-- `📦 DB migration required` -->
- **Real evidence version history** ([#570](https://github.com/sherifconteh-collab/ControlWeaver-Pro/issues/570), migration `133`): `evidence.evidence_version` was an integer that incremented while the row was overwritten in place — no prior version's file, hash, or classification could be retrieved, so the counter went up but nothing was kept. Each update now archives the row as it stood into a new `evidence_versions` table, in the same transaction as the update. New `POST /evidence/:id/versions` replaces the file while retaining the superseded one and its hash, so integrity stays demonstrable across a replacement; `GET /evidence/:id/versions` lists superseded versions and `GET /evidence/:id/versions/:versionNumber/download` retrieves one. Reclassifying evidence no longer destroys the record of what it was classified as while being relied on. Version records are immutable and cascade-delete with their parent. File replacement is audit-logged as `evidence_version_created`.  <!-- `📦 DB migration required` -->

- **GitHub Evidence Connector**: `services/githubService.js` and `routes/github.js` add a real GitHub REST API client — org-scoped token settings (`Settings → Integrations → GitHub`), a test-connection check, a one-time import endpoint, and a full `code_scanning_alerts` / `dependabot_alerts` / `audit_log` / `pull_requests` source for Auto-Evidence Collection Rules. GitHub now performs genuine live data retrieval (like Splunk), not just configuration-record evidence.
- Dynamic per-source-type configuration fields in the Auto-Evidence rule creation form (`dashboard/evidence/auto/page.tsx`), including a GitHub event-type dropdown, replacing free-text inputs.
- **Access Governance module** (`/api/v1/access-governance`, migrations `126`–`128`): entitlement reporting across users, roles, and effective permissions with over-privileged (wildcard) and dormant-access flags; separation-of-duties toxic-combination rules with a live violations report (five system rules ship, three enabled); access review certification campaigns (`draft → active → completed`) that generate an AC-2 evidence record on completion disclosing any self-reviewed items; and a role/permission simulator giving a positive/negative allowed-denied matrix before a role is assigned. New `sod_rules`, `access_review_campaigns`, `access_review_items` tables gated by `access_governance.read` / `.manage`, with row-level security on all four new tables. New `/dashboard/access-governance` page. Revocation decisions are recorded, never auto-applied — de-provisioning stays an explicit action through the existing guarded role-assignment flow.
- **AI-assisted RBAC document import** (migration `127`, `rbac_analysis` feature): upload a role definition spreadsheet, SoD matrix, or roles & responsibilities document (PDF/DOCX/TXT/MD/CSV) and have AI map its duties onto the live permission catalog, flag SoD conflicts including ones the organization is currently violating, and propose platform roles and SoD rules. Only extracted text is persisted; the uploaded file is processed in memory and discarded. Every suggestion requires an explicit per-item click to apply.
- **Nine-organization demo roster** — one per industry vertical (financial services, healthcare, defense, technology, energy, retail, biotech, higher education) plus an external audit firm with a seeded three-engagement workbench. Industry-addressed logins (`admin@financial.com` and so on) with the legacy tier logins kept as working aliases. See `DEMO_CREDENTIALS.md`.
- **SOC 2: all five Trust Services Criteria** (migration `129`): the framework shipped with 27 controls, every one a `CC*` — the Security category alone. Adds the 28 missing criteria across the Availability, Confidentiality, Processing Integrity, and Privacy categories <!-- ip-hygiene:ignore --> (category names and criterion identifiers only), each with the same examine / interview / test program the existing controls carry, and moves `coverage_status` to `comprehensive`. Descriptions are ControlWeave's own paraphrase; the AICPA text is copyrighted and is not reproduced.
- **Control function classification** (migration `130`): `framework_controls.control_functions text[]` carrying `preventive` / `detective` / `corrective`, backfilled from control titles with word-boundary matching. Roughly 500 of 1,200 controls are classified; the rest are deliberately left blank rather than guessed at. Filterable through the API and the controls UI.
- **Framework-neutral evidence type taxonomy** (migration `131`): a 14-value `evidence_types` vocabulary, an `evidence.evidence_type` foreign key, and `assessment_procedures.expected_evidence_types`, so evidence is labelled consistently regardless of framework. Pre-existing evidence stays untyped rather than being guessed at. New `GET /evidence/types` and an `?evidence_type=` list filter.
- **Auto-crosswalk propagation engine** (`services/crosswalkCreditService.js`, migration `132`): implementing or verifying a control now credits mapped controls at ≥90% similarity in the organization's other *active* frameworks as `satisfied_via_crosswalk`, which is what `README.md` and `docs/HOW_CROSSWALKS_WORK.md` have described for several releases without any code behind it. Credits are recorded per (organization, credited control, source control) in `control_crosswalk_credits` with the similarity score, mapping type, and the status the control held beforehand, so `GET /controls/:id` can return the provenance an assessor will ask for. Credit is withdrawn automatically when the source control stops being implemented, restoring the recorded prior status — unless another still-implemented source justifies it, or someone has since implemented the control themselves. Credit never overwrites work already in progress, never crosses organizations, and both directions are audit-logged (`crosswalk_credit_applied` / `crosswalk_credit_withdrawn`) as AU-2 posture changes.

- **POA&M register, detail page, and the auditor review workflow** ([#569](https://github.com/sherifconteh-collab/ControlWeaver-Pro/issues/569), [#570](https://github.com/sherifconteh-collab/ControlWeaver-Pro/issues/570)): both issues shipped their migrations, routes and API clients and were closed with their frontend scope never built, which is why `POAM.md` carried a "What is API-only today" table listing nine capabilities. New `/dashboard/poam` register and `/dashboard/poam/[id]` detail page, plus a sidebar entry at `controls.read` — the permission every POA&M endpoint actually requires, where the only previous route in was a tab on Operations gated at `settings.manage`. The detail page carries field editing, the milestone editor, the progress timeline, submit-for-review, approval history, and multi-control linking. `scheduled_completion_date` renders read-only beside `due_date` with the slippage in days, because it is the original commitment and overwriting it erases the thing federal reporting asks you to show. The table is down to two entries.  <!-- `🔌 New API endpoint` -->
- **Auditor review queue and decision panel**: a POA&M Review tab on the Auditor Workspace listing everything in `pending_auditor_review`, and an approve / reject / request-changes panel on the item itself, with the framework's own auditor guidance and expected review chain shown beside the form. Separation of duties is surfaced rather than enforced only on submit — the panel explains that you cannot review an item you submitted instead of letting you write a decision the API refuses with a 403.
- **Evidence version history and integrity verification in the dashboard**: a detail drawer with metadata editing, the full version list, prior-version download, file replacement, and the integrity check. Each superseded version shows its **PII classification as it was at the time**, which is the point of [#570](https://github.com/sherifconteh-collab/ControlWeaver-Pro/issues/570)'s third bullet — the table alone does not demonstrate that a reclassification is recoverable if nothing ever reads it. `GET /evidence/:id/integrity-check` existed and was missing from the API client entirely.
- **POA&M CSV and PDF export** — `GET /poam/export?format=csv|pdf`, honoring the filters active on screen. Carries every linked control, the framework type, both dates with computed slippage, `resources_required`, milestone counts, and any linked risks and treatment. `README.md` has claimed "export POA&M status for federal and regulatory reporting" for several releases; the only POA&M output that existed was four aggregate counts inside the SSP report.
- **Risk register ↔ POA&M linkage** (migration `140`): migration `136` tied risks to controls (what treats the risk), assets (what is exposed) and objectives (what is threatened) — but not to the remediation work, so the register recorded the decision to treat a risk with no link to what was being done about it. New `risk_poam_links` (many-to-many; one remediation routinely addresses several risks) and `poam_items.treatment_id` for the tighter case where a POA&M executes one specific treatment. `POST /poam/from-risk/:riskId` sets priority from the residual score. Closing remediation deliberately does **not** move a residual score — inherent and residual are stored separately so an assessor can see what the controls achieved, and a score that moved on its own would destroy that evidence; the risk is flagged review-due instead.
- **Risk detail page** (`/dashboard/risks/[id]`) — the page `GET /risks/:id` never had. The register was a list and a heat map; clicking a row did nothing. Assessment, treatments, reviews, acceptance, the existing control/asset/objective links, and the new remediation panel.
- **Many-to-many POA&M ↔ control linkage** (migration `141`): `poam_items.control_id` was a single nullable FK, so one remediation could not span several controls even though evidence (`evidence_control_links`) and risks (`risk_control_links`) both could. One access-review remediation commonly closes findings against AC-2, AC-3 and AC-6 at once. Existing values are backfilled and the column is kept as the originating control.
- **Framework-appropriate terminology** — an ISO 27001 organization sees "Corrective Action Request", SOC 2 "Deficiency", FISCAM and HIPAA "Corrective Action Plan", PCI DSS "Risk Assessment & Validation", NIST and FedRAMP "POA&M". The seven vocabularies have shipped in `frameworkPoamService.js` since the feature was built and were unreachable (see Fixed). Labels only — URLs, tables and API paths are unchanged.
- **`.github/scripts/check-screenshots.js`**, wired into CI: fails on placeholder stub dimensions, the repo's own 500KB cap, and byte-identical duplicates. A compression-density heuristic was tried and removed — three of the four files it flagged were real screenshots, because a flat modern UI compresses about as well as a blank page, and a guard that is wrong three times in four teaches people to ignore it.
- **A `capture-screenshots` job that needs no secrets** — `workflow_dispatch` only, standing up Postgres, migrations, the demo seed, backend and frontend, then capturing against localhost. `DEMO_CREDENTIALS.md` documents localhost only, so the existing secrets-based path could never have succeeded in this repo no matter what was configured.
- **`docs/guides/RISK_REGISTER.md`** — the risk register shipped with no user guide at all.

### Changed

- **Departments and Business Objectives merged into one page.** Both were thin org-configuration lists with no lifecycle of their own, and they are read together — you assign an objective to a department, and a department's open-risk count only means something next to the objectives it owns. Now `/dashboard/structure` with a tab each, permission-gated per tab so `objectives.read` alone lands on the Objectives tab rather than a blank Departments view. `/dashboard/departments` and `/dashboard/objectives` redirect to the matching tab rather than 404.
- **Sidebar regrouped into collapsible sections with subsections** — it was four flat lists totalling 48 links. Now seven sections (plus a gated eighth for platform admins) following the GRC domains, with subsection headings inside the larger ones. Only the section containing the current route is expanded, collapse state persists, and active highlighting takes the longest matching href so a nested route no longer highlights its parent as well. No destination was added or removed in the regrouping.

### Fixed

- **The IP hygiene check read several short quotations as one long one.** Rule 3 (`standards.possible-verbatim.long-quote`) matched a quote character, 120 or more characters of anything, then the same quote character again — measuring the distance from the first quotation mark on a line to any later one rather than the length of a quotation. A sentence naming several terms of art, or one carrying two ordinary possessive apostrophes, therefore read as a single 120-character quotation of a standard. It flagged two lines of `docs/RELEASE_NOTES.md` written by our own release automation and failed both `Backend — Syntax & IP Hygiene` and `QA Testing Suite`, on content no pull request had touched. Delimiters are now paired in order of appearance, and an apostrophe with word characters on both sides is treated as punctuation. Verbatim standards text of the length the rule was written to catch still flags, including a quotation containing an internal apostrophe.

- **Migration schema drift guard, ported from the ai-grc mirror.** The mirror repository found that a `CREATE TABLE IF NOT EXISTS` shadowed by an earlier migration declaring the same table silently drops the second file's columns from every database the schema is built on, and confirmed it live-breaking four subsystems there (SSO, SIEM, the job runner's retry path, data-retention-policy creation). This repository has no live instance of that defect — verified by running the new check against the full migration set — but shares the same duplicate-migration-number history (the `TEVV-DB-2` grandfathered list in `ci.yml`) that made it possible in the mirror. `backend/scripts/check-migration-schema-drift.js` (`npm run check:migration-drift`, wired into CI as `TEVV-DB-2a`) now fails the build if that ever changes; verified by injecting a synthetic shadowed table with an orphaned column and confirming the check catches it, then removing it. — @sherifconteh-collab  <!-- `📦 DB migration required` -->
- **`GET /risks/:id` returned 500 for every risk.** The vendors query added with migration `142` selected `v.name`; the column is `vendor_name`. Because the seven link queries run in a single `Promise.all`, that one wrong column took down the entire endpoint — controls, assets, objectives, POA&Ms, vendors and evidence all unreachable, and the risk detail page with them. Found by running the stack for the first time: no static gate could catch it, since `check:syntax` parses without resolving queries, typecheck cannot see into a SQL string, and the migration itself is valid.  <!-- `🔌 New API endpoint` -->

- **The compliance gate was enforced on a code path the product does not use.** `PUT /controls/:id` demanded a `poam_justification` when a control moved to compliant, created the POA&M and filed the approval request. The dashboard does not call it — the control detail page calls `PATCH /implementations/:id/status` and `PATCH /implementations/:id/test-result`, and neither had a single POA&M reference. So a control could be marked compliant from the UI with no justification and nothing produced for an auditor to review. The rule now lives in `services/poamGateService.js` and is applied on all three paths, preserving the `requires_poam_submission` 400 response contract that existing API clients branch on.
- **Nothing that found a compliance gap raised remediation.** Recording a control test or an assessment procedure as `other_than_satisfied` — NIST SP 800-53A for "this control has gaps", and the canonical trigger for a POA&M — produced nothing at all, and `routes/assessments/findings.js` had no POA&M references whatsoever. Across all three `INSERT INTO poam_items` sites only `'control'` and `'vulnerability'` were ever written; `'audit_finding'` and `'assessment'` were declared in `ALLOWED_SOURCE_TYPE` from the start and dead. Those three events now raise a **draft** POA&M against the control, idempotent per (control, source), with owner, dates and remediation plan deliberately left blank for a human. Nothing is auto-closed, auto-approved or auto-assigned, and findings raise only at medium severity and above.
- **`GET /poam/framework-types` was unreachable.** Declared after `router.get('/:id')`, so Express bound `id="framework-types"` and the request 404'd as "POA&M item not found". The entire multi-framework POA&M vocabulary sat behind it — FISCAM CAP/NFR, ISO CAR/OFI, SOC 2 exception/deficiency, HIPAA CAP, PCI RAV, NIST and FedRAMP — which is why nothing in the product ever offered a type picker and every screen said "POA&M" regardless of the customer's framework. It now resolves, and is scoped to the organization's activated frameworks rather than returning all seven.
- **The control detail page hid its own POA&M panel when it mattered.** The Risk & Compliance section rendered only when a POA&M or vulnerability already existed, so a control with neither showed nothing, offered no way to raise one, and its empty state was unreachable code. Its "View all" link pointed at `/dashboard/poam`, a route that did not exist and returned a 404.
- **The screenshot pipeline's two root causes.** `sync-stale-content` committed with a blanket `git add -A`, which is how `bb54355` swept in thirty-two 200×40 placeholder PNGs that `sync-doc-content.js` never writes and never touches; staging is now driven by the paths that script reports in `doc-sync-report.json`. And the capture step ran unconditionally, hit `process.exit(1)` on the first line of `capture-screenshots.js` for missing demo credentials, and reported a failure on **every** run of the workflow — it now checks for the credentials and skips with an explicit notice.
- **`controls-list-01.png` was a blank page with a loading spinner**, referenced by `CONTROLS.md`, `GETTING_STARTED.md` and the wiki as "Controls list showing control ID, title, framework, status, and owner". Removed along with its three references.
- **An unguarded division rendered a literal `NaNs`** in the Auditor Workspace's multi-agent results, where an optional `durationMs` was divided by 1000 without a check. Surfaced by typing state that had been `any`.
- **`CMDB.md` documented four features that do not exist**: the bulk asset import with its AI field-mapping workflow, Dry Run button and `POST /cmdb/import/analyze` + `/import/commit` endpoints; hardware CSV import; the SBOM tab on software assets; and the AIBOM tab on AI agents. Asset-control mapping and shadow-IT detection are real endpoints with no UI and are now labelled as such. Seven navigation steps pointed at `Assets & Security → Assets` for registers that live at `/dashboard/cmdb`, and six orphaned tier-comparison table rows sat directly beneath the sentence stating there is no tier gating.

- **`assessment_procedures` had no uniqueness on `(framework_control_id, procedure_id)`**, so every `ON CONFLICT DO NOTHING` insert against that table was a silent no-op guard: re-running any procedure seeder duplicated its rows instead of skipping them. Migration `129` deduplicates defensively and adds the constraint, which makes the `ON CONFLICT` clauses in every seeder actually work.
- **Demo-account seeding re-ran on every boot.** `ensureDemoAccountsSeeded()` matched on `lower(u.email)`, but `users.email` is encrypted at rest — the comparison ran against ciphertext and never matched, so the full demo seed re-executed on each start. Now matched on the deterministic `email_hash` lookup key; boot logs `demo.seed.present` and skips.
- **The public contact endpoint emailed `undefined` credentials.** Its tier-to-demo-account map had collapsed, so enquiries received a message containing literal `undefined` in place of a login. Replaced with industry resolution, a legacy tier mapping, and a guaranteed fallback.

- **`evidence_collection_rules` accepted only `splunk`/`connector`**: migration `088`'s `source_type` CHECK constraint never matched the app's own `ALLOWED_SOURCE_TYPES` allowlist (`microsoft_sentinel`, `aws_cloudtrail`, `crowdstrike`, `jira`, `servicenow`, `github`) <!-- ip-hygiene:ignore --> — creating a rule with any of those source types threw a raw Postgres constraint violation. Fixed in migration `125`.
- **Auto-Evidence rule creation form silently discarded its configuration**: `RuleForm`'s submit handler always sent `source_config: {}` regardless of source type, so no rule created through the UI (Splunk included) was ever actually functional. Fixed generically using the already-fetched `/auto-evidence/sources` `configFields` metadata.

### Security

- **`express-rate-limit` was undeclared in `package.json`.** It resolved only as a transitive dependency of `@modelcontextprotocol/sdk` while **25 route files require it directly** — if that SDK ever dropped or relocated it, none of those routers would load and the backend would stop booting. Now declared explicitly at `^8.5.2`; the pre-existing exact-version override became `$express-rate-limit` so it follows the declared range rather than conflicting with it (npm rejects the combination outright).
- **Six advisories cleared across both dependency trees.** Each was a pin that was correct when written and had fallen exactly one patch short: `brace-expansion` `>=5.0.8` → `>=5.0.9` (DoS bypassing the CVE-2026-14257 mitigation), `hono` `^4.12.28` → `^4.12.34` (ReDoS in the CORS middleware), `socket.io-parser` `4.2.6` → `>=4.2.7` (zero-attachment memory exhaustion), plus newly added pins for `fast-uri` `^3.1.5` (host confusion via a backslash authority introducer) and `ip-address` `^10.4.0` (leading-zero octets decoded as decimal, allowing SSRF and trust-boundary bypass). `fast-uri` is held inside the 3.x line rather than taking the 4.x latest, because the advisory is fixed in 3.1.5 and a major bump would land on a consumer that has not asked for it. Backend and frontend both report zero vulnerabilities under the flags CI uses.
- **`js-yaml` and `nanoid` were both sitting on vulnerable transitive versions with no direct pin.** `js-yaml` resolved to a pre-4.3.1 release vulnerable to prototype pollution via a crafted document; now pinned `^4.3.1` in both backend and frontend `overrides` (the frontend override was added after the backend fix shipped, closing a devDependency gap that let an unpinned copy back in through `eslint`'s toolchain). `nanoid` resolved below 3.3.8, vulnerable to predictable ID generation from a broken CSPRNG fallback; capped `>=3.3.17 <4.0.0` so the fix applies without pulling the breaking 4.x ESM-only line into a CommonJS backend.

- **`routes/poam.js` had no rate limiting at all** — `router.use(authenticate)` and nothing else, while its sibling `routes/poamMilestones.js` carried a router-wide limiter. Both halves of one feature are now governed by the same rule, with the new `/poam/export` route limited separately at 10/min because it streams an organization's entire remediation register in one response. The export is audit-logged as an AU-2 event.  <!-- `🔌 New API endpoint` -->

- **GitHub and Splunk connector tokens were stored in plaintext**: both `githubService.js` and the pre-existing `splunkService.js` set `organization_settings.is_encrypted = true` on save but never actually called `encrypt()`/`decrypt()` from `utils/encrypt.js` — the stored value was plain text despite the flag. Both now encrypt at rest (AES-256-GCM); `decrypt()` transparently falls back to legacy plaintext rows, so no migration is required.
- **Rate limits on the control and implementation routes crosswalk propagation made expensive**: `PUT /controls/:id/implementation` and `PATCH /implementations/:id/status` (60/min — one status change now fans out into a mapping query plus a read-modify-write per credited control, or a withdrawal walk over everything the control was holding up), `POST /controls/:id/inherit` (20/min — several queries per mapped control, and a control can carry dozens of mappings), and `GET /controls/:id` (120/min). Neither route file had any rate limiting before.
- **Rate limits on seven previously unlimited evidence routes**: `GET /evidence/:id/download` and `GET /evidence/:id/integrity-check` (30/min each — the download path is the bulk-exfiltration route for files that may carry PII, and integrity-check re-hashes the stored file on every call), `DELETE /evidence/:id` (30/min, destructive and irreversible), `PUT /evidence/:id`, `POST /evidence/:id/link`, `DELETE /evidence/:evidenceId/unlink/:controlId` (60/min each), and `GET /evidence/:id` (120/min).

---


### 📦 Database Migrations

> Run these migrations in order before starting the updated server.

- **Migration 143**: adds `risk_evidence_links`,
- **Migration 142**: adds `risk_vendor_links`, the
- **Migration 005**: with no API and no UI, so an asset inventory could

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

## v4.3.0 — 2026-07-10

> | Field | Value |
> |-------|-------|
> | **Version** | `4.3.0` |
> | **Release date** | 2026-07-10 |
> | **Tag** | `v4.3.0` |
> | **Release branch** | `release/4.3.0` |
> | **Built from** | `0acb1a4f` |
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

## v3.5.0 — 2026-05-18

> | Field | Value |
> |-------|-------|
> | **Version** | `3.5.0` |
> | **Release date** | 2026-05-18 |
> | **Tag** | `v3.5.0` |
> | **Release branch** | `release/3.5.0` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


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


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v3.4.0 — 2026-05-16

> | Field | Value |
> |-------|-------|
> | **Version** | `3.4.0` |
> | **Release date** | 2026-05-16 |
> | **Tag** | `v3.4.0` |
> | **Release branch** | `release/3.4.0` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


### Added
- Redis-backed distributed rate limiting replaces per-instance in-memory Map; falls back to in-memory when Redis is absent so single-instance deployments are unaffected.
- PostgreSQL Row-Level Security (migration 104) on `controls`, `control_implementations`, `evidence`, `audit_engagements`, `audit_logs`, and `users`; `withOrgContext(orgId, fn)` in `database.js` activates the second enforcement layer per-request without touching existing routes.  <!-- `📦 DB migration required` -->
- Sentry error tracking: `@sentry/node` wired to Express via `setupExpressErrorHandler`; `logger.setSentryClient()` forwards error-level log events; `@sentry/nextjs` added to the frontend with `sentry.client.config.ts` and `sentry.server.config.ts`.
- Automated database backups via `node-cron` (`backupScheduler.js`); optional S3 upload in `db-backup.js`; activated with `BACKUP_ENABLED=true`.
- PM2 cluster mode: `ecosystem.config.js` with `instances: max`; `start:cluster` script and updated `start:railway` for Railway deployments.
- Redis response caching for dashboard: `redisCache.js` utility (`getCached`, `invalidateCached`, `invalidateCachedPattern`) with org-scoped keys; replaces single-instance in-memory cache Map in `dashboard.js`.
- CDN-friendly cache headers in `next.config.ts`: static assets (`/_next/static/*`) served with `Cache-Control: public, max-age=31536000, immutable`; HTML pages served with `no-cache`.
- Refresh token rotation on `POST /refresh`: every refresh issues a new refresh token and invalidates the previous one.
- Concurrent session limits at login: configurable via `MAX_CONCURRENT_SESSIONS` (default 10); oldest session evicted when limit is reached.
- Optional HMAC signature layer on TPRM public endpoints: vendors send `X-TPRM-Signature: sha256=<hex>` when `TPRM_HMAC_SECRET` is configured; backward compatible with token-only auth.
- `verifyIncomingWebhook(secret, signature, body)` in `webhookService.js` for verifying incoming webhook callbacks from external systems.  <!-- `🔔 Webhook event` -->
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


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v2.8.10 — 2026-03-28

> | Field | Value |
> |-------|-------|
> | **Version** | `2.8.10` |
> | **Release date** | 2026-03-28 |
> | **Tag** | `v2.8.10` |
> | **Release branch** | `release/2.8.10` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


### Overview

This release includes 1 improvement.

### Changed
- Fix dashboard overview and auth email hydration


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v2.8.9 — 2026-03-28

> | Field | Value |
> |-------|-------|
> | **Version** | `2.8.9` |
> | **Release date** | 2026-03-28 |
> | **Tag** | `v2.8.9` |
> | **Release branch** | `release/2.8.9` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


### Overview

This release includes 1 improvement.

### Changed
- Add duplicate user email cleanup


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v2.8.8 — 2026-03-28

> | Field | Value |
> |-------|-------|
> | **Version** | `2.8.8` |
> | **Release date** | 2026-03-28 |
> | **Tag** | `v2.8.8` |
> | **Release branch** | `release/2.8.8` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


### Overview

This release includes 1 improvement.

### Changed
- Add email hash backfill script


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v2.8.7 — 2026-03-28

> | Field | Value |
> |-------|-------|
> | **Version** | `2.8.7` |
> | **Release date** | 2026-03-28 |
> | **Tag** | `v2.8.7` |
> | **Release branch** | `release/2.8.7` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


### Overview

This release includes 1 improvement.

### Changed
- Fix GovCloud assessment seed query


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v2.8.6 — 2026-03-28

> | Field | Value |
> |-------|-------|
> | **Version** | `2.8.6` |
> | **Release date** | 2026-03-28 |
> | **Tag** | `v2.8.6` |
> | **Release branch** | `release/2.8.6` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


### Overview

This release includes 1 improvement.

### Changed
- Fix demo seed account targeting


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v2.8.5 — 2026-03-28

> | Field | Value |
> |-------|-------|
> | **Version** | `2.8.5` |
> | **Release date** | 2026-03-28 |
> | **Tag** | `v2.8.5` |
> | **Release branch** | `release/2.8.5` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


### Overview

This release includes 1 improvement.

### Changed
- Auto-seed demo accounts on startup


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v2.8.4 — 2026-03-28

> | Field | Value |
> |-------|-------|
> | **Version** | `2.8.4` |
> | **Release date** | 2026-03-28 |
> | **Tag** | `v2.8.4` |
> | **Release branch** | `release/2.8.4` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


### Overview

This release includes 1 improvement.

### Changed
- Seed platform admin self-assessment data


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v2.8.3 — 2026-03-28

> | Field | Value |
> |-------|-------|
> | **Version** | `2.8.3` |
> | **Release date** | 2026-03-28 |
> | **Tag** | `v2.8.3` |
> | **Release branch** | `release/2.8.3` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


### Overview

This release includes 1 improvement.

### Changed
- Harden demo seed prerequisites


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v2.8.2 — 2026-03-28

> | Field | Value |
> |-------|-------|
> | **Version** | `2.8.2` |
> | **Release date** | 2026-03-28 |
> | **Tag** | `v2.8.2` |
> | **Release branch** | `release/2.8.2` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


### Overview

This release includes 1 improvement.

### Changed
- Fix platform admin password rotation


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v2.8.1 — 2026-03-28

> | Field | Value |
> |-------|-------|
> | **Version** | `2.8.1` |
> | **Release date** | 2026-03-28 |
> | **Tag** | `v2.8.1` |
> | **Release branch** | `release/2.8.1` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


### Overview

This release includes 1 new feature.

### Added
- Optimize code and enhance features


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v2.8.0 — 2026-03-27

> | Field | Value |
> |-------|-------|
> | **Version** | `2.8.0` |
> | **Release date** | 2026-03-27 |
> | **Tag** | `v2.8.0` |
> | **Release branch** | `release/2.8.0` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


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


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v2.7.3 — 2026-03-26

> | Field | Value |
> |-------|-------|
> | **Version** | `2.7.3` |
> | **Release date** | 2026-03-26 |
> | **Tag** | `v2.7.3` |
> | **Release branch** | `release/2.7.3` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


### Changed
- Restored v2.7.3 entry (originally a single-line placeholder) with full detail describing its retroactive rewrite of v2.5.0–v2.7.2 release notes to match v2.4.4 quality standard across `RELEASE_NOTES.md`, `INTERNAL_RELEASE_NOTES.md`, `controlweave/docs/RELEASE_NOTES.md`, and `CHANGELOG.md`.
- Release dates added to documentation file headings for all versions.
- Internal release metadata enriched with `Tag` and `Release branch` fields for traceability.


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v2.7.2 — 2026-03-26

> | Field | Value |
> |-------|-------|
> | **Version** | `2.7.2` |
> | **Release date** | 2026-03-26 |
> | **Tag** | `v2.7.2` |
> | **Release branch** | `release/2.7.2` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


### Changed
- Release-notes auto-generation now strips redundant type-prefix verbs and capitalizes 30+ GRC/tech acronyms via `clean_desc()`.
- Auto-generated overview produces grammatically correct counts with singular/plural and Oxford comma.
- Auto-generated release title derived from change categories and applied to all release-note file headings.
- Conventional commit regex synced between `release-notes.yml` and `cm-branch-naming.yml` — added `migration` and `test` types.
- American English normalization applied across workflow files (`categorised` → `categorized`).


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v2.7.1 — 2026-03-26

> | Field | Value |
> |-------|-------|
> | **Version** | `2.7.1` |
> | **Release date** | 2026-03-26 |
> | **Tag** | `v2.7.1` |
> | **Release branch** | `release/2.7.1` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


### Added
- TEVV-API: 4 new behavioral tests — route `require()` + `.stack` verification, auth middleware import check, `module.exports` verification, frontend `api.ts` client coverage.  <!-- `🔌 New API endpoint` -->
- TEVV-DB: Migration file SQL keyword validation.
- TEVV-UI: 7 new page-level tests covering `ai-security`, `assets`, `plot4ai`, `organization`, `my-organizations`, `report-issue`, and all 9 CMDB sub-pages.
- TEVV-UI-39 safety-net test auto-fails CI when a new dashboard page is added without a TEVV check.

### Changed
- Removed duplicate `security-reports-export.yml` and `security-reports-stig-quarterly.yml` workflows.
- Merged `sync-wiki.yml` and `wiki-health-check.yml` into `docs-pipeline.yml` with preflight routing.

### Fixed
- `security-pipeline.yml`: CodeQL language identifier corrected (`javascript` → `javascript-typescript`); `npm install` → `npm ci`; QA report no longer hardcodes pass status.  <!-- `🛡️ Security tooling` -->
- `codeql.yml`: Narrowed triggers to `schedule`/`workflow_dispatch` only.  <!-- `🛡️ Security tooling` -->
- `copilot-pr-review.yml`: Removed comment-triggered fires.
- `compliance-labeler.yml`: Removed `synchronize` trigger.
- `docs-pipeline.yml`: Fixed bare `push:` trigger firing on all branches.


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v2.7.0 — 2026-03-26

> | Field | Value |
> |-------|-------|
> | **Version** | `2.7.0` |
> | **Release date** | 2026-03-26 |
> | **Tag** | `v2.7.0` |
> | **Release branch** | `release/2.7.0` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


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


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v2.6.0 — 2026-03-26

> | Field | Value |
> |-------|-------|
> | **Version** | `2.6.0` |
> | **Release date** | 2026-03-26 |
> | **Tag** | `v2.6.0` |
> | **Release branch** | `release/2.6.0` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


### Added
- Quantized GGUF model support for Ollama — configurable quantization levels for smaller memory footprints and faster local AI inference.

### Fixed
- Stale tier names on `/privacy` page.
- Missing `next/link` import and React type declarations in frontend components.

### Security
- `picomatch` upgraded to `2.3.2` (HIGH-severity ReDoS); `tinyglobby` updated to `4.0.4` in frontend.


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v2.5.0 — 2026-03-25

> | Field | Value |
> |-------|-------|
> | **Version** | `2.5.0` |
> | **Release date** | 2026-03-25 |
> | **Tag** | `v2.5.0` |
> | **Release branch** | `release/2.5.0` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


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


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v2.4.4 — 2026-03-22

> | Field | Value |
> |-------|-------|
> | **Version** | `2.4.4` |
> | **Release date** | 2026-03-22 |
> | **Tag** | `v2.4.4` |
> | **Release branch** | `release/2.4.4` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


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


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v2.4.3 — 2026-03-20

> | Field | Value |
> |-------|-------|
> | **Version** | `2.4.3` |
> | **Release date** | 2026-03-20 |
> | **Tag** | `v2.4.3` |
> | **Release branch** | `release/2.4.3` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


### Changed
- Release automation now syncs root/community README badges plus backend/frontend package versions on release-note updates.
- Release-note generation on `main` now has stronger idempotency guards to skip workflow-authored commits and duplicate version headings.
- v2.4.2 release documentation was backfilled with the missing PR coverage and aligned across CHANGELOG/release-note files.


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v2.4.2 — 2026-03-20

> | Field | Value |
> |-------|-------|
> | **Version** | `2.4.2` |
> | **Release date** | 2026-03-20 |
> | **Tag** | `v2.4.2` |
> | **Release branch** | `release/2.4.2` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


### Added

#### AI Security Hub

> **Tier:** 🟢 All tiers — security patches apply platform-wide.
> ⚠️ Action required: update to this version to receive all security fixes.
> **Affected area:** `backend/frontend`

- Consolidated AI security view with six GRC-native pillars: OWASP Top 10 for LLMs, NIST AI RMF alignment, EU AI Act readiness, PLOT4ai threat modeling, AI supply-chain risk, and agentic AI (AIUC-1) certification status.

#### Community Tier Expansion

> **Tier:** 🟢 All tiers
> **Affected area:** `backend/frontend`

- **BYOK Unlimited AI**: Community-tier organizations with their own API key now receive unlimited AI requests (`aiRequestsPerMonth: -1`).
- **Plot4AI**: Unlocked for Community tier — 138 AI threat cards now available without a Pro license.
- **Regulatory News**: Removed from `PRO_FEATURES` gate — available to all tiers.
- **AI Analysis**: All 9 AI analysis features accessible at Community tier with BYOK.

#### Crosswalk Engine Enhancements

> **Tier:** 🟢 All tiers
> **Affected area:** `backend/frontend`

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

> **Tier:** 🟢 All tiers
> **Affected area:** `backend/frontend`

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

> **Tier:** 🟢 Free (2 max) · Starter (5 max) · Professional+ (Unlimited)
> Crosswalk mappings available on all tiers.
> **Affected area:** `backend/frontend`

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

> **Tier:** 🟢 All tiers
> **Affected area:** `backend/frontend`

- `licenseService.js`: added `generateCommunityKey(licensee, seats)` — generates a local RSA-2048 keypair, signs a community-tier JWT (perpetual, no `exp`), returns `{ licenseKey, publicKey }`. Private key is discarded after signing.
- `licenseService.js`: added `setLocalPublicKey(pem)` — stores a PEM public key in-module as fallback when `CONTROLWEAVE_LICENSE_PUBKEY` env var is not set. Used to verify self-generated keys.
- `licenseService.js`: `validateLicenseKey()` now accepts an optional `overridePubKey` parameter for self-validation during key generation.
- `licenseService.js`: `saveLicenseToDb()` now accepts an optional `localPublicKey` parameter (persists PEM to new `server_license.local_public_key` column).
- `licenseService.js`: `loadLicenseKeyFromDb()` now returns `{ licenseKey, localPublicKey }` instead of a plain string.
- Migration `097_server_license_pubkey.sql`: adds `local_public_key TEXT` column to `server_license` — stores the public key from `generate-community` so self-signed keys survive server restarts without env var changes.
- New endpoint `POST /api/v1/license/generate-community` (platform owner only): generates, activates, and persists a community license key in one step.  <!-- `🔌 New API endpoint` -->
- New script `scripts/generate-community-license.js` (`@tier: exclude`): CLI tool to generate a community license key. Prints keys for `.env` by default; `--activate` mode writes to database directly.
- `server.js`: `ensureLicenseFromDb()` now loads `local_public_key` from DB and calls `setLocalPublicKey()` so self-generated keys validate correctly on restart.
- `server.js`: `ensureLicenseFromDb()` sends a one-time email notification to `PLATFORM_ADMIN_EMAIL` when no license is active on startup. Silent if SMTP is not configured (logs structured warning instead).

#### Community License Key Support & Self-Hosted License API (v2.3.2)

> **Tier:** 🟢 All tiers
> Rate limits vary by tier.
> **Affected area:** `backend`

- `licenseService.js`: Added `'community'` to `VALID_TIERS` — community-tier JWTs are now accepted by `validateLicenseKey()`. Previously, community license keys were silently rejected with "Invalid license tier".
- `edition.js`: Added `community: 'community'` to `LICENSE_TIER_TO_EDITION` — startup validation (`validateEdition()`) now correctly maps a community license to the community edition.
- New route `backend/src/routes/license.js` (`@tier: community`): provides `GET /api/v1/license` (current edition + persistence status) and `POST /api/v1/license/activate` (runtime license key activation with audit log). Both endpoints added to `server.js` and the public mirror allowlist.  <!-- `🔌 New API endpoint` -->
- Migration `096_server_license.sql`: new `server_license` table stores the activated key so it survives restarts. Users activate once via the UI — no `.env` editing required.  <!-- `📦 DB migration required` -->
- `server.js`: new `ensureLicenseFromDb()` startup function loads the DB-persisted license key and restores the edition automatically on restart.
- `licenseService.js`: added `heartbeatCheck()` — optional async background ping to `LICENSE_HEARTBEAT_URL` (disabled by default). Fires-and-forgets; connectivity failures are logged as warnings and **never revoke access**. Community self-hosted works fully offline.
- `backend/src/services/licenseService.js` and `backend/migrations/096_server_license.sql` added to the public mirror allowlist.
- Frontend: `licenseAPI.getInfo()` and `licenseAPI.activate(key)` added to `src/lib/api.ts`.
- `.env.example`: updated to explain that license keys are DB-persisted automatically, and to document the optional `LICENSE_HEARTBEAT_URL`.

#### BYOK — Unlimited AI Calls for Any Tier (v2.1.2)

> **Tier:** 🟢 All tiers
> **Affected area:** `backend/frontend`

- Community-tier orgs with a BYOK API key now receive unlimited AI requests. `AI_BYOK_BYPASS_TIERS` default changed from `'pro,enterprise,govcloud'` → `'community,pro,enterprise,govcloud'` in `tierPolicy.js`; propagates to `checkAIUsage`, `enforceDraftAiLimit`, `enforceImportAiLimit`.
- `/ai/status` endpoint now reports `limit: 'unlimited'`, `remaining: 'unlimited'`, `byokUnlimited: true` when bypass applies and org has ≥1 provider key configured. Previously returned the numeric cap regardless of actual enforcement.

#### Contributor License Agreement (v2.1.2)

> **Tier:** 🟢 All tiers
> **Affected area:** `backend/frontend`

- `docs/CLA.md` — Contributor License Agreement granting ControlWeave Inc. commercial relicense rights while contributors retain copyright.
- `CONTRIBUTING.md` — updated with CLA requirement and signing instructions.
- `.github/workflows/cla.yml` — automated CLA enforcement via `contributor-assistant/github-action`; signatures stored at `signatures/version1/cla.json`.

### Fixed

#### AI Monitoring (v2.1.2)

> **Tier:** 🟢 All tiers
> **Affected area:** `backend/frontend`

- AI Monitoring page usage card was always rendering `0 / 0` — `AIStatus` interface used non-existent flat fields (`usedThisMonth`, `monthlyLimit`); corrected to match actual API response shape (`usage: { used, limit, remaining, byokUnlimited }`).
- BYOK users now see ∞ Unlimited with a full green progress bar and "🔑 Using your own API key — no monthly cap" label.

#### Copy / Documentation (v2.1.2)

> **Tier:** 🟢 All tiers
> **Affected area:** `backend/frontend`

- Settings page: "3 AI requests per month" → "10 AI requests/month (unlimited with own API key)".
- Landing page Community tier: "AI-assisted assessments (10/mo)" → "(10/mo — unlimited with own API key)".
- Settings LLM section: surfaces BYOK unlimited benefit inline.

### Security

#### CLA Workflow Hardening (v2.1.2)

> **Tier:** 🟢 All tiers
> **Affected area:** `backend/frontend`

- Action pinned from mutable `cla-assistant/github-action@v2.6.1` to SHA `contributor-assistant/github-action@ca4a40a7d1004f18d9960b404b97e5f30a505a08` to eliminate supply-chain risk.
- Removed bot actor exclusions from job `if` condition — previously caused missing status checks for bot PRs, which could block branch protection. Bot auto-approval delegated to action's `allowlist`.

---

### Added (prior unreleased)

#### RMF Lifecycle (NIST SP 800-37 Rev 2)

> **Tier:** 🟢 Free · Starter · Professional · Enterprise
> Sidebar visible only when NIST 800-53, NIST 800-171, or CMMC 2.0 is active.
> **Affected area:** `backend/frontend/migration`

- Full RMF lifecycle dashboard with 7-step tracking: Prepare → Categorize → Select → Implement → Assess → Authorize → Monitor
- RMF packages linked to organization systems via nullable FK to `organization_systems`
- Authorization decision recording (ATO / DATO / IATT / Denial) with automatic deactivation of prior decisions
- Step transition history with audit trail (user, timestamp, notes, artifacts)
- CIA triad impact level tracking (Low / Moderate / High) per system categorization
- Sidebar entry gated on NIST 800-53, NIST 800-171, or CMMC 2.0 framework selection
- Migration 085: `rmf_packages`, `rmf_step_history`, `rmf_authorization_decisions` tables with CHECK constraints  <!-- `📦 DB migration required` -->

#### AI Platform

> **Tier:** 🟡 Free (10 req/mo, BYOK) · Starter (50 req/mo) · Professional+ (Unlimited)
> Advanced features (Multi-Agent, RAG, Reasoning Memory) require Professional+.
> **Affected area:** `backend/frontend`

- Multi-Agent Orchestrator — parallel agent execution with configurable timeout, consensus scoring, and structured output
- RAG Knowledge Base — document ingestion with semantic chunking, vector search, org-scoped retrieval
- Reasoning Memory — persistent chain-of-thought memory with TTL-based cache eviction and configurable cap
- Multi-Model AI Router — support for Anthropic Claude, OpenAI, Gemini, Grok, Groq, Ollama with automatic failover
- AI Copilot — org-aware conversational assistant with 25+ analysis features (gap analysis, compliance forecast, etc.)
- Per-framework LLM guardrails for BYOK configurations
- Platform fallback LLM defaults and provider model dropdowns
- AI Governance module — governance dashboard for AI risk management

#### Compliance Frameworks

> **Tier:** 🟢 Free (2 max) · Starter (5 max) · Professional+ (Unlimited)
> Crosswalk mappings available on all tiers.
> **Affected area:** `backend/frontend`

- CMMC 2.0 framework module with crosswalk mappings
- HIPAA/HITECH framework module
- MAESTRO framework — 16 attack class controls for AI security
- ISO/IEC AI standards coverage: 23894, 38507, 22989, 23053, 5259, TR 24027, TR 24028, TR 24368
- OWASP Top 10:2025 + NIST AI guidance implementation
- Financial Services compliance workspace
- EU AI Act Article 17 compliance checklist enhancements

#### Security & Risk Management

> **Tier:** 🟢 All tiers — security patches apply platform-wide.
> ⚠️ Action required: update to this version to receive all security fixes.
> **Affected area:** `backend/frontend`

- Threat Intelligence feed — real-time threat monitoring with filtering and sanitized output
- Vendor Risk / TPRM module — third-party risk management with questionnaires, SMTP notifications, AI risk assessment
- Regulatory News tracker — compliance news aggregation
- Vulnerability tracking with CVSS scoring and risk acceptance workflow
- PII data labeling and classification for evidence uploads
- Zero Trust Architecture implementation guide (NIST SP 800-207)

#### CMDB (Asset Management)

> **Tier:** 🔴 Starter · Professional · Enterprise · Utilities
> Not available on the Community tier.
> **Affected area:** `backend/frontend/migration`

- AI Agent asset type, service accounts, environments, password vaults
- SBOM/AIBOM support for software and AI asset inventories
- CMDB import with AI-powered field mapping
- Vulnerability badges on asset cards

#### Platform & Administration

> **Tier:** 🔵 Internal / Platform Admin only
> Accessible only to platform owners (Conteh Consulting LLC).
> **Affected area:** `backend/frontend`

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

> **Tier:** ⚙️ Internal / Infrastructure — not tier-gated.
> **Affected area:** `ci/cd`

- CM branch naming convention enforcement via GitHub Actions (`<type>/CW-<number>/<short-desc>`)
- Release workflow — tag-triggered GitHub Release creation from CHANGELOG.md
- Docs pipeline automation — screenshots, quality checklist, auto-close
- CodeQL v4 upgrade with dedicated scanning workflow  <!-- `🛡️ Security tooling` -->
- Gitleaks configuration for secrets detection (with false positive handling)  <!-- `🛡️ Security tooling` -->
- Container security scan pipeline fixes
- IP hygiene CI checks for marketing copy

#### Frontend & Marketing

> **Tier:** ⚙️ Internal / Infrastructure
> SEO and marketing pages are public but not a platform feature.
> **Affected area:** `frontend`

- SEO infrastructure — blog pages, framework landing pages, SEO components, OG image previews
- Marketing overhaul — landing pages with self-serve Stripe checkout  <!-- `💳 Stripe integration` -->
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
- Stripe billing flow — redirect after registration, checkout session creation, portal session `returnUrl` validation  <!-- `💳 Stripe integration` -->
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
- SARIF upload gracefully skipped when GitHub Code Scanning is not enabled  <!-- `🛡️ Security tooling` -->
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


### 📦 Database Migrations

> Run these migrations in order before starting the updated server.

- **Migration 085**: `rmf_packages`, `rmf_step_history`, `rmf_authorization_decisions` tables with CHECK constraints

```bash
# Apply all pending migrations
cd controlweave/backend && npm run migrate
```

### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 16 |
| 🟡 Pro | 1 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 3 |


---

## v0.3.0 — 2026-02-18

> | Field | Value |
> |-------|-------|
> | **Version** | `0.3.0` |
> | **Release date** | 2026-02-18 |
> | **Tag** | `v0.3.0` |
> | **Release branch** | `release/0.3.0` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


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


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v0.2.1 — 2026-02-05

> | Field | Value |
> |-------|-------|
> | **Version** | `0.2.1` |
> | **Release date** | 2026-02-05 |
> | **Tag** | `v0.2.1` |
> | **Release branch** | `release/0.2.1` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


### Fixed
- Database migration script: resolved foreign key constraint error on `framework_controls` table  <!-- `📦 DB migration required` -->
- API route `/api/v1/controls`: corrected pagination offset bug returning duplicate records on page 2+
- Login flow: fixed redirect loop when session token expired during SSO handoff

---


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v0.2.0 — 2026-01-22

> | Field | Value |
> |-------|-------|
> | **Version** | `0.2.0` |
> | **Release date** | 2026-01-22 |
> | **Tag** | `v0.2.0` |
> | **Release branch** | `release/0.2.0` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


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
- Legacy CSV import format (v1): will be removed in v0.4.0  <!-- `🕐 Deprecation notice` -->

### Security
- Implemented field-level encryption for PII in `user_profiles` table
- Rate limiting added to all public API endpoints: 100 req/min per IP  <!-- `🔌 New API endpoint` -->

---


### 🕐 Deprecation Notices

- ### Deprecated
- Legacy CSV import format (v1): will be removed in v0.4.0

### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

## v0.1.0 — 2026-01-05

> | Field | Value |
> |-------|-------|
> | **Version** | `0.1.0` |
> | **Release date** | 2026-01-05 |
> | **Tag** | `v0.1.0` |
> | **Release branch** | `release/0.1.0` |
> | **Built from** | `0acb1a4f` |
> | **Ref** | `refs/heads/main` |


### Added
- Initial project scaffolding: Next.js frontend, Node.js API, PostgreSQL database
- NIST AI RMF framework: Govern, Map, Measure, Manage categories with evidence placeholders
- Basic dashboard: control status overview, evidence count, completion percentage
- Authentication: email/password login with bcrypt hashing
- VS Code dev environment: ESLint, Prettier, Husky pre-commit hooks configured
- README.md: project overview, setup instructions, environment variable reference

---


### 📊 Tier Availability Summary

| Tier | New/Changed Sections |
|------|---------------------|
| 🟢 Community | 0 |
| 🟡 Pro | 0 |
| 🔵 Enterprise | 0 |
| ⚙️ Gov Cloud | 0 |
| ⚙️ Internal/Infra | 0 |


---

<!-- Generated by generate-internal-release-notes.js on 2026-08-10T23:37:50.520Z -->
<!-- CM commit convention: docs(release): generate internal release notes for v<version> [skip ci] -->
