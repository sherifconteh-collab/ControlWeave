---
description: Evidence handling, PII classification, and RAG indexing conventions
globs:
  - "controlweave/backend/src/routes/evidence.js"
  - "controlweave/backend/src/routes/pendingEvidence.js"
  - "controlweave/backend/src/routes/autoEvidenceCollection.js"
  - "controlweave/backend/src/services/orgRagService.js"
  - "controlweave/frontend/src/app/dashboard/evidence/**"
---
# Evidence Handling Conventions

Evidence contains sensitive compliance data and may include PII — handle with care. Available to every authenticated user; no tier gating (see `.claude/rules/tier-system.md`).

## Access Control

```javascript
router.use(authenticate);
router.use(requirePermission('evidence.read')); // or .write for mutating routes
```

## PII Classification

Every evidence item MUST have a PII classification. Never store evidence without classifying it:

- **pii_classification**: none, low, moderate, high, critical
- **data_sensitivity**: public, internal, confidential, restricted
- **pii_types** (array): name, email, SSN, address, phone, DOB, financial, health, biometric, other

When in doubt, classify higher — it's safer to over-classify than under-classify.

## File Upload Security

Evidence uploads use multer with these constraints:
- Supported formats: PDF, DOCX, DOC, TXT, MD, CSV
- Validate content type on upload
- Store files in `controlweave/backend/uploads/` (gitignored)
- Generate file hash on upload for integrity verification
- Never serve uploaded files without org-scoped access checks

## RAG Indexing

Evidence files are automatically indexed for AI-powered search:

```javascript
const ragService = require('../services/orgRagService');

// After successful upload
await ragService.indexDocument(orgId, {
  documentId: evidence.id,
  content: extractedText,
  metadata: { type: 'evidence', control_ids: linkedControls }
});
```

Text extraction supports: PDF (pdf-parse), DOCX (mammoth), TXT/MD/CSV (direct read).

## Evidence-Control Linking

Evidence items are linked to controls via the `evidence_control_links` junction table. When querying evidence for a control, always join through this table:

```javascript
const result = await pool.query(
  `SELECT e.* FROM evidence e
   JOIN evidence_control_links ecl ON e.id = ecl.evidence_id
   WHERE ecl.control_id = $1 AND e.organization_id = $2`,
  [controlId, req.user.organization_id]
);
```

## Pending Evidence (AI Suggestions)

The `pendingEvidence` route handles AI-generated evidence suggestions:
- AI suggests evidence from integrated sources (Splunk, etc.)
- All suggestions require human review before acceptance
- Approval workflow: pending → approved/rejected
- Never auto-accept AI evidence without human validation

## Evidence Expiration

Time-sensitive evidence (certifications, audit reports) must track expiration:
- Set `expiration_date` on upload
- Query and flag evidence nearing expiry (30-day warning)
- Expired evidence should not count toward control compliance
