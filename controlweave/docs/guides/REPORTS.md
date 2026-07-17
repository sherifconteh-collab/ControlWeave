# 📈 Reports Guide

Generate compliance reports in PDF and Excel format — from detailed control status exports to executive-ready summaries and System Security Plans.

## Overview

ControlWeave's reporting module produces audit-ready compliance reports with real-time data from your controls, assessments, evidence, assets, vulnerabilities, and POA&M items.

---

## Available Report Types

### 1. Compliance Status Report (PDF & Excel)

A full compliance report covering all active frameworks:

- Overall compliance percentage
- Per-framework breakdown (total controls, implemented, in-progress, crosswalked)
- Control-level detail: ID, title, framework, status, assigned owner, implementation date, notes

**Use when**: Sharing compliance status with leadership or auditors.

### 2. System Security Plan (SSP)

A comprehensive system security plan document following NIST conventions:

- Organization and system profile
- CIA triad impact levels (Confidentiality, Integrity, Availability)
- Deployment model and environment types
- Cloud providers and data sensitivity types
- RMF lifecycle stage
- Full control inventory with implementation details
- Asset summary by category (hardware, software, environments, etc.)
- Vulnerability summary
- Evidence count
- POA&M summary

**Use when**: Preparing for FedRAMP, ATO, or government contractor requirements.

### 3. Framework-Specific Report

Filter your report to a single framework (e.g., NIST 800-53, SOC 2, ISO 27001):

- Controls in scope for that framework
- Implementation status per control
- Crosswalk credits (controls satisfied via other frameworks)
- Compliance percentage

**Use when**: Preparing for a specific audit or certification.

### 4. Executive Summary Report

High-level compliance overview:

- Organization compliance score
- Framework status at a glance
- Top risks and gaps
- Priority actions

**Use when**: Board presentations or executive briefings.

---

## Generating a Report

### Step 1: Navigate to Reports

1. Click **Reports** in the left sidebar
2. You'll see the report generation options and a history of previously generated reports

### Step 2: Select Report Type

1. Choose the report type from the available options
2. Select the **Format**: PDF or Excel (XLSX)

### Step 3: Configure Options

Depending on report type, configure:
- **Framework filter** — limit to one or all frameworks
- **Status filter** — include only certain control statuses
- **Date range** — for activity-based reports

### Step 4: Generate

1. Click **Generate Report**
2. The report is built server-side with live data
3. The file downloads automatically

> **💡 Tip**: Large reports with many controls may take a few seconds to generate. The file will download as soon as it is ready.

---

## Scheduled Report Delivery

In addition to on-demand generation, Reports supports recurring report delivery by email — switch to the **Scheduled** view on the Reports page.

### Setting up a scheduled report

1. Click **Reports** in the left sidebar, then switch to **Scheduled**
2. Click **New Scheduled Report** and configure:
   - **Report type**: Compliance Summary, Framework Gap, Evidence Status, Audit Trail, or Executive Summary
   - **Schedule**: Daily, Weekly, Monthly, or Quarterly
   - **Format**: PDF, CSV, or JSON
   - **Recipients**: one or more email addresses
3. Save — the report runs automatically on the configured cadence and is emailed as an attachment to each recipient

### How delivery works

A background scheduler checks for due reports and runs them without any manual trigger. Each run generates a fresh file from live data (not a cached snapshot) and emails it through your organization's configured SMTP settings (**Settings → Notifications**) or the platform default if none is set. If no SMTP transport is configured at all, the report still runs and `last_run_at` updates, but delivery is skipped — configure SMTP to receive the file.

**Use when**: You need recurring compliance visibility (e.g., a weekly gap report to your compliance lead, or a monthly executive summary to leadership) without remembering to generate it manually.

---

## Report Content Details

### PDF Reports

PDF reports include:

- **Header**: Organization name, report type, generation date
- **Executive Summary**: Compliance percentage, framework count, key metrics
- **Framework Table**: Per-framework compliance breakdown
- **Control Details**: Sorted by framework and control ID
- **Footer**: Page numbers and confidentiality notice

### Excel (XLSX) Reports

Excel reports include multiple worksheets:

| Sheet | Contents |
|-------|----------|
| **Summary** | Overall compliance metrics |
| **Frameworks** | Per-framework breakdown |
| **Controls** | All controls with status, owner, notes |
| **Assets** (SSP) | Asset inventory by category |
| **Vulnerabilities** (SSP) | Vulnerability summary |

---

## System Security Plan (SSP) Details

The SSP report pulls from your organization profile. To ensure the SSP is complete:

1. Go to **Settings** → **Organization Profile**
2. Fill in:
   - **System Name** and **System Description**
   - **Authorization Boundary**
   - **Operating Environment Summary**
   - **Confidentiality / Integrity / Availability Impact** levels
   - **Environment Types** (cloud, on-premise, hybrid)
   - **Deployment Model**
   - **Cloud Providers**
   - **Data Sensitivity Types**
   - **RMF Stage**
3. Save your profile
4. Re-generate the SSP for updated content

---

## Compliance Data Explained

### Compliance Percentage Calculation

```
Compliance % = (Implemented + Satisfied via Crosswalk) / Total Controls × 100
```

Controls with status `implemented` or `satisfied_via_crosswalk` count toward compliance.

### Crosswalk Credits

When a control is satisfied through a crosswalk mapping (implementing one control satisfies another), it is counted as `satisfied_via_crosswalk` and included in the compliance percentage.

---

ControlWeaver has no tier gating — report generation, PDF/Excel export, System Security Plan (SSP) generation, and framework-filtered reports are all available to every authenticated user.

---

## Related Features

- [Dashboard Guide](DASHBOARD.md) — Real-time compliance metrics
- [Assessments Guide](ASSESSMENTS.md) — Assessment data included in reports
- [AI Analysis Guide](AI_ANALYSIS.md) — AI-generated executive summaries
- [Frameworks Guide](FRAMEWORKS.md) — Framework-level compliance data
