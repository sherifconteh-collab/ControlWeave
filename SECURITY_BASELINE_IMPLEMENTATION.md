# Security Baseline Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the comprehensive security baseline in ControlWeave, including DISA STIG Application Security controls and automated security reporting to the wiki.

## Prerequisites

Before starting, ensure you have:
- ControlWeave backend and database running
- Database credentials configured in `.env` file
- Node.js 18+ installed
- Access to ControlWeave with admin privileges

## Implementation Steps

### Phase 1: DISA STIG Framework Setup

#### 1.1 Seed DISA STIG Framework

The DISA Application Security and Development STIG (V5R3) framework includes 65+ security controls covering:
- Authentication & Access Control
- Cryptography (FIPS 140-2)
- Input Validation & Output Encoding
- Session Management & CSRF Protection
- Audit & Logging (1-year retention)
- Security Testing (SAST/DAST)
- API Security
- Container & Cloud Security
- Supply Chain Security (SBOM)
- Incident Response
- Monitoring & SIEM Integration

**Command:**
```bash
cd controlweave/backend
node scripts/seed-disa-stig-framework.js
```

**Expected Output:**
```
Starting DISA STIG Application Security framework seeding...
Created framework disa_stig_app with ID <uuid>
Inserting 65 controls...
Inserted 65 controls for DISA STIG framework
DISA STIG Application Security framework seeding completed successfully!
```

#### 1.2 Verify Framework Installation

Check that the framework was added:
```bash
psql -d controlweave -c "SELECT code, name, version FROM frameworks WHERE code = 'disa_stig_app';"
```

### Phase 2: Apply Security Baseline

#### 2.1 Run Security Baseline Script

This script applies a comprehensive security baseline to all organizations, including:
- DISA STIG Application Security
- NIST SP 800-53 Rev 5
- NIST Cybersecurity Framework 2.0
- ISO/IEC 27001:2022
- SOC 2 Type II
- HIPAA Security Rule
- GDPR
- NIST SP 800-171 (CUI)
- NIST Privacy Framework
- NIST AI Risk Management Framework

**Command:**
```bash
node scripts/apply-security-baseline.js
```

**Expected Output:**
```
================================================================================
CONTROLWEAVE SECURITY BASELINE APPLICATION
================================================================================

Found 2 organization(s):
  1. Demo Organization (uuid)
  2. Test Organization (uuid)

Security Frameworks in Baseline:
  1. disa_stig_app
  2. nist_800_53
  3. nist_csf_2.0
  ...

Available Frameworks:
  ✓ disa_stig_app: DISA Application Security and Development STIG V5R3
  ✓ nist_800_53: NIST SP 800-53 Rev 5
  ...

--------------------------------------------------------------------------------
Applying security baseline to: Demo Organization
--------------------------------------------------------------------------------
Currently selected frameworks: 5
  - nist_csf_2.0: NIST Cybersecurity Framework 2.0
  ...

  ✓ Added framework: disa_stig_app
  ✓ Added framework: nist_privacy
  Added 5 new security framework(s).

Total controls across all frameworks: 450
Creating implementations for 280 Priority 1 controls...
  ✓ Created 280 control implementation records.
```

#### 2.2 Verify Baseline Application

Check organization frameworks:
```bash
psql -d controlweave -c "
  SELECT f.code, f.name, COUNT(ci.id) as control_implementations
  FROM organization_frameworks ofw
  JOIN frameworks f ON ofw.framework_id = f.id
  LEFT JOIN framework_controls fc ON fc.framework_id = f.id
  LEFT JOIN control_implementations ci ON ci.control_id = fc.id
  WHERE ofw.organization_id = '<your-org-id>'
  GROUP BY f.code, f.name
  ORDER BY f.code;
"
```

### Phase 3: Security Reports & Wiki Integration

#### 3.1 Configure Wiki Export Directory

The security reports will be exported to:
```
controlweave/docs/wiki/security/reports/
```

