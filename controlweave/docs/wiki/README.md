# Wiki Content Structure

This folder contains source markdown for the GitHub Wiki:
https://github.com/sherifconteh-collab/ControlWeaver-Pro/wiki

## Available Documentation

### Core Pages
- **[Home.md](Home.md)** - Main wiki landing page
- **[Developer-Resources.md](Developer-Resources.md)** - Stripe-style developer resources hub
- **[Audit-Policy-Center.md](Audit-Policy-Center.md)** - Audit and policy hub
- **[User-Guide.md](User-Guide.md)** - Product-level user guide
- **[_Sidebar.md](_Sidebar.md)** - Persistent wiki left navigation
- **[_Footer.md](_Footer.md)** - Wiki footer links

### Templates
- **[Developer-Doc-Template.md](Developer-Doc-Template.md)** - Engineering documentation template
- **[Policy-Page-Template.md](Policy-Page-Template.md)** - Policy document template
- **[Audit-Test-Plan-Template.md](Audit-Test-Plan-Template.md)** - Audit execution template

### Getting Started (`getting-started/`)
- **[Getting-Started.md](getting-started/Getting-Started.md)**
- **[Account-Setup.md](getting-started/Account-Setup.md)**

### Security (`security/`)
- **[Vulnerability-Management.md](security/Vulnerability-Management.md)**
- **[DISA-STIG-Compliance.md](security/DISA-STIG-Compliance.md)**

## Syncing to GitHub Wiki

### Manual Sync
1. Clone the wiki repository.
2. Copy wiki files from this folder.
3. Commit and push.

### Scripted Sync
Use:
```bash
./scripts/sync-wiki.sh
```

The script syncs:
- `Home.md`
- `User-Guide.md`
- `Developer-Resources.md`
- `Audit-Policy-Center.md`
- `Developer-Doc-Template.md`
- `Policy-Page-Template.md`
- `Audit-Test-Plan-Template.md`
- `_Sidebar.md`
- `_Footer.md`
- Section pages under `getting-started/`, `security/`, `operations/`, `deployment/`, and `reference/`

## Formatting Standards

### Developer Docs
Follow `Developer-Doc-Template.md`:
1. Overview
2. Prerequisites
3. Quickstart
4. Configuration
5. Workflows
6. Testing
7. Troubleshooting
8. Security notes
9. Change management
10. Related docs

### Policy and Audit Docs
Follow `Policy-Page-Template.md` and `Audit-Test-Plan-Template.md`:
1. Document control metadata
2. Scope and requirements
3. Control mappings
4. Evidence requirements
5. Testing and sign-off
6. Exceptions and remediation
7. Revision history

## File Naming Convention

- Use hyphens instead of underscores: `Getting-Started.md`
- Use PascalCase with hyphens: `Audit-Policy-Center.md`
- Special GitHub Wiki files must be exact: `_Sidebar.md`, `_Footer.md`, `Home.md`

---

Last Updated: February 19, 2026