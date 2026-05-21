---
description: Assessment engagement and audit workflow conventions
globs:
  - "controlweave/backend/src/routes/assessments.js"
  - "controlweave/backend/src/routes/audit*.js"
  - "controlweave/backend/src/routes/auditorWorkspace.js"
  - "controlweave/backend/src/services/audit*.js"
  - "controlweave/frontend/src/app/dashboard/assessments/**"
  - "controlweave/frontend/src/app/dashboard/auditor-workspace/**"
---
# Assessment & Audit Conventions

Assessments are ControlWeaver's core compliance workflow — available at Community tier. The assessment module is the largest route file (~3700 lines), so follow these patterns carefully.

## Engagement Types

- `internal_audit` — organization-led compliance review
- `external_audit` — third-party auditor engagement
- `readiness` — pre-audit readiness assessment
- `assessment` — general compliance assessment

## Engagement Lifecycle

```
planning → fieldwork → reporting → complete
                                  → cancelled (at any stage)
```

## Key Sub-Resources

Each engagement has child resources accessed via nested routes:

- **PBC items**: `/api/v1/assessments/engagements/:id/pbc` — Prepared by Client requests
- **Workpapers**: `/api/v1/assessments/engagements/:id/workpapers` — audit documentation
- **Findings**: `/api/v1/assessments/engagements/:id/findings` — identified issues
- **Signoffs**: `/api/v1/assessments/engagements/:id/signoffs` — approval chain

## PBC (Prepared by Client) Priorities

- `low`, `medium`, `high`, `critical`
- PBC items track: title, description, priority, assigned_to_id, due_date, status
- Always validate `assigned_to_id` belongs to the same organization

## Workpaper Statuses

```
draft → in_review → finalized
```

Finalized workpapers should not be modified without creating a new version.

## Finding Severity Levels

- `low`, `medium`, `high`, `critical`
- Each finding links to specific controls and generates remediation recommendations

## Signoff Types

Multiple stakeholders sign off on assessments:
- `auditor` — lead auditor approval
- `management` — management review
- `executive` — executive sign-off
- `customer_acknowledgment` — customer acceptance
- `company_leadership` — company leadership review
- `auditor_firm_recommendation` — audit firm's formal recommendation

## Assessment Outcomes (NIST Standard)

Assessment procedures produce one of three outcomes:
- **Satisfied** — control meets requirements
- **Other Than Satisfied** — control has gaps
- **Not Applicable** — control doesn't apply to scope

## Assessment Depth

Three examination depths determine thoroughness:
- **Basic** — high-level review
- **Focused** — targeted examination of specific areas
- **Comprehensive** — exhaustive review of all aspects

## User Validation Pattern

When linking users to assessments (auditors, owners, assignees), always verify the user belongs to the organization:

```javascript
async function ensureOrgUser(orgId, userId) {
  if (!userId) return true; // null is acceptable
  const result = await pool.query(
    'SELECT id FROM users WHERE id = $1 AND organization_id = $2 AND is_active = true',
    [userId, orgId]
  );
  return result.rows.length > 0;
}
```

## Permission Model

- Read: `requirePermission('assessments.read')` (or no explicit permission — authenticated users in the org)
- Write: `requirePermission('assessments.write')` for creating/modifying engagements, PBC, workpapers, findings
