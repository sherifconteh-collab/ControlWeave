# 🗄️ Data Governance Guide

Define data retention policies, configure data sovereignty settings, and manage data classification across your organization.

## Overview

The Data Governance module helps organizations comply with data protection regulations (GDPR, CCPA, HIPAA) by managing how long data is retained, where data is stored, and what cross-border transfer restrictions apply.

---

## Data Retention Policies

Retention policies define how long specific types of data should be kept before deletion or archival.

### Viewing Retention Policies

1. Go to **Data Governance** → **Retention Policies**
2. See all policies with:
   - Policy name and resource type
   - Retention period (days)
   - Auto-enforcement status
   - Active/inactive status

### Creating a Retention Policy

1. Click **New Policy**
2. Enter:
   - **Policy Name** — descriptive name (e.g., "Audit Logs 7-Year Retention")
   - **Resource Type** — what kind of data this policy applies to (e.g., `evidence`, `audit_logs`, `vulnerability_findings`)
   - **Retention Days** — how many days to retain this data (minimum 1)
   - **Auto Enforce** — whether the system automatically enforces deletion/archival
   - **Active** — whether this policy is currently in effect
3. Click **Save**

### Updating a Policy

1. Find the policy in the list
2. Click **Edit**
3. Update any field (name, resource type, retention days, enforcement, active status)
4. Click **Save**

### Deleting a Policy

1. Find the policy
2. Click **Delete**
3. Confirm — note that existing data is not immediately deleted

> **💡 Tip**: Keep policies in sync with your regulatory requirements. HIPAA requires 6 years minimum; GDPR requires data to be retained only as long as necessary for its purpose. <!-- ip-hygiene:ignore -->

---

## Data Sovereignty Configuration

Data sovereignty settings control where your organization's data is stored and what cross-border transfer rules apply.

### Viewing Sovereignty Configuration

1. Go to **Data Governance** → **Sovereignty**
2. See your current:
   - **Primary Data Region** — where data is primarily stored
   - **Data Residency Requirements** — specific residency obligations
   - **Cross-Border Transfer Allowed** — whether data can leave the primary region
   - **Approved Transfer Regions** — which regions are approved for cross-border transfers
   - **Data Localization Policy** — your stated data localization policy
   - **Sovereignty Attestation Date** — when this configuration was last attested

### Updating Sovereignty Configuration

1. Click **Edit Configuration**
2. Update:
   - **Primary Data Region** — e.g., `us-east`, `eu-west`, `ap-southeast`
   - **Data Residency Requirements** — JSON array of specific requirements (e.g., GDPR Article 44)
   - **Cross-Border Transfer Allowed** — toggle on/off
   - **Approved Transfer Regions** — list of approved destination regions
   - **Data Localization Policy** — free-text policy statement
3. Click **Save**
4. The **Sovereignty Attestation Date** is automatically updated to now

---

## Regulatory Jurisdictions

View which regulatory jurisdictions are relevant to your data operations.

1. Go to **Data Governance** → **Jurisdictions**
2. Browse jurisdictions with:
   - Jurisdiction name and code
   - Whether AI regulations apply
   - Whether data residency requirements exist

Filter by:
- **Has AI Regulations** — jurisdictions with AI-specific data rules
- **Has Data Residency Requirements** — jurisdictions requiring local data storage

### Common Jurisdictions

| Region | Key Regulation | Data Residency |
|--------|----------------|---------------|
| **EU / EEA** | GDPR | Standard Contractual Clauses required for transfers |
| **California, USA** | CCPA | No residency requirement, but disclosure required |
| **Russia** | Federal Law 242-FZ | Must store Russian citizen data locally |
| **China** | PIPL / MLPS | Strict localization for certain data types |
| **Brazil** | LGPD | Based on GDPR model |

---

## Data Classification

While ControlWeave does not currently have a standalone Data Classification interface, data classification is configured through:

1. **Assets** (CMDB) → **Security Classification** field on each asset
2. **System Profile** → **Data Sensitivity Types** (configured in Settings → Organization Profile)
3. **Data Sovereignty** → **Data Residency Requirements** (data type restrictions by region)

---

## Compliance Mapping

Data governance policies support these compliance frameworks:

| Framework | Relevant Controls |
|-----------|------------------|
| **GDPR** | Article 5 (data minimization), Article 17 (right to erasure) |
| **HIPAA** | §164.530(j) (record retention), §164.312 (access controls) |
| **NIST 800-53** | SI-12 (information management and retention) |
| **SOC 2** | CC6.5 (data disposal), A1.3 (data retention) |

> **💡 Tip**: Link your retention policies to controls in the Controls module by adding implementation notes referencing the specific policy name and retention period.

---

*Requires `settings.manage` permission for retention policies and `organizations.write` for sovereignty configuration.*

---

## Related Features

- [Settings Guide](SETTINGS.md) — Organization profile and data sensitivity types
- [State AI Laws Guide](STATE_AI_LAWS.md) — AI-specific data regulations by jurisdiction
- [CMDB Guide](CMDB.md) — Asset-level data classification
- [Frameworks Guide](FRAMEWORKS.md) — GDPR, HIPAA, and other data frameworks
