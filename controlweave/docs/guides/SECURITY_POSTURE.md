# 🔒 Security Posture Guide

Monitor your organization's real-time security posture, operational health, and risk metrics in one unified view.

## Overview

The Security Posture module aggregates data from across ControlWeave — vulnerabilities, audit events, POA&M items, job queues, and SIEM configurations — into a unified operational and security dashboard. It also provides administrative oversight of system health. This feature combines the **Security Posture** dashboard (SIEM integration) and the **Operations** dashboard (system health).

---

## Security Posture Dashboard

Navigate to **Security Posture** to see your current risk and security metrics.

### Security Metrics

- **Open Vulnerabilities** — active vulnerability findings (Open + In Progress)
- **Active POA&M Items** — remediation items currently being worked
- **Compliance Score** — current percentage of implemented controls
- **Critical Findings** — vulnerabilities with critical severity

### SIEM Integration Status

If you have a SIEM configured, the Security Posture dashboard shows:

- Whether your SIEM connection is active
- Last successful data push
- Number of events forwarded

---

## SIEM Configuration

Connect ControlWeave to your SIEM to forward compliance events and audit logs in real time.

### Supported SIEM Providers

| Provider | Description |
|----------|-------------|
| **Splunk** | Splunk Enterprise / Splunk Cloud |
| **Elastic** | Elastic SIEM / Elasticsearch |
| **Webhook** | Generic HTTP webhook (any SIEM) |
| **Syslog** | RFC 5424 Syslog receiver |

### Configuring a SIEM Connection

1. Go to **Settings** → **Integrations** → **SIEM**
2. Click **Add SIEM Configuration**
3. Enter:
   - **Name** — descriptive label for this connection
   - **Provider** — Splunk, Elastic, Webhook, or Syslog
   - **Connection Details** — URL, port, token, or index (provider-specific)
   - **Enabled** — toggle to activate
4. Click **Save**

### What Gets Forwarded to SIEM

All significant audit events are eligible for forwarding:

- Control implementation changes
- Evidence uploads
- Assessment completions
- User authentication events
- Configuration changes
- POA&M updates
- Vulnerability findings

### Testing the Connection

After configuring:
1. Click **Test Connection**
2. A test event is sent to your SIEM
3. Verify receipt in your SIEM console

---

## Operations Dashboard

The Operations dashboard provides administrative visibility into ControlWeave's operational health. Navigate to **Operations** in the admin menu.

> **Note**: The Operations dashboard requires `settings.manage` permission and is intended for platform administrators.

### Overview Metrics

#### User Activity
- **Active Users** — users with `is_active = true`
- **Total Users** — all users in the organization
- **Active Users (7 days)** — distinct users who performed actions in the last 7 days

#### Audit Log Activity
- **Events (24h)** — total audit events in the last 24 hours
- **Failures (24h)** — failed or error events in the last 24 hours

#### Open Risk Items
- **Open Vulnerabilities** — active vulnerability findings
- **Remediated Vulnerabilities** — resolved vulnerability findings
- **Active POA&M Items** — open remediation tasks

### Job Queue Health

The job queue status shows pending, running, failed, and completed background jobs:

| Status | Meaning |
|--------|---------|
| **Pending** | Job queued, waiting to start |
| **Running** | Job actively executing |
| **Failed** | Job encountered an error |
| **Completed** | Job finished successfully |

> **💡 Tip**: Investigate failed jobs if you notice SIEM forwarding or webhook delivery issues. Failed jobs may indicate connection problems or configuration errors.

### Webhook Delivery Status

Outgoing webhook delivery health:

| Status | Meaning |
|--------|---------|
| **Pending** | Delivery queued |
| **Delivered** | Successfully received by target |
| **Failed** | Delivery failed after retries |

### Top Audit Events (Last 7 Days)

The top 12 most frequent event types in the last 7 days — helps identify patterns in user activity or system events.

### Recent Failures

The 20 most recent failed audit log entries — useful for identifying errors or unauthorized access attempts.

---

## Risk Score Interpretation

ControlWeave calculates your security posture risk from:

1. **Compliance gap** — percentage of unimplemented controls
2. **Open vulnerabilities** — weighted by severity (critical = highest)
3. **Overdue POA&M items** — remediation tasks past their due date
4. **Open audit findings** — from the Auditor Workspace

A lower risk score indicates better security posture. Use the Priority Actions section of your [Dashboard](DASHBOARD.md) to see which controls to address first.

---

ControlWeaver has no tier gating — the Security Posture dashboard, SIEM integration, Operations dashboard, and webhook health monitoring are all available to every authenticated user. SIEM configuration requires the `settings.manage` permission.

---

## Related Features

- [Dashboard Guide](DASHBOARD.md) — Overall compliance and control metrics
- [Vulnerabilities Guide](VULNERABILITIES.md) — Manage open vulnerability findings
- [POA&M Guide](POAM.md) — Track remediation tasks
- [Integrations Guide](INTEGRATIONS.md) — Configure SIEM and other connections
- [Threat Intelligence Guide](THREAT_INTELLIGENCE.md) — Ingest threat data
