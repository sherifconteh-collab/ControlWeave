# POA&M Approval Workflow & Policy Engine — Implementation Reference

Architecture and implementation reference for the POA&M auditor-approval workflow
(with framework-specific remediation types) and the NIST 800-53-structured policy
documentation engine. For the user-facing workflow (creating/updating/closing
POA&Ms, submitting for review, auditor review UI, tips, troubleshooting), see
[`controlweave/docs/guides/POAM.md`](controlweave/docs/guides/POAM.md). This
document covers what that guide doesn't: database schema, service architecture,
raw API contracts, and the policy engine (which has no dedicated user guide).

## Database Schema (Migration 061)

See `controlweave/backend/migrations/061_poam_approval_and_policy_engine.sql` for
the full, idempotent schema. Re-running `npm run migrate` is safe.

**`poam_items` extensions** (6 new columns):
- `submitted_for_review_at`, `submitted_by`
- `reviewed_at`, `reviewed_by`
- `review_status`, `review_notes`

New statuses: `pending_auditor_review`, `auditor_approved`, `auditor_rejected`.

**`poam_approval_requests`** — tracks every approval request:
- Links POA&Ms to controls, stores justification and supporting evidence IDs
- Tracks review outcome and comments
- Framework-specific columns (added alongside the base table):
  - `framework_id UUID REFERENCES frameworks(id)`
  - `framework_specific_type VARCHAR(100)`
  - `framework_specific_data JSONB`
  - Indexes: `idx_poam_approval_framework`, `idx_poam_approval_type`

**Policy engine tables** (7 new tables, all organization-scoped):

| Table | Purpose |
|---|---|
| `organization_policies` | Policy records — version control, status workflow (`draft → under_review → approved → published → archived`), review scheduling |
| `policy_sections` | Sections organized by the 20 NIST 800-53 control families; holds policy content + family metadata |
| `policy_control_mappings` | Maps policy sections to specific controls, supports multiple frameworks, includes mapping notes |
| `policy_reviews` | Annual/ad-hoc review tracking. Review types: `annual`, `triggered`, `ad_hoc`, `change_driven` |
| `policy_user_acknowledgments` | User acknowledgment tracking, version-specific, linked to reviews |
| `policy_references` | References to assets/systems/processes/regulations; continuous-monitoring configuration and status |
| `policy_monitoring_alerts` | Automated alerts. Types: `review_due`, `reference_changed`, `compliance_issue`, `acknowledgment_required` |

All tables carry foreign key constraints, performance indexes, and `organization_id`
for multi-tenant isolation.

### NIST 800-53 control families (policy structural template)

AC, AT, AU, CA, CM, CP, IA, IR, MA, MP, PE, PL, PS, PT, RA, SA, SC, SI, PM, SR
(20 families total) — Access Control, Awareness and Training, Audit and
Accountability, Assessment/Authorization/Monitoring, Configuration Management,
Contingency Planning, Identification and Authentication, Incident Response,
Maintenance, Media Protection, Physical and Environmental Protection, Planning,
Personnel Security, PII Processing and Transparency, Risk Assessment, System and
Services Acquisition, System and Communications Protection, System and
Information Integrity, Program Management, Supply Chain Risk Management.

Each control family becomes a policy section; when multiple frameworks are
selected, controls are grouped by family across frameworks into one unified
section per family.

## Framework-Specific POA&M Service (`frameworkPoamService.js`)

`controlweave/backend/src/services/frameworkPoamService.js` (~380 lines) holds
the framework type configuration and validation logic:

- `FRAMEWORK_POAM_TYPES` — config for every supported framework type (required
  fields, review levels, guidance text)
- `getFrameworkPoamTypes(frameworkCode)` — types for one framework
- `getAllFrameworkTypes()` — all types across all frameworks
- `validateFrameworkSpecificData(type, data)` — enforces required fields before
  a submission is accepted
- `createFrameworkApprovalRequest(...)` — creates an approval request carrying
  framework context
