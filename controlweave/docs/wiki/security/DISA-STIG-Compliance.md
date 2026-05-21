# DISA STIG Compliance — ControlWeave

## Overview

ControlWeave implements **five DISA STIGs** covering every layer of its technology stack to ensure full DoD-compliant security. This guide documents the applicable STIGs, implementation status, and verification procedures.

## What is DISA STIG?

The Defense Information Systems Agency (DISA) Security Technical Implementation Guides (STIGs) contain technical guidance to "lock down" information systems/software that might otherwise be vulnerable to malicious attacks. STIGs are organized by technology layer — application, database, web server, and operating system — so organizations must apply all STIGs relevant to their stack.

## Applicable STIG Frameworks

ControlWeave's technology stack (Node.js/Express backend, Next.js frontend, PostgreSQL database, Linux deployment) requires the following five STIGs:

| # | Framework Code | Name | Version | Controls | Relevance |
|---|---------------|------|---------|----------|-----------|
| 1 | `disa_stig_app` | DISA Application Security and Development STIG | V5R3 | 65+ | Custom application code, secure development |
| 2 | `disa_stig_app_server` | DISA Application Server SRG | V3R1 | 43 | Node.js runtime, middleware, deployment |
| 3 | `disa_stig_postgresql` | DISA PostgreSQL STIG | V2R3 | 38 | PostgreSQL 17 database security |
| 4 | `disa_stig_web_server` | DISA Web Server SRG | V3R1 | 40 | Express.js/Node.js web server |
| 5 | `disa_stig_gpos` | DISA General Purpose Operating System STIG | V2R1 | 45 | Linux/Ubuntu deployment environment |

**Total STIG Controls:** 231+

---

## 1. Application Security and Development STIG (disa_stig_app)

### Framework Details

- **Full Name:** DISA Application Security and Development STIG
- **Version:** V5R3 (Version 5, Release 3)
- **Framework Code:** `disa_stig_app`
- **Category:** Cybersecurity
- **Total Controls:** 65+
- **Priority 1 Controls:** 50+

## Control Categories

### 1. Application Security Posture Management (ASPM)
- Security categorization
- Requirements analysis  
- Threat modeling
- Risk assessment

### 2. Authentication & Access Control
- Multi-factor authentication (APSC-DV-000160)
- Password complexity requirements (APSC-DV-000170)
- Password minimum length of 15 characters (APSC-DV-000180)
- Account lockout after 3 failed attempts (APSC-DV-000190)
- Session timeout after 15 minutes (APSC-DV-000200)
- Least privilege enforcement (APSC-DV-000210)

### 3. Cryptography
- FIPS 140-2 validated cryptographic modules (APSC-DV-000220)
- Encryption for data at rest (APSC-DV-000230)
- TLS 1.2+ for data in transit (APSC-DV-000240)
- RFC 5280 certificate validation (APSC-DV-000250)

### 4. Input Validation & Output Encoding
- SQL injection prevention (APSC-DV-000480)
- Cross-site scripting (XSS) prevention (APSC-DV-000490)
- Input validation for all parameters (APSC-DV-000500)
- Output encoding (APSC-DV-000510)
- XML external entity (XXE) prevention (APSC-DV-000520)

### 5. Session Management & CSRF Protection
- CSRF token protection (APSC-DV-000530)
- Secure flag on session cookies (APSC-DV-000540)
- HttpOnly flag on session cookies (APSC-DV-000550)
- Session ID regeneration on auth (APSC-DV-000560)

### 6. Audit & Logging (AU-2 Compliance)
- Audit log generation (APSC-DV-000800)
- Complete audit record content (APSC-DV-000810)
- Audit log protection (APSC-DV-000820)
- Regular audit log review (APSC-DV-000830)
- **1-year audit log retention (APSC-DV-000840)** ✓

### 7. Error Handling
- No sensitive info in error messages (APSC-DV-001460)
- Stack trace protection (APSC-DV-001470)
- Security event logging (APSC-DV-001480)

### 8. Security Testing & Code Review
- Static Application Security Testing (SAST) (APSC-DV-001620)
- Dynamic Application Security Testing (DAST) (APSC-DV-001630)
- Security-focused code reviews (APSC-DV-001640)
- Vulnerability remediation timelines (APSC-DV-001650)

