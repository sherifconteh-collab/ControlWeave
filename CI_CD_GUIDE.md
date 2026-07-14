# CI/CD Guide

Consolidated reference for ControlWeaver's CI/CD pipeline: what actually runs today, what
each check evidences for compliance frameworks, and how to work with it day to day.

This supersedes the older `CI_CD_COMPLIANCE_MAPPING.md`, `CI_CD_IMPLEMENTATION_SUMMARY.md`,
`CI_CD_PIPELINE_GUIDE.md`, `CI_CD_QUICK_REFERENCE.md`, `CI_WORKFLOW_ANALYSIS.md`,
`GITHUB_ACTIONS_ARTIFACT_FIX.md`, `GITHUB_ACTIONS_PERMISSIONS_FIX.md`, and
`PIPELINE_ARCHITECTURE.md`, which described earlier/aspirational states of the pipeline.
Where those docs disagreed with the actual workflow YAML, this doc follows the YAML.

---

## 1. Pipeline Architecture

There are **two separate GitHub Actions pipelines** covering PRs, plus a handful of
supporting workflows. They are not the same thing and gate merges differently.

### 1.1 `.github/workflows/ci.yml` — the TEVV pipeline (hard gate)

This is the pipeline described in `CLAUDE.md`'s "CI Pipeline (TEVV)" section and is the
one that actually blocks merges via required status checks. Runs on push to `main`/`master`
and on every pull request. Six jobs, all mandatory:

1. **`backend`** — Backend Syntax & IP Hygiene: `npm ci`, `npm run check:syntax`,
   `npm run check:ip-hygiene` (with `IP_HYGIENE_FAIL_ON_STANDARDS=true`).
2. **`frontend`** — Typecheck & Build: `npm ci`, `npm run generate:api-types`,
   `npm run typecheck`, `npm run build`.
3. **`security`** — Dependency Vulnerability Scan: `npm ci && npm audit --audit-level=high`
   for **both** backend and frontend, full dependency tree (not `--production`-scoped).
   Zero high-severity CVEs required.
