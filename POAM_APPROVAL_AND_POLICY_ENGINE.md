# POA&M Approval Workflow and Policy Engine

## Overview

This document describes the POA&M (Plan of Action and Milestones) approval workflow with framework-specific support and the policy documentation engine implemented in ControlWeave Pro.

## Features Implemented

### 1. POA&M Approval Workflow for Auditors (with Framework-Specific Support)

The POA&M approval workflow enables organizations to submit remediation plans for auditor review when controls transition from non-compliant to compliant status. **Now includes support for framework-specific processes like FISCAM CAPs/NFRs, ISO CARs, and SOC 2 exceptions.**

#### Framework-Specific POA&M Types

The system now supports specialized remediation processes required by different compliance frameworks:

**FISCAM (Federal Information System Controls Audit Manual):**
- **CAP (Corrective Action Plan)** - Formal corrective action plan for control deficiencies
  - Required fields: root_cause, corrective_action, responsible_official, target_completion_date, resources_required
  - Review levels: auditor → management → independent_verification

- **NFR (Notice of Findings and Recommendations)** - Formal notice of audit findings
  - Required fields: finding_description, recommendation, management_response, estimated_completion_date
  - Review levels: auditor → auditee_management → audit_committee

**ISO 27001:**
- **CAR (Corrective Action Request)** - For non-conformities
  - Required fields: non_conformity_description, corrective_action, preventive_action, verification_method
  - Review levels: auditor → management_representative

- **OFI (Opportunity for Improvement)** - Non-mandatory recommendations
  - Required fields: improvement_area, proposed_action, expected_benefit

**SOC 2:**
- **Control Exception** - Documented exceptions to requirements
  - Required fields: exception_rationale, compensating_controls, risk_assessment, remediation_plan

- **Control Deficiency** - Design or operational deficiencies
  - Required fields: deficiency_type, impact_assessment, remediation_steps, testing_plan

**HIPAA:**
- **HIPAA Corrective Action Plan** - For violations or gaps
  - Required fields: violation_description, affected_phi, corrective_measures, prevention_measures, compliance_date

**PCI DSS:**
- **RAV (Report on Attestation)** - Compliance gap documentation
  - Required fields: requirement_number, gap_description, remediation_approach, validation_method, target_date

**NIST 800-53:**
- **NIST POA&M** - Standard format
  - Required fields: weakness_description, risk_rating, remediation_steps, milestones, resources, scheduled_completion

**FedRAMP:**
- **FedRAMP POA&M** - Agency authorization specific
  - Required fields: weakness_id, risk_adjustment, vendor_dependency, milestone_changes, deviation_request

#### Key Components

**Database Tables:**
- `poam_items` - Extended with approval workflow fields
  - `submitted_for_review_at` - Timestamp when submitted for review
  - `submitted_by` - User who submitted for review
  - `reviewed_at` - Timestamp of review
  - `reviewed_by` - Auditor who reviewed
  - `review_status` - Current review status
  - `review_notes` - Auditor's review comments

- `poam_approval_requests` - Tracks all approval requests
  - Links POA&Ms to controls
  - Stores justification and supporting evidence
  - Tracks review outcomes and comments

**New POA&M Statuses:**
- `pending_auditor_review` - Submitted for auditor review
- `auditor_approved` - Approved by auditor
- `auditor_rejected` - Rejected by auditor

**API Endpoints:**

1. **Submit POA&M for Review (Enhanced with Framework Support)**
   ```
   POST /api/v1/poam/:id/submit-for-review
   ```
   Body (Standard):
   ```json
   {
     "control_id": "uuid",
     "previous_control_status": "in_progress",
     "new_control_status": "implemented",
     "justification": "Detailed explanation of remediation...",
     "supporting_evidence_ids": ["uuid1", "uuid2"]
   }
   ```
   
   Body (FISCAM CAP Example):
   ```json
   {
     "control_id": "uuid",
     "previous_control_status": "in_progress",
     "new_control_status": "implemented",
     "justification": "Control remediated per FISCAM requirements...",
     "supporting_evidence_ids": ["uuid1", "uuid2"],
     "framework_specific_type": "fiscam_cap",
     "framework_specific_data": {
       "root_cause": "Inadequate access control procedures",
       "corrective_action": "Implement role-based access control system",
       "responsible_official": "John Doe, CISO",
       "target_completion_date": "2026-06-01",
       "resources_required": "$50,000 budget, 2 FTEs for 3 months"
     }
   }
   ```
   
   Body (ISO 27001 CAR Example):
   ```json
   {
     "control_id": "uuid",
     "justification": "Non-conformity remediated...",
     "framework_specific_type": "iso_car",
     "framework_specific_data": {
       "non_conformity_description": "Data encryption at rest not implemented",
       "corrective_action": "Deploy full disk encryption on all systems",
       "preventive_action": "Add encryption verification to deployment checklist",
       "verification_method": "Quarterly configuration audits"
     }
   }
   ```