### 9. Configuration Management
- Secure configuration baseline (APSC-DV-002010)
- Default credentials removal (APSC-DV-002020)
- Unnecessary services disabled (APSC-DV-002030)
- Security headers (CSP, X-Frame-Options) (APSC-DV-002040)

### 10. API Security
- API authentication required (APSC-DV-002530)
- API rate limiting (APSC-DV-002540)
- API input validation (APSC-DV-002550)
- Secure API error messages (APSC-DV-002560)

### 11. Container & Cloud Security
- Container image scanning (APSC-DV-002960)
- Container runtime security (APSC-DV-002970)
- Secrets management (no secrets in code) (APSC-DV-002980)

### 12. Supply Chain Security
- Software Bill of Materials (SBOM) (APSC-DV-003100)
- Third-party component scanning (APSC-DV-003110)
- Dependency version control (APSC-DV-003120)
- License compliance (APSC-DV-003130)

### 13. Incident Response & Continuity
- Incident response plan (APSC-DV-003140)
- Backup & recovery procedures (APSC-DV-003150)
- Disaster recovery testing (APSC-DV-003160)

### 14. Privacy Controls
- PII protection (APSC-DV-003170)
- Data minimization (APSC-DV-003180)
- Privacy notice (APSC-DV-003190)

### 15. Monitoring & Alerting
- Security monitoring (APSC-DV-003200)
- Anomaly detection (APSC-DV-003210)
- Security alerting (APSC-DV-003220)
- SIEM integration (APSC-DV-003230)

## ControlWeave Implementation Status — Application STIG

### ✓ Implemented Controls

| Control ID | Title | Implementation |
|------------|-------|----------------|
| APSC-DV-000160 | Multi-Factor Authentication | ✓ JWT + Optional MFA |
| APSC-DV-000170 | Password Complexity | ✓ bcryptjs hashing |
| APSC-DV-000180 | Password Min Length | ✓ 15 char minimum |
| APSC-DV-000190 | Account Lockout | ✓ Configurable lockout |
| APSC-DV-000200 | Session Management | ✓ JWT with expiry |
| APSC-DV-000210 | Least Privilege | ✓ RBAC system |
| APSC-DV-000220 | FIPS 140-2 Crypto | ✓ Node.js crypto |
| APSC-DV-000230 | Data at Rest Encryption | ✓ PostgreSQL encryption |
| APSC-DV-000240 | TLS 1.2+ | ✓ HTTPS enforced |
| APSC-DV-000480 | SQL Injection Prevention | ✓ Parameterized queries |
| APSC-DV-000490 | XSS Prevention | ✓ Input sanitization |
| APSC-DV-000500 | Input Validation | ✓ Validation middleware |
| APSC-DV-000530 | CSRF Protection | ✓ Token-based |
| APSC-DV-000540 | Secure Cookie Flag | ✓ Implemented |
| APSC-DV-000550 | HttpOnly Cookie Flag | ✓ Implemented |
| APSC-DV-000800 | Audit Log Generation | ✓ Full AU-2 compliance |
| APSC-DV-000810 | Audit Record Content | ✓ 15+ fields |
| APSC-DV-000820 | Audit Log Protection | ✓ Separate table |
| APSC-DV-000830 | Audit Log Review | ✓ Dashboard + reports |
| APSC-DV-000840 | 1-Year Retention | ✓ Automated enforcement |
| APSC-DV-001460 | Error Handling | ✓ Generic error messages |
| APSC-DV-001620 | SAST | ✓ CodeQL in CI/CD |
| APSC-DV-001630 | DAST | ✓ ZAP scanning |
| APSC-DV-002010 | Secure Baseline | ✓ Configuration management |
| APSC-DV-002040 | Security Headers | ✓ CSP, X-Frame-Options |
| APSC-DV-002530 | API Authentication | ✓ JWT required |
| APSC-DV-002540 | API Rate Limiting | ✓ express-rate-limit |
| APSC-DV-002960 | Container Scanning | ✓ Trivy in pipeline |
| APSC-DV-002980 | Secrets Management | ✓ Environment variables |
| APSC-DV-003100 | SBOM | ✓ Upload + tracking |
| APSC-DV-003110 | Component Scanning | ✓ npm audit + Trivy |
| APSC-DV-003200 | Security Monitoring | ✓ Audit logs + SIEM |
| APSC-DV-003230 | SIEM Integration | ✓ Splunk/Elastic/Webhook |

