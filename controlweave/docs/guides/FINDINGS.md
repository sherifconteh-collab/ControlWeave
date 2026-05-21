# 🔍 Audit Findings Guide

Document, track, and resolve audit findings within ControlWeave's Auditor Workspace.

## Overview

Audit findings document control deficiencies, exceptions, or observations discovered during an audit engagement. ControlWeave links findings directly to controls, workpapers, and remediation plans.

## Creating a Finding

1. Navigate to **Auditor Workspace** → **Engagements** → select an engagement
2. Click **Findings** → **New Finding**
3. Fill in finding details:
   - **Title**: Short description of the finding
   - **Control Reference**: The control(s) affected
   - **Severity**: Critical, High, Medium, Low, or Informational
   - **Finding Type**: Deficiency, Significant Deficiency, or Material Weakness
   - **Description**: Detailed description of the issue
   - **Root Cause**: Underlying cause of the finding
   - **Recommendation**: Suggested corrective action
4. Click **Create Finding**

## Finding Severity Levels

| Severity | Description | Typical Response Time |
|----------|-------------|----------------------|
| **Critical** | Material weakness, immediate risk | Immediate action required |
| **High** | Significant deficiency | 30 days |
| **Medium** | Control deficiency | 60-90 days |
| **Low** | Minor gap or improvement opportunity | 90-180 days |
| **Informational** | Observation, no immediate risk | Next review cycle |

## Finding Lifecycle

```
New → Management Response → Remediation In Progress → Resolved → Closed
```

## Management Response

After a finding is issued, the auditee provides a formal response:

1. Open the finding
2. Click **Add Management Response**
3. Enter:
   - **Response**: Agreement or disagreement with finding
   - **Corrective Action Plan**: Steps being taken
   - **Target Date**: Expected completion date
   - **Owner**: Person responsible for remediation

## Linking to POA&M

Critical and High findings can be automatically linked to POA&M items:

1. Open the finding
2. Click **Create POA&M Item**
3. The finding details are pre-populated
4. Adjust and save the POA&M entry

## Related Guides

- [Engagements](ENGAGEMENTS.md) - Manage audit engagements
- [Workpapers](WORKPAPERS.md) - Audit workpaper documentation
- [POA&M Tracking](POAM.md) - Track remediation plans
- [Reports](REPORTS.md) - Include findings in audit reports
