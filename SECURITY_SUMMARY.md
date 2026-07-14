# Security Summary

Consolidated security reference for ControlWeaver: current cryptographic/auth posture,
the multi-framework security baseline (DISA STIG + friends), dependency audit posture, and
a couple of specific design decisions worth knowing about.

This supersedes `SECURITY_AUDIT_REPORT.md`, `SECURITY_BASELINE_IMPLEMENTATION.md`,
`SECURITY_ENHANCEMENT_COMPLETE.md`, `SECURITY_IMPLEMENTATION_SUMMARY.md`, and
`SECURITY_SUMMARY_UPDATE.md`. Where those docs stated numbers that have since changed
(bcrypt cost, JWT algorithm), this doc uses the values in the current code, not the
historical ones — see `.claude/rules/security.md` for the enforced baseline going forward.

## 1. Current Cryptographic & Auth Posture

Source of truth: `controlweave/backend/src/config/security.js`,
`controlweave/backend/src/utils/encrypt.js`,
`controlweave/backend/src/utils/passwordPolicy.js`.

- **Password hashing:** bcryptjs, cost factor **14** (raised from an earlier cost-12
  baseline described in some older docs — 14 is now used consistently at every
  `bcrypt.hash()` call site: `users.js`, `platformAdmin.js`, `server.js`, `auth.js`,
  `ssoService.js`, `totp.js`).
- **Password policy:** 15-character minimum, mandatory complexity (uppercase, lowercase,
  digit, special character) — `passwordPolicy.js`.
- **Account lockout:** 5 failed attempts (`LOCKOUT_MAX_ATTEMPTS`), 15-minute lockout window
  (`LOCKOUT_DURATION_MS`), both env-overridable.
- **JWT signing:** HS384 is the signing algorithm (`JWT_ALGORITHM`), per CNSA Suite 1.0's
  SHA-384+ floor. `jwt.verify` is pinned to an explicit algorithm allow-list
  (`JWT_VERIFY_OPTIONS`) of `['HS384', 'HS256']` — HS256 is accepted only as a
  backward-compatible transitional measure so pre-cutover sessions aren't invalidated; drop
  it from the allow-list once all such tokens have expired (>= max refresh-token TTL). This
  is *not* HS256-only, contrary to what some earlier security docs implied.
- **Field-level encryption:** AES-256-GCM (`utils/encrypt.js`), 96-bit IV, 128-bit auth tag,
  32-byte key from `ENCRYPTION_KEY` (required in production, dev fallback otherwise).
- **Token/lookup hashing:** HMAC-SHA-384 / SHA-384 (`sha384`, `hashToken`,
  `hashForLookup`), meeting the CNSA Suite 1.0 SHA-384+ requirement. Legacy SHA-256
  candidates are still accepted transitionally via `verifyTokenHash`/`tokenHashCandidates`
  so tokens issued before the SHA-384 cutover keep resolving until they expire — this is a
  deliberate rotation window, not a downgrade.
- **TLS:** `tls.DEFAULT_MIN_VERSION` enforced at TLS 1.2+; HSTS and DB SSL also enforced.
- **CNSA Suite 1.0 self-audit:** `encrypt.js` exports `auditEncryptionStrength()`, which
  checks algorithm, key length, HMAC strength, TLS minimum version, a functional
  encrypt/decrypt round-trip, and whether production keys are actually configured (vs. the
  insecure dev fallback). Useful to run after any crypto-adjacent change or as an
  automated STIG assessment input.
- **JWT secret:** must be ≥32 characters in production (enforced at startup —
  `resolveJwtSecret()` throws if unset or too short in production); a random ephemeral
  secret is generated for local dev if `JWT_SECRET` is unset (with a console warning).

## 2. Multi-Framework Security Baseline (DISA STIG + 9 others)

ControlWeaver ships scripts to seed a DISA STIG Application Security (V5R3) framework and
apply a 10-framework security baseline to organizations, primarily useful for audit
readiness and as a starting point for GovCloud/federal-adjacent deployments.

