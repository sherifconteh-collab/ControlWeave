# 🎛️ Controls Management Guide

Complete guide to managing security and compliance controls in ControlWeave.

## Overview

Controls are the security and compliance requirements from your activated frameworks. This guide covers everything from viewing and filtering controls to implementing them and tracking their health.

---

## Understanding Controls

### What is a Control?

A **control** is a specific security or compliance requirement from a framework. Examples:
- **NIST 800-53 AC-2**: Account Management  
- **ISO 27001 A.9.2.1**: User registration and de-registration
- **SOC 2 CC6.1**: Logical and physical access controls
- **HIPAA 164.308(a)(4)(i)**: Information access management

### Control Components

Each control has:
- **Control ID**: Unique identifier (e.g., AC-2, A.9.2.1)
- **Title**: Brief description
- **Framework(s)**: Which framework(s) include this control
- **Full Description**: Detailed requirement
- **Implementation Guidance**: How to satisfy the control
- **Assessment Procedures**: How to test the control
- **Crosswalk Mappings**: Equivalent controls in other frameworks

![Control detail page showing all control components](../screenshots/control-detail-01.png)
*Figure 1: Complete control detail view*

---

## Viewing Controls

### Access Controls List

1. Click **Controls** in the left sidebar
2. You'll see all controls from your activated frameworks

![Controls list showing control ID, title, framework, status, and owner](../screenshots/controls-list-01.png)
*Figure 2: Controls list - Your compliance inventory*

### List View Columns

- **Control ID**: Framework-specific identifier
- **Title**: Brief control description
- **Framework**: Badge(s) showing which framework(s)
- **Status**: Implementation status
- **Owner**: Assigned person
- **Due Date**: Implementation deadline
- **Health Score**: Overall control health (0-100%)

---

## Filtering & Searching Controls

### Filter by Framework

Click framework badge or use dropdown to show only controls from that framework.

### Filter by Status

Status options:
- **Not Started**: No work begun
- **In Progress**: Implementation underway
- **Implemented**: Fully deployed
- **Needs Review**: Implementation complete, pending internal review
- **Verified**: Implemented and independently assessed
- **Not Applicable**: Control does not apply to this system/org
- **Auto-Crosswalked**: Automatically satisfied via crosswalk from another implemented control

> **💡 Fixed in v2.3.0**: Status badges on the Controls list page now display consistently across all browsers and control sets. If you previously saw missing or miscolored badges, this has been resolved.

### Filter by Family

Group by control families:
- **AC** - Access Control
- **AU** - Audit and Accountability
- **CM** - Configuration Management
- **IA** - Identification and Authentication
- **IR** - Incident Response
- And more...

### Search Controls

Search by:
- Control ID (e.g., "AC-2")
- Keywords in title or description
- Owner name
- Evidence tags

**Search Tips**:
- Use quotes for exact phrases: `"access control"`
- Search multiple terms: `encryption data`
- Use control IDs: `AC-2 AC-3 AC-6`

---

## Control Implementation

### Step 1: Open Control Details

Click any control to see full details:

![Control detail page with tabs for Overview, Implementation, Assessment, Evidence](../screenshots/control-detail-01.png)
*Figure 3: Control detail*

### Step 2: Edit Implementation

Click **Edit Implementation** button.

### Step 3: Update Status

![Status dropdown with all status options](../screenshots/control-status-dropdown-01.png)
*Figure 4: Select implementation status*

**Status Workflow**:
```
Not Started → In Progress → Implemented → Needs Review → Verified
                                 ↓
                          (crosswalk applied)
                        Auto-Crosswalked
```

> **Note**: Selecting "Not Applicable" is available from the control detail page when a control genuinely does not apply to your system or organization.

### Step 4: Assign Owner

Select team member responsible for implementing this control.

### Step 5: Set Due Date

Choose realistic deadline based on control complexity.

### Step 6: Add Implementation Notes

**Good Implementation Notes Include**:
- What was implemented
- Technologies/tools used
- Configuration details
- Process changes made
- People involved
- Date implemented

