# 🏢 Vendor Risk Guide

Manage third-party vendor risk, run vendor security assessments, track questionnaires, and score your supply chain.

## Overview

ControlWeave provides two complementary vendor risk management capabilities:

1. **TPRM (Third-Party Risk Management)** — full vendor lifecycle management with questionnaires, document tracking, and risk tiering
2. **Vendor Security Scores** — external security ratings from SecurityScorecard and BitSight

Together, these modules give you a complete picture of your vendor ecosystem's risk posture.

---

## TPRM — Third-Party Risk Management

### Vendor Registry

The TPRM vendor registry is your central inventory of third-party vendors.

#### Viewing Vendors

1. Go to **Vendor Risk** → **Vendors**
2. See all vendors sorted by risk tier (Critical first)
3. Filter by:
   - **Risk Tier** (Critical / High / Medium / Low)
   - **Review Status** (Pending Review, In Review, Approved, Conditional, Rejected, Decommissioned)
   - **Search** by vendor name or services provided

Each vendor card shows:
- Vendor name and type
- Risk tier
- Review status
- Number of questionnaires and documents
- Linked CMDB asset (if applicable)

#### Adding a Vendor

1. Click **Add Vendor**
2. Fill in:
   - **Vendor Name** — legal name of the vendor
   - **Vendor Type** — Software, Hardware, Services, Cloud, Managed Service, Data Processor, Other
   - **Risk Tier** — Critical, High, Medium, or Low
   - **Review Status** — current approval status
   - **Services Provided** — description of what this vendor delivers
   - **Data Access Level** — None, Metadata, Limited, or Full
   - **Contains PII** — whether the vendor processes personally identifiable information
   - **CMDB Asset** (optional) — link to an existing asset in your CMDB
3. Click **Save**

#### Updating a Vendor

1. Click any vendor to open details
2. Click **Edit**
3. Update any field
4. Click **Save**

---

### Vendor Risk Tiers

| Tier | Description | Review Frequency |
|------|-------------|-----------------|
| **Critical** | Mission-critical vendors with high data access | Annually or on change |
| **High** | Significant operational dependency | Annually |
| **Medium** | Moderate business impact | Every 2 years |
| **Low** | Minimal data access, easily replaceable | Every 3 years |

---

### Vendor Review Statuses

| Status | Meaning |
|--------|---------|
| **Pending Review** | Initial assessment not yet started |
| **In Review** | Assessment in progress |
| **Approved** | Vendor approved to use |
| **Conditional** | Approved with conditions or remediation requirements |
| **Rejected** | Vendor not approved for use |
| **Decommissioned** | Vendor relationship ended |

---

### Security Questionnaires

Send structured security questionnaires to vendors and track their responses.

#### Questionnaire Statuses

| Status | Meaning |
|--------|---------|
| **Draft** | Being prepared, not yet sent |
| **Sent** | Delivered to vendor |
| **In Progress** | Vendor is completing it |
| **Completed** | Vendor submitted responses |
| **Overdue** | Past due date, not completed |
| **Cancelled** | Questionnaire cancelled |

#### Sending a Questionnaire

1. Open a vendor's detail page
2. Go to the **Questionnaires** tab
3. Click **New Questionnaire**
4. Select questionnaire template and set a due date
5. Click **Send**

---

### Document Management

Track compliance documentation received from vendors.

#### Document Types

| Type | Description |
|------|-------------|
| **SOC 2 Report** | Third-party audit report |
| **ISO 27001 Certificate** | Information security certification |
| **Penetration Test Report** | Security testing results |
| **Privacy Policy** | Vendor's privacy practices |
| **DPA** | Data Processing Agreement |
| **BAA** | Business Associate Agreement (HIPAA) |
| **Insurance Certificate** | Cybersecurity insurance |
| **Business Continuity Plan** | Disaster recovery capability |
| **Incident Response Plan** | Security incident procedures |
| **Other** | Any other compliance document |

#### Document Statuses

| Status | Meaning |
|--------|---------|
| **Requested** | Document requested from vendor |
| **Received** | Document received |
| **Under Review** | Being evaluated |
| **Accepted** | Document accepted as satisfactory |
| **Rejected** | Does not meet requirements |
| **Expired** | Document has passed its validity date |

---

## Vendor Security Scores

External security ratings provide continuous, objective measurement of vendor security posture.

### Supported Rating Providers

| Provider | Description |
|----------|-------------|
| **SecurityScorecard** | Letter grades (A–F) across 10 risk factors |
| **BitSight** | Numerical ratings (250–900) with detailed breakdown |

### Viewing Vendor Scores

1. Go to **Vendor Risk** → **Security Scores**
2. See all vendor scores with:
   - Vendor name and score provider
   - Current score and grade
   - Score trend (improving/declining/stable)
   - Last score date

Filter by:
- **Vendor Name** — search specific vendor
- **Score Provider** — SecurityScorecard or BitSight
- **Score Trend** — improving, declining, or stable

### Adding a Vendor Score Manually

1. Click **Add Score**
2. Enter:
   - **Vendor Name**
   - **Score Provider** (securityscorecard or bitsight)
   - **Score Date**
   - **Score** and **Grade**
   - **Score Trend**
3. Click **Save**

### Integrating with SecurityScorecard/BitSight

Automated score ingestion is available via the Integrations Hub:
1. Go to **Settings** → **Integrations**
2. Configure SecurityScorecard or BitSight connector with your API key
3. Scores are automatically pulled on a schedule

---

ControlWeaver has no tier gating — the TPRM vendor registry, questionnaires, document tracking, vendor security scores, and the SecurityScorecard/BitSight integrations are all available to every authenticated user.

---

## Related Features

- [CMDB Guide](CMDB.md) — Link vendors to asset records
- [AI Governance Guide](AI_GOVERNANCE.md) — Manage AI-specific vendor risk
- [Integrations Guide](INTEGRATIONS.md) — Configure SecurityScorecard/BitSight connectors
- [Controls Guide](CONTROLS.md) — Map vendor risk controls (e.g., SA-9 External System Services)
- [Evidence Guide](EVIDENCE.md) — Store vendor compliance documents as evidence