---

## 2. Application Server SRG (disa_stig_app_server)

### Framework Details

- **Full Name:** DISA Application Server Security Requirements Guide
- **Version:** V3R1
- **Framework Code:** `disa_stig_app_server`
- **Total Controls:** 45
- **Scope:** Node.js runtime, Express middleware, process management, deployment

### Control Categories

- **Runtime Configuration & Hardening** — Supported versions, non-root execution, debug port lockdown, NODE_ENV, memory limits
- **Process Management & Availability** — Process supervision, graceful shutdown, health checks, resource exhaustion protection
- **Middleware & Request Pipeline** — Middleware ordering, body parser limits, CORS, helmet headers, error handling
- **Authentication & Session Infrastructure** — JWT validation, token secret management, refresh token security
- **Dependency & Module Security** — npm audit, lockfile enforcement, no eval, prototype pollution, supply chain integrity
- **Database Connection Security** — Connection pooling, TLS to database, parameterized queries, least-privilege DB account
- **Logging & Observability** — Structured logging, sensitive data redaction, unhandled rejection logging
- **Deployment & CI/CD** — Immutable deployments, artifact scanning, rollback capability, secrets injection
- **File Handling & Upload Security** — Upload isolation, file type validation, size limits, temp file cleanup

---

## 3. PostgreSQL STIG (disa_stig_postgresql)

### Framework Details

- **Full Name:** DISA PostgreSQL Security Technical Implementation Guide
- **Version:** V2R3
- **Framework Code:** `disa_stig_postgresql`
- **Total Controls:** 38
- **Scope:** PostgreSQL database security, authentication, auditing, encryption

### Control Categories

- **Authentication & Access Control** — Login auth, user accounts, role separation, password encryption, host-based auth, connection limits
- **Audit & Logging** — Audit configuration, DDL auditing, login auditing, data access/modification auditing, pgaudit extension
- **Encryption & Data Protection** — TLS connections, certificate-based TLS, data-at-rest encryption, backup encryption, password storage
- **Configuration & Hardening** — Secure installation, listening address restriction, file permissions, version currency, statement timeout
- **Object & Schema Security** — Schema separation, object ownership, RBAC, row-level security
- **Availability & Recovery** — Backup strategy, replication security, point-in-time recovery
- **Monitoring & Maintenance** — Connection monitoring, performance monitoring, vacuum/maintenance

---

## 4. Web Server SRG (disa_stig_web_server)

### Framework Details

- **Full Name:** DISA Web Server Security Requirements Guide
- **Version:** V3R1
- **Framework Code:** `disa_stig_web_server`
- **Total Controls:** 40
- **Scope:** Express.js HTTP serving, TLS, headers, request handling

### Control Categories

- **TLS/SSL Configuration** — TLS 1.2 minimum, strong ciphers, server certificates, HSTS, revocation checking
- **Security Headers** — CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, server header suppression
- **Access Control** — Authentication required, authorization enforcement, directory listing disabled, admin restriction, CORS policy
- **Request Handling & Input Validation** — Request size limits, rate limiting, HTTP method restriction, file upload controls, path traversal prevention, request timeout
- **Session Management** — Secure cookies, session timeout, session ID entropy
- **Audit & Logging** — Access logs, error logs, authentication event logging, log integrity, event forwarding
- **Error Handling** — Custom error pages, debug mode disabled
- **Hardening & Configuration** — Unnecessary modules disabled, process isolation, resource limits, version currency, dependency security
- **Availability & DoS Protection** — DDoS mitigation, graceful degradation, health monitoring

---

## 5. General Purpose OS STIG (disa_stig_gpos)

### Framework Details

- **Full Name:** DISA General Purpose Operating System Security Technical Implementation Guide
- **Version:** V2R1
- **Framework Code:** `disa_stig_gpos`
- **Total Controls:** 48
- **Scope:** Linux/Ubuntu host security, hardening, network, patching

### Control Categories