Directory structure:
```
security/
├── README.md (updated with security info)
├── DISA-STIG-Compliance.md (comprehensive guide)
├── Vulnerability-Management.md (existing)
└── reports/
    ├── README.md (report index with retention policy)
    └── <org-slug>/
        ├── audit-logs-YYYY-MM-DD.md
        ├── vulnerabilities-YYYY-MM-DD.md
        ├── controls-status-YYYY-MM-DD.md
        └── disa-stig-compliance-YYYY-MM-DD.md
```

#### 3.2 Export Security Reports

Generate and export security reports with 1-year retention:

**Daily Reports:**
```bash
node scripts/export-security-reports-daily.js
```

**Quarterly DISA STIG Reports:**
```bash
node scripts/export-stig-reports-quarterly.js
```

**Expected Output:**
```
================================================================================
SECURITY REPORTS EXPORT TO WIKI
================================================================================

Processing organization: Demo Organization
--------------------------------------------------------------------------------
Generating audit logs report...
Generating vulnerability findings report...
Generating security controls status report...
Generating DISA STIG compliance report...
  ✓ Audit logs report: .../reports/demo-organization/audit-logs-2026-02-18.md
  ✓ Vulnerability report: .../reports/demo-organization/vulnerabilities-2026-02-18.md
  ✓ Controls status report: .../reports/demo-organization/controls-status-2026-02-18.md
  ✓ DISA STIG report: .../reports/demo-organization/disa-stig-compliance-2026-02-18.md

✓ Created reports index: .../reports/README.md

Checking for old reports to archive...
  No old reports to archive

================================================================================
EXPORT COMPLETE
================================================================================

Reports saved to: controlweave/docs/wiki/security/reports/
Retention period: 365 days (1 year)
```

#### 3.3 Schedule Automated Report Generation

Add to cron or CI/CD pipeline for automated daily and quarterly exports:

**Cron Example:**
```bash
# Daily reports at 2 AM
0 2 * * * cd /path/to/controlweave/backend && node scripts/export-security-reports-daily.js >> /var/log/controlweave-reports.log 2>&1

# Quarterly DISA STIG reports (Jan 1, Apr 1, Jul 1, Oct 1)
0 2 1 1,4,7,10 * cd /path/to/controlweave/backend && node scripts/export-stig-reports-quarterly.js >> /var/log/controlweave-stig-reports.log 2>&1
```

**GitHub Actions Workflows:**

Daily reports workflow (`.github/workflows/security-reports-export.yml`):
```yaml
name: Export Security Reports (Daily)
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:  # Manual trigger

jobs:
  export-reports:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd controlweave/backend
          npm install
      - name: Export daily reports
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          cd controlweave/backend
          node scripts/export-security-reports-daily.js
      - name: Commit reports
        run: |
          git config --global user.name 'Security Bot'
          git config --global user.email 'security@example.com'
          git add controlweave/docs/wiki/security/reports/
          git commit -m "Daily security reports - $(date +%Y-%m-%d)" || exit 0
          git push
```

Quarterly DISA STIG workflow (`.github/workflows/security-reports-stig-quarterly.yml`):
```yaml
name: Export DISA STIG Reports (Quarterly)
on:
  schedule:
    - cron: '0 2 1 1,4,7,10 *'  # Quarterly: Jan 1, Apr 1, Jul 1, Oct 1 at 2 AM UTC
  workflow_dispatch:  # Manual trigger

jobs:
  export-stig:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd controlweave/backend
          npm install
      - name: Export DISA STIG reports
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          cd controlweave/backend
          node scripts/export-stig-reports-quarterly.js
      - name: Commit reports
        run: |
          git config --global user.name 'Security Bot'
          git config --global user.email 'security@example.com'
          git add controlweave/docs/wiki/security/reports/
          git commit -m "Quarterly DISA STIG reports - Q$(date +%q) $(date +%Y-%m-%d)" || exit 0
          git push
```

### Phase 4: Retention Policy Enforcement

#### 4.1 Understanding Retention Policies

Per DISA STIG APSC-DV-000840 and NIST SP 800-53 AU-11:

**Audit Logs:**
- Minimum retention: 365 days (1 year)
- Automatically enforced by export script
- Old reports (>365 days) are archived/deleted during export

**Security Reports:**
- Retention: 365 days
- Automatic cleanup during export
- File naming: `<type>-YYYY-MM-DD.md`

**Vulnerability Data:**
- Retained until remediation + 90 days
- Status transitions tracked in database

**Evidence Files:**
- Configurable retention (default 365 days)
- Managed by `jobService.js` retention cleanup

#### 4.2 Manual Retention Enforcement

Check audit log retention:
```sql
SELECT 
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as log_count,
  MIN(created_at) as oldest_log,
  MAX(created_at) as newest_log
FROM audit_logs
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;
```

Archive old audit logs (if needed):
```sql
-- Move logs older than 1 year to archive table
CREATE TABLE IF NOT EXISTS audit_logs_archive AS 
SELECT * FROM audit_logs WHERE created_at < NOW() - INTERVAL '365 days';

-- Delete archived logs from main table
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '365 days';
```

### Phase 5: STIG Vulnerability Management

#### 5.1 Upload STIG Checklist

1. Navigate to **Security → Vulnerabilities**
2. Click **Upload Vulnerability Data**
3. Select DISA STIG Checklist (.ckl) file
4. System parses and imports findings automatically

Sample STIG checklist: `controlweave/backend/demo/vulnerability-upload-samples/sample-stig-checklist.xml`

#### 5.2 Verify STIG Findings

```sql
SELECT 
  source,
  standard,
  severity,
  status,
  COUNT(*) as finding_count,
  COUNT(CASE WHEN stig_id IS NOT NULL THEN 1 END) as with_stig_id
FROM vulnerability_findings
WHERE source = 'STIG'
GROUP BY source, standard, severity, status
ORDER BY 
  CASE severity 
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END;
```

### Phase 6: Compliance Verification

#### 6.1 Review Control Implementation Status

Access the ControlWeave UI:
1. Log in as admin
2. Navigate to **Compliance → Controls**
3. Filter by framework: `disa_stig_app`
4. Review Priority 1 controls
5. Update status for each control:
   - `implemented` - Control is fully operational
   - `in_progress` - Implementation underway
   - `needs_review` - Requires evaluation
   - `not_applicable` - Not applicable to environment

#### 6.2 Upload Evidence

For each implemented control:
1. Click control to view details
2. Click **Upload Evidence**
3. Attach relevant files:
   - Configuration screenshots
   - Code samples
   - SAST/DAST scan results
   - Test outputs
   - Compliance certificates

#### 6.3 Generate Compliance Dashboard

1. Navigate to **Reports → Compliance Dashboard**
2. Select frameworks to include
3. View compliance metrics:
   - Overall compliance percentage
   - Controls by status
   - Priority 1 implementation rate
   - Recent assessments

### Phase 7: SIEM Integration (Optional)

#### 7.1 Configure SIEM

1. Navigate to **Settings → SIEM Configuration**
2. Select provider:
   - Splunk
   - Elastic (Elasticsearch)
   - Generic Webhook
   - Syslog
3. Enter connection details:
   - Endpoint URL
   - API credentials (encrypted)
   - Event types to forward
4. Test connection

#### 7.2 Verify SIEM Forwarding

Check SIEM logs for ControlWeave events:
```bash
# Splunk query
index=controlweave sourcetype=audit_log

# Elasticsearch query
GET /controlweave-audit-logs/_search
{
  "query": {
    "range": {
      "timestamp": {
        "gte": "now-24h"
      }
    }
  }
}
```

Check forwarding status in database:
```sql
SELECT 
  event_type,
  COUNT(*) as total,
  COUNT(CASE WHEN siem_forwarded = true THEN 1 END) as forwarded,
  COUNT(CASE WHEN siem_forwarded = false THEN 1 END) as pending
FROM audit_logs
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY event_type;
```

## Verification Checklist

Use this checklist to verify complete implementation:

### Framework Setup
- [ ] DISA STIG framework seeded (65+ controls)
- [ ] Security baseline applied to all organizations
- [ ] All Priority 1 controls have implementation records