2. **Get Framework-Specific Types**
   ```
   GET /api/v1/poam/framework-types
   GET /api/v1/poam/framework-types?framework_code=fiscam
   ```
   Returns all available framework-specific POA&M types with their required fields.

3. **Get Auditor Guidance**
   ```
   GET /api/v1/poam/auditor-guidance/:frameworkCode/:typeCode
   ```
   Example: `GET /api/v1/poam/auditor-guidance/fiscam/fiscam_cap`
   
   Returns framework-specific review guidelines for auditors.

4. **Get Approval Request with Context**
   ```
   GET /api/v1/poam/approval-request/:id/context
   ```
   Returns approval request with full framework context, type configuration, and auditor guidance.

2. **Auditor Review POA&M**
   ```
   POST /api/v1/poam/:id/review
   ```
   Body:
   ```json
   {
     "outcome": "approved",  // or "rejected", "changes_requested"
     "comments": "Review comments..."
   }
   ```
   Requires `audit.write` permission.

3. **Get Approval History**
   ```
   GET /api/v1/poam/:id/approval-history
   ```
   Returns all approval requests for a POA&M with review details.

#### Control Status Change Detection

The system automatically detects when a control transitions from non-compliant to compliant status.

**Control Implementation Endpoint Enhancement:**
```
PUT /api/v1/controls/:id/implementation
```

Body (with automatic POA&M):
```json
{
  "status": "implemented",
  "implementationDetails": "...",
  "evidenceUrl": "...",
  "poam_justification": "Required when changing from non-compliant to compliant"
}
```

**Behavior:**
1. Detects status changes from `['not_started', 'in_progress', 'needs_review']` to `['implemented', 'satisfied_via_crosswalk', 'verified']`
2. Requires `poam_justification` field for compliance transitions
3. Automatically creates or updates POA&M with status `pending_auditor_review`
4. Creates approval request
5. Sends notifications to auditors
6. Returns POA&M details in response

**Response includes:**
```json
{
  "success": true,
  "data": {
    "implementation": { ... },
    "crosswalkedControls": [ ... ],
    "poam_item": { ... },
    "status_change_detected": true,
    "requires_auditor_review": true
  }
}
```

### 2. Policy Documentation Engine

A comprehensive policy management system structured around NIST 800-53 control families with support for multi-framework integration.

#### Key Components

**Database Tables:**

1. **organization_policies**
   - Core policy information
   - Version control
   - Status workflow: `draft` → `under_review` → `approved` → `published` → `archived`
   - Review frequency and scheduling

2. **policy_sections**
   - Organized by NIST 800-53 control families (20 families)
   - Family codes: AC, AT, AU, CA, CM, CP, IA, IR, MA, MP, PE, PL, PS, PT, RA, SA, SC, SI, PM, SR
   - Contains policy content and control family metadata

3. **policy_control_mappings**
   - Maps policy sections to specific controls
   - Supports multiple frameworks
   - Includes mapping notes

4. **policy_reviews**
   - Tracks annual and ad-hoc reviews
   - Review types: `annual`, `triggered`, `ad_hoc`, `change_driven`
   - Schedules next review dates

5. **policy_user_acknowledgments**
   - User acknowledgment tracking
   - Version-specific acknowledgments
   - Linked to policy reviews

6. **policy_references**
   - References to assets, systems, processes, regulations
   - Continuous monitoring configuration
   - Monitoring status tracking

7. **policy_monitoring_alerts**
   - Automated alerts for policy compliance
   - Alert types: `review_due`, `reference_changed`, `compliance_issue`, `acknowledgment_required`
   - Resolution tracking

#### NIST 800-53 Control Families

The policy engine uses these 20 control families as the structural template:

