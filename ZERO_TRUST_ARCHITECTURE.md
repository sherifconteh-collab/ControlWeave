# Zero Trust Architecture in ControlWeave

ControlWeave operates under a **dual Zero Trust model**:

1. **As a Zero Trust-compliant platform** — ControlWeave's own infrastructure and API are built following NIST SP 800-207 Zero Trust Architecture (ZTA) principles.
2. **As a Zero Trust compliance management tool** — ControlWeave includes the NIST SP 800-207 framework as a first-class reference model, with 18 ZTA controls, crosswalk mappings to NIST 800-53 and NIST CSF 2.0, and full assessment procedure support so your organization can track and audit its own Zero Trust posture.

---

## The Five Zero Trust Principles (NIST SP 800-207)

### 1. Never Trust, Always Verify

Every request to the ControlWeave API must present a valid, cryptographically-signed JWT access token regardless of the requester's network location.

| Implementation | Details |
|----------------|---------|
| **JWT Authentication** | Every protected route is gated by the `authenticate` middleware (`src/middleware/auth.js`). Tokens are verified with `jsonwebtoken` against `JWT_SECRET`. |
| **Short-lived access tokens** | Access tokens expire after **15 minutes** (`JWT_ACCESS_EXPIRY=15m`), limiting the window of token misuse. |
| **Active user check** | After token verification the middleware re-queries the database to confirm the user is still active (`is_active = true`) and their organization still exists — there is no implicit trust from a valid token alone. |
| **SSO & Passkey support** | Google, Microsoft, Okta, GitHub, and Apple SSO are supported via state-validated OAuth callbacks. WebAuthn/Passkey authentication (`src/routes/passkeys.js`) provides phishing-resistant credential verification. |
| **Branch protection (CI/CD)** | No code merges without mandatory peer review and passing security scans — the pipeline itself never implicitly trusts a commit. |

---

### 2. Least Privilege Access

Access is granted at the minimum level required for the operation and is evaluated per request.

| Implementation | Details |
|----------------|---------|
| **Role-Based Access Control (RBAC)** | Three roles (`admin`, `auditor`, `user`) each with explicit permission sets. Admins receive `['*']`; auditors and users are limited to specific read/write scopes (see `ROLE_FALLBACK_PERMISSIONS` in `src/middleware/auth.js`). |
| **20+ granular permissions** | Permissions are defined per resource and action (`dashboard.read`, `controls.write`, `evidence.read`, etc.) and are checked on every relevant route via `authorize()`. |
| **Tier-gated features** | Subscription tier (`Free`, `Starter`, `Professional`, `Enterprise`) limits access to advanced features through `src/config/tierPolicy.js`, enforced in middleware. |
| **Non-root containers (CI/CD)** | Container images run as non-root users; pipelines use minimal IAM permissions scoped to each job. |
| **Organization isolation** | Every database query filters by `organization_id`, ensuring users can never access another tenant's data even if their token is valid. |

---

### 3. Assume Breach

The platform is designed so that a compromise of any single component cannot cascade across the entire system.

| Implementation | Details |
|----------------|---------|
| **Defense-in-depth rate limiting** | Multiple independent, configurable rate-limit tiers enforced via `src/middleware/rateLimit.js` and `SECURITY_CONFIG`: login uses `authRateLimitMax` (default 100/15 min); registration and password recovery use half that limit; refresh tokens have a dedicated limiter (`refreshRateLimitMax`, default 120/60 sec); all other API routes share a general limiter (`apiRateLimitMax`, default 2000/60 sec). |
| **Account lockout** | After a configurable number of failed login attempts (`LOCKOUT_MAX_ATTEMPTS`, default 5), an account is locked for a duration controlled by `LOCKOUT_DURATION_MS` (default 15 minutes). |
| **Refresh token rotation** | Refresh tokens are stored in the database and invalidated on use, preventing replay attacks. |
| **SAST, DAST & secret scanning (CI/CD)** | CodeQL (SAST), OWASP ZAP (DAST), Trivy (container), TruffleHog + Gitleaks (secrets) run on every pull request. High/Critical findings block deployment. |
| **SBOM generation** | Software Bill of Materials is generated for every build to enable rapid impact analysis in the event of a supply-chain compromise. |
| **Parameterized SQL queries** | All database access uses `$1`/`$2` parameterized queries — no string interpolation — preventing SQL injection. |

---

### 4. Verify Explicitly

Every access decision is based on all available data points — identity, device, context — not merely network location.

