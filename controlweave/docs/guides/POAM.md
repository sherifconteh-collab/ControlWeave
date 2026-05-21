# 📝 POA&M Tracking Guide

Complete guide to managing Plans of Action & Milestones (POA&M) in ControlWeave.

## Overview

POA&M (Plan of Action & Milestones) items document weaknesses or deficiencies identified during assessments and the planned remediation steps to address them. This guide covers creating, tracking, updating, and closing POA&M items, including the auditor review workflow and framework-specific processes.

---

## Understanding POA&M

### What is a POA&M?

A **Plan of Action & Milestones** is a formal document that:
- Identifies a security or compliance weakness
- Describes the remediation plan
- Defines milestones and target completion dates
- Tracks progress toward resolution
- Provides an audit trail of remediation efforts

### When POA&M Items Are Created

POA&M items are created in three ways:

1. **Manually** — You create a POA&M for any identified weakness
2. **From Vulnerabilities** — Convert a tracked vulnerability into a POA&M
3. **Automatically** — System creates a POA&M when a control transitions from non-compliant to compliant status (requires auditor review)

---

## POA&M Statuses

| Status | Meaning |
|--------|---------|
| **Open** | Weakness identified, remediation not yet started |
| **In Progress** | Actively working on remediation |
| **Pending Auditor Review** | Remediation complete, awaiting auditor approval |
| **Auditor Approved** | Auditor confirmed remediation is satisfactory |
| **Auditor Rejected** | Auditor found remediation insufficient; rework required |
| **Closed** | Weakness fully remediated and verified |

### Status Workflow

```
Open → In Progress → Pending Auditor Review → Auditor Approved → Closed
                                            ↓
                                    Auditor Rejected → In Progress
```

---

## Viewing POA&M Items

### Access POA&M List

1. Click **POA&M** in the left sidebar
2. You'll see all POA&M items for your organization

![POA&M list view showing ID, title, status, severity, and due date](../screenshots/poam-list-view-01.png)
*Figure 1: POA&M list — Your remediation tracking dashboard*

### List View Columns

- **ID**: Unique POA&M identifier
- **Title**: Brief description of the weakness
- **Status**: Current remediation status
- **Severity**: Critical, High, Medium, or Low
- **Control**: Associated control (if any)
- **Due Date**: Target completion date
- **Owner**: Assigned person

### Filter & Search

Use the filter bar to narrow results by:
- **Status**: Filter by current status
- **Severity**: Focus on critical or high items
- **Framework**: Show POA&Ms linked to a specific framework
- **Owner**: View items assigned to a team member
- **Date Range**: Filter by due date

![POA&M filter bar with status and severity options](../screenshots/poam-filter-bar-01.png)
*Figure 2: Filter POA&M items*

---

## Creating a POA&M

### Create Manually

1. Click **POA&M** in the left sidebar
2. Click **New POA&M**

![New POA&M button highlighted](../screenshots/poam-new-button-01.png)
*Figure 3: Create a new POA&M*

3. Fill in the POA&M form:

![POA&M creation form](../screenshots/poam-create-form-01.png)
*Figure 4: POA&M creation form*

**Required Fields**:
- **Title**: Clear, concise description of the weakness
- **Description**: Full details of the identified weakness or deficiency
- **Severity**: Critical / High / Medium / Low
- **Remediation Plan**: Steps to address the weakness
- **Target Completion Date**: Realistic deadline

**Optional Fields**:
- **Control**: Link to the relevant compliance control
- **Owner**: Person responsible for remediation
- **Milestones**: Break remediation into trackable steps
- **Supporting Evidence**: Attach relevant documents

4. Click **Create POA&M**

### Create from Vulnerability

Convert an existing vulnerability into a formal POA&M:

1. Navigate to **Vulnerabilities**
2. Open the vulnerability you want to track
3. Click **Create POA&M**

![Create POA&M button in vulnerability details](../screenshots/poam-from-vuln-button-01.png)
*Figure 5: Create POA&M from vulnerability*

The form will be pre-populated with vulnerability details. Review and complete any additional fields, then click **Create POA&M**.

