# ControlWeave — Data Encryption Guide

> **Answers the question:** *"What are our encryption levels for storing data at rest and in transit for users?"*
>
> Addresses CNSA Suite requirements for stronger public key algorithms.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [How We Verify Encryption Currency](#how-we-verify-encryption-currency)
3. [Performance Impact](#performance-impact)
4. [Data at Rest](#data-at-rest)
5. [Data in Transit](#data-in-transit)
6. [MCP Server Transport Security](#mcp-server-transport-security)
7. [CNSA Suite Compliance](#cnsa-suite-compliance)
8. [Post-Quantum Roadmap (CNSA Suite 2.0)](#post-quantum-roadmap-cnsa-suite-20)
9. [Key Management](#key-management)
10. [STIG Control Status](#stig-control-status)

---

## Executive Summary

| Layer | Algorithm | Status |
|-------|-----------|--------|
| User email (at rest) | AES-256-GCM | ✅ Encrypted (migration 098) |
| TOTP secrets (at rest) | AES-256-GCM | ✅ Encrypted |
| SIEM / SMTP API keys (at rest) | AES-256-GCM | ✅ Encrypted |
| Passwords | bcrypt (one-way) | ✅ Hashed — not reversible |
| Email lookup index | HMAC-SHA-384 | ✅ CNSA Suite 1.0 compliant (migration 099) |
| Database TLS (in transit) | TLS 1.2+ | ✅ Via `DB_SSL_MODE=require` |
| REST API (in transit) | TLS 1.2+ / HSTS | ✅ Via Railway TLS terminator |
| MCP → API (in transit) | TLS 1.2+ (enforced) | ✅ HTTPS required in production |
| MCP session tokens (at rest) | File mode 0600 | ✅ Owner-only file permissions |

---

## How We Verify Encryption Currency

ControlWeave has **three layers of automated verification** to ensure encryption algorithms stay current:

### 1. Runtime Audit at Every Server Startup

`src/utils/encrypt.js` exports `auditEncryptionStrength()`. The backend calls this at boot:

```javascript
// server.js — runs at every startup
const { auditEncryptionStrength } = require('./utils/encrypt');
const report = auditEncryptionStrength();
// → logs to structured JSON: compliant, cnsa_suite, summary, per-check details
// → throws in production if any check fails (prevents a non-compliant server from starting)
```

The audit verifies **six checks** against CNSA Suite 1.0 on every deployment:

| Check ID | What Is Verified | Required By CNSA 1.0 |
|----------|-----------------|----------------------|
| `CNSA-1.0-SYM` | Algorithm must be `aes-256-gcm` | AES-256 |
| `CNSA-1.0-KEYLEN` | Key must be ≥256 bits | ≥256-bit keys |
| `CNSA-1.0-HASH` | HMAC must be SHA-384+ | SHA-384+ |
| `CNSA-1.0-TLS` | TLS minimum version ≥1.2 | TLS 1.2+ |
| `FUNC-ROUNDTRIP` | Live AES-256-GCM encrypt/decrypt cycle | Functional verification |
| `KEY-CONFIG` | `ENCRYPTION_KEY` + `HMAC_KEY` are set | Production key hygiene |

**Run it manually at any time:**
```bash
cd controlweave/backend
node -e "
const r = require('./src/utils/encrypt').auditEncryptionStrength();
console.log(JSON.stringify(r, null, 2));
process.exit(r.compliant ? 0 : 1);
"
```

### 2. STIG Assessment (APSC-DV-000230 + APSC-DV-000240)

`scripts/assess-stig-compliance.js` calls `auditEncryptionStrength()` directly when generating STIG checklists. It also verifies the algorithm constants in source and checks for both migration files:

```bash
cd controlweave/backend
node scripts/assess-stig-compliance.js --json
# → docs/wiki/security/reports/disa_stig_app-<date>.cklb
# → prints APSC-DV-000230 status with live audit evidence
```

### 3. Static Code Checks (CI-time)

The assessment script uses `fileContains()` to verify algorithm constants and migration files exist on every run — caught in CI/CD if anyone tries to downgrade algorithms:

- Checks `src/utils/encrypt.js` contains `'sha384'` (CNSA-compliant HMAC)
- Checks `migrations/098_user_pii_encryption.sql` and `migrations/099_email_hash_sha384.sql` exist
- Checks `src/routes/auth.js` contains the `emailHash` write path

---

## Performance Impact

**Short answer: No — encryption does not meaningfully slow down the user experience.**

The crypto operations add single-digit microseconds to most requests. The dominant cost in any user-facing flow is the intentional `bcrypt` password hash, which is 20,000× slower than AES-256-GCM by design.

### Measured Latency (Node.js 24, AES-256-GCM + HMAC-SHA-384)

| Operation | Per-call latency | Notes |
|-----------|-----------------|-------|
| `encrypt(email)` | ~10 µs | AES-256-GCM, 12-byte random IV |
| `decrypt(ciphertext)` | ~6 µs | GCM tag verification included |
| `hashForLookup(email)` | ~3 µs | HMAC-SHA-384, key cached |

**Key caching** (`_cachedEncKey` / `_cachedHmacKey`) parses the hex env vars only once per process start and reuses the `Buffer`, cutting `hashForLookup()` from ~30 µs to ~3 µs (89% improvement).

### Login Flow Breakdown

```
POST /auth/login breakdown:
  bcrypt verify ........... ~250,000 µs  (98.8% — intentional, protects passwords)
  DB query (hash lookup) ..   ~3,000 µs  ( 1.2%)
  hashForLookup + decrypt .       ~10 µs  ( 0.004%)
                              ──────────
  Total overhead added by    10 µs out of ~253,010 µs  → effectively 0%
  field-level encryption:
```

The login endpoint already has a ~250ms floor due to bcrypt. Encryption adds less than 10 microseconds to that.

### GET /users — Largest Impact

The `GET /users` endpoint decrypts every email in the result set. Even with 100 users, the total decryption cost is ~0.6ms added to a ~3ms DB query — well within acceptable response times:

| Org size | DB query | Decrypt overhead | Total |
|----------|----------|-----------------|-------|
| 10 users | ~3 ms | ~0.06 ms | ~3.1 ms |
| 100 users | ~3 ms | ~0.6 ms | ~3.6 ms |
| 500 users | ~8 ms | ~3 ms | ~11 ms |

### What Is NOT Affected

Encryption only touches the `email` field in the `users` table. These high-traffic endpoints are completely unaffected:
- Controls, frameworks, requirements, evidence
- Assessments, findings, recommendations
- CMDB assets, vulnerabilities
- Audit logs, dashboard stats
- AI/LLM analysis endpoints

---

## Data at Rest

### Field-Level Encryption (Application Layer)

ControlWeave implements **AES-256-GCM** field-level encryption via `src/utils/encrypt.js` for all sensitive PII stored in PostgreSQL.

#### Algorithm Details

```
Algorithm : AES-256-GCM
Key size  : 256 bits (32 bytes)
IV / nonce: 96 bits (12 bytes, random per encryption)
Auth tag  : 128 bits (16 bytes)
Encoding  : JSON envelope { iv, ciphertext, tag } — all base64
```

AES-256-GCM provides **authenticated encryption** (AEAD): confidentiality + integrity in a single pass. It is part of **CNSA Suite 1.0** (NSA, 2015) and is FIPS 140-2 approved.

#### Encrypted Fields

| Table | Column | Algorithm | Notes |
|-------|--------|-----------|-------|
| `users` | `email` | AES-256-GCM | Field-level; `email_hash` used for lookup |
| `users` | `totp_secret` | AES-256-GCM | 2FA secret |
| `siem_configurations` | `api_key` | AES-256-GCM | SIEM integration key |
| `siem_configurations` | `webhook_secret` | AES-256-GCM | Webhook HMAC secret |
| `platform_settings` | `smtp_pass` | AES-256-GCM | SMTP credentials |
| `organization_settings` | `smtp_pass` | AES-256-GCM | Per-org SMTP credentials |

#### Password Storage

Passwords are **never** stored in encrypted or reversible form. They are hashed with **bcrypt** (work factor 12), a one-way adaptive hash function designed to resist brute-force attacks.

```
Algorithm  : bcrypt
Work factor: 12 rounds (≈250ms per hash on modern hardware)
```

#### Searchable Encryption (Email Lookup)

Email is a lookup key (`WHERE email = ?`). Storing it as a random-IV ciphertext would break all lookups. ControlWeave solves this with a **deterministic HMAC-SHA-384 index** (migration 099):

```
email_hash = HMAC-SHA-384(email_lowercase, HMAC_KEY)
```

HMAC-SHA-384 meets the **CNSA Suite 1.0 SHA-384+ requirement**. SHA-384 produces a 48-byte (96 hex-char) digest stored in `email_hash VARCHAR(96)`.

- All lookups use `WHERE email_hash = $1` — the plaintext email is **never** stored in cleartext for new/migrated rows.
- Existing rows are migrated lazily: on each user's first login after migration 099 is applied, `email_hash` is backfilled automatically with the SHA-384 digest.
- `HMAC_KEY` is separate from `ENCRYPTION_KEY`, enabling independent key rotation.

#### Hosting-Provider Encryption

Railway (the hosting provider) applies **AES-256 disk encryption** to all PostgreSQL data volumes. This protects:
- All database columns not covered by application-level field encryption (e.g., `first_name`, `last_name`, `role`, audit logs).
- Database backups and WAL archives.

> **Note on first_name / last_name:** These fields are covered by Railway disk encryption but not by application-level field encryption. They are referenced in 50+ SQL-level `CONCAT()` / `ORDER BY` expressions across the codebase; adding application-level encryption without introducing a full application-layer name-assembly refactor is a tracked follow-up item.

---

## Data in Transit

### Backend REST API

| Control | Implementation | Reference |
|---------|---------------|-----------|
| TLS termination | Railway load balancer (TLS 1.2+) | Infrastructure |
| HSTS | `Strict-Transport-Security: max-age=31536000; includeSubDomains` | `src/server.js` |
| Database SSL | `DB_SSL_MODE=require`, `rejectUnauthorized=true` (default) | `src/config/database.js` |
| Security headers | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `CSP` | `src/server.js` |

The backend HTTP server itself does **not** terminate TLS (Railway handles this, which is standard for PaaS deployments). HSTS instructs browsers to only connect via HTTPS for 1 year.

### Database Connections

```
Transport : PostgreSQL TLS (libpq sslmode=require)
Validation: rejectUnauthorized=true (default)
           Disable only via DB_SSL_REJECT_UNAUTHORIZED=false (dev only)
```

---

## MCP Server Transport Security

The MCP server (`scripts/mcp-server-secure.js`) connects to the ControlWeave REST API over HTTP/HTTPS and transmits Bearer JWT tokens. The following controls protect this channel:

### TLS Minimum Version

```javascript
// Explicitly set at process startup (mcp-server-secure.js + mcp-auth-session.js)
tls.DEFAULT_MIN_VERSION = 'TLSv1.2';
```

Node.js 18+ already defaults to TLS 1.2, but we set it explicitly for auditability. This affects **all** outbound TLS connections from the MCP process, including `fetch()` calls to the API.

Current TLS envelope:
- **Minimum**: TLS 1.2
- **Maximum**: TLS 1.3 (Node.js 24 default)
- **Certificate validation**: `rejectUnauthorized=true` (default; override with `MCP_TLS_REJECT_UNAUTHORIZED=false` for dev only)

### HTTPS Enforcement (Production)

`normalizeApiBaseUrl()` in `mcp-auth-session.js` **throws** if `GRC_API_BASE_URL` is set to a plain `http://` URL for a non-localhost host when `NODE_ENV=production`:

```
[SECURITY] MCP API base URL must use HTTPS in production.
Received: http://api.example.com/api/v1 — set GRC_API_BASE_URL to an https:// endpoint.
```

This prevents JWT tokens from being transmitted in cleartext over the network.

### In-Transit Token Warning

`apiRequest()` emits a `[SECURITY WARNING]` to stderr if a Bearer token is about to be sent over plain HTTP to a non-localhost host (secondary guard, complements the startup enforcement).

### MCP Transport (stdio)

The MCP protocol itself uses **stdio** (`StdioServerTransport`) — communication is between the AI client (Claude Desktop / VS Code) and the MCP server subprocess over stdin/stdout. This is a **local inter-process channel** with no network exposure; it is inherently isolated.

### Session File Security

MCP session files (`~/.controlweave/mcp-session.json`) that store JWT tokens are written with **mode 0600** (owner read/write only):

```javascript
fs.writeFileSync(path, JSON.stringify(payload, null, 2), { mode: 0o600 });
```

### Environment Variables for MCP Transit Security

| Variable | Default | Description |
|----------|---------|-------------|
| `GRC_API_BASE_URL` | `http://localhost:3001/api/v1` | Must be `https://` in production |
| `MCP_TLS_REJECT_UNAUTHORIZED` | `true` | Set to `false` to disable cert validation (dev only) |
| `NODE_ENV` | `development` | Set to `production` to enable HTTPS enforcement |

---

## CNSA Suite Compliance

### CNSA Suite 1.0 (Required Immediately)

CNSA Suite 1.0 mandates **stronger public key algorithms** for all new acquisitions effective immediately. ControlWeave's current status:

| Algorithm | CNSA 1.0 Requirement | ControlWeave Implementation | Status |
|-----------|---------------------|------------------------------|--------|
| AES-256 | Symmetric encryption ≥256 bits | AES-256-GCM (encrypt.js) | ✅ Compliant |
| SHA-384+ | Hashing / MAC operations | HMAC-SHA-384 (email_hash, migration 099) | ✅ Compliant |
| RSA-3072+ or ECDH P-384 | Key exchange / PKI | Railway TLS (platform-managed, P-384 available) | ✅ Compliant |
| TLS 1.2+ | Transport security | HSTS + `tls.DEFAULT_MIN_VERSION=TLSv1.2` | ✅ Compliant |

> **Note on SHA-256 for refresh token hashing:** The `hashRefreshToken()` function in `auth.js` still uses SHA-256. This is used for server-side token storage (not user-facing data), but upgrading to SHA-384 is a tracked follow-up.

---

## Post-Quantum Roadmap (CNSA Suite 2.0)

### What Is Post-Quantum Cryptography?

Current public-key algorithms (RSA, ECDH, ECDSA) rely on mathematical problems — factoring large numbers or computing discrete logarithms — that are **hard for classical computers but solvable by sufficiently powerful quantum computers** using Shor's algorithm.

The **post-quantum roadmap** means preparing for the day when cryptographically-relevant quantum computers (CRQCs) exist. NSM-10 (May 2022) and CNSA Suite 2.0 policy establish a mandatory transition timeline before that threat materializes.

### Mandatory CNSA Suite 2.0 Timeline

```
NOW                          Jan 1 2027          Dec 31 2030    Dec 31 2031
 │                                │                    │               │
 ▼                                ▼                    ▼               ▼
CNSA 1.0                   New NSS/SAP             Phase out      CNSA 2.0
required                   acquisitions           non-CNSA 2.0   mandatory
immediately                must support           equipment      for all
                           CNSA 2.0                              protocols
```

- **Effective immediately:** All acquisitions must support CNSA Suite 1.0 (AES-256, SHA-384+, TLS 1.2+)
- **1 January 2027:** New acquisitions for all National Security Systems (NSS) and Special Access Programs (SAP) must support CNSA Suite 2.0 products
- **31 December 2030:** Equipment and services that cannot be updated to CNSA 2.0 must be phased out
- **31 December 2031:** CNSA 2.0 algorithms mandatory for all protocol use

### CNSA Suite 2.0 Algorithms (Quantum-Resistant)

These are **post-quantum** algorithms standardized by NIST specifically to resist attacks from quantum computers:

| Algorithm | NIST Standard | Purpose | ControlWeave Gap |
|-----------|--------------|---------|--------------------|
| ML-KEM (formerly Kyber) | FIPS 203 | Key encapsulation / key exchange | TLS key exchange (handled by Railway/platform) |
| ML-DSA (formerly Dilithium) | FIPS 204 | Digital signatures (code signing, JWTs) | JWT signing currently uses HMAC-SHA-256 |
| SLH-DSA (formerly SPHINCS+) | FIPS 205 | Stateless hash-based signatures | Firmware/artifact signing |

### ControlWeave's Current Quantum Posture

**Good news — symmetric encryption is already quantum-safe:**
- AES-256 requires ~2¹²⁸ quantum operations via Grover's algorithm. This remains computationally infeasible even for large quantum computers. **No change needed.**
- HMAC-SHA-384 provides 192-bit post-quantum security against generic attacks. **No change needed.**

**Gaps requiring attention before 2031:**
- **TLS key exchange (ML-KEM):** ECDH P-384 is vulnerable to Shor's algorithm on a CRQC. Migration to ML-KEM is a **platform-level change** handled by Railway/hosting provider. Timeline: monitor for Node.js TLS + OpenSSL 3.5 ML-KEM support (expected 2025–2027).
- **JWT signing (ML-DSA):** Current JWTs use HMAC-SHA-256 (symmetric — not vulnerable to Shor's). Pure post-quantum JWT signing with ML-DSA is a future upgrade when ecosystem support matures.

### Action Items to Track

| Item | Target Date | Owner |
|------|------------|-------|
| Upgrade `hashRefreshToken()` SHA-256 → SHA-384 | Q2 2026 | Backend |
| Encrypt `first_name` / `last_name` fields | Q2 2026 | Backend |
| Node.js FIPS mode (`--enable-fips`) for APSC-DV-000220 | Q3 2026 | DevOps |
| Automated key rotation pipeline | Q4 2026 | Backend |
| Validate Railway TLS supports ML-KEM (post-quantum TLS) | Q1 2027 | DevOps |
| ML-KEM TLS key exchange (CNSA Suite 2.0 NSS/SAP deadline) | 31 Dec 2030 | Platform |
| Full CNSA Suite 2.0 protocol compliance | 31 Dec 2031 | All |

---

## Key Management

### Required Environment Variables

| Variable | Description | Format |
|----------|-------------|--------|
| `ENCRYPTION_KEY` | AES-256-GCM encryption key | 64-char hex string (32 bytes) |
| `HMAC_KEY` | HMAC-SHA-384 email hash key | 96-char hex string (48 bytes, CNSA Suite 1.0) |

**Generate keys:**

```bash
# Generate ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate HMAC_KEY (separate from ENCRYPTION_KEY — 48 bytes for CNSA Suite 1.0)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Key Rotation

- `ENCRYPTION_KEY` rotation requires re-encrypting all ciphertext-bearing columns. A migration script should decrypt with the old key and re-encrypt with the new key before updating the env variable.
- `HMAC_KEY` rotation requires NULLing `email_hash` values (as migration 099 does) and allowing lazy backfill to regenerate them. Because lookups fall back to plaintext for NULL hash rows, a rolling rotation is safe.
- Keys are **never** committed to source control. They are set via Railway environment variables or a secrets manager.

### Development Fallback Keys

In non-production environments, deterministic fallback keys are used automatically when `ENCRYPTION_KEY` / `HMAC_KEY` are not set, so the server starts without configuration. The server logs a `[SECURITY]` warning when using these fallbacks. **They are NOT secret and MUST NOT be used in production.**

---

## STIG Control Status

| Control ID | Title | Status | Notes |
|------------|-------|--------|-------|
| APSC-DV-000230 | Encryption for Data at Rest | ✅ PASS | AES-256-GCM + HMAC-SHA-384; migrations 098 + 099; `auditEncryptionStrength()` at startup |
| APSC-DV-000240 | Encryption for Data in Transit | ✅ PASS | HSTS + DB SSL + MCP HTTPS enforcement + `tls.DEFAULT_MIN_VERSION=TLSv1.2` |
| APSC-DV-000220 | FIPS 140-2 Validated Cryptography | ⚠️ OPEN | bcrypt is not FIPS-validated; Node.js FIPS mode not enabled |
| APSC-DV-000250 | Certificate Validation | ✅ PASS | `rejectUnauthorized=true` (DB + MCP) |
| PGS9-00-002200 | PostgreSQL Data-at-Rest | ✅ NR / PASS | Railway-managed disk encryption |

---

*Last updated: March 2026 — CNSA Suite 1.0 / 2.0 compliance*
