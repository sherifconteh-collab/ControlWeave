# ControlWeave Demo - Login Credentials

## Application URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## Demo Accounts

Every account below uses the password `ControlWeave!2026`. There is one demo
organization per industry vertical, plus one external audit firm, so every
scenario can be exercised against data that fits the vertical.

Each organization has an **admin** login (`admin@<industry>.com`) and an
**auditor** login (`auditor@<industry>.com`).

| Industry | Organization | Admin login | Frameworks | AI framework |
|---|---|---|---|---|
| Financial Services | Meridian Financial Group | `admin@financial.com` | FFIEC, SR 11-7, SOC 2, SEC Markets AI Risk | NIST AI RMF |
| Healthcare | BrightPath Health | `admin@healthcare.com` | HIPAA, HITECH | NIST AI RMF |
| Defense & Government Contracting | Vanguard Defense Systems | `admin@defense.com` | CMMC 2.0, NIST 800-171, FedRAMP High | NIST AI RMF |
| Technology / SaaS | NovaTech Solutions | `admin@technology.com` | SOC 2, ISO 27001, GDPR | ISO 42001 |
| Energy & Utilities | Cascade Grid Energy | `admin@energy.com` | NERC CIP, NIST CSF 2.0 | NIST AI RMF |
| Retail & E-commerce | Harborline Retail Group | `admin@retail.com` | PCI DSS v4, CCPA/CPRA, ISO 27001, State AI Governance | NIST AI RMF |
| Pharmaceuticals & Life Sciences | Helixor Biosciences | `admin@pharma.com` | ISO 27001, GDPR, ISO 27701 | EU AI Act |
| Higher Education | Lakemont University | `admin@education.com` | NIST CSF 2.0, NIST 800-171, CCPA/CPRA | ISO 42005 |
| Audit & Assurance Firm | Sterling & Roe Advisory | `admin@auditfirm.com` | SOC 2, ISO 27001, NIST 800-53 | ISO 42001 |

The **AI framework** column is the one the AI Governance Assessment actually
reads controls from. That analysis only accepts five codes — NIST AI RMF, ISO
42001, ISO 42005, EU AI Act, and AIUC-1 — so an organization whose only AI
framework is, say, State AI Governance would open that screen with nothing in
it. Frameworks like SEC Markets AI Risk and State AI Governance are still
tracked (they appear in the Frameworks column) but do not feed that assessment.

This is enforced twice: `demo-account-config.js` refuses to load if any account
declares no framework from `AI_GOVERNANCE_FRAMEWORK_CODES`, and
`seed-industry-demo-data.js` fails if a declared one does not resolve against
the seeded catalog.

### Audit workbench account

`admin@auditfirm.com` / `auditor@auditfirm.com` (Sterling & Roe Advisory) is the
account to use for the audit workbench. Its organization ships with three
seeded engagements so every workbench screen has real data:

- **SOC 2 Type II Examination — Harborline Retail Group** (`fieldwork`) —
  6 PBC requests spanning every status, 4 workpapers across draft / in review /
  finalized, and 3 findings at low, medium, and high severity.
- **ISO 27001 Surveillance Audit — Helixor Biosciences** (`planning`) — an
  engagement still being scoped, with open PBC requests and a planning
  workpaper.
- **Internal Controls Review — FY2026** (`reporting`) — finalized workpapers,
  a closed finding, and a complete signoff chain (auditor, management, audit
  firm recommendation).

### Legacy tier-addressed logins

The four original tier logins still work and resolve to the same organizations
as their industry-addressed equivalents, so older links and screenshots do not
break:

| Legacy login | Now equivalent to |
|---|---|
| `admin@enterprise.com` | `admin@financial.com` |
| `admin@pro.com` | `admin@healthcare.com` |
| `admin@govcloud.com` | `admin@defense.com` |
| `admin@community.com` | `admin@technology.com` |

The matching `auditor@enterprise.com`, `auditor@pro.com`,
`auditor@govcloud.com`, and `auditor@community.com` logins work the same way.

## Seeding the demo data

```bash
cd controlweave/backend

npm run seed:demo:all-test-data     # everything, in order
```

Or run the individual steps:

```bash
npm run seed:demo-accounts          # organizations + admin logins (and aliases)
npm run seed:auditor-accounts       # auditor login per organization
npm run seed:demo:industries        # frameworks + control implementations
npm run seed:demo:audit-workbench   # engagements, PBC, workpapers, findings, signoffs
```

Verify the result — this checks every admin, auditor, and alias login, and
fails if the audit workbench is empty:

```bash
npm run qa:demo:verify-logins
```

## How to Run the Demo

### Prerequisites
- PostgreSQL must be running
- Node.js 20+ installed
- Ports 3000 and 3001 available

### Start the Application

1. **Backend** (Terminal 1):
   ```bash
   cd controlweave/backend
   npm run dev
   ```

2. **Frontend** (Terminal 2):
   ```bash
   cd controlweave/frontend
   npm run dev
   ```

3. **Access the Application**:
   - Open browser to http://localhost:3000
   - Login with any of the credentials above

## Features by Role

### Admin Role
- Full dashboard access
- Framework selection and management
- Control implementation
- Evidence management
- Asset management (CMDB)
- Vulnerability tracking
- SBOM management
- Assessment planning
- Report generation
- Organization settings
- User management
- Access Governance (entitlements, SoD, access reviews, simulator)
- AI-powered compliance analysis

### Auditor Role
All admin features plus:
- **Auditor Workspace**: Procedure-driven engagement management
  - Create audit engagements (Internal Audit, External Audit, Readiness, Assessment)
  - AI-assisted PBC (Provided By Client) request drafting
  - Workpaper management
  - Finding documentation
  - Sign-off checklisting
  - Validation package export

### Auditor Sub-Roles
The system also supports specialized auditor sub-roles:
- **Auditor Lead**: Full auditor workflow access
- **Auditor Fieldwork**: Focused on evidence collection and procedure execution
- **Auditor Observer**: Read-focused role for observation and quality checks

## Database Information

- **Database**: grc_platform
- **User**: postgres
- **Host**: localhost
- **Port**: 5432

## Notes

- All demo accounts use the same password: `ControlWeave!2026`
- Set `DEMO_ACCOUNT_PASSWORD` (minimum 15 characters) before seeding to use a
  different password; re-seeding without it preserves existing passwords
- Password reset is blocked for every demo email domain, because these accounts
  are shared and one reset would lock everyone else out
- The admin and auditor accounts for an industry share the same organization
- Demo data includes frameworks, controls, and sample CMDB assets
- The application features auto-crosswalk capabilities across compliance frameworks: implementing a control credits mapped controls at ≥90% similarity in your other active frameworks, records which source justified each credit, and withdraws the credit if that source stops being implemented
- AI features require API keys configured in Settings > LLM Configuration