### 2.1 Frameworks in the baseline

1. DISA Application Security and Development STIG V5R3 (`disa_stig_app`, 65+ controls)
2. NIST SP 800-53 Rev 5
3. NIST Cybersecurity Framework 2.0
4. ISO/IEC 27001:2022
5. SOC 2 Type II
6. HIPAA Security Rule
7. GDPR
8. NIST SP 800-171 Rev 3 (CUI)
9. NIST Privacy Framework 1.0
10. NIST AI Risk Management Framework 1.0

DISA STIG control categories: authentication & access control, cryptography (FIPS 140-2
posture), input validation/output encoding, session management & CSRF, audit & logging
(1-year retention — APSC-DV-000840), security testing (SAST/DAST), configuration
management, API security, container/cloud security, supply chain (SBOM), incident response,
privacy controls, SIEM integration.

### 2.2 Setup commands

```bash
cd controlweave/backend

# 1. Seed the DISA STIG framework (65+ controls)
node scripts/seed-disa-stig-framework.js

# 2. Apply the 10-framework baseline to all organizations
#    (auto-creates implementation records for Priority 1 controls)
node scripts/apply-security-baseline.js

# 3. Generate security reports (audit logs, vulnerabilities, controls status, STIG)
node scripts/export-security-reports.js

# 4. Verify the whole setup (6-phase check: frameworks, baseline, audit logging,
#    vulnerability mgmt, SIEM, wiki reports)
node scripts/verify-security-baseline.js
```

Verify framework install directly:
```sql
SELECT code, name, version FROM frameworks WHERE code = 'disa_stig_app';
```

Verify baseline application per org:
```sql
SELECT f.code, f.name, COUNT(ci.id) AS control_implementations
FROM organization_frameworks ofw
JOIN frameworks f ON ofw.framework_id = f.id
LEFT JOIN framework_controls fc ON fc.framework_id = f.id
LEFT JOIN control_implementations ci ON ci.control_id = fc.id
WHERE ofw.organization_id = '<org-id>'
GROUP BY f.code, f.name ORDER BY f.code;
```

### 2.3 Automated report export & retention

`.github/workflows/security-reports.yml` runs daily (02:00 UTC) audit-log/vulnerability/
controls-status reports and a quarterly (1 Jan/Apr/Jul/Oct, 02:00 UTC) DISA STIG compliance
report, both exported to `controlweave/docs/wiki/security/reports/<org-slug>/` as
`<type>-YYYY-MM-DD.md`, with a generated `reports/README.md` index. (This workflow
consolidates what used to be two separate files — if you're looking for
`security-reports-export.yml` or a standalone quarterly-STIG workflow by name, they were
merged into `security-reports.yml`.)

**Retention periods** (DISA STIG APSC-DV-000840 / NIST 800-53 AU-11):
- Audit logs & security reports: 365 days, enforced automatically on each export run
- Vulnerability data: until remediation + 90 days
- Evidence files: configurable, default 365 days (`jobService.js` retention cleanup)

Manual retention check:
```sql
SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) AS log_count,
       MIN(created_at) AS oldest_log, MAX(created_at) AS newest_log
FROM audit_logs GROUP BY 1 ORDER BY 1 DESC;
```

### 2.4 STIG vulnerability management

Supported upload formats: DISA STIG checklists (`.ckl`), ACAS/Nessus scans, SBOM
(SPDX/CycloneDX), SCAP (OVAL/XCCDF). Upload via **Security → Vulnerabilities → Upload
Vulnerability Data**; the system parses and imports findings automatically, populating
`stig_id` (e.g. `V-100000`), `source = 'STIG'`, `standard = 'DISA STIG'`, and asset linkage.
Sample file: `controlweave/backend/demo/vulnerability-upload-samples/sample-stig-checklist.xml`.

```sql
SELECT source, standard, severity, status, COUNT(*) AS finding_count
FROM vulnerability_findings WHERE source = 'STIG'
GROUP BY source, standard, severity, status
ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2
                        WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END;
```