**Example**:
```
Implemented multi-factor authentication (MFA) using Microsoft Authenticator 
for all users. Enforced via Azure AD Conditional Access policies. 
All 47 users enrolled as of 2024-01-15. Emergency access accounts 
exempted per documented procedure.
```

### Step 7: Save Changes

Click **Save** to update control.

---

## Linking Evidence

### Why Link Evidence?

Evidence proves you've implemented controls:
- Required for audits
- Demonstrates compliance
- Supports assessment activities
- Shows due diligence

### Add Evidence to Control

From control details:

1. Scroll to **Evidence** section
2. Click **Add Evidence**
3. Choose **Upload New** or **Link Existing**

### Upload New Evidence

![Evidence upload modal](../screenshots/evidence-upload-form-01.png)
*Figure 5: Upload evidence files*

**Supported Formats**:
- PDF - Policies, procedures, screenshots
- DOCX - Documents, plans
- XLSX - Spreadsheets, logs
- PNG/JPG - Screenshots, diagrams
- TXT - Configuration files, logs

**Best Practices**:
- Use descriptive filenames
- Add meaningful tags
- Include version numbers
- Date your evidence
- Keep evidence current

### Link Existing Evidence

If you've already uploaded evidence:

1. Click **Link Existing**
2. Search/browse evidence library
3. Select evidence to link
4. Click **Link**

![Link existing evidence dialog showing evidence library](../screenshots/evidence-link-control-01.png)
*Figure 6: Link previously uploaded evidence*

### View Linked Evidence

Click any evidence to:
- View the file
- See which controls it supports
- Check upload date
- View tags
- Download

---

## Control Health

### What is Control Health?

**Control Health Score** (0-100%) measures:
- Implementation status (40%)
- Evidence currency (30%)
- Assessment results (30%)

### Health Score Breakdown

**High Health (80-100%)**:
- ✅ Status: Implemented
- ✅ Evidence: < 90 days old
- ✅ Recent assessment: Satisfied

**Medium Health (50-79%)**:
- ⚠️ Status: In Progress or Implemented
- ⚠️ Evidence: 90-180 days old
- ⚠️ Assessment: Other Than Satisfied or pending

**Low Health (0-49%)**:
- ❌ Status: Not Started or Not Applicable
- ❌ Evidence: > 180 days old or missing
- ❌ Assessment: Failed or never assessed

### Improving Control Health

**Quick Wins**:
1. Update old evidence (< 90 days)
2. Complete pending assessments
3. Add missing evidence
4. Update status to reflect reality
5. Document implementation notes

---

## Control Exceptions

### When to Use Exceptions

Control exceptions are for when you:
- Cannot implement a control (technical limitation)
- Choose not to implement (risk acceptance)
- Defer implementation (resource constraints)
- Implement an alternative control

### Create Exception

1. Open control details
2. Click **Request Exception**
3. Fill exception form:

**Required Fields**:
- **Reason**: Why exception is needed
- **Risk Level**: Impact of not implementing
- **Compensating Controls**: Alternative measures
- **Expiry Date**: When to review
- **Approver**: Who must approve

### Exception Workflow

```
Requested → Pending Review → Approved/Rejected
                                    ↓
                              Valid Until Expiry
                                    ↓
                              Review Required
```

### Review Exceptions

Exceptions expire and require review. Dashboard shows:
- Exceptions expiring within 30 days
- Expired exceptions
- Exceptions pending approval

---

## Crosswalk Mappings

### View Crosswalks

In control details, scroll to **Crosswalk Mappings** section to see equivalent controls in other frameworks.

### Understanding Mappings

**Mapping Types**:
- **Direct Equivalent**: 1:1 mapping, fully equivalent
- **Partial Coverage**: Control partially satisfies other
- **Related**: Similar intent but different scope

**Example**:
Implementing **NIST 800-53 AC-2** also satisfies:
- ISO 27001 A.9.2.1 (Direct Equivalent)
- SOC 2 CC6.1 (Partial Coverage)
- HIPAA 164.308(a)(3)(i) (Direct Equivalent)