4. **`tevv-api`** — 12 sub-checks (TEVV-API-1 through TEVV-API-12) verifying: every route
   file is syntactically valid, registered in `server.js`, exports a loadable Express
   router, applies `authenticate` middleware (with a documented public-route exemption
   list), has RBAC (`requirePermission`) on compliance-domain routes, has SOD
   (`requireSod`) on approval-workflow routes, has frontend API client coverage, and — for
   any *new* route file — imports `express-rate-limit` directly (a large baseline of
   pre-existing route files is grandfathered against this last check; see the inline
   comment in `ci.yml` for why CodeQL can't see the custom Redis-backed rate limiter).
5. **`tevv-db`** — Runs all migrations against a fresh Postgres 17 service container, then
   checks migration file naming (`NNN_` prefix), flags any *new* duplicate migration
   numbers (a known set of legacy duplicates from parallel merges is grandfathered),
   verifies the seed script covers all expected framework codes and NIST 800-53 families,
   validates specific migrations exist (086 state AI laws, 087 international AI laws, 082
   financial AI governance), and does structural SQL sanity checks (matched `DO $$` blocks,
   no unterminated string literals).
6. **`tevv-ui`** — ~27 sub-checks verifying, per major feature area, that the frontend page
   exists, the backend route is registered in `server.js`, and the page imports the
   correct API client wrapper (with documented exceptions for pages that are static
   marketing content, redirect stubs, or consume a different API client than their route
   name would suggest — each exception has an inline comment explaining why).

None of these six jobs are advisory — a failure in any of them blocks merge.

### 1.2 `.github/workflows/security-pipeline.yml` — SAST/DAST/SBOM/AIBOM pipeline

Runs on push to `main`/`develop`, on PRs targeting `main`/`develop`, and on manual dispatch.
This is the pipeline the older docs described in detail. It has more jobs than `ci.yml`,
but **only a subset are actually mandatory** for its own final gate job
(`✅ All Security & QA Checks Passed`):

| Job | Mandatory? | Notes |
|---|---|---|
| `backend-build` | Yes | `check:syntax`, `check:ip-hygiene` (non-strict), build, `npm audit --audit-level=moderate --production` |
| `frontend-build` | Yes | typecheck, lint, build, `npm audit --audit-level=moderate --production` |
| `qa-testing` | Yes (job result) | Runs migrations + syntax/hygiene checks (blocking) **plus** the dynamic E2E suite and crosswalk verification, both wrapped in `continue-on-error: true` — those two sub-steps can fail without failing the job |
| `dependency-scan` | Yes (or skipped) | `npm audit --json` for both apps, non-fatal (`\|\| true`) — informational artifact, not a gate itself (the real audit gate is `backend-build`/`frontend-build` above and `ci.yml`'s `security` job) |
| `generate-sbom` | Yes (or skipped) | CycloneDX SBOM for backend + frontend |
| `generate-aibom` | Yes (or skipped) | Custom AI/ML BOM via `scripts/generate-aibom.js`, posted as a PR comment |
| `codeql-analysis` | **No — non-blocking** | Runs CodeQL (`security-extended,security-and-quality` queries) but `upload: never`; results are saved as a workflow artifact (SARIF), not uploaded to the GitHub Security tab, because **GitHub Advanced Security / Code Scanning is not enabled on this repository** |
| `secrets-scan` | **No — non-blocking** | TruffleHog (`--only-verified`) + Gitleaks |
| `container-security` | Not in the gate at all | Builds backend/frontend Docker images, scans with Trivy; SARIF upload to GitHub Security is conditionally attempted only if a runtime check confirms the Code Scanning API is enabled (it currently isn't, so this step no-ops) — results still land as a workflow artifact either way |
| `dast-scan` | Not in the gate at all | OWASP ZAP baseline scan against `https://demo.controlweave.com` — only runs on push to `main`, never on PRs |
| `vulnerability-analysis` | **No — non-blocking (best-effort)** | Runs `scripts/analyze-vulnerabilities.js` with `FAIL_ON_SEVERITY=high` against all downloaded scan artifacts; see §1.3 |
| `security-report` | Yes (or skipped) | Consolidates all findings into an HTML report + PR comment |

So in practice: **build/typecheck/lint/moderate-severity-production-audit/SBOM/AIBOM are
the hard requirements** of this pipeline; CodeQL, secrets scanning, and the
vulnerability-severity gate are evidence-generating but do not currently block the
`all-checks-passed` job on their own. If you need "CodeQL must pass" or "no secrets" to be
a hard merge gate, that has to be added at the branch-protection level, not assumed from
this workflow's internal logic.

### 1.3 Vulnerability analysis & risk acceptance

`vulnerability-analysis` builds a suppression list from GitHub issues that were closed with
labels `security,vulnerability-review,risk-accepted` — that label is only ever applied by
`.github/workflows/vulnerability-risk-acceptance.yml`, and only after it verifies every item
in the issue's Review Checklist was actually checked off before closure (closing an issue
for any other reason does not suppress the finding). `scripts/analyze-vulnerabilities.js`
then runs with `FAIL_ON_SEVERITY=high`, so Critical/High findings (net of suppressions) fail
that step. When `needs_review > 0`, a single consolidated GitHub issue is created/updated
(not one issue per finding) summarizing Critical/High/Medium counts, and a PR comment links
to it. `.github/workflows/scan-finding-resolution.yml` is a separate workflow that reacts to
that issue lifecycle.

### 1.4 Other workflows worth knowing about

- **`codeql.yml`** — a *separate* CodeQL workflow, scheduled weekly (Monday 08:00 UTC) plus
  manual dispatch only. It explicitly does not run on push/PR to avoid duplicating the
  CodeQL job inside `security-pipeline.yml`. Same "no GitHub Advanced Security" caveat
  applies — results are saved as artifacts.
- **`security-reports.yml`** — daily (02:00 UTC) audit-log/vulnerability/controls-status
  reports plus a quarterly (1 Jan/Apr/Jul/Oct) DISA STIG compliance report, both exported to
  `controlweave/docs/wiki/security/reports/` with 365-day retention (DISA STIG
  APSC-DV-000840 / NIST AU-11). This is a **consolidation of two previously separate
  workflows** (`security-reports-export.yml` and a quarterly STIG workflow) into one file —
  if you're looking for `security-reports-export.yml` by name, it no longer exists under
  that name.
- **`scan-finding-resolution.yml`**, **`vulnerability-risk-acceptance.yml`** — support the
  Fix/Mitigate/Accept/False-Positive vulnerability review workflow referenced in §1.3.
- **`docs-pipeline.yml`** — the current documentation-update workflow (earlier docs
  referenced `auto-review-docs.yml`/`wiki-health-check.yml`/`docs-auto-update.yml`, none of
  which exist in this repo anymore).
- **`azure-pipelines.yml`** (repo root) — an Azure DevOps mirror of the same security
  controls, still present (~600 lines), for teams running Azure Pipelines instead of/in
  addition to GitHub Actions.

### 1.5 Artifacts generated

| Artifact | Format | Retention | Source job |
|---|---|---|---|
| `dependency-audit-results` | JSON | 30 days | `dependency-scan` |
| `codeql-results-*` | SARIF | 30 days | `codeql-analysis` |
| `container-scan-results` | SARIF | 30 days | `container-security` |
| `sbom-artifacts` | CycloneDX JSON | 90 days | `generate-sbom` |
| `aibom-artifacts` | JSON + Markdown | 90 days | `generate-aibom` |
| `vulnerability-analysis` | JSON + Markdown | 90 days | `vulnerability-analysis` |
| `dast-results` | HTML + JSON | 30 days | `dast-scan` (main only) |
| `security-report` | HTML | 90 days | `security-report` |
| `qa-test-results` | Markdown | 30 days | `qa-testing` |

### 1.6 Resolved history: artifact-upload and Actions-API permission fixes

Two permission issues were previously hit and fixed; both are reflected in the current
`security-pipeline.yml` permissions block (`actions: write`, which is a superset of
`actions: read`), so there is nothing outstanding here — noted only so the reasoning isn't
lost:

- `actions/upload-artifact@v4` requires `actions: write` (not just `read`) to finalize an
  upload; workflows that only had `actions: read` got a 403 on the finalize step.
- Workflows/actions that query the Actions API (e.g. workflow run status via
  `actions/github-script`) need `actions: read` at minimum or they get "Resource not
  accessible by integration."
- The three other workflow files these fixes originally touched
  (`auto-review-docs.yml`, `wiki-health-check.yml`, `docs-auto-update.yml`) no longer exist
  under those names — see §1.4.

---

## 2. Compliance Mapping

The pipeline's controls satisfy requirements across the frameworks ControlWeave itself
supports. This is the evidence-generation mapping used when the pipeline's own artifacts
are cited as audit evidence (e.g. in a SOC 2 or NIST 800-53 authorization package for
ControlWeave's own development process).

**Evidence caveat:** several of the mappings below assume CodeQL/Trivy findings land in
"GitHub Security" as a system of record. As of this pipeline configuration, GitHub Advanced
Security / Code Scanning is **not enabled**, so those findings exist only as workflow
artifacts (SARIF, 30-day retention) and PR/issue comments — not as persistent GitHub
Security tab entries. Treat "GitHub Security findings" below as "SARIF workflow artifacts"
unless Advanced Security is turned on.

### NIST 800-53

| Control | Requirement | CI/CD Implementation |
|---------|-------------|---------------------|
| SA-3 | SDLC | Build, test, security scanning, deployment stages in `ci.yml` + `security-pipeline.yml` |
| SA-4 | Acquisition Process | SBOM generation for all dependencies |
| SA-8 | Security Engineering Principles | Defense in depth, fail-secure design |
| SA-10 | Developer Config Management | Git-based version control, branch protection |
| SA-11 | Developer Security Testing | SAST (CodeQL), DAST (OWASP ZAP), dependency scanning, secrets detection |
| SA-15 | Standardized Process | Standardized pipeline, quality gates |
| SA-17 | Security Architecture | Multi-layer scanning, fail-fast where mandatory |
| RA-3 | Risk Assessment | Vulnerability analysis with severity categorization |
| RA-5 | Vulnerability Monitoring | CodeQL, npm audit, Trivy, secrets detection |
| RA-5(3) | Breadth/Depth of Coverage | 5 scan types: SAST, DAST, dependency, secrets, container |
| SI-2 | Flaw Remediation | Vulnerability flagging, tracking issue, fix verification |
| SI-3 | Malicious Code Protection | Secrets scanning, code analysis, container scanning |
| SI-4 | System Monitoring | Continuous scanning on every commit |
| SI-7 | Software/Info Integrity | SBOM generation, build verification |
| SI-10 | Input Validation | Syntax checking, type checking, linting (`ci.yml` `tevv-*` jobs) |
| CM-2 | Baseline Configuration | Dockerfiles, reproducible builds |
| CM-3 | Change Control | Branch protection, mandatory reviews, `ci.yml` as required check |
| CM-4 | Impact Analysis | Vulnerability impact classification |
| CM-7 | Least Functionality | Minimal container images |
| CM-11 | User-Installed Software | Dependency scanning, SBOM tracking |
| AU-2/AU-3 | Event Logging / Content | All pipeline runs logged; artifact generation |
| AU-6 | Audit Review | Security report generation |
| AU-9 | Audit Protection | GitHub audit trail |
| AU-11 | Audit Record Retention | 30–90 day artifact retention; 365-day security report retention (§1.4) |
| AC-2/AC-3/AC-6 | Access Control | GitHub auth, branch protection, non-root containers |

### ISO 27001:2022

`A.8.1` inventory (SBOM/AIBOM), `A.8.2` ownership (Git provenance), `A.5.14`/`A.5.15`
supplier relationships (dependency + AI provider tracking), `A.8.8` vulnerability
management, `A.8.15` logging, `A.8.16` monitoring, `A.8.31` dev/test/prod separation,
`A.8.32` change management (mandatory review + automated testing).

### SOC 2 Trust Services Criteria

`CC6.1`/`CC6.6` access control (branch protection, auth), `CC7.1`–`CC7.4` system operations
(mandatory review, continuous scanning, threat evaluation, issue escalation), `CC8.1`
change management, `CC9.1`/`CC9.2` risk mitigation.

### NIST AI RMF, EU AI Act, ISO 42001

The `generate-aibom` job is the primary evidence source: it documents AI/ML dependencies,
LLM provider usage (Anthropic, OpenAI, Google, xAI, Groq, Ollama), data flows, and privacy
controls. This satisfies NIST AI RMF GOVERN/MAP/MEASURE/MANAGE categories concerned with
transparency and risk documentation, EU AI Act Art. 11 (technical documentation, regenerated
every pipeline run), and ISO 42001 Clause 7.5 (documented information).

### OWASP LLM Top 10

Mapped primarily through AIBOM documentation (LLM03 no training on customer data, LLM05
supply-chain via dependency scanning of AI SDKs, LLM06 secrets scanning preventing API key
leaks, LLM08/LLM09 AIBOM documents AI is advisory-only with required human review, LLM10
BYOK architecture). LLM01/LLM07 are marked not applicable (no user-controlled prompts or
plugins in the CI/CD pipeline itself).

### GDPR, HIPAA, NIST CSF 2.0, NIST 800-171, NERC CIP, FFIEC, NIST Privacy Framework, NIST 800-207

All draw on the same underlying evidence: branch protection + auth (access control
articles/standards), secrets scanning + encryption (confidentiality/integrity), SBOM/AIBOM
(asset inventory / supply chain), vulnerability analysis (risk assessment / patch
management), and the 30–90/365-day artifact retention tiers (audit trail requirements). See
git history for the full per-control breakdown if you need the exhaustive table for an audit
package — it was pruned here to the load-bearing summary because the exhaustive version was
mostly repeating this same pattern 80+ times across frameworks.

### Framework Coverage Summary

| Framework | Coverage |
|-----------|----------|
| NIST 800-53 | 25+ controls across 6 families |
| ISO 27001:2022 | 4 annexes |
| SOC 2 | 9 trust services criteria |
| NIST AI RMF | 4 functions (GOVERN/MAP/MEASURE/MANAGE) |
| EU AI Act | Art. 9, 10, 11, 15 |
| ISO 42001 | Clauses 6, 7, 8, 9 |
| OWASP LLM Top 10 | 10 risks addressed |
| GDPR | Art. 5, 25, 30, 32, 35 |
| HIPAA | Administrative + Technical Safeguards |
| NIST CSF 2.0 | All 5 functions |
| NIST 800-171 | Access Control, Audit, Config Mgmt, Sys/Comms Protection, Sys/Info Integrity |
| NERC CIP | CIP-002, 003, 007, 010 |
| FFIEC | Development/Acquisition, Vulnerability/Patch Mgmt, Audit |
| NIST Privacy Framework | Identify-P, Govern-P, Control-P |
| NIST 800-207 (Zero Trust) | All 5 principles |

Compliance evidence generated here (SBOM, AIBOM, vulnerability reports, security reports,
audit logs) can be cited toward SOC 2 Type II, ISO 27001, NIST 800-53 authorization
packages, HIPAA, GDPR DPIA documentation, and EU AI Act conformity assessments — but always
verify the specific evidence artifact still exists and matches current pipeline behavior
before citing it, rather than assuming this mapping is exhaustive or current for a live
audit.

---

## 3. Quick Reference

### 3.1 Before you push

```bash
# Backend (controlweave/backend)
npm run check:syntax
npm run check:ip-hygiene
npm run build
npm audit --audit-level=high        # matches ci.yml's dedicated security job
npm audit --audit-level=moderate --production   # matches security-pipeline.yml gate

# Frontend (controlweave/frontend)
npm run generate:api-types
npm run typecheck
npm run lint
npm run build
npm audit --audit-level=high
npm audit --audit-level=moderate --production

# QA (controlweave/backend, requires a running Postgres 17 + migrated DB)
npm run qa:e2e:dynamic
npm run qa:e2e:auditor
```

### 3.2 What happens when you open a PR

Both `ci.yml` and `security-pipeline.yml` trigger. `ci.yml`'s six jobs
(backend/frontend/security/tevv-api/tevv-db/tevv-ui) are the hard gate per CLAUDE.md.
`security-pipeline.yml` additionally builds/tests, generates SBOM/AIBOM, runs CodeQL and
secrets scanning (both non-blocking today), and runs the vulnerability-severity analysis
(also non-blocking on its own, though `FAIL_ON_SEVERITY=high` inside
`analyze-vulnerabilities.js` will still exit non-zero on High/Critical net of accepted-risk
suppressions).

Typical total time across both pipelines: 20–35 minutes.

### 3.3 Vulnerability severity levels

| Severity | `analyze-vulnerabilities.js` behavior |
|----------|--------|
| Critical / High | `FAIL_ON_SEVERITY=high` → step fails; net of any suppression from a completed risk-acceptance review (§1.3) |
| Medium | Included in the consolidated review issue; does not fail the step |
| Low / Info | Logged only |

### 3.4 If your PR fails

| Failure | Where to look | Fix |
|---|---|---|
| Syntax/typecheck/lint error | `backend`/`frontend` job in `ci.yml` | Fix the code; `npm run lint -- --fix` for lint |
| `tevv-api`/`tevv-db`/`tevv-ui` failure | Job step name tells you which sub-check (e.g. TEVV-API-9 = missing `authenticate` middleware) | Match the route/page/migration to the pattern the check expects — see `.claude/rules/api-design.md`, `database.md` |
| `npm audit` failure | `security` job (`ci.yml`) or `backend-build`/`frontend-build` (`security-pipeline.yml`) | `npm audit fix`, or bump the specific package |
| Secrets detected | `secrets-scan` (non-blocking, but fix it anyway) | Remove the secret, rotate it, use env vars |
| High/Critical vulnerability flagged | `vulnerability-analysis` job / consolidated GitHub issue | Fix, or go through the risk-acceptance review (Fix/Mitigate/Accept/False-Positive) so `vulnerability-risk-acceptance.yml` can label it `risk-accepted` |

Push fixes to the same branch; both pipelines re-run automatically.

### 3.5 Emergency bypass

Only for genuine incidents (production down, urgent security patch): a repo admin can
temporarily disable a required status check, must re-enable it immediately after merge, and
a follow-up PR must address whatever was skipped. This should be exceptionally rare.

### 3.6 Getting help

- Pipeline behavior questions: this document, then the actual workflow YAML in
  `.github/workflows/` (it is the source of truth — this doc summarizes it, not the reverse).
- `tevv-*` failures: read the specific check's inline `run:` block in `ci.yml` — each one
  prints a `❌`/`✅` message identifying exactly what it expected.
- Security/vulnerability questions: check the `vulnerability-analysis` and
  `security-report` artifacts on the run, and the consolidated review issue if one was
  created.