- `getApprovalRequestWithContext(id)` — approval request + type config + guidance
- `getAuditorGuidance(frameworkCode, typeCode)` — framework-specific review
  checklist text for auditors

### Supported framework types and multi-level review chains

Required fields per type are documented in the user guide
(`controlweave/docs/guides/POAM.md` → "Framework-Specific POA&M Processes").
The multi-level **review chains** (not covered in the user guide) are:

| Framework / Type | Review chain |
|---|---|
| FISCAM CAP (`fiscam_cap`) | auditor → management → independent_verification |
| FISCAM NFR (`fiscam_nfr`) | auditor → auditee_management → audit_committee |
| ISO 27001 CAR (`iso_car`) | auditor → management_representative |
| SOC 2 Control Exception / Deficiency | auditor → service_auditor → client_notification |
| FedRAMP POA&M | csp → 3pao → agency_ao → fedramp_pmo |

(ISO OFI, HIPAA CAP, PCI RAV, and NIST 800-53 POA&M use a single-level
auditor review — no multi-stage chain.)

Validation is enforced server-side: submissions missing a required field for
the selected `framework_specific_type` are rejected before an approval request
is created. Storage is JSONB (`framework_specific_data`), so adding a new
framework type is a config change in `frameworkPoamService.js`, not a schema
migration.

## API Reference

### POA&M routes (`/api/v1/poam`)

- `POST /:id/submit-for-review` — submit for auditor review; accepts optional
  `framework_specific_type` + `framework_specific_data` alongside the standard
  `control_id`, `previous_control_status`, `new_control_status`,
  `justification`, `supporting_evidence_ids`
- `POST /:id/review` — auditor approve/reject/request-changes; body
  `{ outcome: 'approved' | 'rejected' | 'changes_requested', comments }`;
  requires `audit.write`
- `GET /:id/approval-history` — all approval requests + review details for a POA&M
- `GET /framework-types` and `GET /framework-types?framework_code=<code>` — list
  available framework-specific types and their required fields
- `GET /auditor-guidance/:frameworkCode/:typeCode` — framework-specific review
  guidance for auditors
- `GET /approval-request/:id/context` — approval request with full framework
  context, type config, and guidance

### Control implementation route enhancement

`PUT /api/v1/controls/:id/implementation` was extended to detect compliance
transitions and drive the POA&M workflow automatically:

1. Detects a status change from `['not_started', 'in_progress', 'needs_review']`
   to `['implemented', 'satisfied_via_crosswalk', 'verified']`
2. Requires a `poam_justification` field on the request body for such transitions
3. Auto-creates or updates a POA&M with status `pending_auditor_review`
   (accepting the same `framework_specific_type` / `framework_specific_data`
   fields as the manual submit-for-review endpoint)
4. Creates the approval request and notifies auditors
5. Returns `poam_item`, `status_change_detected: true`,
   `requires_auditor_review: true`, and (when a framework type was supplied)
   `framework_context` in the response

### Policy routes (`/api/v1/policies`)

- `GET /` — list policies (filter by `status`, `policy_type`)
- `GET /:id` — policy details with sections and recent reviews
- `POST /` — create policy (`policy_name`, `policy_type`, `version`, `status`,
  `effective_date`, `review_frequency_days`, ...)
- `POST /generate` — AI-generate a policy from one or more frameworks
  (`policy_name`, `policy_type`, `framework_ids[]`, `include_all_frameworks`);
  groups controls by NIST family, generates section content, creates sections
  and control mappings, returns the full policy structure
- `PATCH /:id` — update policy
- `POST /:id/sections` — add/update a policy section (`section_number`,
  `section_title`, `section_content`, `framework_family_code`,
  `framework_family_name`, `display_order`, `control_mappings[]`)
- `GET /:id/sections/:sectionId/controls` — controls mapped to a section, with
  implementation status
- `POST /:id/reviews` — create a policy review (`review_type`, `review_date`,
  `review_status`, `changes_made`, `requires_user_acknowledgment`); when
  acknowledgment is required, creates a monitoring alert and notifies all users
