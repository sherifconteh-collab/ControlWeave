# 🗄️ CMDB (Asset Management) Guide

This guide covers how to track and manage your organization's assets using ControlWeave's Configuration Management Database (CMDB).

## ⏱️ Time Commitment
- **Quick Setup**: 15 minutes
- **Full Configuration**: 1-2 hours (depending on asset inventory size)

## 📋 Prerequisites
- ControlWeave account
- `assets.read` to view and `assets.write` to change anything. There is no
  "Asset Manager" role — the assignable roles are `admin`, `auditor` and `user`,
  and CMDB access comes from the permission, not a dedicated role
- Your list of hardware, software and service accounts — as a CSV if you have
  one, since the inventory can be bulk-imported (§1.4)

---

## Overview

ControlWeave's CMDB helps you:
- 📦 Maintain a complete inventory of hardware, software, and AI agent assets
- 🏗️ Define and classify deployment environments
- 🔐 Track service accounts and credential rotation schedules
- 🔑 Register password vault integrations
- 🔗 Record dependencies between assets, and track vulnerabilities against them
- 🎯 Link assets to the compliance controls they evidence (CM-8, AC-2, IA-5)
- 📥 Bulk-import an inventory from CSV and export it back out

SBOM is a separate feature with its own page rather than something the CMDB
generates — see the [SBOM guide](SBOM.md). Per-asset AIBOM does not exist; §5.2
explains what is actually there.

ControlWeave has no tier gating and no asset limit — CMDB, hardware and software assets, AI agents, service accounts, environments and password vaults are all available to every authenticated user with the `assets.read` / `assets.write` permissions.

---

## Step 1: Access the CMDB

### 1.1 Navigate to the asset inventory

Under **Assets & Security** in the left sidebar, click **Assets**. That page is
titled *Configuration Management Database (CMDB)* and is the general asset
inventory: a filterable list of assets with a detail drawer showing
vulnerabilities, dependencies and notes.

### 1.2 Navigate to the specialized registers

The six specialized registers live at `/dashboard/cmdb` and are **not** in the
sidebar. Reach them from the **Financial Compliance** entry under
**Assets & Security**, or go to `/dashboard/cmdb` directly:

- **Hardware** — Physical and virtual machines
- **Software** — Applications and services
- **AI Agents** — AI/ML models and autonomous agents
- **Service Accounts** — Non-human credentials and API keys
- **Environments** — Deployment environments (Production, Staging, etc.)
- **Password Vaults** — Credential store integrations

Two further pages live under `/dashboard/cmdb` alongside the registers:

- **Dependency Graph** (`/dashboard/cmdb/dependency-map`) — visualizes the
  asset-to-asset relationships recorded via `POST /api/v1/cmdb/relationships`
- **Financial Services Workspace** (`/dashboard/cmdb/financial-services-workspace`)

**Every register works the same way, and the shape is narrower than it looks.**
Each is a single table page with:

- a **+ Add New** button (top right) opening an *Add New …* modal whose submit
  button reads **Save**
- an **Edit** link on each row, opening that same modal seeded from the record
  and titled *Edit …*
- a **Delete** link on each row

Editing arrived late: for a long time these pages had only Add and Delete, so
correcting a typo meant deleting the record and retyping it. If you are working
from an older build and see no Edit link, `PUT /api/v1/cmdb/environments/:id`,
`/service-accounts/:id`, `/password-vaults/:id` and the asset equivalents have
always worked.

There is still no per-row detail *page* — everything happens in the table and
its modal.

The steps below name the fields each modal collects. Read "go to X → **+ Add
New**" throughout — the buttons are not labeled "Add Hardware", "Add Software",
"Add Environment" and so on.

### 1.3 What the two dashboards show

**Assets** (`/dashboard/assets`): Total Assets, Active, Categories,
Environments, plus category / status / environment filters.

**CMDB** (`/dashboard/cmdb`): Total Assets, Service Accounts and AI Agents,
with links into each register and a short explanation of why the CMDB matters
for GRC.