- **User Access & Authentication** — SSH key auth, password complexity/length, account lockout, root restriction, MFA, inactive accounts
- **Audit & Logging** — auditd, login/logout auditing, privileged commands, file access, config changes, log protection, remote forwarding
- **File System & Integrity** — File integrity monitoring (AIDE), home dir permissions, SUID/SGID review, world-writable files, partitions, encryption
- **Network Security** — Host firewall (ufw), SSH hardening, unused services, IP forwarding, ICMP redirects, SYN cookies, NTP
- **System Hardening** — Kernel hardening (ASLR), core dumps, banners, USB restriction, automatic updates, SELinux/AppArmor
- **Software & Patch Management** — Package integrity (GPG), authorized repos only, patch currency, unnecessary software removal, container runtime security
- **Availability & Recovery** — System backup, resource monitoring, process accounting

---

## Applying DISA STIGs to Your Organization

### Step 1: Seed All STIG Frameworks

```bash
cd controlweave/backend

# Application Security STIG (65+ controls)
node scripts/seed-disa-stig-framework.js

# Application Server SRG (45 controls)
node scripts/seed-disa-stig-app-server.js

# PostgreSQL Database STIG (38 controls)
node scripts/seed-disa-stig-postgresql.js

# Web Server STIG (40 controls)
node scripts/seed-disa-stig-web-server.js

# General Purpose OS STIG (48 controls)
node scripts/seed-disa-stig-gpos.js
```

This adds all five DISA STIG frameworks with 235+ total controls to the database.

### Step 2: Apply Security Baseline

```bash
node scripts/apply-security-baseline.js
```

This script:
- Adds DISA STIG and all other security frameworks to your organization
- Creates control implementation records for Priority 1 controls
- Sets initial status to `needs_review`

### Step 3: Review and Update Control Implementations

1. Log into ControlWeave
2. Navigate to **Compliance → Controls**
3. Filter by framework: `disa_stig_app`
4. For each control:
   - Update status (implemented, in_progress, not_applicable)
   - Add implementation narrative
   - Upload evidence (screenshots, configs, code samples)

### Step 4: Generate CKLB Checklists & Compliance Reports

```bash
# Generate .cklb files (STIG Viewer 3 format) — one per STIG per org
node scripts/export-stig-cklb.js

# Generate Markdown compliance summary
node scripts/export-stig-reports-quarterly.js

# Or run both via the full security reports export
node scripts/export-security-reports.js
```

This exports:
- **.cklb checklists** — Open in STIG Viewer 3, per STIG framework per organization
- DISA STIG compliance status report (Markdown)
- Control implementation status
- Audit logs summary
- Vulnerability findings

Reports are saved to: `controlweave/docs/wiki/security/reports/<org>/`

### CKLB File Format

The `.cklb` files are STIG Viewer 3 JSON format. Each file contains:
- Target data (organization name, host info)
- All controls for the STIG framework with their implementation status
- Status mapping: `implemented` → `not_a_finding`, `in_progress` → `open`, `needs_review` → `not_reviewed`, `not_applicable` → `not_applicable`
- Finding details from implementation narratives

## Vulnerability Management with STIG

### STIG Checklist Upload

ControlWeave supports both DISA STIG checklist formats:

- **.cklb** — STIG Viewer 3 JSON format (recommended)
- **.ckl** — Legacy STIG Viewer XML format

To upload:

1. Navigate to **Security → Vulnerabilities**
2. Click **Upload Vulnerability Data**
3. Select your `.cklb` or `.ckl` STIG checklist file
4. System automatically parses and imports findings

### STIG Fields in Vulnerability Tracking

Each vulnerability finding includes:
- `stig_id` - STIG vulnerability number (e.g., V-100000)
- `source` - Set to "STIG"
- `standard` - Set to "DISA STIG"
- Linked to asset/system
- Status tracking (open, in_progress, remediated)

### Example STIG Checklist XML

See: `controlweave/backend/demo/vulnerability-upload-samples/sample-stig-checklist.xml`

## Integration with Other Frameworks

DISA STIG controls map to:
- **NIST SP 800-53 Rev 5** - Direct control mappings
- **NIST Cybersecurity Framework** - Function alignment
- **ISO 27001** - Security control correlation
- **SOC 2** - Trust services criteria

