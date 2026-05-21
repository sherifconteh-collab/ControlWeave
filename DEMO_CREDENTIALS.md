# ControlWeave Demo - Login Credentials

## Application URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## Demo Accounts

### Enterprise Admin Account
- **Email**: `admin@enterprise.com`
- **Password**: `ControlWeave!2026`
- **Organization**: Meridian Financial Group
- **Tier**: Enterprise
- **Role**: Admin
- **Access**: Full administrative access to all features

### Auditor Account
- **Email**: `auditor@enterprise.com`
- **Password**: `ControlWeave!2026`
- **Organization**: Meridian Financial Group (same as enterprise admin)
- **Tier**: Enterprise
- **Role**: Auditor
- **Access**: Auditor-specific features including Auditor Workspace

### Additional Demo Accounts

#### GovCloud Tier
- **Email**: `admin@govcloud.com`
- **Password**: `ControlWeave!2026`
- **Organization**: Vanguard Defense Systems
- **Tier**: GovCloud
- **Role**: Admin

#### Pro Tier
- **Email**: `admin@pro.com`
- **Password**: `ControlWeave!2026`
- **Organization**: BrightPath Health
- **Tier**: Pro
- **Role**: Admin

#### Community Tier
- **Email**: `admin@community.com`
- **Password**: `ControlWeave!2026`
- **Organization**: NovaTech Solutions
- **Tier**: Community
- **Role**: Admin

## How to Run the Demo

### Prerequisites
- PostgreSQL must be running
- Node.js 18+ installed
- Ports 3000 and 3001 available

### Start the Application

1. **Backend** (Terminal 1):
   ```bash
   cd controlweaver/backend
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
- The enterprise admin and auditor accounts share the same organization
- GovCloud is an admin-only shared demo account in the current seeded tier set
- Demo data includes frameworks, controls, and sample CMDB assets
- The application features auto-crosswalk capabilities across compliance frameworks
- AI features require API keys configured in Settings > LLM Configuration
