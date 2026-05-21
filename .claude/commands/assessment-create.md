# Create Assessment Engagement

Scaffold a new assessment engagement with all required components for ControlWeaver.

## Input

$ARGUMENTS — Description of the assessment (e.g., "SOC 2 readiness assessment for Q2 2026")

## Steps

1. **Gather requirements**
   - Determine engagement type: `internal_audit`, `external_audit`, `readiness`, or `assessment`
   - Identify target frameworks (e.g., SOC 2, NIST 800-53, ISO 27001)
   - Define scope and assessment period

2. **Create the engagement via API**
   - POST to `/api/v1/assessments/engagements`
   - Required fields: `name`, `engagement_type`
   - Optional fields: `scope`, `framework_codes[]`, `status`, `period_start`, `period_end`, `lead_auditor_id`, `engagement_owner_id`
   - Valid statuses: `planning`, `fieldwork`, `reporting`, `complete`, `cancelled`

3. **Set up PBC (Prepared by Client) items**
   - POST to `/api/v1/assessments/engagements/:id/pbc`
   - Each PBC item needs: `title`, `description`, `priority` (low/medium/high/critical), `assigned_to_id`, `due_date`
   - Link PBC items to specific controls via `control_ids[]`

4. **Create workpapers** (if needed)
   - POST to `/api/v1/assessments/engagements/:id/workpapers`
   - Fields: `title`, `procedure_type` (examination/interview/test), `content`
   - Workpaper statuses: `draft`, `in_review`, `finalized`

5. **Link assessment procedures**
   - Assessment procedures define what to examine for each control
   - Three depths: Basic, Focused, Comprehensive
   - Outcomes follow NIST standard: Satisfied, Other Than Satisfied, Not Applicable

6. **Verify the setup**
   - Check engagement appears in GET `/api/v1/assessments/engagements`
   - Verify PBC items are assigned and have due dates
   - Confirm framework controls are linked

## Assessment Engagement Template

```javascript
// POST /api/v1/assessments/engagements
{
  "name": "SOC 2 Type II Readiness - Q2 2026",
  "engagement_type": "readiness",
  "scope": "Evaluate SOC 2 Trust Services Criteria coverage",
  "framework_codes": ["SOC2"],
  "status": "planning",
  "period_start": "2026-04-01",
  "period_end": "2026-06-30"
}
```

## Checklist

- [ ] Engagement created with correct type and scope
- [ ] Framework codes match target compliance frameworks
- [ ] PBC items created with priorities and due dates
- [ ] Workpapers initiated for key control areas
- [ ] Assessment procedures linked at appropriate depth
- [ ] All queries filter by `organization_id`
- [ ] `requirePermission('assessments.write')` applied to creation routes