1. **AC** - Access Control
2. **AT** - Awareness and Training
3. **AU** - Audit and Accountability
4. **CA** - Assessment, Authorization, and Monitoring
5. **CM** - Configuration Management
6. **CP** - Contingency Planning
7. **IA** - Identification and Authentication
8. **IR** - Incident Response
9. **MA** - Maintenance
10. **MP** - Media Protection
11. **PE** - Physical and Environmental Protection
12. **PL** - Planning
13. **PS** - Personnel Security
14. **PT** - PII Processing and Transparency
15. **RA** - Risk Assessment
16. **SA** - System and Services Acquisition
17. **SC** - System and Communications Protection
18. **SI** - System and Information Integrity
19. **PM** - Program Management
20. **SR** - Supply Chain Risk Management

#### API Endpoints

**Policy Management:**

1. **List Policies**
   ```
   GET /api/v1/policies?status=published&policy_type=security_policy
   ```

2. **Get Policy Details**
   ```
   GET /api/v1/policies/:id
   ```
   Returns policy with sections and recent reviews.

3. **Create Policy**
   ```
   POST /api/v1/policies
   ```
   Body:
   ```json
   {
     "policy_name": "Information Security Policy",
     "policy_type": "security_policy",
     "description": "...",
     "version": "1.0",
     "status": "draft",
     "effective_date": "2026-03-01",
     "review_frequency_days": 365
   }
   ```

4. **Generate Policy from Frameworks** (AI-Powered)
   ```
   POST /api/v1/policies/generate
   ```
   Body:
   ```json
   {
     "policy_name": "Multi-Framework Security Policy",
     "policy_type": "security_policy",
     "framework_ids": ["uuid1", "uuid2"],
     "include_all_frameworks": false
   }
   ```
   
   This endpoint:
   - Gets all controls from selected frameworks
   - Groups controls by NIST control family
   - Generates policy sections using AI (or fallback)
   - Creates policy sections for each control family
   - Maps controls to policy sections
   - Returns complete policy structure

5. **Update Policy**
   ```
   PATCH /api/v1/policies/:id
   ```

6. **Add/Update Policy Section**
   ```
   POST /api/v1/policies/:id/sections
   ```
   Body:
   ```json
   {
     "section_number": "AC-1",
     "section_title": "Access Control Policy and Procedures",
     "section_content": "Detailed policy content...",
     "framework_family_code": "AC",
     "framework_family_name": "Access Control",
     "display_order": 1,
     "control_mappings": [
       {
         "control_id": "uuid",
         "framework_id": "uuid",
         "mapping_notes": "..."
       }
     ]
   }
   ```

7. **Get Section Controls**
   ```
   GET /api/v1/policies/:id/sections/:sectionId/controls
   ```
   Returns all controls mapped to a policy section with implementation status.

**Policy Review Workflow:**

8. **Create Policy Review**
   ```
   POST /api/v1/policies/:id/reviews
   ```
   Body:
   ```json
   {
     "review_type": "annual",
     "review_date": "2026-03-01",
     "review_status": "scheduled",
     "review_notes": "...",
     "changes_made": true,
     "requires_user_acknowledgment": true
   }
   ```
   
   When `requires_user_acknowledgment` is true:
   - Creates monitoring alert
   - Sends notifications to all users
   - Tracks acknowledgment status

9. **User Acknowledges Policy**
   ```
   POST /api/v1/policies/:id/acknowledge
   ```
   Body:
   ```json
   {
     "policy_review_id": "uuid",
     "acknowledgment_notes": "I have read and understand..."
   }
   ```

10. **Get Monitoring Alerts**
    ```
    GET /api/v1/policies/:id/monitoring-alerts?resolved=false
    ```

#### Policy Generation Service

The `policyService.js` provides functions for automated policy generation:

**Main Functions:**

1. **generatePolicyFromFrameworks(orgId, userId, policyName, policyType, frameworks)**
   - Creates policy record
   - Fetches controls from selected frameworks
   - Groups controls by NIST control family
   - Generates sections using AI or fallback
   - Creates policy sections and control mappings
   - Returns complete policy structure

2. **generateSectionContent(orgId, policyName, policyType, family, controls, frameworks)**
   - Uses organization's LLM service if available
   - Generates comprehensive policy content
   - Integrates multiple frameworks
   - Fallback to template-based generation

3. **createPolicyReference(orgId, policyId, sectionId, referenceType, referenceName, ...)**
   - Creates monitoring reference
   - Configures monitoring frequency
   - Schedules next monitoring date

4. **checkPolicyReferences(orgId)**
   - Checks references needing monitoring
   - Creates alerts for overdue items
   - Returns references requiring review