### Automatic POA&M Creation

When a control transitions from non-compliant (`Not Started`, `In Progress`, `Needs Review`) to compliant (`Implemented`, `Verified`), the system **automatically creates a POA&M** and places it in `Pending Auditor Review` status.

**Required**: You must provide a `poam_justification` explaining the remediation when updating the control status.

![Control status change requiring POA&M justification](../screenshots/poam-auto-create-justification-01.png)
*Figure 6: Justification required when marking a control compliant*

The POA&M is automatically submitted for auditor review and linked to the control.

---

## Updating a POA&M

### Update Status

1. Open the POA&M
2. Click **Edit**
3. Change the **Status** field

![POA&M status dropdown options](../screenshots/poam-status-dropdown-01.png)
*Figure 7: POA&M status options*

### Add Progress Updates

Document progress notes without changing status:

1. Open the POA&M
2. Scroll to **Updates** section
3. Click **Add Update**
4. Enter your progress note
5. Click **Save**

![POA&M updates section with Add Update button](../screenshots/poam-updates-section-01.png)
*Figure 8: Log progress updates on a POA&M*

**Good Update Notes Include**:
- What was completed
- What's remaining
- Any blockers or dependencies
- Revised timeline if needed

### Attach Evidence

Link evidence of remediation to the POA&M:

1. Open the POA&M
2. Scroll to **Evidence** section
3. Click **Add Evidence**
4. Upload or link existing evidence

---

## Submitting for Auditor Review

When remediation is complete, submit the POA&M for auditor review.

### Standard Submission

1. Open the POA&M
2. Click **Submit for Review**

![Submit for Review button](../screenshots/poam-submit-review-button-01.png)
*Figure 9: Submit POA&M for auditor review*

3. Fill in the review submission form:

![Review submission form with justification and evidence fields](../screenshots/poam-submit-review-form-01.png)
*Figure 10: Review submission form*

**Required**:
- **Justification**: Detailed explanation of how the weakness was remediated
- **Control** (if applicable): The control that was addressed
- **Status Change**: Previous and new control status

**Optional**:
- **Supporting Evidence**: Link evidence documents
- **Framework-Specific Data**: Additional fields for specific frameworks (see below)

4. Click **Submit for Review**

The POA&M status changes to `Pending Auditor Review`. Auditors are notified automatically.

---

## Framework-Specific POA&M Processes

ControlWeave supports specialized remediation documentation required by specific compliance frameworks. Select the appropriate **Framework-Specific Type** when submitting for review.

### FISCAM (Federal Information System Controls Audit Manual)

#### Corrective Action Plan (CAP)

For formal corrective action plans required by FISCAM:

**Required Fields**:
- **Root Cause**: Underlying cause of the control deficiency
- **Corrective Action**: Specific actions taken to address the root cause
- **Responsible Official**: Name and title of the accountable official
- **Target Completion Date**: When corrective action will be complete
- **Resources Required**: Budget, personnel, and tools needed

**Review Levels**: Auditor → Management → Independent Verification

#### Notice of Findings and Recommendations (NFR)

For formal notices of audit findings:

**Required Fields**:
- **Finding Description**: Detailed description of the audit finding
- **Recommendation**: Specific recommended actions
- **Management Response**: Organization's response to the finding
- **Estimated Completion Date**: Expected resolution date

**Review Levels**: Auditor → Auditee Management → Audit Committee

### ISO 27001

#### Corrective Action Request (CAR)

For non-conformities identified during ISO 27001 audits:

**Required Fields**:
- **Non-Conformity Description**: Description of the non-conformity
- **Corrective Action**: Actions to eliminate the cause
- **Preventive Action**: Actions to prevent recurrence
- **Verification Method**: How effectiveness will be confirmed

**Review Levels**: Auditor → Management Representative

#### Opportunity for Improvement (OFI)

For non-mandatory improvement recommendations:

**Required Fields**:
- **Improvement Area**: Area being improved
- **Proposed Action**: Recommended improvement
- **Expected Benefit**: Anticipated outcome

