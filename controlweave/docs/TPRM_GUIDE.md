# Third-Party Risk Management (TPRM)

**Tier Required:** Professional or higher  
**Location in App:** Dashboard → Third-Party Risk (🔗)

---

## Overview

ControlWeave's Third-Party Risk Management module helps compliance teams assess and monitor the security posture of vendors, suppliers, and service providers. It covers the full due-diligence lifecycle:

1. **Vendor Registry** — onboard and classify vendors by risk tier
2. **Security Questionnaires** — AI-generate and email questionnaires to vendors; track opens and responses
3. **Documentation Requests** — request and track compliance certifications (SOC 2, ISO 27001, etc.)
4. **AI Risk Assessment** — get an AI-generated risk score and narrative for any vendor
5. **CMDB Integration** — link vendors to existing assets in the Configuration Management Database

---

## Key Concepts

| Term | Description |
|------|-------------|
| **Vendor** | Any third party that provides software, hardware, cloud services, managed services, or acts as a data processor |
| **Risk Tier** | `critical / high / medium / low` — your organisation's classification of how risky a vendor relationship is |
| **Review Status** | Lifecycle state: `pending_review → in_review → approved / conditional / rejected / decommissioned` |
| **Questionnaire** | A set of security questions sent to the vendor via email for self-assessment |
| **Access Token** | A unique 96-character random token embedded in the vendor's questionnaire link — no ControlWeave account required |
| **Opened At** | Timestamp automatically recorded the first time the vendor clicks their link |

---

## Getting Started

### 1. Add a Vendor

1. Navigate to **Third-Party Risk** in the sidebar
2. Click **+ Add Vendor**
3. Fill in vendor name, type, risk tier, data access level, and contact details
4. Optionally link the vendor to an existing **CMDB asset** by typing in the search field
5. Click **Add Vendor**

### 2. Run an AI Risk Assessment

From the Vendors tab, click **🤖 Assess** on any vendor row. The AI will:
- Analyse the vendor's profile (type, data access level, services provided)
- Generate a risk score (0–100) and a written risk narrative
- Store the result on the vendor record for future reference

### 3. Generate a Security Questionnaire

1. Switch to the **Questionnaires** tab and click **🤖 Generate Questionnaire**
2. Select a vendor, enter a title, and optionally set a due date
3. Click **Generate Questions with AI** — the AI produces 15–20 questions across:
   - Information Security Program
   - Data Protection & Privacy
   - Access Control & Identity Management
   - Incident Response & Business Continuity
   - Vulnerability Management
   - Supply Chain & Subprocessors
   - Physical Security
4. Review the questions, then click **✅ Save Questionnaire**

### 4. Send the Questionnaire to the Vendor

1. In the Questionnaires tab, click **📧 Send** on a questionnaire row
2. The system uses the vendor's contact email (or prompts for one)
3. An HTML email is sent containing:
   - All questions listed for preview
   - Due date (if set)
   - A secure link unique to this questionnaire
4. The questionnaire status changes to `sent`

