# Content Packs Guide

## What Are Content Packs?

Content Packs are a **tenant-specific feature** that allows organizations to import licensed compliance framework content—such as detailed control descriptions, assessment procedures, and implementation guidance—from third-party vendors without modifying the global baseline framework data.

## Why Content Packs?

### The Problem They Solve

Many organizations purchase licensed compliance content from vendors like:
- **NIST SP 800-53 Revision 5** official publications with detailed control descriptions
- **ISO 27001/27002** standard documents with implementation guidance
- **CIS Benchmarks** with specific assessment procedures
- **Vendor-specific** control mappings and procedure guides
- **Industry-specific** compliance frameworks with proprietary content

These licensed materials often contain:
- More detailed control descriptions than open-source summaries
- Vendor-specific implementation guidance
- Assessment procedures with expected evidence
- Industry-specific interpretations
- Proprietary control mappings

**The challenge:** How do you use this licensed content in your GRC platform without:
1. Violating licensing terms by making it globally available
2. Manually copying text for hundreds of controls
3. Losing content when framework versions are updated
4. Mixing licensed content with the baseline framework data

**The solution:** Content Packs provide a secure, organization-scoped way to import and manage licensed compliance content.

## Key Benefits

### 1. **License Compliance**
- Content stays within your organization's tenant
- No risk of inadvertently sharing proprietary content
- Attestation workflow ensures licensing rights are confirmed
- Audit trail of who imported what and when

### 2. **Time Savings**
- AI-assisted parsing of reports/documents
- Automatic matching to existing framework controls
- Batch import of hundreds of control descriptions
- No manual copy-paste needed

### 3. **Content Isolation**
- Organization-specific overrides don't affect other tenants
- Global framework baseline remains intact
- Easy to add, update, or remove packs
- Clear separation between baseline and licensed content

### 4. **Audit-Ready Workflow**
- Upload → Parse → AI Draft → Attest → Review → Import
- Optional approval gate for larger organizations
- Complete audit trail in audit logs
- Hash verification of source documents

### 5. **Better Control Descriptions**
- Replace generic summaries with official vendor text
- Add detailed implementation guidance
- Include specific assessment procedures
- Reference expected evidence

## How Content Packs Work

### Architecture

```
┌─────────────────────────────────────────┐
│         Framework Controls              │
│  (Global baseline - all organizations)  │
│                                         │
│  - NIST 800-53: AC-1, AC-2, AC-3...    │
│  - ISO 27001: A.5.1, A.5.2...          │
│  - SOC 2: CC1.1, CC1.2...              │
└─────────────────────────────────────────┘
                    ↓
         ┌──────────────────────┐
         │  Organization Scope  │
         └──────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│      Organization Content Packs         │
│   (Tenant-specific licensed content)    │
│                                         │
│  Pack 1: NIST 800-53 Rev 5 Official    │
│  - Detailed descriptions                │
│  - Implementation guidance              │
│                                         │
│  Pack 2: ISO 27001:2022 Vendor Guide   │
│  - Assessment procedures                │
│  - Expected evidence                    │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│     Control & Procedure Overrides       │
│  (What users see when viewing controls) │
│                                         │
│  AC-1: Uses Pack 1 description          │
│  AC-2: Uses Pack 1 description          │
│  A.5.1: Uses Pack 2 procedure           │
└─────────────────────────────────────────┘
```

### Import Workflow

#### Step 1: Upload Report
- Upload a licensed document (PDF, DOCX, TXT, CSV, JSON, XML, MD)
- Maximum file size: 20 MB
- Supported formats automatically parsed
- Text extraction with fallback parsers

#### Step 2: AI-Assisted Drafting
- Platform uses your configured LLM to parse the report
- AI matches content to existing framework controls
- Generates a structured JSON draft with:
  - Control descriptions
  - Assessment procedures
  - Evidence requirements
  - Implementation guidance
- Shows match summary (e.g., "Matched 150/200 controls")