| Implementation | Details |
|----------------|---------|
| **Token + live database verification** | The `authenticate` middleware verifies the JWT signature *and* fetches the current user record and organization tier from the database on every request. Deactivated users are rejected even with a valid token. |
| **Contextual request metadata** | `attachRequestContext` middleware (`src/middleware/requestContext.js`) attaches a unique `requestId` to every request and sets the `X-Request-ID` response header for distributed tracing and correlation in audit logs. |
| **SSO state validation** | OAuth callbacks validate a database-stored cryptographic state parameter that is single-use and time-limited, preventing CSRF and replay attacks. |
| **Security headers** | Every response includes `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, and (in production) `Strict-Transport-Security` with `max-age=31536000`. |
| **CORS allowlist** | Origins are explicitly allowlisted via `CORS_ORIGIN`; wildcard origins are never used in production. |

---

### 5. Monitor and Log Everything

Continuous visibility is maintained across all user actions, API calls, and security events.

| Implementation | Details |
|----------------|---------|
| **AU-2 compliant audit logging** | Every significant action is logged with 15+ fields: `user_id`, `organization_id`, `action`, `resource_type`, `resource_id`, `outcome`, `ip_address`, `user_agent`, `session_id`, `request_id`, `timestamp`, and more. |
| **365-day log retention** | Audit logs are retained for one year and auto-rotated, satisfying NIST AU-11 and APSC-DV-000840. |
| **SIEM integration** | Real-time event forwarding to Splunk, Elastic, Webhook, and Syslog endpoints (`src/routes/siem.js`). |
| **Performance & request logging** | `performanceTracker` and `requestLogger` middleware capture latency, status codes, and error details for every API call. |
| **CI/CD audit trail** | Every pipeline run produces a complete artifact trail — scan reports, SBOM, vulnerability findings — stored for post-incident analysis. |

---

## Zero Trust Controls in the Platform

ControlWeave seeds **18 NIST SP 800-207 controls** (code: `nist_800_207`) that your organization can use to track its own Zero Trust posture:

| Control ID | Title | Type |
|------------|-------|------|
| ZTA-1 | Resource Identification and Classification | Strategic |
| ZTA-2 | Subject/Identity Verification | Technical |
| ZTA-3 | Least Privilege Access Per-Request | Technical |
| ZTA-4 | Policy Decision Point (PDP) Implementation | Technical |
| ZTA-5 | Policy Enforcement Point (PEP) Implementation | Technical |
| ZTA-6 | Continuous Diagnostics and Monitoring | Technical |
| ZTA-7 | Dynamic and Risk-Based Policy | Strategic |
| ZTA-8 | Micro-Segmentation | Technical |
| ZTA-9 | Encrypted Communications (All Traffic) | Technical |
| ZTA-10 | Device Health Verification | Technical |
| ZTA-11 | Multi-Factor Authentication (All Access) | Technical |
| ZTA-12 | Just-In-Time / Just-Enough Access | Technical |
| ZTA-13 | Session-Based Trust Evaluation | Technical |
| ZTA-14 | Behavioral Analytics and Anomaly Detection | Technical |
| ZTA-15 | Data Loss Prevention in Zero Trust | Technical |
| ZTA-16 | Network Visibility and Analytics | Technical |
| ZTA-17 | API Security Gateway | Technical |
| ZTA-18 | Supply Chain Trust Verification | Strategic |

### Crosswalk Mappings

The ZTA controls are pre-mapped to other frameworks to eliminate duplicated effort:

| ZTA Control | Maps To | Similarity |
|-------------|---------|-----------|
| ZTA-2 (Identity Verification) | NIST 800-53 IA-2 | 90% |
| ZTA-3 (Least Privilege) | NIST 800-53 AC-6 | 90% |
| ZTA-6 (Monitoring) | NIST 800-53 SI-4 | 85% |
| ZTA-9 (Encryption) | NIST 800-53 SC-8 | 95% |
| ZTA-11 (MFA) | NIST 800-53 IA-2 | 90% |
| ZTA-6 (Monitoring) | NIST CSF 2.0 DE.CM-01 | 85% |
| ZTA-3 (Least Privilege) | NIST CSF 2.0 PR.AA-04 | 90% |
| ZTA-8 (Micro-Segmentation) | NIST CSF 2.0 PR.DS-10 | 80% |

---

## Summary

| ZTA Principle | Platform Controls |
|---------------|------------------|
| Never Trust, Always Verify | JWT auth on every route, 15-min token expiry, live DB user checks, SSO state validation, WebAuthn/Passkey support |
| Least Privilege | RBAC with 20+ granular permissions, organization-scoped queries, tier-gated feature access |
| Assume Breach | Multi-tier rate limiting, account lockout, SAST/DAST/secret scanning in CI/CD, parameterized SQL |
| Verify Explicitly | Token + DB verification per request, contextual request metadata, explicit CORS allowlist, security response headers |
| Monitor and Log Everything | AU-2 audit logging with 365-day retention, SIEM forwarding, CI/CD artifact trail |

---

## Audit Readiness

ControlWeave is designed and operated as an **enterprise-grade, audit-ready compliance platform** — not a prototype or personal project. The following evidence artifacts are available to auditors assessing ControlWeave's own Zero Trust posture.

### Evidence Artifacts

| Evidence Category | Artifact | Location / Source |
|-------------------|----------|-------------------|
| **Identity & Access** | JWT authentication on all protected routes | `src/middleware/auth.js` |
| **Identity & Access** | RBAC permission matrix (20+ permissions across 3 roles) | `src/middleware/auth.js` → `ROLE_FALLBACK_PERMISSIONS` |
| **Identity & Access** | SSO integration (Google, Microsoft, Okta, GitHub, Apple) | `src/routes/auth.js`, `src/routes/sso.js` |
| **Identity & Access** | WebAuthn / Passkey support | `src/routes/passkeys.js` |
| **Access Control** | Organization-scoped multi-tenancy (all queries filter `organization_id`) | All DB queries across `src/routes/` |
| **Access Control** | Subscription-tier feature gating | `src/config/tierPolicy.js` |
| **Cryptography** | TLS 1.2+ in transit, AES at rest, FIPS 140-2 modules, bcryptjs password hashing | `src/config/security.js`, infrastructure config |
| **Security Headers** | CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy | `src/server.js` (response middleware) |
| **Rate Limiting** | Four configurable rate-limit tiers + account lockout | `src/middleware/rateLimit.js`, `src/config/security.js` |
| **Audit Logging** | AU-2 compliant events with 15+ fields, 365-day retention | `src/middleware/auditLogger.js`, `src/routes/audit.js` |
| **SIEM Integration** | Real-time forwarding (Splunk, Elastic, Webhook, Syslog) | `src/routes/siem.js` |
| **Vulnerability Management** | SBOM ingestion (SPDX/CycloneDX), STIG upload, CVSS scoring, CISA KEV | `src/routes/sbom.js`, `src/routes/vulnerabilities.js` |
| **CI/CD Security** | SAST (CodeQL), DAST (OWASP ZAP), Trivy, TruffleHog + Gitleaks on every PR | `.github/workflows/` |
| **Supply Chain** | SBOM generated for every build | CI/CD pipeline artifacts |
| **ZTA Compliance Tracking** | 18 NIST SP 800-207 controls seeded with assessment procedures | `backend/scripts/seed-frameworks.js` |
| **Framework Coverage** | 15+ compliance frameworks, 500+ controls with crosswalk intelligence | Platform database, `src/routes/frameworks.js` |

### Standards and Frameworks Satisfied

ControlWeave's Zero Trust implementation satisfies controls from the following frameworks (evidenced by the platform's own operation):

| Framework | Satisfied Controls |
|-----------|-------------------|
| NIST SP 800-207 (ZTA) | All 5 ZTA principles, 18 ZTA control domains |
| NIST SP 800-53 Rev 5 | AC-2, AC-3, AC-6, IA-2, IA-5, SC-8, SC-13, SC-28, SI-4, AU-2, AU-9, AU-11, RA-5, SA-11 |
| NIST Cybersecurity Framework 2.0 | PR.AA (Identity), PR.DS (Data Security), DE.CM (Monitoring), RS.MA (Response) |
| ISO/IEC 27001:2022 | A.5 (Policies), A.8 (Asset Mgmt), A.9 (Access Control), A.10 (Crypto), A.12 (Operations), A.16 (Incident) |
| SOC 2 Type II | CC6 (Logical Access), CC7 (System Operations), CC8 (Change Management) |
| OWASP Top 10 | A01 (Access Control), A02 (Crypto Failures), A03 (Injection), A07 (Auth Failures) |

### Continuous Compliance

ControlWeave enforces security controls continuously, not only at audit time:

- **Every pull request** triggers SAST, DAST, dependency, secret, and container scanning — high/critical findings block deployment.
- **Every API request** is authenticated, authorized, rate-limited, and logged.
- **Every audit event** is forwarded to SIEM in real time and retained for 365 days.
- **Every dependency** is tracked in SBOM and checked against CVE/NVD on build.

---

For further details, see [`CI_CD_COMPLIANCE_MAPPING.md`](CI_CD_COMPLIANCE_MAPPING.md#nist-sp-800-207-zero-trust-architecture) and the [Security Wiki](controlweave/docs/wiki/security/README.md).