### 2.5 SIEM integration (optional)

Configure under **Settings → SIEM Configuration**: Splunk, Elastic, generic webhook, or
syslog, with encrypted API credentials and a connection test. Check forwarding status:

```sql
SELECT event_type, COUNT(*) AS total,
       COUNT(CASE WHEN siem_forwarded THEN 1 END) AS forwarded,
       COUNT(CASE WHEN NOT siem_forwarded THEN 1 END) AS pending
FROM audit_logs WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY event_type;
```

### 2.6 Troubleshooting

| Problem | Fix |
|---|---|
| "Connection refused" | `pg_isready`; check `.env` credentials; `psql -h localhost -U user -d controlweave` |
| "Framework disa_stig_app not found" | Re-run `node scripts/seed-disa-stig-framework.js` |
| "No organizations found" | Create one, then re-run `apply-security-baseline.js` |
| Reports not generating | `mkdir -p controlweave/docs/wiki/security/reports`; check write permissions; re-run export script |
| GitHub Actions export failing | Verify `DATABASE_URL` (and `DB_*`) secrets are configured in repo settings; manually dispatch the workflow to see full logs |

### 2.7 Maintenance cadence

Daily: automated report generation, audit log review, SIEM alert monitoring. Weekly: review
new vulnerability findings, update control implementation status. Monthly: complete control
assessments, security code reviews. Quarterly: full DISA STIG assessment, third-party
testing, incident response drills. Annually: audit prep, penetration testing, STIG version
review, policy updates.

## 3. Control Implementation Reference (selected DISA STIG APSC-DV controls)

| Control ID | Title | Implementation |
|------------|-------|----------------|
| APSC-DV-000160 | Multi-Factor Authentication | JWT + optional TOTP MFA |
| APSC-DV-000170 | Password Complexity | bcryptjs hashing, complexity regex (`passwordPolicy.js`) |
| APSC-DV-000180 | Password Min Length | 15-char minimum |
| APSC-DV-000190 | Account Lockout | 5 attempts / 15-minute lockout (env-configurable) |
| APSC-DV-000200 | Session Management | JWT with expiry, refresh-token rotation |
| APSC-DV-000220 | FIPS 140-2 Crypto | Node.js `crypto` module; FIPS mode itself not enabled at the OS/OpenSSL level |
| APSC-DV-000230 | Data at Rest Encryption | AES-256-GCM field-level + HMAC-SHA-384 lookup hash (migrations 098–099) |
| APSC-DV-000240 | TLS 1.2+ | HSTS + DB SSL + `tls.DEFAULT_MIN_VERSION = 'TLSv1.2'` |
| APSC-DV-000480 | SQL Injection Prevention | Parameterized queries only (`pg` pool, `$1`/`$2`) |
| APSC-DV-000490 | XSS Prevention | Input sanitization, no `dangerouslySetInnerHTML` |
| APSC-DV-000530 | CSRF Protection | Token-based |
| APSC-DV-000800/810/820 | Audit Log Generation/Content/Protection | Full AU-2 compliance, 15+ fields, separate protected table |
| APSC-DV-000840 | 1-Year Audit Retention | Automated via `security-reports.yml` (§2.3) |
| APSC-DV-001620/001630 | SAST / DAST | CodeQL + OWASP ZAP — see `CI_CD_GUIDE.md` §1 for current (non-)blocking status |
| APSC-DV-002530/002540 | API Auth / Rate Limiting | JWT required; `express-rate-limit` on newer routes, custom Redis limiter elsewhere |
| APSC-DV-003100 | SBOM | Upload + tracking, CycloneDX generation in CI |
| APSC-DV-003230 | SIEM Integration | Splunk/Elastic/Webhook/Syslog (§2.5) |

## 4. Dependency Audit Posture

Point-in-time findings from the last full audit pass (2026-02-19) — re-run `npm audit`
before relying on these numbers for anything current:

- Backend production dependencies: 0 vulnerabilities.
- Frontend production dependencies: 0 vulnerabilities.
- Frontend **dev** dependencies: known ReDoS findings in the eslint toolchain
  (`minimatch` < 10.2.1, `ajv` < 8.18.0, GHSA-2g4f-4pwh-qvx6) — dev-only, not shipped to
  production, and excluded by `npm audit --production`. Fix requires an eslint v9 → v10
  migration; track as a scheduled dependency bump rather than an emergency patch.
- `package-lock.json` is intentionally committed for both `backend` and `frontend` (not
  gitignored) specifically so `npm audit` and `npm ci` work in CI — do not re-add it to
  `.gitignore`.
- CI enforces this at two levels: `ci.yml`'s `security` job (`npm audit --audit-level=high`,
  full dependency tree) and `security-pipeline.yml`'s `backend-build`/`frontend-build` jobs
  (`npm audit --audit-level=moderate --production`). See `CI_CD_GUIDE.md` §1.1–1.2 for how
  these differ.

## 5. Specific Security Design Decisions

### 5.1 SSO callback routes are intentionally not rate-limited

CodeQL flags `/sso/callback/org` and `/sso/callback/:provider` for missing rate limiting.
This is a deliberate design decision, not an oversight:

- These are callback endpoints invoked by external identity providers (Google, Microsoft,
  GitHub, Apple, or an org's SSO provider), not directly by end users — rate limiting is
  already enforced upstream at the provider.
- Each callback carries a one-time authorization code plus a cryptographic `state`
  parameter that is validated, expires quickly, and is deleted after use (replay
  prevention).
- Legitimate multi-tab/multi-window login flows can trigger multiple callbacks in quick
  succession; naive rate limiting would break those flows.
- Compensating controls: state validation, short expiration, one-time use, provider-side
  code verification, and full audit logging (success and failure) of every SSO
  authentication attempt.

If you see this CodeQL alert again, it's expected — don't add rate limiting to these two
routes without revisiting this rationale first. Possible future hardening (not implemented):
anomaly detection on callback patterns, IP reputation checks, alert thresholds on repeated
SSO failures from the same source.

### 5.2 Public repo mirror workflow security model

`.github/workflows/public-mirror.yml` mirrors an allowlisted subset of this repo to a public
mirror. Its security model is allowlist-first, multi-layered:

- **Access control:** hardcoded to run only against this repo's `owner/repo`; requires the
  `PUBLIC_MIRROR_PAT` secret to actually push (missing secret → skip, not failure); workflow
  itself only holds `contents: read` permission.
- **Secret-pattern blocking** (checked via `git grep`, both pre- and post-mirror):
  ```
  ghp_[A-Za-z0-9]{36}                                   # GitHub PATs (classic)
  github_pat_[A-Za-z0-9_]{20,}                          # GitHub PATs (fine-grained)
  AKIA[0-9A-Z]{16}                                      # AWS access keys
  -----BEGIN (RSA|EC|OPENSSH|PGP) PRIVATE KEY-----      # Private keys
  xox[baprs]-                                           # Slack tokens
  ```
- **Allowlist-only file copying:** only explicitly listed paths/globs are mirrored (e.g.
  `backend/src/**`, `backend/migrations/**`, specific named scripts) — no wildcard at the
  repo root, and Pro-only/premium files are excluded by construction rather than by a
  denylist.
- **Dry-run mode:** `workflow_dispatch` with `dry_run: true` produces an inspectable
  artifact without pushing anything, for validating allowlist/filter changes before they go
  live.
- **Traceability:** every real mirror commit embeds the source SHA; all runs are visible in
  the Actions tab.

Residual, accepted risks: manual allowlist maintenance could in principle miss a
newly-added premium file (mitigated by ordinary PR review), and `PUBLIC_MIRROR_PAT`
expiring would just skip publishing (fails safe, no partial mirror) rather than fail loudly
— worth an occasional manual check that the token is still valid if the public mirror looks
stale.