### Leverage Crosswalks

**Strategy**:
1. Sort controls by crosswalk count
2. Implement controls with most mappings first
3. Maximize compliance with minimum effort
4. Use AI Crosswalk Optimizer for recommendations

### Manually Trigger a Crosswalk

After implementing a control, you can immediately propagate its implementation to all mapped controls:

1. In the Controls list, locate the implemented control
2. Click the **🔗 Crosswalk** button next to the control
3. ControlWeave checks all crosswalk mappings and auto-satisfies eligible related controls
4. A confirmation message shows how many related controls were auto-satisfied

> **💡 Tip**: The crosswalk is also triggered automatically when you set a control to "Implemented" or "Verified". The manual trigger is useful if you want to re-run crosswalk propagation after adjusting mapping settings.

---

## Import / Export

Export control implementation data for offline work and bulk updates, then import changes back into ControlWeave.

### Export Control Answers

1. Go to **Controls**
2. Click **Export XLSX** or **Export CSV** in the **Import / Export** panel
3. A file is downloaded containing all control implementation statuses and notes
4. Edit the file offline (useful for bulk updates or sharing with your team)

> **Permissions required**: `implementations.read`

### Import Control Answers

1. In the **Import / Export** panel, select your updated file (`.xlsx` or `.csv`)
2. Choose an import mode:
   - **Merge** *(recommended)*: Updates existing records without overwriting unrelated data
   - **Replace**: Replaces all implementation data with the imported file content
3. Optionally enable **AI column mapping**: If your spreadsheet uses non-standard column headers, AI will attempt to detect and map them automatically
4. Click **Import**
5. Review the import summary (rows processed, inserted, updated, skipped)

> **Permissions required**: `implementations.write`

> **💡 Tip**: Use Merge mode when importing partial updates. Use Replace only when you have a complete and authoritative export from ControlWeave itself.

---

## AI Control Assessments (Connector-Driven Suggestions)

### What It Does

When a connector (e.g., Splunk, via an evidence collection rule) gathers new evidence for a control, ControlWeave can ask AI whether that evidence supports changing the control's implementation status — either forward progress (e.g., Implemented → Verified) or a regression (e.g., Verified → In Progress) if the evidence suggests the control is no longer being met. AI never changes a control's status directly; every suggestion requires human review.

### Review Suggestions

1. Click **AI Control Assessments** in the left sidebar (under Compliance)
2. Click **Scan** to check controls with enabled evidence collection rules for new suggestions
3. Each suggestion shows the current status, the AI-suggested status, the AI's confidence and reasoning, and the linked evidence
4. Click **Approve** to apply the suggested status to the control (this is audit-logged), or **Reject** to dismiss it — optionally add a note either way

> **Note**: Approving a suggestion that sets a control to "Verified" requires the Admin or Auditor role, same as the manual status-update workflow. Unlike the manual workflow, AI-suggested regressions are allowed — flagging a possible regression for human review is the point of this feature.

### View Stats

The AI Control Assessments page also shows counts of pending, approved, and rejected suggestions for quick triage.

---

## Assessment Procedures

### View Procedures

Each control has assessment procedures that specify:
- **Procedure ID**: e.g., AC-2-EXAMINE-01
- **Type**: Examine, Interview, Test
- **Steps**: What to check
- **Evidence Needed**: Required artifacts
- **Expected Outcome**: What satisfies the procedure

### Create Assessment from Control

Quick path to assessment:

1. From control details
2. Click **Create Assessment**
3. Pre-filled with control info
4. Select depth and assessor
5. Click **Create**

---

## Control Tips & Best Practices

### Performance with Large Control Sets

For organizations with 500 or more active controls:

> **💡 Performance note (v2.3.0)**: The Controls list page received targeted query optimizations in this release. Page load, filtering, and search operations are significantly faster for large control inventories. Enable framework and status filters to load a targeted subset even faster.

### Implementation Tips