### Audit Logging
- [ ] Audit logs table contains data
- [ ] AU-2 compliant fields populated (15+ fields)
- [ ] 1-year retention policy enforced
- [ ] Recent events logged (authentication, authorization, configuration)

### Vulnerability Management
- [ ] STIG checklist upload tested
- [ ] Vulnerability findings table populated
- [ ] `stig_id` field populated for STIG findings
- [ ] Vulnerability remediation workflow functional

### Security Reports
- [ ] Reports directory created: `docs/wiki/security/reports/`
- [ ] All 4 report types generated:
  - [ ] Audit logs report
  - [ ] Vulnerability findings report
  - [ ] Controls status report
  - [ ] DISA STIG compliance report
- [ ] Report index README.md created
- [ ] Retention policy documented

### Automation
- [ ] Report generation script tested
- [ ] Scheduled task configured (cron/GitHub Actions)
- [ ] Old reports cleanup verified
- [ ] SIEM integration tested (if applicable)

### Documentation
- [ ] DISA STIG Compliance guide published to wiki
- [ ] Security README updated
- [ ] Implementation procedures documented
- [ ] Audit preparation checklist available

## Troubleshooting

### Database Connection Issues

**Problem:** "Error: Connection refused"

**Solution:**
1. Verify database is running: `pg_isready`
2. Check `.env` file has correct credentials
3. Test connection: `psql -h localhost -U user -d controlweave`

### Missing Framework

**Problem:** "Framework disa_stig_app not found"

**Solution:**
1. Run seed script: `node scripts/seed-disa-stig-framework.js`
2. Verify: `psql -d controlweave -c "SELECT * FROM frameworks WHERE code = 'disa_stig_app';"`

### No Organizations Found

**Problem:** "No organizations found. Please create organizations first."

**Solution:**
1. Create organization via UI or SQL:
```sql
INSERT INTO organizations (name, tier) VALUES ('Demo Organization', 'professional');
```
2. Re-run baseline script

### Report Generation Errors

**Problem:** Reports not generating or incomplete

**Solution:**
1. Ensure directories exist: `mkdir -p controlweave/docs/wiki/security/reports`
2. Check write permissions
3. Verify database queries return data
4. Review script output for specific errors

## Maintenance Schedule

### Daily
- Automated security report generation
- Audit log review for critical events
- SIEM alert monitoring

### Weekly
- Review new vulnerability findings
- Update control implementation status
- Generate and review compliance dashboards

### Monthly
- Complete control assessments
- Update implementation narratives
- Security code reviews

### Quarterly
- Full DISA STIG compliance assessment
- Third-party security testing
- Incident response procedure testing

### Annually
- Comprehensive audit preparation
- Penetration testing
- STIG version update review
- Security policy updates

## Support Resources

### Documentation
- [DISA STIG Compliance Guide](../docs/wiki/security/DISA-STIG-Compliance.md)
- [Vulnerability Management](../docs/wiki/security/Vulnerability-Management.md)
- [Audit Log AU-2 Compliance](../AUDIT_LOG_AU2_COMPLIANCE.md)
- [CI/CD Security Pipeline](../CI_CD_COMPLIANCE_MAPPING.md)

### External Resources
- [DISA STIG Library](https://public.cyber.mil/stigs/)
- [NIST SP 800-53 Rev 5](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

### Scripts Reference
- `seed-disa-stig-framework.js` - Seed DISA STIG framework
- `apply-security-baseline.js` - Apply comprehensive baseline
- `export-security-reports.js` - Generate and export reports
- `test-au2-audit-logging.js` - Test audit logging compliance

## Conclusion

Following this guide ensures ControlWeave is:
- ✓ DISA STIG Application Security compliant
- ✓ Multi-framework security baseline applied
- ✓ 1-year audit log retention enforced
- ✓ Automated security reporting to wiki
- ✓ Vulnerability management operational
- ✓ Audit-ready with complete documentation

For additional support, consult your security team or review the comprehensive documentation in the wiki.