> **SMTP Setup:** Email delivery can be configured via environment variables (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`) **or** via **Platform Admin → Email (SMTP) Configuration** settings (stored in the `platform_settings` table and editable without a server restart). If both are set, environment variables take precedence; the system falls back to DB-backed SMTP if env vars are absent. If neither is configured, send operations silently no-op.

### 5. Track Vendor Engagement

The Questionnaires table shows:
- **Sent To** — the email address and date of delivery
- **Opened** — a green ✓ badge appears the moment the vendor first clicks the link
- **Reminder** — date of the most recent reminder email
- **Status** — `draft / sent / in_progress / completed / overdue / cancelled`

Click **⏰ Remind** to send a follow-up email to the vendor.

### 6. Vendor Self-Service Response

Vendors receive a link that opens a public page (no ControlWeave account required):
- They can view all questions
- Save progress or submit final responses
- Once submitted, status changes to `completed`

### 7. Request Documentation

1. Switch to the **Documents** tab and click **+ Request Document**
2. Select a vendor and document type (SOC 2 Report, ISO 27001 Certificate, Pen Test Report, DPA, BAA, etc.)
3. Track the request through `requested → received → under_review → accepted` workflow
4. Set an expiry date to be alerted before certifications lapse

---

## CMDB Integration

Every vendor can be linked to a CMDB asset (hardware, software, cloud service, etc.):

- When adding a vendor, search CMDB assets by name in the **Link to CMDB Asset** field
- The vendor table shows the linked asset name and category
- The vendor detail panel shows asset status alongside the vendor record
- API: `GET /api/v1/tprm/cmdb-assets/:assetId/vendors` — navigate from the CMDB side to see all vendors linked to a given asset

---

## AI Features

### AI Questionnaire Generation
**Endpoint:** `POST /api/v1/ai/tprm/generate-questionnaire`

Accepts `vendorInfo` (name, type, risk tier, data access level, services) and returns a JSON array of structured question objects:
```json
[
  {
    "id": "Q1",
    "category": "Data Protection & Privacy",
    "question": "Do you encrypt data at rest using AES-256 or equivalent?",
    "type": "yes_no",
    "required": true,
    "guidance": "Include details of the encryption algorithm and key management process."
  }
]
```

### AI Response Analysis
**Endpoint:** `POST /api/v1/ai/tprm/analyze-responses`

Accepts `vendorInfo`, `questions`, and `responses`. Returns:
- Overall security posture score (0–100)
- Risk rating (critical / high / medium / low)
- Key findings (positive and negative)
- Identified compliance gaps
- Recommended risk mitigations
- Suggested re-assessment timeline
- Approval recommendation

---

## API Reference

All endpoints require `Authorization: Bearer <token>` and Pro tier.

### Vendors

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/tprm/vendors` | List vendors (filter: `risk_tier`, `review_status`, `search`) |
| `GET` | `/api/v1/tprm/vendors/:id` | Get vendor details with questionnaires and documents |
| `POST` | `/api/v1/tprm/vendors` | Create vendor |
| `PATCH` | `/api/v1/tprm/vendors/:id` | Update vendor |
| `DELETE` | `/api/v1/tprm/vendors/:id` | Delete vendor |
| `POST` | `/api/v1/tprm/vendors/:id/store-ai-assessment` | Store AI risk score and summary |

### Questionnaires

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/tprm/questionnaires` | List questionnaires (filter: `vendor_id`, `status`) |
| `GET` | `/api/v1/tprm/questionnaires/:id` | Get questionnaire with vendor info |
| `POST` | `/api/v1/tprm/questionnaires` | Create questionnaire |
| `PATCH` | `/api/v1/tprm/questionnaires/:id` | Update questionnaire |
| `DELETE` | `/api/v1/tprm/questionnaires/:id` | Delete questionnaire |
| `POST` | `/api/v1/tprm/questionnaires/:id/send` | Send questionnaire to vendor by email |
| `POST` | `/api/v1/tprm/questionnaires/:id/remind` | Send reminder email |

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/tprm/documents` | List document requests (filter: `vendor_id`, `request_status`) |
| `POST` | `/api/v1/tprm/documents` | Create document request |
| `PATCH` | `/api/v1/tprm/documents/:id` | Update document request status |
| `DELETE` | `/api/v1/tprm/documents/:id` | Delete document request |

### Summary & CMDB

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/tprm/summary` | Dashboard summary counts |
| `GET` | `/api/v1/tprm/cmdb-assets` | Search CMDB assets to link (`?search=name`) |
| `GET` | `/api/v1/tprm/cmdb-assets/:assetId/vendors` | Vendors linked to a CMDB asset |

### Public Vendor Endpoints (no auth required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/tprm-public/respond/:token` | Load questionnaire (records `opened_at` on first access) |
| `PATCH` | `/api/v1/tprm-public/respond/:token` | Submit responses |

---

## Database Schema

### `tprm_vendors`
Core vendor registry table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | Org reference |
| `vendor_name` | VARCHAR(255) | Vendor display name |
| `vendor_type` | VARCHAR | `software / hardware / services / cloud / managed_service / data_processor / other` |
| `risk_tier` | VARCHAR | `critical / high / medium / low` |
| `review_status` | VARCHAR | `pending_review / in_review / approved / conditional / rejected / decommissioned` |
| `data_access_level` | VARCHAR | `none / metadata / limited / full` |
| `cmdb_asset_id` | UUID | Optional FK to `assets.id` |
| `ai_risk_summary` | TEXT | Most recent AI risk narrative |
| `ai_risk_score` | INTEGER | 0–100 AI-generated risk score |

### `tprm_questionnaires`
Questionnaire instances (one per send):

| Column | Type | Description |
|--------|------|-------------|
| `vendor_email` | VARCHAR | Email address questionnaire was sent to |
| `access_token` | VARCHAR(128) | Unique token for the vendor respond link |
| `opened_at` | TIMESTAMP | First time vendor opened the link |
| `reminder_sent_at` | TIMESTAMP | Most recent reminder email |
| `questions` | JSONB | Array of question objects |
| `responses` | JSONB | Map of question ID → vendor answer |
| `ai_generated` | BOOLEAN | Whether questions were AI-generated |
| `ai_analysis` | TEXT | AI analysis of completed responses |
| `overall_score` | INTEGER | 0–100 questionnaire score |

### `tprm_documents`
Documentation request tracker:

| Column | Type | Description |
|--------|------|-------------|
| `document_type` | VARCHAR | `soc2_report / iso27001_cert / pen_test_report / privacy_policy / dpa / baa / insurance_cert / business_continuity_plan / incident_response_plan / other` |
| `request_status` | VARCHAR | `requested / received / under_review / accepted / rejected / expired` |
| `expires_at` | DATE | Optional expiry — used for "expiring soon" alerts |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SMTP_HOST` | For email | SMTP server hostname |
| `SMTP_PORT` | For email | SMTP port (default 587) |
| `SMTP_USER` | For email | SMTP username |
| `SMTP_PASS` | For email | SMTP password |
| `FROM_EMAIL` | For email | Sender address (default `ControlWeave <contehconsulting@gmail.com>`) |
| `FRONTEND_URL` | For email | Base URL used in questionnaire links (default `http://localhost:3000`) |

---

## Security Notes

- Questionnaire access tokens are 48 random bytes (96 hex chars) — brute-force infeasible
- Public respond endpoints have a separate rate limiter (60 requests per 15 min per IP)
- Authenticated TPRM endpoints have a dedicated rate limiter (120 requests per 15 min per org)
- All vendor mutations are recorded in the audit log
- Public respond endpoints never expose org-internal data beyond the questionnaire title and questions
- Vendor responses are sanitised (keys max 64 chars, values max 4000 chars, only primitives allowed)

---

## Compliance Mappings

TPRM supports the following compliance control objectives:

| Framework | Controls |
|-----------|---------|
| **NIST 800-53 r5** | SA-9 (External System Services), SR-1 through SR-12 (Supply Chain Risk Management) |
| **ISO 27001:2022** | A.5.19 (Information security in supplier relationships), A.5.20, A.5.21, A.5.22, A.5.23 |
| **SOC 2** | CC9.2 (Risk Mitigation — Vendor Management) |
| **NIST CSF 2.0** | GV.SC (Supply Chain Risk Management) |
| **GDPR** | Art. 28 (Processor agreements / DPA), Art. 32 (Technical measures) |

---

*Last updated: February 2026*