#### Step 3: Review and Edit
- Review AI-generated draft
- Edit any mismatched or incorrect entries
- Add missing controls manually
- Adjust descriptions as needed

#### Step 4: License Attestation
- **Mandatory step:** Confirm you have licensing rights
- Provide license reference (e.g., "NIST SP 800-53 Rev 5 - Public Domain")
- Record who attested and when
- This creates an audit trail

#### Step 5: Optional Approval
- Larger organizations can require approval workflow
- Designated reviewers approve/reject packs
- Review notes captured for audit purposes

#### Step 6: Import
- Pack is imported as organization-specific content
- Control and procedure overrides are created
- Users immediately see updated content
- Original document hash stored for verification

## Content Pack Format

### JSON Structure

```json
{
  "pack_name": "NIST SP 800-53 Revision 5",
  "pack_version": "Rev 5",
  "framework_code": "nist-800-53",
  "source_vendor": "NIST",
  "license_reference": "Public Domain - https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final",
  "metadata": {
    "publication_date": "2020-09-23",
    "document_url": "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-53r5.pdf"
  },
  "controls": [
    {
      "control_id": "AC-1",
      "title": "Policy and Procedures",
      "description": "Develop, document, and disseminate to [Assignment: organization-defined personnel or roles]: a. Access control policy that: 1. Addresses purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance; and 2. Is consistent with applicable laws, executive orders, directives, regulations, policies, standards, and guidelines; and b. Procedures to facilitate the implementation of the access control policy and the associated access controls...",
      "metadata": {
        "section": "3.1",
        "page": 42
      }
    }
  ],
  "procedures": [
    {
      "control_id": "AC-1",
      "procedure_id": "AC-1.1",
      "title": "Verify Access Control Policy Exists",
      "description": "Confirm that the organization has documented an access control policy.",
      "expected_evidence": "Access control policy document, dated and approved",
      "assessor_notes": "Check for management signatures and approval dates.",
      "metadata": {
        "assessment_type": "document_review"
      }
    }
  ]
}
```

### Field Requirements

#### Pack-Level Fields
- **pack_name** (required): Human-readable name
- **pack_version** (optional): Version identifier
- **framework_code** (required): Must match existing framework (e.g., "nist-800-53", "iso-27001")
- **source_vendor** (optional): Publisher/vendor name
- **license_reference** (required): License terms, purchase order, or public domain reference
- **metadata** (optional): Additional pack-level metadata

#### Control Overrides
- **control_id** (required): Must match existing framework control ID
- **title** (optional): Override control title
- **description** (optional): Override control description
- **metadata** (optional): Additional control-specific metadata
- At least one of `title` or `description` must be provided

#### Procedure Overrides
- **control_id** (required): Parent control ID
- **procedure_id** (required): Must match existing procedure ID
- **title** (optional): Override procedure title
- **description** (optional): Override procedure description
- **expected_evidence** (optional): Override expected evidence
- **assessor_notes** (optional): Override assessor notes
- **metadata** (optional): Additional procedure-specific metadata
- At least one override field must be provided

## API Endpoints

### List Imported Packs
```bash
GET /api/v1/settings/content-packs
```

Returns all content packs imported for your organization.

### Get Pack Template
```bash
GET /api/v1/settings/content-packs/template
```

Returns an empty JSON template for manual pack creation.

### Upload Report and Draft Pack
```bash
POST /api/v1/settings/content-packs/drafts/upload
Content-Type: multipart/form-data

form-data:
  - file: <report file>
  - frameworkCode: "nist-800-53"
  - packName: "NIST 800-53 Rev 5"
  - packVersion: "Rev 5"
  - sourceVendor: "NIST"
  - licenseReference: "Public Domain"
  - useAI: "true"
```

Uploads a report and optionally generates an AI-assisted draft.

### List Drafts
```bash
GET /api/v1/settings/content-packs/drafts
```

Returns all draft packs (uploaded but not yet imported).

### Get Draft Details
```bash
GET /api/v1/settings/content-packs/drafts/:id
```

