# Security & Compliance

Documentation for security, compliance, and controls.

## Available Guides

- **[Data Encryption Guide](DATA_ENCRYPTION.md)** - At-rest (AES-256-GCM, HMAC-SHA-384) and in-transit (TLS 1.2+, MCP HTTPS) encryption levels; CNSA Suite compliance
- **[Zero Trust Architecture](Zero-Trust.md)** - NIST SP 800-207 ZTA principles and platform implementation
- **[DISA STIG Compliance](DISA-STIG-Compliance.md)** - DoD Application Security STIG implementation
- **[Vulnerability Management](Vulnerability-Management.md)** - Track and remediate vulnerabilities
- **[Security Reports](reports/README.md)** - Automated security reports with 1-year retention

## Security Frameworks Implemented

ControlWeave implements comprehensive security controls from multiple frameworks:

### DoD & Federal Standards
- **DISA Application Security STIG V5R3** - 65+ application security controls
- **NIST SP 800-53 Rev 5** - Security and privacy controls
- **NIST SP 800-171 Rev 3** - Controlled Unclassified Information (CUI) protection
- **NIST Cybersecurity Framework 2.0** - Risk management framework
- **NIST Privacy Framework** - Privacy controls and practices
- **NIST AI RMF 1.0** - AI risk management
- **FedRAMP** - Federal cloud security requirements

### Industry Standards
- **ISO/IEC 27001:2022** - Information security management
- **ISO/IEC 42001:2023** - AI management systems
- **SOC 2 Type II** - Trust services criteria
- **PCI DSS** - Payment card industry standards

### Regulatory Compliance
- **HIPAA Security Rule** - Healthcare data protection
- **GDPR** - EU data protection regulation
- **CCPA/CPRA** - California privacy laws

## Security Features

### Audit Logging (AU-2 Compliance)
- Complete audit trail with 15+ AU-2 compliant fields
- 1-year retention policy (APSC-DV-000840)
- SIEM integration (Splunk, Elastic, Webhook, Syslog)
- Real-time event forwarding
- Automated log rotation and archival

### Vulnerability Management
- STIG checklist (.ckl) file upload support
- SBOM ingestion (SPDX, CycloneDX)
- Scanner integration (ACAS, Nessus, Trivy)
- CVE/NVD tracking with CVSS scoring
- CISA KEV monitoring
- Automated remediation workflows

### Security Testing
- Static Application Security Testing (SAST) via CodeQL
- Dynamic Application Security Testing (DAST) via OWASP ZAP
- Container image scanning with Trivy
- Dependency vulnerability scanning
- Continuous security monitoring in CI/CD

### Access Control
- Role-Based Access Control (RBAC)
- Multi-factor authentication support
- JWT-based session management
- SSO integration (Google, Microsoft, Okta, GitHub, Apple)
- WebAuthn/Passkey support
- API key authentication

### Cryptography
- TLS 1.2+ for data in transit
- AES encryption for data at rest
- FIPS 140-2 compliant cryptographic modules
- Secure password hashing with bcryptjs
- Certificate validation (RFC 5280)

## Security Reports & Retention

All security reports and audit logs are automatically exported to this wiki with 1-year retention:

- **Audit Logs Reports** - Daily/weekly audit trail summaries
- **Vulnerability Findings** - STIG, SBOM, and scanner results
- **Controls Status** - Security control implementation tracking
- **DISA STIG Compliance** - Application security STIG status
- **Compliance Dashboards** - Multi-framework compliance posture

### Retention Policy

Per DISA STIG APSC-DV-000840 and NIST SP 800-53 AU-11:
- **Audit logs:** 365 days minimum retention
- **Security reports:** 365 days retention
- **Vulnerability data:** Retained until remediation + 90 days
- **Evidence files:** Configurable retention (default 365 days)

### Automated Export

Run the security report export script:

```bash
cd controlweave/backend
node scripts/export-security-reports.js
```

Reports are saved to: `controlweave/docs/wiki/security/reports/`

## Quick Start

### 1. Apply Security Baseline

```bash
# Seed DISA STIG framework
node scripts/seed-disa-stig-framework.js

# Apply comprehensive security baseline
node scripts/apply-security-baseline.js
```

### 2. Configure Security Features

- Enable SIEM integration in Settings → SIEM Configuration
- Upload STIG checklists to Vulnerabilities
- Configure retention policies
- Set up automated report generation

### 3. Monitor & Report

- Review daily audit logs
- Track vulnerability remediation
- Generate compliance reports
- Conduct regular assessments

## Compliance Verification

### Run Security Checks

```bash
# Verify all security frameworks are seeded
node scripts/check-frameworks.js

# Test AU-2 audit logging
node scripts/test-au2-audit-logging.js

# Export current security status
node scripts/export-security-reports.js
```

### Generate Compliance Reports

1. Log into ControlWeave
2. Navigate to **Reports → Compliance**
3. Select framework (DISA STIG, NIST 800-53, etc.)
4. Generate PDF/Excel report
5. Export includes control status, evidence, and findings

## Additional Resources

### Documentation
- `SECURITY_SUMMARY.md` - Overall security implementation
- `SECURITY_SUMMARY_UPDATE.md` - Recent security enhancements
- `CI_CD_COMPLIANCE_MAPPING.md` - CI/CD security controls
- `AUDIT_LOG_AU2_COMPLIANCE.md` - Detailed AU-2 compliance
- `controlweave/docs/guides/VULNERABILITIES.md` - Vulnerability guide

### External Resources
- [DISA STIG Library](https://public.cyber.mil/stigs/)
- [NIST SP 800-53 Rev 5](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [ISO 27001 Standard](https://www.iso.org/isoiec-27001-information-security.html)

## Support

For security implementation questions:
1. Review the relevant framework guide
2. Check implementation examples in the codebase
3. Generate compliance reports to identify gaps
4. Consult with your security team