### 1.4 Bulk import and export

The **Bulk import & export** panel at the bottom of `/dashboard/cmdb` handles
loading and extracting inventory in one go.

1. **Download template** gives you a CSV with exactly the columns the importer
   accepts. **Export inventory** gives you the same columns filled in, so you
   can export, edit and load the file back.
2. Choose what the rows are — Hardware, Software or AI Agents — and pick your
   file.
3. **Dry run** validates without writing anything. It reports how many rows are
   valid and lists every problem row by its line number in your file.
4. **Import** stays disabled until a dry run has succeeded, and imports only the
   valid rows. All of them insert in a single transaction, so a failure part-way
   leaves nothing behind rather than a half-loaded inventory.

Choosing a different file clears the previous dry-run result, so an import can
never run against an analysis of different content.

**Columns.** `name` is required. Optional: asset tag, serial number, model,
manufacturer, location, status, criticality, security classification, IP
address, hostname, FQDN, MAC address, version, license key and expiry, cloud
provider and region, acquisition/deployment/end-of-life dates, documentation URL
and notes. Two columns are resolved for you: `environment` matches a registered
environment by name, and `owner_email` matches an active user in your
organization. Unrecognized columns are ignored and reported rather than
silently dropped. Dates must be `YYYY-MM-DD`. The limit is 5000 rows per
import.

Ownership by UUID, the AI governance fields and freeform metadata are
deliberately not importable — they stay on the form and the API.

The equivalent endpoints are `GET /api/v1/cmdb/import/template`,
`GET /api/v1/cmdb/import/export`, `POST /api/v1/cmdb/import/analyze` (dry run)
and `POST /api/v1/cmdb/import/commit`. Import and export are both audit-logged.

---

## Step 2: Managing Environments

Define your deployment environments before adding assets. Assets are associated with environments to provide context for compliance assessments.

### 2.1 Add an Environment

1. Go to `/dashboard/cmdb` → **Environments**, then click **+ Add New**
2. Fill in the environment details:

**Required Fields**:
- **Name**: Human-readable label (e.g., "Production", "Staging")
- **Code**: Short identifier used in API and reports (e.g., `prod`, `stg`)
- **Environment Type**: `production`, `staging`, `development`, `test`, `dr`

**Data Classification Fields**:
- **Contains PII**: Whether the environment processes Personally Identifiable Information
- **Contains PHI**: Whether the environment processes Protected Health Information
- **Contains PCI**: Whether the environment processes Payment Card Industry data
- **Data Classification**: `public`, `internal`, `confidential`, `restricted`
- **Security Level**: `low`, `medium`, `high`, `critical`
- **Criticality**: Business impact level

3. Click **Save**

> **💡 Tip**: Mark your production environment's data classifications accurately.
> These flags feed the organization context the AI analyses read, so getting them
> right improves the recommendations those analyses produce.

### 2.2 Edit or Delete an Environment

Environment names are not clickable — there is no detail page — but each row
carries **Edit** and **Delete**. Edit reopens the creation modal seeded from the
record; Delete asks "Delete this environment?" first.

`assets.environment_id` references `environments(id)` with no cascade, so
Postgres refuses to delete an environment that assets still point at. The route
does not translate that into a useful message: you get a generic
`Internal server error`. If a delete fails, reassign or remove the referencing
assets first.

The equivalent endpoint is `PUT /api/v1/cmdb/environments/:id`.

---

## Step 3: Managing Hardware Assets

### 3.1 Add a Hardware Asset

1. Go to `/dashboard/cmdb` → **Hardware** → **+ Add New**
2. Fill in asset details:

**Required Fields**:
- **Name**: Asset display name (e.g., "Web Server 01")

**Identification Fields**:
- **Asset Tag**: Internal inventory tag
- **Serial Number**: Manufacturer serial number
- **Model**: Hardware model (e.g., "Dell PowerEdge R750")
- **Manufacturer**: Hardware vendor