Returns full draft details including editable JSON.

### Attest Licensing
```bash
POST /api/v1/settings/content-packs/drafts/:id/attest
Content-Type: application/json

{
  "attestationStatement": "I confirm that [Organization] has valid licensing rights to use this content under [License Agreement]."
}
```

Records mandatory licensing attestation.

### Import Draft
```bash
POST /api/v1/settings/content-packs/drafts/:id/import
```

Imports an attested draft as an active content pack.

### Delete Pack
```bash
DELETE /api/v1/settings/content-packs/:id
```

Removes an imported pack and all its overrides.

## Use Cases

### Use Case 1: NIST SP 800-53 Official Publication
**Scenario:** Your organization purchased the official NIST SP 800-53 Rev 5 publication and wants to use the detailed control descriptions.

**Steps:**
1. Export/save the PDF from NIST
2. Upload via Settings → LLM Configuration → Licensed Content Packs
3. Select "nist-800-53" framework
4. Use AI to auto-match 200+ controls
5. Review and adjust any mismatches
6. Attest: "NIST SP 800-53 Rev 5 - Public Domain"
7. Import

**Result:** All NIST 800-53 controls now show official NIST descriptions instead of summaries.

### Use Case 2: Vendor-Provided SOC 2 Procedures
**Scenario:** Your compliance consultant provided a SOC 2 assessment procedures guide with evidence requirements.

**Steps:**
1. Upload the consultant's DOCX file
2. Select "soc2" framework
3. AI drafts procedure overrides with evidence requirements
4. Review 50+ procedures
5. Attest: "Licensed from [Vendor] under agreement #12345"
6. Require approval from Chief Compliance Officer
7. After approval, import

**Result:** SOC 2 procedures now include consultant's evidence requirements and assessment notes.

### Use Case 3: ISO 27001:2022 Implementation Guide
**Scenario:** Your organization purchased an ISO 27001:2022 implementation guide with control-by-control guidance.

**Steps:**
1. Upload the guide (PDF)
2. Select "iso-27001" framework
3. AI extracts implementation guidance
4. Review and edit 100+ controls
5. Attest: "Purchased from [Publisher] - Invoice #67890"
6. Import

**Result:** ISO 27001 controls display vendor's implementation guidance.

### Use Case 4: Industry-Specific Compliance Content
**Scenario:** Your healthcare organization has HIPAA-specific control interpretations from legal counsel.

**Steps:**
1. Create a JSON pack manually or from counsel's report
2. Upload with framework "hipaa"
3. Add healthcare-specific interpretations
4. Attest: "Internal legal guidance - privileged"
5. Import

**Result:** HIPAA controls show your organization's legal interpretations.

## Best Practices

### 1. Verify Licensing Before Import
- Ensure you have legal rights to use the content
- Keep purchase orders, licenses, or terms of use on file
- Reference specific agreements in attestation
- For public domain content, cite the source

### 2. Use AI Assistance Wisely
- AI matching is ~80-90% accurate
- Always review AI-generated drafts
- Fix mismatches manually
- Add missing controls that AI didn't catch

### 3. Organize Multiple Packs
- Use descriptive pack names (e.g., "NIST 800-53 Rev 5 Official")
- Include version in pack_version field
- Record source vendor for tracking
- Use metadata for additional context

### 4. Update Packs Over Time
- Delete old pack before importing new version
- This removes old overrides cleanly
- Import new version
- Test a few controls to verify

### 5. Audit Trail Matters
- All imports are logged in audit logs
- Attestation statements are permanently stored
- Document who approved (if using approval workflow)
- Keep source files for verification

### 6. Handle Partial Packs
- You don't need to override all controls
- Pack can cover 10 controls or 200 controls
- Mix baseline and licensed content seamlessly
- Add more packs later as needed

## Troubleshooting

### AI Draft Shows Few Matches
**Problem:** AI only matched 20/200 controls.