### SOC 2

#### Control Exception

For documented exceptions to SOC 2 requirements:

**Required Fields**:
- **Exception Rationale**: Why the exception is necessary
- **Compensating Controls**: Alternative controls in place
- **Risk Assessment**: Risk level of the exception
- **Remediation Plan**: Plan to eliminate the exception

#### Control Deficiency

For design or operational deficiencies:

**Required Fields**:
- **Deficiency Type**: Design deficiency or operational deficiency
- **Impact Assessment**: Potential impact of the deficiency
- **Remediation Steps**: Specific remediation actions
- **Testing Plan**: How remediation will be tested

### HIPAA

#### HIPAA Corrective Action Plan

For violations or compliance gaps involving Protected Health Information (PHI):

**Required Fields**:
- **Violation Description**: Nature of the HIPAA violation or gap
- **Affected PHI**: Type and scope of PHI involved
- **Corrective Measures**: Steps taken to correct the violation
- **Prevention Measures**: Actions to prevent recurrence
- **Compliance Date**: Date full compliance was achieved

### PCI DSS

#### Report on Attestation of Compliance (RAV)

For PCI DSS compliance gaps:

**Required Fields**:
- **Requirement Number**: Specific PCI DSS requirement
- **Gap Description**: Nature of the compliance gap
- **Remediation Approach**: How the gap will be addressed
- **Validation Method**: How compliance will be validated
- **Target Date**: Completion target

### NIST 800-53

#### NIST POA&M

Standard NIST-format POA&M:

**Required Fields**:
- **Weakness Description**: Description of the identified weakness
- **Risk Rating**: Risk level (Critical, High, Moderate, Low)
- **Remediation Steps**: Planned remediation actions
- **Milestones**: Specific milestones with dates
- **Resources**: Required budget and personnel
- **Scheduled Completion**: Planned completion date

### FedRAMP

#### FedRAMP POA&M

For agency authorization-specific findings:

**Required Fields**:
- **Weakness ID**: Unique identifier for the weakness
- **Risk Adjustment**: Risk level adjustment justification
- **Vendor Dependency**: Any dependency on third-party vendors
- **Milestone Changes**: Changes to milestone schedule
- **Deviation Request**: Request for deviation from standard requirements

---

## Auditor Review Workflow

*Available to users with Auditor role (Pro+ tiers)*

### Viewing POA&Ms Pending Review

Auditors see a dedicated queue of submissions pending review:

1. Navigate to **POA&M** in the left sidebar
2. Filter by **Status: Pending Auditor Review**

![POA&M queue filtered to pending review items](../screenshots/poam-auditor-queue-01.png)
*Figure 11: Auditor review queue*

### Getting Framework-Specific Guidance

Before reviewing, access framework-specific guidance:

1. Open the POA&M submission
2. Click **View Auditor Guidance**

![Auditor guidance panel showing framework-specific review checklist](../screenshots/poam-auditor-guidance-01.png)
*Figure 12: Framework-specific auditor guidance*

Guidance includes:
- Required fields to verify
- Review checklist specific to the framework type
- Multi-level review workflow

### Conducting the Review

1. Open the POA&M pending review
2. Review the justification and supporting evidence
3. Check framework-specific data (if applicable)
4. Click **Review**

![Review form with approve, reject, and changes requested options](../screenshots/poam-review-form-01.png)
*Figure 13: Auditor review form*

**Review Outcomes**:
- **Approved**: Remediation is satisfactory; POA&M moves to `Auditor Approved`
- **Rejected**: Remediation is insufficient; POA&M returns to `In Progress`
- **Changes Requested**: Minor adjustments needed before approval

5. Enter **Review Comments**: Provide actionable feedback
6. Click **Submit Review**

The POA&M owner is notified of the outcome automatically.

### Viewing Approval History

Track the complete review history of any POA&M:

1. Open the POA&M
2. Scroll to **Approval History**

![Approval history showing all review submissions and outcomes](../screenshots/poam-approval-history-01.png)
*Figure 14: POA&M approval history*

