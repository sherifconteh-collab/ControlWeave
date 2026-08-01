# Security Reports

Destination directory for security reports exported from a running
ControlWeave instance. The directory is tracked (via `.gitkeep`) but its
contents are not — reports are generated per-deployment and contain
organization-specific findings, so they are produced on demand rather than
committed.

## Generating reports

```bash
cd controlweave/backend
node scripts/export-security-reports.js
```

Output lands in this directory.

## What gets exported

| Report | Contents |
|---|---|
| Audit log summaries | Daily and weekly audit trail rollups |
| Vulnerability findings | STIG, SBOM, and scanner results |
| Controls status | Security control implementation tracking |
| DISA STIG compliance | Application security STIG status |
| Compliance dashboards | Multi-framework compliance posture |

## Retention

Per DISA STIG APSC-DV-000840 and NIST SP 800-53 AU-11:

- **Audit logs** — 365 days minimum
- **Security reports** — 365 days
- **Vulnerability data** — until remediation, plus 90 days
- **Evidence files** — configurable, default 365 days

Retention is enforced by the platform against its own records. Files exported
into this directory are a point-in-time copy and are not managed by the
retention job — treat them as artifacts to be filed wherever your evidence
retention process lives.

## Related

- [Security overview](../README.md) — the controls behind these reports
- [DISA STIG compliance](../DISA-STIG-Compliance.md) — STIG mapping detail
- [Vulnerability management](../Vulnerability-Management.md) — the workflow that produces findings