Use the **Crosswalk** feature to view relationships between frameworks.

## Audit Preparation

### Evidence Collection Checklist

For each Priority 1 STIG control:
- [ ] Implementation narrative documented
- [ ] Configuration screenshots captured
- [ ] Code samples provided (if applicable)
- [ ] Test results uploaded
- [ ] Scan reports attached (SAST/DAST)
- [ ] Access control matrices documented

### Automated Compliance Verification

Run the security baseline verification:

```bash
node scripts/verify-security-baseline.js
```

Checks:
- All Priority 1 controls have implementations
- Required evidence is uploaded
- Audit logs are being generated
- SIEM integration is active
- Retention policies are enforced

## Continuous Compliance

### Daily Tasks
- Review audit logs for failed authentication attempts
- Check SIEM alerts for security events
- Monitor vulnerability scan results

### Weekly Tasks
- Review new STIG findings from scans
- Update control implementation status
- Generate and review security reports

### Monthly Tasks
- Complete control assessment procedures
- Update implementation narratives
- Conduct security code reviews
- Test incident response procedures

### Quarterly Tasks
- Full DISA STIG compliance assessment
- **Verify STIG versions are current** (see below)
- Third-party security testing
- Disaster recovery testing
- Security awareness training

### Annual Tasks
- Comprehensive audit preparation
- Penetration testing
- STIG version updates (download from DISA)
- Security policy review

## Quarterly STIG Version Verification

Each quarter the CI/CD pipeline automatically checks that all seeded STIG frameworks are running the latest version published by DISA. You can also run this manually:

```bash
cd controlweave/backend

# Offline check — compares seed scripts against the manifest
node scripts/check-stig-versions.js --offline

# Online check — compares database rows against the manifest (requires DB connection)
node scripts/check-stig-versions.js
```

The version manifest lives at `controlweave/backend/config/stig-version-manifest.json`.
When DISA publishes a new STIG version:

1. Update `stig-version-manifest.json` with the new version, release date, and URL
2. Update the corresponding seed script with the new controls
3. Re-run the seed script to update the database
4. Commit and push — the quarterly workflow will confirm the update

## Automation

### Schedule Report Generation

Add to cron or CI/CD pipeline:

```bash
# Daily at 2 AM
0 2 * * * cd /path/to/controlweave/backend && node scripts/export-security-reports.js
```

### SIEM Integration

Configure in **Settings → SIEM Configuration**:
- Provider: Splunk, Elastic, or Webhook
- Endpoint URL
- API credentials
- Event types to forward

All audit logs matching APSC-DV-000800-000840 requirements are automatically forwarded.

## Compliance Resources

### Official DISA STIG Resources
- [DISA STIG Library](https://public.cyber.mil/stigs/)
- [Application Security and Development STIG](https://public.cyber.mil/stigs/downloads/)
- [STIG Viewer Tool](https://public.cyber.mil/stigs/srg-stig-tools/)

### ControlWeave Documentation
- [Audit Log AU-2 Compliance](../AUDIT_LOG_AU2_COMPLIANCE.md)
- [Vulnerability Management](./Vulnerability-Management.md)
- [CI/CD Security Pipeline](../CI_CD_COMPLIANCE_MAPPING.md)
- [Security Summary](../SECURITY_SUMMARY.md)

## Support

For DISA STIG implementation questions:
1. Review this guide and official STIG documentation
2. Check control implementation examples in the application
3. Generate compliance reports to identify gaps
4. Contact your security team for organization-specific guidance

## Version History

- **2026-03-22:** Expanded to five DISA STIG frameworks (235+ controls)
  - Added Application Server SRG (disa_stig_app_server) — 45 controls
  - Added PostgreSQL STIG (disa_stig_postgresql) — 38 controls
  - Added Web Server SRG (disa_stig_web_server) — 40 controls
  - Added General Purpose OS STIG (disa_stig_gpos) — 48 controls
  - Quarterly version verification against DISA manifest
  - Combined quarterly compliance report covering all STIGs
- **2026-02-18:** Initial DISA STIG V5R3 implementation
  - Framework seeded with 65+ controls
  - Integration with vulnerability management
  - Automated reporting and retention
  - 1-year audit log retention compliance
