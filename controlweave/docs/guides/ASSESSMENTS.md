# ✅ Assessments Guide

Learn how to run compliance assessments against your controls using NIST-standard procedures and outcomes.

## Overview

Assessments allow you (or an external auditor) to formally evaluate whether security controls are implemented correctly and operating effectively. ControlWeave supports 186 seeded assessment procedures across all active frameworks, with three assessment depths and three NIST-standard outcome states.

---

## Key Concepts

### Assessment Depths

| Depth | Description | When to Use |
|-------|-------------|-------------|
| **Basic** | Lightweight review of documentation and stated implementation | Quick internal checks, pre-audit readiness |
| **Focused** | Targeted examination of specific controls and evidence | Routine periodic assessments |
| **Comprehensive** | Full examine/interview/test cycle per NIST SP 800-53A | Formal audits, FedRAMP/ATO preparation |

### NIST-Standard Outcomes

| Outcome | Meaning |
|---------|---------|
| **Satisfied** | Control is implemented correctly and operating as intended |
| **Other Than Satisfied** | Control is partially implemented or has deficiencies |
| **Not Applicable** | Control does not apply to the system/organization |

### Procedure Types

- **Examine** — Review documentation, policies, records, and system configurations
- **Interview** — Speak with personnel responsible for implementing or operating the control
- **Test** — Exercise or observe the control mechanism directly

---

## Running an Assessment

### Step 1: Navigate to Assessments

1. Click **Assessments** in the left sidebar
2. You'll see a list of existing assessment plans and procedures

### Step 2: Create an Assessment Plan

1. Click **New Assessment**
2. Select **Engagement** (optional — link to an audit engagement)
3. Choose **Framework** from your active frameworks
4. Select **Controls** to include in this assessment
5. Choose **Assessment Depth** (Basic, Focused, or Comprehensive)
6. Assign an **Assessor** from your team
7. Set a **Target Completion Date**
8. Click **Create Plan**

### Step 3: Browse Assessment Procedures

Each control has one or more procedures. For each procedure:

1. Open the assessment plan
2. Click a control to expand its procedures
3. Review the **Procedure Steps** — what to examine, who to interview, what to test
4. Review **Evidence Needed** — what artifacts are required

### Step 4: Record Assessment Results

For each procedure:

1. Select the **Outcome**: Satisfied, Other Than Satisfied, or Not Applicable
2. Add **Assessor Notes** — describe what was reviewed and what was found
3. Link relevant **Evidence** from the evidence library
4. If outcome is Other Than Satisfied, add **Findings** (what is deficient)
5. Click **Save Result**

### Step 5: Complete and Finalize

1. Review all procedure results
2. Click **Finalize Assessment**
3. Assessment status changes to **Complete**
4. Results are reflected in control health scores

> **💡 Tip**: Assessments with "Other Than Satisfied" findings automatically generate POA&M candidates. Review the POA&M module after completing an assessment.

---

## Assessment Plans

### Viewing Plans

The **Assessment Plans** tab shows all plans with:
- Plan name and description
- Framework(s) assessed
- Number of controls in scope
- Completion percentage
- Assessor assigned
- Target date and status

### Plan Statuses

| Status | Meaning |
|--------|---------|
| **Planning** | Plan created, not yet started |
| **In Progress** | Assessment work underway |
| **Completed** | All procedures evaluated |
| **Archived** | Historical record |

---

## Assessment Procedures Library

ControlWeave includes 186 seeded assessment procedures mapped to framework controls. To browse them:

1. Go to **Assessments** → **Procedures Library**
2. Filter by:
   - **Framework** (e.g., NIST 800-53, ISO 27001)
   - **Control Family** (e.g., AC, AU, IA)
   - **Procedure Type** (Examine, Interview, Test)
3. Click any procedure to see detailed steps

> **💡 Tip**: Procedures follow NIST SP 800-53A assessment objectives. Each procedure maps to specific control parameters (examine, interview, test).

---

## Segregation of Duties (SoD)

ControlWeave enforces separation of duties on assessments:

- The person who **implements** a control cannot be the sole **assessor** of that same control
- This ensures independent review and audit integrity
- Admins can configure SoD exceptions in **Settings** → **Audit**

---

## Assessment Results & Reporting

> **💡 Improved in v2.3.0**: AI-powered analysis features used during and after assessments (such as gap analysis and compliance forecasting) now load significantly faster thanks to optimized streaming. Large assessments covering 100+ controls previously experienced timeouts — these have been resolved.

### Viewing Results

After completing an assessment:

1. Go to **Assessments** → **Results**
2. See outcome summary by control
3. Drill into individual procedure results
4. View linked evidence per procedure

### Exporting Results

1. Open a completed assessment plan
2. Click **Export** → **PDF Report** or **Excel**
3. Report includes:
   - Assessment scope and methodology
   - Procedure-level outcomes
   - Assessor notes
   - Evidence references
   - Finding summaries

---

## Tier Requirements

| Feature | Community | Pro | Enterprise | Gov Cloud |
|---------|------|---------|--------------|------------|
| Basic assessment depth | ✅ | ✅ | ✅ | ✅ |
| Focused assessment depth | ❌ | ✅ | ✅ | ✅ |
| Comprehensive assessment depth | ❌ | ✅ | ✅ | ✅ |
| Assessment PDF export | ❌ | ✅ | ✅ | ✅ |
| External auditor workspace | ❌ | ✅ | ✅ | ✅ |

---

## Related Features

- [Controls Guide](CONTROLS.md) — Understand the controls being assessed
- [Evidence Guide](EVIDENCE.md) — Upload and link evidence to procedures
- [Auditor Workspace Guide](AUDITOR_WORKSPACE.md) — External auditor access
- [POA&M Guide](POAM.md) — Track remediation for findings
- [Reports Guide](REPORTS.md) — Generate assessment reports
