# 👔 Auditor Workspace Guide

Enable external auditors to access compliance data securely through tokenized, time-limited workspace links.

## Overview

The Auditor Workspace provides a secure, read-only portal for external auditors, assessors, and audit firms. You generate a shareable link that gives auditors access to your compliance posture, evidence, findings, and PBC (Provided By Client) request status — without requiring them to have a ControlWeave account.

---

## How It Works

1. **You create a workspace link** — generates a secure token with an expiry date
2. **You share the link** with your auditor
3. **Auditor visits the link** — no login required
4. **Auditor sees** your compliance summary, evidence, findings, and PBC requests
5. **Link expires automatically** — after the configured number of days

---

## Creating an Auditor Workspace Link

### Step 1: Navigate to Auditor Workspace

1. Click **Auditor Workspace** in the left sidebar
2. Go to the **Links** tab

### Step 2: Create a New Link

1. Click **Create New Link**
2. Fill in the form:
   - **Name** — descriptive label (e.g., "SOC 2 Q3 2025 Audit — PricewaterhouseCoopers")
   - **Engagement** (optional) — link to a specific audit engagement to scope the view
   - **Days Valid** — how long the link remains active (1–365 days, default 30)
3. Click **Create Link**

### Step 3: Share the Link

1. Copy the generated URL
2. Send it to your external auditor via email or your preferred channel
3. The auditor can access the workspace immediately

> **💡 Tip**: All link creation and access events are logged in the audit trail automatically.

---

## What Auditors See

When an auditor visits a workspace link, they see:

### Compliance Summary Dashboard
- **Controls in Scope** — total controls across active frameworks
- **Controls Implemented** — number with implemented status
- **Open POA&M Items** — active remediation items
- **Open Vulnerabilities** — current vulnerability count
- **Evidence Count** — total uploaded evidence artifacts

### Engagement Details (if linked)
- Engagement name, type, and status
- Timeline and description

### Findings
- All audit findings for the linked engagement
- Sorted by severity (Critical → High → Medium → Low)
- Each finding shows: title, severity, status, recommendation, due date

### PBC Requests (Provided By Client)
- List of documents/artifacts requested by the auditor
- Each request shows: title, priority, status, due date

### Recent Evidence
- Last 50 evidence items uploaded
- File name, type, size, and upload date

---

## Managing Workspace Links

### View All Links

Go to **Auditor Workspace** → **Links** to see all workspace links with:
- Link name
- Associated engagement (if any)
- Expiry date
- Active/inactive status

### Deactivate a Link

1. Find the link in the list
2. Click the link's action menu
3. Select **Deactivate**
4. The auditor can no longer access the workspace via that link

### Extend a Link

1. Find the link in the list
2. Click **Edit**
3. Update the **Expiry Date**
4. Click **Save**

---

## Audit Engagements

For structured audits, create a formal engagement to track the audit lifecycle.

### Engagement Types

| Type | Description |
|------|-------------|
| **Internal Audit** | Internal team self-assessment |
| **External Audit** | Third-party independent audit |
| **Readiness Assessment** | Pre-audit preparation review |
| **Assessment** | General compliance assessment |

### Engagement Statuses

| Status | Meaning |
|--------|---------|
| **Planning** | Scope and logistics being defined |
| **Fieldwork** | Active evidence gathering and testing |
| **Reporting** | Findings being documented and reviewed |
| **Completed** | Audit concluded |
| **Archived** | Historical record |

### Creating an Engagement

1. Go to **Auditor Workspace** → **Engagements**
2. Click **New Engagement**
3. Enter: name, type, description, framework scope, start/end dates
4. Click **Create**
5. Add PBC requests and link the engagement to a workspace link

---

## PBC Requests (Provided By Client)

PBC requests are documents or artifacts the auditor needs from your team.

### PBC Priorities

- **Critical** — Must have before fieldwork begins
- **High** — Required for core testing
- **Medium** — Supporting documentation
- **Low** — Nice to have

### PBC Statuses

| Status | Meaning |
|--------|---------|
| **Open** | Request submitted, awaiting response |
| **In Progress** | Your team is gathering the artifact |
| **Submitted** | Artifact provided to auditor |
| **Accepted** | Auditor confirmed receipt and acceptance |
| **Rejected** | Auditor rejected; revision needed |
| **Closed** | Request fulfilled |

---

## Audit Findings

Findings document deficiencies or gaps discovered during the audit.

### Finding Severities

- **Critical** — Immediate risk, must remediate urgently
- **High** — Significant risk, remediate within 30 days
- **Medium** — Moderate risk, remediate within 90 days
- **Low** — Minor issue, remediate within 180 days

### Finding Statuses

| Status | Meaning |
|--------|---------|
| **Open** | Finding documented, remediation not started |
| **Accepted** | Risk accepted (with justification) |
| **Remediating** | Remediation in progress |
| **Verified** | Remediation complete and verified |
| **Closed** | Finding resolved and closed |

---

## Sign-offs

Formal audits require structured sign-offs at completion:

| Sign-off Type | Who Signs |
|---------------|-----------|
| **Customer Acknowledgment** | Your organization's management |
| **Auditor Sign-off** | External auditor firm |
| **Company Leadership Sign-off** | Executive team |
| **Auditor Firm Final Recommendation** | Audit firm recommendation letter |

---

## Audit Templates

ControlWeave supports custom templates for consistent audit artifacts. Templates can be uploaded for:

- PBC request forms
- Workpaper templates
- Finding report templates
- Sign-off checklists
- Engagement reports

**Supported formats**: PDF, DOCX, TXT, MD, CSV

To upload a template:
1. Go to **Settings** → **Audit Templates**
2. Click **Upload Template**
3. Select the template type and upload the file
4. Templates are parsed and stored (up to 250,000 characters)

---

## Tier Requirements

| Feature | Community | Pro | Enterprise | Gov Cloud |
|---------|------|---------|--------------|------------|
| Auditor Workspace | ❌ | ✅ | ✅ | ✅ |
| Workspace Links | ❌ | ✅ | ✅ | ✅ |
| Engagements | ❌ | ✅ | ✅ | ✅ |
| Findings & PBC Requests | ❌ | ✅ | ✅ | ✅ |
| Audit Templates | ❌ | ✅ | ✅ | ✅ |

---

## Related Features

- [Assessments Guide](ASSESSMENTS.md) — Conduct formal assessments
- [Evidence Guide](EVIDENCE.md) — Upload evidence for auditor review
- [Reports Guide](REPORTS.md) — Generate audit-ready reports
- [POA&M Guide](POAM.md) — Track remediation of audit findings
