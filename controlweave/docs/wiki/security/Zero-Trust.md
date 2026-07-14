# Zero Trust Architecture

ControlWeave implements NIST SP 800-207 Zero Trust Architecture (ZTA) both as an operational security standard for the platform itself and as a compliance framework your organization can assess against.

For the full explanation — including principle-by-principle implementation details, control listings, and crosswalk mappings — see the root-level guide:

➡️ **[ZERO_TRUST_ARCHITECTURE.md](../../../../ZERO_TRUST_ARCHITECTURE.md)**

## Quick Reference

| ZTA Principle | Key Platform Controls |
|---------------|-----------------------|
| Never Trust, Always Verify | JWT on every route, 15-min token expiry, live user DB check, SSO state validation, WebAuthn/Passkey |
| Least Privilege | RBAC (20+ permissions), org-scoped queries, permission-gated features |
| Assume Breach | Multi-tier rate limiting, account lockout, SAST/DAST/secrets scanning, parameterized SQL |
| Verify Explicitly | Token + DB check per request, request context metadata, CORS allowlist, security headers |
| Monitor and Log Everything | AU-2 audit logging with 365-day retention, SIEM integration, CI/CD artifact trail |

## ZTA Controls Seeded in ControlWeave

ControlWeave includes 18 NIST SP 800-207 controls (`nist_800_207`) for assessing your organization's Zero Trust posture. See the [full control list](../../../../ZERO_TRUST_ARCHITECTURE.md#zero-trust-controls-in-the-platform) and [crosswalk mappings](../../../../ZERO_TRUST_ARCHITECTURE.md#crosswalk-mappings).