5. **scheduleAnnualReviews(orgId)**
   - Finds policies due for review
   - Creates review records
   - Creates alerts for due reviews

**AI-Powered Content Generation:**

The service integrates with the organization's configured LLM to generate:
- Purpose statements
- Scope definitions
- Policy statements addressing all mapped controls
- Roles and responsibilities
- Control references

**Multi-Framework Integration:**

When multiple frameworks are selected, the service:
1. Collects controls from all frameworks
2. Groups by control family (e.g., all AC controls together)
3. Generates unified policy statements addressing all framework requirements
4. Maintains traceability to specific controls

## Usage Examples

### Example 1: Control Compliance Change with Framework-Specific POA&M (FISCAM CAP)

```javascript
// User marks FISCAM control as implemented with CAP
PUT /api/v1/controls/abc-123/implementation
{
  "status": "implemented",
  "implementationDetails": "Implemented MFA per FISCAM requirements",
  "evidenceUrl": "https://docs.example.com/fiscam-mfa",
  "poam_justification": "MFA deployed across all systems per FISCAM guidelines",
  "framework_specific_type": "fiscam_cap",
  "framework_specific_data": {
    "root_cause": "Legacy authentication system lacked multi-factor capability",
    "corrective_action": "Deployed enterprise MFA solution (Duo Security) across all federal systems",
    "responsible_official": "Jane Smith, Chief Information Security Officer",
    "target_completion_date": "2026-05-15",
    "resources_required": "$75,000 for licenses, 3 FTEs for 2 months for implementation"
  }
}

// Response includes auto-created POA&M with FISCAM context
{
  "success": true,
  "data": {
    "implementation": { ... },
    "poam_item": {
      "id": "poam-uuid",
      "status": "pending_auditor_review",
      "title": "Remediation: SM-3 - Security Management Policy"
    },
    "requires_auditor_review": true,
    "framework_context": {
      "type": "fiscam_cap",
      "framework": "FISCAM",
      "required_fields": ["root_cause", "corrective_action", ...]
    }
  }
}

// Auditor reviews with FISCAM-specific guidance
GET /api/v1/poam/auditor-guidance/fiscam/fiscam_cap
{
  "success": true,
  "data": {
    "type_name": "Corrective Action Plan (CAP)",
    "required_fields": [...],
    "review_levels": ["auditor", "management", "independent_verification"],
    "guidance": "FISCAM CAP Review Guidelines:\n1. Verify root cause analysis..."
  }
}

// Auditor approves
POST /api/v1/poam/poam-uuid/review
{
  "outcome": "approved",
  "comments": "FISCAM CAP reviewed and approved. Root cause analysis is thorough. Corrective action addresses the control deficiency. Resources are adequate. Recommend independent verification in 90 days."
}
```

### Example 2: ISO 27001 CAR Submission

```javascript
// Submit ISO 27001 Corrective Action Request
POST /api/v1/poam/poam-uuid/submit-for-review
{
  "control_id": "iso-control-uuid",
  "justification": "Non-conformity identified during internal audit, corrective action implemented",
  "framework_specific_type": "iso_car",
  "framework_specific_data": {
    "non_conformity_description": "Password complexity requirements not enforced on legacy systems",
    "corrective_action": "Updated all legacy systems to enforce 12-character passwords with complexity",
    "preventive_action": "Automated password policy compliance checks added to monthly security scans",
    "verification_method": "Quarterly password audit via automated scanning tool"
  },
  "supporting_evidence_ids": ["evidence-1-uuid", "evidence-2-uuid"]
}

// Auditor gets ISO-specific guidance
GET /api/v1/poam/auditor-guidance/iso_27001/iso_car
{
  "guidance": "ISO 27001 CAR Review Guidelines:\n1. Verify non-conformity is properly classified...\n2. Ensure root cause analysis follows ISO methodology..."
}
```

### Example 3: List Available Framework Types

```javascript
// Get all framework-specific POA&M types
GET /api/v1/poam/framework-types
{
  "success": true,
  "data": [
    {
      "framework_code": "fiscam",
      "code": "fiscam_cap",
      "name": "Corrective Action Plan (CAP)",
      "description": "Formal corrective action plan required by FISCAM",
      "required_fields": ["root_cause", "corrective_action", ...],
      "review_levels": ["auditor", "management", "independent_verification"]
    },
    {
      "framework_code": "fiscam",
      "code": "fiscam_nfr",
      "name": "Notice of Findings and Recommendations (NFR)",
      ...
    },
    // ... more types
  ]
}

// Get types for specific framework
GET /api/v1/poam/framework-types?framework_code=fiscam
{
  "success": true,
  "data": {
    "types": [
      { "code": "fiscam_cap", "name": "Corrective Action Plan (CAP)", ... },
      { "code": "fiscam_nfr", "name": "Notice of Findings and Recommendations (NFR)", ... }
    ]
  }
}
```

