# 🤖 AI Governance Guide

Manage your organization's AI vendor ecosystem, assess risks, track incidents, and govern your AI supply chain.

## Overview

The AI Governance module helps organizations manage the risks associated with AI vendors and components they use. It tracks vendor risk assessments, AI-related incidents, and AI supply chain components — giving you a structured approach to governing third-party AI use. This feature requires **Pro tier or above**.

---

## Key Concepts

### AI Vendor Assessments

An AI vendor assessment captures the risk profile of an AI service or tool your organization uses:

- **Vendor Types**: LLM Provider, ML Platform, Data Provider, AI Tool, Consulting
- **Risk Levels**: Low, Medium, High, Critical
- **Business Criticality**: Low, Medium, High, Critical
- **Statuses**: Active, Expired, Terminated, Under Review

### AI Vendor Incidents

Incidents document adverse events related to AI vendor use:

- **Incident Types**: Security Breach, Data Leak, Service Outage, Compliance Violation, Model Failure
- **Severities**: Low, Medium, High, Critical

### AI Supply Chain Components

Individual AI components (models, datasets, libraries, APIs) used within your organization:

- **Component Types**: Model, Dataset, Library, Infrastructure, API, Tool
- **Approval tracking**: whether each component is approved for use
- **Vulnerability tracking**: known vulnerability count per component

---

## AI Governance Summary

Navigate to **AI Governance** to see the summary dashboard:

### Vendor Summary
- **Total Active Vendors** — count of active AI vendor assessments
- **Critical Count** — vendors with critical risk level
- **High Count** — vendors with high risk level
- **Overdue Assessments** — vendors past their assessment due date
- **Due Soon** — assessments due within 30 days
- **Concentration Risk** — vendors with high/critical business criticality
- **Average Privacy Risk Score** — mean privacy risk across active vendors
- **Average Overall Risk Score** — mean overall risk score

### Incident Summary
- **Open Incidents** — unresolved AI-related incidents
- **Critical Open Incidents** — high/critical severity open incidents
- **Incidents Last 90 Days** — recent incident trend

### Supply Chain Summary
- **Total Active Components** — AI components in use
- **Unapproved Components** — components not yet approved for use
- **Components with Vulnerabilities** — components with known vulnerabilities

---

## Managing AI Vendors

### Viewing Vendors

1. Go to **AI Governance** → **Vendors**
2. Filter by:
   - **Risk Level** (Low / Medium / High / Critical)
   - **Vendor Type** (LLM Provider, ML Platform, etc.)
   - **Business Criticality**
   - **Status**
   - **Search** by vendor name
3. Vendors are sorted by risk level (Critical first)

### Adding a Vendor Assessment

1. Click **Add Vendor**
2. Fill in vendor details:
   - **Vendor Name** and **Vendor Type**
   - **Website** and **Contact**
   - **Assessment Date** and **Next Assessment Date**
   - **Risk Scores**: Overall, Security, Privacy, Compliance, Operational, Financial (0–100)
   - **Risk Level** (derived from overall score)
   - **Business Criticality**
3. Complete AI-specific evaluation fields:
   - **Model Transparency** — does the vendor disclose model details?
   - **Bias Testing Evidence** — has bias testing been performed?
   - **Explainability Capability** — can decisions be explained?
   - **Adversarial Robustness** — resistance to adversarial inputs
   - **Data Provenance Clarity** — clear origin of training data
4. Add **Risk Acceptance** decision (Pending / Accepted / Mitigated / Transferred / Avoided)
5. Click **Save**

### Viewing Vendor Details

Click any vendor to see:
- Full assessment details and scores
- **Recent Incidents** — last 10 AI incidents linked to this vendor
- **Supply Chain Components** — active components sourced from this vendor

---

## Tracking AI Incidents

### Logging an Incident

1. Go to **AI Governance** → **Incidents**
2. Click **Log Incident**
3. Fill in:
   - **Vendor** (link to an assessed vendor)
   - **Incident Date**
   - **Incident Type** (Security Breach, Data Leak, Service Outage, Compliance Violation, Model Failure)
   - **Severity** (Low / Medium / High / Critical)
   - **Incident Summary** — description of what happened
4. Click **Save**

### Tracking Incident Resolution

Update incident status as remediation progresses. All incidents are visible in the vendor detail view and the summary dashboard.

---

## AI Supply Chain Management

The supply chain component registry tracks all AI components your organization uses.

### Adding a Component

1. Go to **AI Governance** → **Supply Chain**
2. Click **Add Component**
3. Enter:
   - **Component Name** and **Component Type** (Model, Dataset, Library, etc.)
   - **Risk Level**
   - **Source Vendor** (link to a vendor assessment)
   - **Approved for Use** — whether this component is authorized
   - **Known Vulnerabilities** — number of known vulnerabilities
4. Click **Save**

### Unapproved Components

Components not yet approved for use appear highlighted in the summary. Review and approve (or reject) components before they are put into production.

---

## Tier Requirements

| Feature | Community | Pro | Pro | Enterprise |
|---------|------|---------|--------------|------------|
| AI Governance module | ❌ | ❌ | ✅ | ✅ |
| Vendor assessments | ❌ | ❌ | ✅ | ✅ |
| Incident tracking | ❌ | ❌ | ✅ | ✅ |
| Supply chain components | ❌ | ❌ | ✅ | ✅ |

---

## Related Features

- [AI Monitoring Guide](AI_MONITORING.md) — Real-time monitoring of AI systems
- [CMDB Guide](CMDB.md) — Track AI agents as assets
- [Vendor Risk Guide](VENDOR_RISK.md) — Third-party risk management
- [Threat Intelligence Guide](THREAT_INTELLIGENCE.md) — AI-related threat feeds