**Solutions:**
- Check if report format is machine-readable (not scanned PDF)
- Try uploading in a different format (DOCX vs PDF)
- Manually edit draft to add missing controls
- Use JSON template for manual pack creation

### Import Fails with "Control Not Found"
**Problem:** Control ID in pack doesn't match database.

**Solutions:**
- Verify framework_code matches exactly (case-sensitive)
- Check control_id matches framework (e.g., "AC-1" not "AC-01")
- Run `SELECT control_id FROM framework_controls WHERE framework_id = (SELECT id FROM frameworks WHERE code = 'your-framework')` to see valid IDs
- Edit draft JSON to fix control IDs

### Pack Import Removes Unexpected Content
**Problem:** Importing pack A affected pack B content.

**Solutions:**
- Each pack can only override controls once
- Newer pack replaces older pack's overrides for same controls
- Delete conflicts before importing
- Use pack_version to track which pack is active

### AI Limit Reached During Draft
**Problem:** Community tier only allows 3 AI calls per month.

**Solutions:**
- Upgrade to paid tier for unlimited AI
- Add your own API key (BYOK) for unlimited use
- Upload without AI assistance and edit JSON manually
- Use JSON template to create pack from scratch

### Performance Issues with Large Packs
**Problem:** Importing 500+ controls is slow.

**Solutions:**
- This is expected for large packs (may take 30-60 seconds)
- Split into multiple smaller packs if needed
- Import during low-usage hours
- Large packs are fine once imported

## Security & Compliance

### Data Privacy
- Content packs are **organization-scoped only**
- Other tenants cannot see your packs
- Platform administrators cannot view licensed content
- Packs are encrypted at rest in the database

### License Compliance
- Attestation is mandatory before import
- Audit logs track who imported what
- License references are stored permanently
- Source document hashes verify authenticity

### Access Control
- Requires `settings.manage` permission
- Only organization admins can import packs by default
- Approval workflow can add additional gate
- All actions are audit-logged

## FAQ

**Q: Do content packs modify the global framework data?**  
A: No. Packs create organization-specific overrides. The global baseline remains unchanged.

**Q: Can other organizations see my licensed content?**  
A: No. Content packs are strictly tenant-scoped. Other organizations cannot access your packs.

**Q: What happens if I delete a pack?**  
A: All overrides from that pack are removed. Controls revert to baseline descriptions.

**Q: Can I import multiple packs for the same framework?**  
A: Yes, but later packs override earlier packs for the same control IDs.

**Q: Do I need AI to use content packs?**  
A: No. You can create JSON packs manually or upload reports without AI assistance.

**Q: How much does AI-assisted drafting cost?**  
A: Community tier: 3 AI calls/month. Paid tiers: unlimited with platform keys or bring your own API key.

**Q: Can I edit a pack after importing?**  
A: Not directly. Delete the pack and re-import with changes, or create a new pack version.

**Q: What file formats are supported?**  
A: PDF, DOCX, DOC, TXT, MD, CSV, JSON, XML, LOG (up to 20 MB).

**Q: How long does AI drafting take?**  
A: Typically 30-120 seconds depending on document size and framework complexity.

**Q: Can I see a pack's source document after import?**  
A: Only the document hash is stored, not the document itself. Keep source files separately.

**Q: Do packs work with custom frameworks?**  
A: Yes, as long as the framework exists in your tenant and framework_code matches.

**Q: Can external auditors see content packs?**  
A: Yes, if they have auditor access. Controls and procedures display pack content.

## Additional Resources

- **API Documentation:** See README.md for full API reference
- **Framework Codes:** Run `GET /api/v1/frameworks` to list available frameworks
- **Permissions:** See Settings → Roles for permission configuration
- **Audit Logs:** Settings → Audit Logs shows all pack imports
- **Support:** Contact your platform administrator for assistance

---

**Need Help?**  
If you have questions about content packs, consult your organization's compliance team or platform administrator. For technical issues, check the audit logs or review API error messages for specific guidance.