### Example 2: Generate Multi-Framework Policy

```javascript
// Generate policy covering NIST 800-53 and ISO 27001
POST /api/v1/policies/generate
{
  "policy_name": "Enterprise Information Security Policy",
  "policy_type": "security_policy",
  "framework_ids": ["nist-800-53-uuid", "iso-27001-uuid"]
}

// Response includes complete policy with sections
{
  "success": true,
  "data": {
    "policy": {
      "id": "policy-uuid",
      "policy_name": "Enterprise Information Security Policy",
      "status": "draft",
      "version": "1.0"
    },
    "sections": [
      {
        "section": {
          "section_number": "AC",
          "section_title": "AC - Access Control",
          "framework_family_code": "AC",
          "section_content": "... AI-generated policy content ..."
        },
        "controls_count": 25
      },
      // ... more sections for each control family
    ],
    "frameworks_used": [
      { "code": "NIST-800-53", "name": "NIST 800-53 Rev. 5" },
      { "code": "ISO-27001", "name": "ISO/IEC 27001:2022" }
    ]
  }
}
```

### Example 3: Annual Policy Review

```javascript
// Create annual review
POST /api/v1/policies/policy-uuid/reviews
{
  "review_type": "annual",
  "review_date": "2026-03-01",
  "review_status": "completed",
  "review_notes": "Policy reviewed and updated. Minor changes to section AC to reflect new MFA requirements.",
  "changes_made": true,
  "requires_user_acknowledgment": true
}

// System automatically:
// 1. Creates monitoring alert
// 2. Notifies all users
// 3. Updates next_review_date to 2027-03-01

// Users acknowledge policy
POST /api/v1/policies/policy-uuid/acknowledge
{
  "policy_review_id": "review-uuid",
  "acknowledgment_notes": "I have read and understand the updated policy."
}
```

## Permissions Required

- **controls.read** - View POA&Ms, policies, controls
- **controls.write** - Create/update POA&Ms, policies, control implementations, submit for review
- **audit.read** - View audit-related data
- **audit.write** - Review and approve/reject POA&Ms

## Notifications and Webhooks

The system automatically sends notifications and webhook events for:

1. **POA&M Events:**
   - `poam.item.created`
   - `poam.submitted_for_review`
   - `poam.auditor_reviewed`
   - `control.compliance_change`

2. **Policy Events:**
   - Policy created
   - Policy published
   - Review required
   - Acknowledgment required
   - Reference monitoring needed

## Best Practices

### POA&M Workflow

1. **Document Thoroughly:** Provide detailed justification when marking controls compliant
2. **Attach Evidence:** Link supporting documentation to approval requests
3. **Timely Reviews:** Auditors should review submissions promptly
4. **Clear Communication:** Use review comments to provide actionable feedback

### Policy Management

1. **Multi-Framework Approach:** Generate policies covering all applicable frameworks
2. **Regular Reviews:** Schedule annual reviews, set calendar reminders
3. **User Acknowledgment:** Require acknowledgment for significant changes
4. **Continuous Monitoring:** Set up references for key systems/processes
5. **Version Control:** Increment version numbers for major changes
6. **AI Enhancement:** Use AI generation for comprehensive, professional policy content

## Database Schema

See `migrations/061_poam_approval_and_policy_engine.sql` for complete schema.

## Migration

To apply this migration:

```bash
cd controlweave/backend
npm run migrate
```

The migration is idempotent and can be run multiple times safely.

## Future Enhancements

Potential future improvements:

1. **Policy Templates:** Pre-built templates for common policy types
2. **Workflow Automation:** Automated routing based on control criticality
3. **Integration with Assessment:** Link policies to assessment procedures
4. **Multi-Level Approval:** Support for multiple approval stages
5. **Policy Comparison:** Compare versions and track changes
6. **Evidence Attachments:** Direct file upload to POA&M approval requests
7. **Delegation:** Delegate review authority to specific users
8. **Analytics Dashboard:** Policy compliance metrics and trends

## Support

For questions or issues with these features, contact the development team or consult the main ControlWeave documentation.