**DO**:
✅ Document as you implement (don't wait)
✅ Link evidence immediately
✅ Use consistent terminology
✅ Update status realistically
✅ Assign owners early
✅ Set reasonable due dates
✅ Review crosswalks before implementing
✅ Use AI for implementation guidance

**DON'T**:
❌ Mark as "Implemented" without evidence
❌ Use generic implementation notes
❌ Ignore crosswalk opportunities
❌ Skip owner assignment
❌ Set unrealistic deadlines
❌ Forget to upload evidence
❌ Leave controls in "In Progress" forever

### Evidence Tips

**Good Evidence Examples**:
- **Policies**: Information Security Policy, AUP, Data Classification Policy
- **Procedures**: Incident Response Procedure, Change Management Process
- **Screenshots**: System configurations, access control settings
- **Logs**: Audit logs, access logs, change logs
- **Reports**: Vulnerability scan reports, penetration test reports
- **Records**: Training completion records, user access reviews

**Evidence Organization**:
- Name files descriptively: `InfoSec-Policy-v2.1-2024-01.pdf`
- Tag by control: `AC-1`, `policy`, `approved`
- Update annually (or more frequently)
- Version control documents
- Include approval dates

### Priority Controls

**Start with These** (Quick Wins):
1. **AC-1, AT-1, IR-1, etc.** - Policy controls (just documents)
2. **CP-1** - Contingency Planning Policy
3. **PS-1** - Personnel Security Policy
4. **SI-1** - System and Information Integrity Policy

**High-Impact Controls**:
1. **AC-2** - Account Management
2. **AC-3** - Access Enforcement
3. **IA-5** - Authenticator Management
4. **AU-2** - Audit Events
5. **CA-2** - Security Assessments
6. **SC-7** - Boundary Protection

---

## Troubleshooting

### Control Not Showing

**Problem**: Expected control not in list

**Solutions**:
- Verify framework is activated
- Check filters (might be hiding it)
- Search by control ID
- Refresh page

### Can't Edit Control

**Problem**: Edit Implementation button disabled

**Possible Causes**:
- Insufficient permissions (need Manager role or higher)
- Control locked (contact admin)
- Organization in read-only mode

### Evidence Won't Upload

**Problem**: Evidence upload failing

**Solutions**:
- Check file size (maximum 50 MB per file)
- Verify file format is supported
- Try smaller file
- Contact support if persistent

### Missing Crosswalks

**Problem**: Expected crosswalk not showing

**Solutions**:
- Activate both frameworks
- Crosswalk may not exist (not all controls map)
- Enterprise: Create custom mapping

---

## Keyboard Shortcuts

- `Ctrl/Cmd + F` - Search controls
- `Ctrl/Cmd + K` - Open AI Copilot
- `E` - Edit implementation (when control selected)
- `S` - Save changes
- `Esc` - Close modal/dialog

---

## Quick Reference

### Control Status Options

| Status | Meaning | Use When |
|--------|---------|----------|
| Not Started | No work begun | Haven't started yet |
| In Progress | Implementation underway | Actively working on it |
| Implemented | Fully deployed | Completed and in production |
| Verified | Implemented and assessed | Passed formal assessment |
| Not Applicable | Does not apply | Control is out of scope for your system/org |
| Auto-Crosswalked | Satisfied via crosswalk | Automatically satisfied by another implemented control |

### Evidence Types by Control Type

| Control Type | Best Evidence |
|-------------|---------------|
| Policy Controls (AC-1, AT-1) | Policy documents, approval emails |
| Technical Controls (AC-2, IA-5) | Screenshots, configuration exports |
| Process Controls (CM-3, SA-3) | Process diagrams, procedure docs |
| Assessment Controls (CA-2, CA-7) | Assessment reports, scan results |

---

**Next Steps:**
- [Assessment Guide](ASSESSMENTS.md)
- [Evidence Guide](EVIDENCE.md)
- [AI Analysis](AI_ANALYSIS.md)
- [Framework Guide](FRAMEWORKS.md)