**Deployment Fields**:
- **Environment**: Select from your registered environments
- **Location**: Physical or logical location
- **IP Address**: Primary IP address
- **Hostname**: DNS hostname
- **FQDN**: Fully qualified domain name
- **MAC Address**: Network interface MAC address

**Lifecycle Fields**:
- **Status**: `active`, `inactive`, `decommissioned`, `maintenance`
- **Criticality**: `low`, `medium`, `high`, `critical`
- **Acquisition Date**: When the asset was purchased
- **Deployment Date**: When placed into service
- **End of Life Date**: Planned end-of-support date

**Compliance Fields**:
- **Security Classification**: Data classification level
- **Compliance Status**: Current compliance posture
- **Last Audit Date** / **Next Audit Date**: Audit schedule
- **Owner**: Responsible user
- **Documentation URL**: Link to runbooks or wikis

3. Click **Save**

### 3.2 Bulk Asset Management

Use the **Bulk import & export** panel on `/dashboard/cmdb` (§1.4) — download
the template, fill it in, dry-run it and import. The register pages themselves
have no Import control; bulk loading is centralized on the CMDB dashboard so one
file can be validated the same way whichever category it targets.

To script it instead, `POST /api/v1/cmdb/assets` creates one asset per call, and
`POST /api/v1/cmdb/import/commit` takes a whole CSV.

---

## Step 4: Managing Software Assets

### 4.1 Add a Software Asset

1. Go to `/dashboard/cmdb` → **Software** → **+ Add New**
2. Fill in asset details:

**Software-Specific Fields**:
- **Name**: Application name (e.g., "Apache HTTP Server")
- **Version**: Software version string (e.g., "2.4.57")
- **Manufacturer**: Vendor name
- **License Key**: License identifier
- **License Expiry**: License expiration date
- **Cloud Provider**: For cloud-hosted software (`aws`, `azure`, `gcp`)
- **Cloud Region**: Deployment region

**Linking Fields**:
- **Environment**: Associated deployment environment
- **Owner**: Application owner

3. Click **Save**

### 4.2 SBOM Integration

**Software assets have no SBOM tab.** The Software register is a table with add
and delete only; there is no per-asset detail page, so no SBOM upload,
generation or component listing hangs off one.

SBOM management is its own feature with its own page — see the
[SBOM guide](SBOM.md) and **Assets & Security → SBOM** in the sidebar. It is not
linked to individual software-asset records.

---

## Step 5: Managing AI Agents

AI Agent assets have additional fields to support AI governance and the NIST AI RMF framework.

### 5.1 Add an AI Agent

1. Go to `/dashboard/cmdb` → **AI Agents** → **+ Add New**
2. Fill in standard asset fields, plus:

**AI Governance Fields**:
- **AI Model Type**: Model architecture (e.g., `LLM`, `computer_vision`, `classification`)
- **AI Risk Level**: Risk classification (`low`, `medium`, `high`, `critical`)
- **AI Training Data Source**: Description of training data origin
- **Bias Testing Completed**: Whether bias testing has been performed
- **Bias Testing Date**: Date of last bias evaluation
- **Human Oversight Required**: Whether a human must review AI outputs
- **AI Transparency Score**: 0–100 score reflecting model explainability

3. Click **Save**

### 5.2 AIBOM Support

An AI Bill of Materials documents a model's components, training data and
dependencies.

**There is no AIBOM tab on an AI Agent.** The AI Agents register captures the
agent's model, purpose, EU AI Act risk level, human-oversight and bias-testing
fields, but no bill of materials — there is no AIBOM upload, generation or
review screen anywhere in the dashboard.

What does exist:
- `POST /api/v1/ai/monitoring/aiboms/:aibomId/enable` turns on continuous
  monitoring for an AIBOM record.
- `scripts/generate-aibom.js` produces an AIBOM for **ControlWeave itself**, not
  for your registered agents. See the [SBOM guide](SBOM.md).

> **💡 Tip**: Accurate AIBOMs matter for the EU AI Act and NIST AI RMF. Until
> per-agent AIBOM management ships, record what you have in the agent's
> description and attach the document through the
> [Evidence module](EVIDENCE.md).

