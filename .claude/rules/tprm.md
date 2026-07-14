---
description: TPRM (Third Party Risk Management) conventions for ControlWeaver
globs:
  - "controlweave/backend/src/routes/tprm*.js"
  - "controlweave/backend/src/routes/vendorSecurity.js"
  - "controlweave/backend/src/services/vendorSecurity*.js"
  - "controlweave/frontend/src/app/dashboard/tprm/**"
  - "controlweave/frontend/src/app/dashboard/vendor-risk/**"
---
# TPRM Conventions

ControlWeaver's Third Party Risk Management module is available to every authenticated user — no tier gating (see `.claude/rules/tier-system.md`). All TPRM code must enforce access controls and follow vendor risk management standards.

## Access Control Stack

Every TPRM route must apply this middleware:

```javascript
router.use(authenticate);
router.use(requirePermission('tprm.read')); // or .write for mutating routes
```

## Valid Enumerations

Always validate against these sets — reject requests with invalid values:

- **Vendor types**: software, hardware, services, cloud, managed_service, data_processor, other
- **Risk tiers**: critical, high, medium, low
- **Review statuses**: pending_review, in_review, approved, conditional, rejected, decommissioned
- **Data access levels**: none, metadata, limited, full
- **Document types**: soc2_report, iso27001_cert, pen_test_report, privacy_policy, dpa, baa, insurance_cert, business_continuity_plan, incident_response_plan, other

## Search Safety

TPRM search endpoints use ILIKE for vendor name/description filtering. Always escape user input to prevent wildcard injection:

```javascript
function escapeIlike(str) {
  return String(str).replace(/[%_\\]/g, '\\$&');
}

// Usage
const search = escapeIlike(req.query.search);
const result = await pool.query(
  'SELECT * FROM tprm_vendors WHERE organization_id = $1 AND name ILIKE $2',
  [req.user.organization_id, `%${search}%`]
);
```

## TPRM Database Tables

- `tprm_vendors` — vendor records with risk tier, type, data access level
- `tprm_documents` — vendor compliance documents with expiration tracking
- `tprm_questionnaires` — security questionnaire templates and responses
- `tprm_evidence` — vendor-specific evidence linked to controls
- Migrations: 072-077 series in `controlweave/backend/migrations/`

## Vendor Security Integrations

SecurityScorecard and BitSight integrations (in `vendorSecurityService.js`) provide automated risk scoring. These are optional — manual scoring must always be supported as a fallback.

## Rate Limiting

TPRM routes use organization-scoped rate limiting: 120 requests per 15 minutes per org. This applies at the router level, not per-route.
