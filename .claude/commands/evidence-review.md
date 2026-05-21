# Evidence Review

Review evidence lifecycle compliance, PII handling, and control mapping in ControlWeaver.

## Input

$ARGUMENTS — Scope of evidence review (e.g., "all evidence for SOC 2 controls" or "PII classification audit")

## Steps

1. **Check evidence-to-control mappings**
   - Verify evidence items are linked to the correct controls via `evidence_control_links`
   - Identify controls with missing evidence (gaps)
   - Check for orphaned evidence not linked to any control

2. **Review PII classification**
   - Every evidence item should have a `pii_classification`: none, low, moderate, high, critical
   - Verify `data_sensitivity` level: public, internal, confidential, restricted
   - Check `pii_types` array accuracy: name, email, SSN, address, phone, DOB, financial, health, biometric, other
   - Flag any evidence with PII that lacks proper classification

3. **Validate evidence freshness**
   - Check `expiration_date` on time-sensitive evidence
   - Flag expired evidence still linked to active controls
   - Review evidence that hasn't been updated in >12 months

4. **Review approval workflow**
   - Pending evidence items (from `pendingEvidence` route) need review
   - Check approval/rejection status and reviewer assignments
   - Verify AI-suggested evidence has been human-reviewed

5. **Audit RAG indexing**
   - Evidence files should be indexed for RAG-based AI queries
   - Supported formats: PDF, DOCX, TXT, MD, CSV
   - Check that `ragService.indexDocument()` was called on upload
   - Verify file integrity via stored hashes

6. **Security checks**
   - All evidence queries filter by `organization_id`
   - File uploads validate content type and size
   - Evidence files stored in `/uploads` directory (gitignored)
   - No PII data exposed in API error responses

7. **Generate report**
   ```bash
   # Check evidence counts and gaps
   cd controlweave/backend
   npm run check:syntax
   ```

## Evidence Quality Checklist

- [ ] All evidence items have PII classification assigned
- [ ] Data sensitivity levels match organizational policy
- [ ] Evidence-to-control mappings are complete (no control gaps)
- [ ] Expired evidence flagged or renewed
- [ ] AI-suggested evidence has human approval
- [ ] File uploads indexed for RAG search
- [ ] No orphaned evidence records
- [ ] `organization_id` filtering on all evidence queries
- [ ] Evidence tier requirement enforced (Pro tier minimum)

## Output

Provide an evidence compliance report with:
- **Total evidence items** reviewed
- **Coverage gaps** — controls missing evidence
- **PII findings** — misclassified or unclassified PII
- **Expiration warnings** — evidence nearing or past expiry
- **Recommendations** — prioritized actions to improve evidence posture