- `POST /:id/acknowledge` — user acknowledges a policy version
  (`policy_review_id`, `acknowledgment_notes`)
- `GET /:id/monitoring-alerts?resolved=false` — outstanding monitoring alerts

## Policy Generation Service (`policyService.js`)

`controlweave/backend/src/services/policyService.js` (~458 lines):

- `generatePolicyFromFrameworks(orgId, userId, policyName, policyType, frameworks)`
  — creates the policy record, fetches controls from selected frameworks,
  groups by NIST family, generates section content, creates sections + control
  mappings, returns the full structure
- `generateSectionContent(orgId, policyName, policyType, family, controls, frameworks)`
  — uses the organization's configured LLM to draft purpose statements, scope,
  policy statements covering all mapped controls, and roles/responsibilities;
  falls back to template-based generation if no LLM is configured
- `createPolicyReference(orgId, policyId, sectionId, referenceType, referenceName, ...)`
  — creates a continuous-monitoring reference and schedules the next check
- `checkPolicyReferences(orgId)` — finds references due for monitoring, creates
  alerts for overdue items
- `scheduleAnnualReviews(orgId)` — finds policies due for review, creates review
  records and alerts

When multiple frameworks are selected, controls from all of them are grouped by
control family (e.g., all `AC` controls together regardless of source
framework) and the generated policy statement addresses every mapped
framework's requirements while maintaining per-control traceability.

## Permissions

| Action | Permission |
|---|---|
| View POA&Ms, policies, controls | `controls.read` |
| Create/update POA&Ms, policies, control implementations, submit for review | `controls.write` |
| View audit-related data, auditor guidance | `audit.read` |
| Review/approve/reject POA&Ms | `audit.write` |

## Notifications & Webhook Events

- POA&M: `poam.item.created`, `poam.submitted_for_review`,
  `poam.auditor_reviewed`, `control.compliance_change`
- Policy: created, published, review required, acknowledgment required,
  reference monitoring needed

## Files

**Created:**
- `controlweave/backend/migrations/061_poam_approval_and_policy_engine.sql`
- `controlweave/backend/src/routes/policies.js`
- `controlweave/backend/src/services/policyService.js`
- `controlweave/backend/src/services/frameworkPoamService.js`

**Modified:**
- `controlweave/backend/src/routes/poam.js` (3 new endpoints)
- `controlweave/backend/src/routes/controls.js` (POA&M auto-creation on
  compliance transitions, framework-aware)
- `controlweave/backend/src/server.js` (registered `policies` routes)

## Security Notes

- All endpoints require authentication; access is further scoped by
  `controls.read/write` and `audit.read/write` permissions
- Global API rate limiting (configured in `server.js`) covers these routes —
  do not assume per-route rate limiting is missing if a scanner flags it
- Parameterized queries throughout; no string-interpolated SQL
- All tables are organization-scoped (`organization_id`)

## Manual QA Checklist

- Control status flip from non-compliant → compliant: verify POA&M
  auto-creation, `poam_justification` is required and enforced
- Submit for review as a regular user; review as an auditor with each outcome
  (approved / rejected / changes_requested); verify approval history
- Framework-specific submission: validate required-field enforcement per type,
  auditor guidance retrieval, and approval-request context API
- Policy generation with a single framework and with multiple frameworks; with
  and without an LLM configured (verify template fallback)
- Policy lifecycle through all statuses; create a review requiring
  acknowledgment; acknowledge as a user; verify monitoring alerts fire
- Confirm notifications and audit log entries are created for each of the above

## Future Enhancements (not yet implemented)

- Policy templates for common policy types
- Multi-level approval workflow automation (beyond the framework review chains
  already modeled)
- Policy version comparison/diff viewing
- Direct evidence file uploads on POA&M approval requests
- Delegated review authority
- Policy compliance analytics dashboard
- Additional framework types (CMMC, StateRAMP, etc.) and automated
  framework-type detection based on the control being remediated