---

## Step 6: Managing Service Accounts

### 6.1 Add a Service Account

Service accounts represent non-human identities such as API keys, CI/CD tokens, and database credentials.

1. Go to `/dashboard/cmdb` → **Service Accounts** → **+ Add New**
2. Fill in the details:

**Required Fields**:
- **Account Name**: Identifier for the service account (e.g., `ci-deploy-prod`)
- **Account Type**: `api_key`, `service_principal`, `database`, `application`, `system`

**Credential Fields**:
- **Credential Type**: `password`, `certificate`, `api_key`, `oauth_token`, `ssh_key`
- **Privilege Level**: `standard`, `elevated`, `admin`, `super_admin`
- **Scope**: Systems or resources this account can access
- **Password Vault**: Link to a registered password vault where credentials are stored

**Rotation Fields**:
- **Rotation Frequency (Days)**: How often credentials should be rotated (default: 90)
- **Last Rotation Date**: When credentials were last changed
- **Next Rotation Date**: Calculated based on frequency
- **Auto Rotation Enabled**: Whether rotation is automated

**Review Fields**:
- **Review Frequency (Days)**: How often access should be reviewed
- **Last Review Date** / **Next Review Date**: Access review schedule
- **Reviewer**: User responsible for access reviews

3. Click **Save**

### 6.2 Credential Rotation Tracking

Each service account carries a **rotation frequency** (defaulting to 90 days), a
**last rotation date** and a **next rotation date**. The register shows **Next
Rotation** as a column.

What the guide previously described but the page does not do:

- **No color coding on rotation.** The green/amber/red chips on this page are
  for account *status* and *privilege level*. An overdue rotation is not
  highlighted — read the Next Rotation column yourself.
- **No Record Rotation button.** There is no one-click "I rotated this" action.
  To log a rotation, click **Edit** on the account and set **Last Rotation
  Date**; the next date follows from the frequency. The equivalent endpoint is
  `PUT /api/v1/cmdb/service-accounts/:id` with `last_rotation_date`.

Rotation dates are stored and returned by the API
(`last_rotation_date`, `rotation_frequency_days`, `next_rotation_date`), so
overdue-rotation reporting can be built on `GET /api/v1/cmdb/service-accounts`.

---

## Step 7: Managing Password Vaults

Register your organization's password vaults to link service account credentials.

### 7.1 Add a Password Vault

1. Go to `/dashboard/cmdb` → **Password Vaults** → **+ Add New**
2. Fill in the details:

**Fields**:
- **Name**: Display name (e.g., "HashiCorp Vault - Production")
- **Vault Type**: `hashicorp_vault`, `cyberark`, `aws_secrets_manager`, `azure_key_vault`, `1password`, `other`
- **Vault URL**: API endpoint or web URL
- **Description**: Notes about this vault's purpose

3. Click **Save**

Once registered, vaults appear as options when creating service accounts.

---

## Step 8: Risk Exposure

Every asset should be traceable to the risks it carries. An asset with no
recorded exposure is an unassessed asset, not a safe one.

### 8.1 See what an asset is exposed to

1. Open **Assets** (`/dashboard/assets`) and click an asset
2. The **Risk Exposure** panel at the top of the drawer lists every linked risk

Each row shows the risk's severity band, its category and status, and the
movement from **inherent** to **residual** score. Both are shown deliberately:
residual alone tells you where you are but hides how much the treatment
achieved, and migration 136 stores both so that trail stays auditable. Scores
are likelihood x impact on a 1-5 scale, so 1-25 — 15+ reads as Critical, 10+
High, 5+ Medium.

Click a risk to open it in the register.

### 8.2 Link an asset to a risk

Linking happens on the risk, not the asset, so one screen owns the
relationship:

1. Open the risk in **Risk Register** (`/dashboard/risks`)
2. Add the asset under its **Assets** links

The asset's Risk Exposure panel picks it up immediately.