---

## Closing a POA&M

Once an auditor approves the POA&M, you can close it:

1. Open the `Auditor Approved` POA&M
2. Click **Close POA&M**
3. Confirm closure

The POA&M status changes to `Closed` and is retained in the audit trail.

---

## POA&M Tips & Best Practices

### Creating Effective POA&Ms

**DO**:
✅ Be specific about the weakness and its impact
✅ Define realistic milestones with clear owners
✅ Link to the relevant control and framework
✅ Attach supporting evidence as you remediate
✅ Log progress updates regularly
✅ Use framework-specific types when applicable
✅ Provide detailed justification when submitting for review

**DON'T**:
❌ Use vague descriptions like "fix security issue"
❌ Set unrealistic target dates
❌ Leave POA&Ms in "In Progress" without updates
❌ Skip evidence attachment
❌ Submit for review without sufficient documentation

### Weekly Review Tasks

- Review all POA&M items for status updates
- Log progress on in-progress items
- Submit completed remediations for review
- Respond to auditor review outcomes
- Identify overdue items and escalate as needed

### Severity Guidance

| Severity | Remediation Timeline | Examples |
|----------|---------------------|----------|
| **Critical** | 30 days | Exposed credentials, active exploits, zero-day vulnerabilities |
| **High** | 90 days | Unpatched critical CVEs, missing MFA, inadequate access controls |
| **Medium** | 180 days | Incomplete policy documentation, outdated configurations |
| **Low** | 365 days | Minor process improvements, documentation gaps |

---

## Troubleshooting

### POA&M Not Visible

**Problem**: Expected POA&M not in the list

**Solutions**:
- Check active filters (status or severity may be filtering it out)
- Verify you have `controls.read` permission
- Search by POA&M ID or title
- Refresh the page

### Can't Submit for Review

**Problem**: Submit for Review button is disabled or unavailable

**Possible Causes**:
- No linked control selected (required for automatic workflow)
- Missing required justification text
- Insufficient permissions (need `controls.write`)

### Auditor Review Not Receiving Notifications

**Problem**: Auditor not notified of new submissions

**Solutions**:
- Verify auditor's notification settings are enabled
- Check that the user has the Auditor role with `audit.write` permission
- Contact an admin to verify notification configuration

### Framework-Specific Fields Not Appearing

**Problem**: Framework-specific data fields not shown

**Solutions**:
- Select a **Framework-Specific Type** in the review submission form
- Verify the framework is activated for your organization
- Contact support if the framework type is not listed

---

## Quick Reference

### POA&M Status Transitions

| From | To | Action Required |
|------|----|----------------|
| Open | In Progress | Edit POA&M, update status |
| In Progress | Pending Auditor Review | Submit for Review with justification |
| Pending Auditor Review | Auditor Approved | Auditor approves |
| Pending Auditor Review | In Progress | Auditor rejects (rework needed) |
| Auditor Approved | Closed | Close the POA&M |

### Permissions

| Action | Required Permission |
|--------|-------------------|
| View POA&Ms | `controls.read` |
| Create/Update POA&Ms | `controls.write` |
| Submit for Review | `controls.write` |
| Review (Approve/Reject) | `audit.write` |
| View Auditor Guidance | `audit.read` |

### Feature Availability by Tier

| Feature | Community | Pro | Enterprise | Gov Cloud |
|---------|------|---------|--------------|------------|
| POA&M Tracking | ✅ | ✅ | ✅ | ✅ |
| Auditor Review Workflow | ❌ | ✅ | ✅ | ✅ |
| Framework-Specific Types | ❌ | ✅ | ✅ | ✅ |
| From-Vulnerability Creation | ❌ | ✅ | ✅ | ✅ |
| Automated POA&M Creation | ✅ | ✅ | ✅ | ✅ |

---

**Next Steps:**
- [Controls Guide](CONTROLS.md)
- [Assessments Guide](ASSESSMENTS.md)
- [Vulnerability Management](VULNERABILITIES.md)
- [AI Analysis](AI_ANALYSIS.md)
