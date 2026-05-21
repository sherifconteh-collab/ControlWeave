# TPRM Vendor Management

Guide for managing third-party vendor risk workflows in ControlWeaver's TPRM module.

## Input

$ARGUMENTS — Vendor action (e.g., "onboard new SaaS vendor", "review vendor risk tier", "assess vendor security posture")

## Steps

1. **Vendor onboarding**
   - POST to `/api/v1/tprm/vendors`
   - Required: `name`, `vendor_type`, `risk_tier`
   - Valid vendor types: software, hardware, services, cloud, managed_service, data_processor, other
   - Valid risk tiers: critical, high, medium, low
   - Valid data access levels: none, metadata, limited, full
   - Set initial review status to `pending_review`

2. **Document collection**
   - Track vendor documents via the TPRM documents API
   - Valid document types: soc2_report, iso27001_cert, pen_test_report, privacy_policy, dpa, baa, insurance_cert, business_continuity_plan, incident_response_plan, other
   - Each document needs: type, expiration date, compliance status

3. **Risk assessment**
   - Vendor risk scoring integrates with SecurityScorecard and BitSight (Enterprise tier)
   - Manual risk factors: data sensitivity, regulatory scope, business criticality
   - Risk tier assignment drives review cadence:
     - Critical: quarterly review
     - High: semi-annual review
     - Medium: annual review
     - Low: biennial review

4. **Questionnaire workflow**
   - Create and send security questionnaires to vendors
   - Track questionnaire completion and responses
   - Link questionnaire results to vendor risk profile

5. **Review and approval**
   - Review statuses: pending_review → in_review → approved/conditional/rejected
   - Status `decommissioned` for offboarded vendors
   - Document review decisions with rationale

6. **Ongoing monitoring**
   - Track document expiration dates
   - Monitor vendor security scores (if integrated)
   - Flag vendors with expired certifications
   - Generate vendor risk reports

## Vendor Onboarding Template

```javascript
// POST /api/v1/tprm/vendors
{
  "name": "Acme Cloud Services",
  "vendor_type": "cloud",
  "risk_tier": "high",
  "data_access_level": "full",
  "description": "Primary cloud infrastructure provider",
  "contact_email": "security@acme.example.com",
  "review_status": "pending_review"
}
```

## TPRM Architecture Notes

- **Tier**: Enterprise only — requires `requireTier('enterprise')` and `requireProEdition('tprm')`
- **Rate limiting**: 120 requests per 15 minutes per organization
- **Multi-tenant**: All vendor data scoped by `organization_id`
- **Tables**: `tprm_vendors`, `tprm_documents`, `tprm_questionnaires`, `tprm_evidence`
- **Migrations**: 072-077 series in `controlweave/backend/migrations/`
- **ILIKE safety**: Search queries use `escapeIlike()` to prevent wildcard injection

## Checklist

- [ ] Vendor created with valid type and risk tier
- [ ] Data access level accurately reflects vendor's data exposure
- [ ] Required documents (SOC 2, pen test, etc.) tracked with expiration dates
- [ ] Risk tier drives appropriate review cadence
- [ ] All TPRM queries filter by `organization_id`
- [ ] Enterprise tier check enforced on all TPRM routes
- [ ] ILIKE search patterns properly escaped
- [ ] Audit log entries created for vendor status changes