### 8.3 Exposure across the estate

`GET /api/v1/cmdb/risk-exposure[?category=hardware|software|ai-agents]` returns,
per asset, the number of **open** risks (closed and accepted are excluded), the
worst residual score, and the title of the top risk. It is one query for the
whole estate rather than one per asset, so it is the right basis for a report or
a register column.

---

## Step 9: Asset-Control Mapping

Link CMDB assets to compliance controls so the inventory can evidence them.

### 9.1 Link an asset to a control

1. Open **Assets** (`/dashboard/assets`) and click an asset to open its detail
   drawer
2. In **Compliance Controls**, click **+ Link control**
3. Search by control ID or title (e.g. `CM-8`) and select from the list — it
   offers controls from your organization's active frameworks and hides ones
   already linked
4. Optionally set a **compliance status** for the pairing: Compliant, Partial,
   Non-compliant or Not applicable
5. Click **Link**

Each linked control shows on the asset with its framework, its status, and an
**Unlink** action. The status is editable in place from the same row.

This was unimplemented for a long time: the `asset_control_mappings` table has
been in the schema since migration 005 — commented *"Links assets to compliance
controls for traceability"* — with no API and no UI, so the table stayed empty.
If your inventory shows no links at all, that is why; they have to be made now.

**Common Control-Asset Mappings**:
- **CM-8** (System Component Inventory) — All CMDB assets
- **AC-2** (Account Management) — Service accounts
- **IA-5** (Authenticator Management) — Service accounts + password vaults
- **CM-6** (Configuration Settings) — Hardware and software assets
- **SA-22** (Unsupported System Components) — Assets approaching end-of-life

The endpoints are `GET`/`POST /api/v1/cmdb/assets/:assetId/controls`,
`PUT`/`DELETE /api/v1/cmdb/assets/:assetId/controls/:controlId`, and
`GET /api/v1/cmdb/controls/:controlId/assets` for the reverse view.


### 9.2 AI-Powered Mapping

ControlWeave AI can suggest control-to-asset mappings, but **this is API-only
and advisory**. There is no Asset-Control Mapping panel on the AI Insights page,
and no accept or apply flow — the endpoint returns suggestions as a response and
persists nothing. Read its suggestions, then record the ones you agree with
using the linking flow in §9.1.

```
POST /api/v1/ai/asset-control-mapping
```

Requires the `ai.use` permission and a configured LLM provider.

---

## Step 10: Reporting & Analytics

### 10.1 Exporting the inventory

Use **Export inventory** in the bulk panel on `/dashboard/cmdb` (§1.4). It emits
CSV covering every asset — or one category, if you pick one — using the same
columns the importer accepts, so an export can be edited and loaded back.

There is still no **Reports → Asset Inventory** entry, and none of the packaged
report types this section used to promise (Full Inventory, By Environment, By
Category, End-of-Life, Service Account Review) exist; there is no PDF or XLSX
rendering of the inventory. The CSV export is the supported path.

Where assets appear in packaged reporting: the **System Security Plan (SSP)**
report includes an asset-inventory section in its narrative, alongside
compliance posture, vulnerabilities, evidence and POA&M.

Service accounts are not in the CSV export; read them from
`GET /api/v1/cmdb/service-accounts`.

### 10.2 There is no Asset Coverage view

There is no **Dashboard → Asset Coverage** page and no framework-by-framework
rollup of which controls have asset-linked evidence. The underlying data now
exists — §9.1 records the mappings — but nothing aggregates it into a coverage
view yet. Per control, `GET /api/v1/cmdb/controls/:controlId/assets` returns the
assets linked to it.

---

## Step 11: AI-Assisted CMDB Operations

### 11.1 Shadow IT Detection

AI can flag assets that appear in your environment but are not registered in the
CMDB, comparing integration feeds against registered assets.

**This is API-only.** There is no Shadow IT Detection control on the AI Insights
page — that page offers a single **Phase 6 Analysis** run and nothing else. The
analysis is reachable at:

```
POST /api/v1/ai/shadow-it
```

Requires the `ai.use` permission and a configured LLM provider.

### 11.2 Ask in natural language

There is no in-app chat box. Connect an MCP-compatible assistant (see the
[MCP Guide](../MCP_GUIDE.md)) and ask asset questions there:

**Example Questions**:
- "Which assets are missing an assigned owner?"
- "Show me all production assets with critical severity"
- "Which service accounts have overdue credential rotations?"
- "What controls are covered by my hardware assets?"
- "Which software assets have licenses expiring in the next 90 days?"

---

## 🎯 Quick Start Workflow

**First 30 Minutes**:
1. Create your key environments (Production, Staging)
2. Add your top 10 most critical assets
3. Link at least one asset to a relevant control (§9.1)
4. Register your password vault (if applicable)

**First Week**:
1. Bulk-import your hardware and software inventory from CSV (§1.4) — dry-run it
   first, fix what it flags, then import
2. Register all service accounts with rotation schedules
3. Link assets to CM-8, AC-2 and IA-5 so the inventory evidences them
4. Record asset-to-asset dependencies and review them on the Dependency Graph

**Ongoing**:
1. Monthly: Review service account rotation status via the **Next Rotation**
   column — nothing highlights an overdue one for you (§6.2)
2. Quarterly: Audit asset list for decommissioned systems
3. On change: Edit the asset in place, or re-import a corrected CSV

---

## ✅ CMDB Setup Checklist

**Environments**:
- [ ] Production environment defined with data classifications
- [ ] All deployment environments registered
- [ ] Network zones and security levels set

**Assets**:
- [ ] Hardware inventory entered
- [ ] Software inventory entered
- [ ] AI Agents registered with governance fields completed
- [ ] Service accounts registered with rotation schedules

**Vaults & Credentials**:
- [ ] Password vaults registered
- [ ] Service accounts linked to vaults
- [ ] Rotation schedules reviewed

**Controls Integration**:
- [ ] Critical assets linked to the risks they carry (§8.1)
- [ ] CM-8 (System Component Inventory) linked to assets
- [ ] AC-2 (Account Management) linked to service accounts
- [ ] IA-5 (Authenticator Management) linked to service accounts

**Reporting**:
- [ ] Inventory exported from the bulk panel (§1.4), or reviewed in the SSP
      report's inventory section (§10.1)

---

## 🚀 Next Steps

After setting up your CMDB:

1. **Track Vulnerabilities**: [Link vulnerabilities to assets](VULNERABILITIES.md)
2. **Manage SBOM**: use the standalone SBOM feature at **Assets & Security →
   SBOM** ([guide](SBOM.md)). It is not reachable from an asset record — there
   is no asset detail page and no SBOM or AIBOM tab (§4.2, §5.2)
3. **Map to Controls**: link assets to the controls they evidence (§9.1)
4. **Review dependencies**: open the Dependency Graph at
   `/dashboard/cmdb/dependency-map`
5. **Extract the inventory**: **Export inventory** on `/dashboard/cmdb` (§1.4)

---

## 📚 Additional Resources

- [NIST SP 800-128](https://csrc.nist.gov/publications/detail/sp/800-128/final) - Guide for Security-Focused Configuration Management
- [NIST AI RMF](https://www.nist.gov/system/files/documents/2023/01/26/AI%20RMF%201.0.pdf) - AI Risk Management Framework
- [CycloneDX SBOM Standard](https://cyclonedx.org/) - SBOM format specification
- [SPDX SBOM Standard](https://spdx.dev/) - Linux Foundation SBOM format

---

**Need Help?** There is no in-app AI Copilot button. Ask over
[MCP](../MCP_GUIDE.md), run an analysis from **AI Insights**, or contact
contehconsulting@gmail.com

> **💡 Pro Tip**: Register environments first, then add assets into them. Assets
> then carry data-classification context from day one — and because there is no
> Edit control on the registers (§1.2), getting an asset's environment and dates
> right at creation saves re-entering the record later.
