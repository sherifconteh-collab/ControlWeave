# 🗄️ CMDB (Asset Management) Guide

This guide covers how to track and manage your organization's assets using ControlWeave's Configuration Management Database (CMDB).

## ⏱️ Time Commitment
- **Quick Setup**: 15 minutes
- **Full Configuration**: 1-2 hours (depending on asset inventory size)

## 📋 Prerequisites
- ControlWeave account
- Admin or Asset Manager role (write access requires `assets.write` permission)
- List of hardware, software, and service accounts to import

---

## Overview

ControlWeave's CMDB helps you:
- 📦 Maintain a complete inventory of hardware, software, and AI agent assets
- 🏗️ Define and classify deployment environments
- 🔐 Track service accounts and credential rotation schedules
- 🔑 Register password vault integrations
- 🔗 Link assets to security controls and vulnerabilities
- 📋 Generate SBOM and AIBOM for compliance evidence

ControlWeaver has no tier gating and no asset limit — CMDB, hardware/software assets, AI agents, and service accounts are all available to every authenticated user.
| **Environments** | — | 5 | Unlimited | Unlimited |
| **Password Vaults** | ❌ | ✅ | ✅ | ✅ |
| **SBOM Management** | ❌ | ✅ Basic | ✅ Full | ✅ Full |
| **AIBOM Management** | ❌ | ✅ Basic | ✅ Full | ✅ Full |
| **Asset-Control Mapping** | ❌ | ✅ Manual | ✅ AI-Powered | ✅ AI-Powered |
| **Shadow IT Detection** | ❌ | ❌ | ✅ AI | ✅ AI |

---

## Step 1: Access the CMDB

### 1.1 Navigate to CMDB

1. Click **CMDB** in the left sidebar
2. The CMDB dashboard displays an overview of your asset inventory

The CMDB is organized into six sections:
- **Hardware** — Physical and virtual machines
- **Software** — Applications and services
- **AI Agents** — AI/ML models and autonomous agents
- **Service Accounts** — Non-human credentials and API keys
- **Environments** — Deployment environments (Production, Staging, etc.)
- **Password Vaults** — Credential store integrations

### 1.2 Dashboard Overview

The CMDB Dashboard displays:
- **Total Assets**: Count by category
- **Asset Health**: Status breakdown (Active, Inactive, Decommissioned)
- **Environment Coverage**: Assets mapped to environments
- **Upcoming Reviews**: Service accounts and assets with approaching review dates
- **Recent Activity**: Latest asset changes

### 1.3 Import Assets from External CMDB

Click **📥 Import Assets** (top-right of the CMDB dashboard) to bulk-import assets from any external CMDB or IT asset management tool.

**Supported formats**: CSV (`.csv`) and JSON (`.json`) exports from any CMDB, IT asset management, or vulnerability scanning tool. Examples include IT management platforms, IT service management tools, open-source asset trackers, vulnerability scanners, and custom spreadsheets.

**AI-assisted field mapping workflow**:

1. Click **📥 Import Assets**
2. Upload your CSV or JSON file
3. AI analyzes your column headers and sample rows, then suggests how each column maps to the ControlWeave CMDB schema (e.g., your `ci_name` → `name`, `ip_addr` → `ip_address`)
4. Review the AI's suggested mappings in the table — adjust any that are incorrect
5. Check the data preview to verify rows look correct
6. Select the **Asset Type** (Hardware, Software, or AI Agent)
7. Click **🔍 Dry Run** to validate the mapping without writing any data
8. Click **✅ Import** to commit the assets

**Handling gaps**: If the AI identifies required fields (like `name`) that have no matching column in your file, they are highlighted in amber. You can:
- Map another column to fill the gap
- Skip the import for those rows
- Manually enter missing values after import

**Idempotent imports**: Re-importing a file will skip rows that create duplicate asset names. Existing assets are not overwritten.

> **API**: `POST /api/v1/cmdb/import/analyze` (upload + AI mapping) and `POST /api/v1/cmdb/import/commit` (write assets)

---

## Step 2: Managing Environments

Define your deployment environments before adding assets. Assets are associated with environments to provide context for compliance assessments.

### 2.1 Add an Environment

1. Click **CMDB** → **Environments** → **Add Environment**
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
- **Network Zone**: `internet`, `dmz`, `intranet`, `restricted`, `isolated`
- **Security Level**: `low`, `medium`, `high`, `critical`
- **Criticality**: Business impact level

3. Click **Save Environment**

> **💡 Tip**: Mark your production environment's data classifications accurately — these flags flow into compliance control assessments and help the AI Copilot generate context-aware recommendations.

### 2.2 Edit or Delete an Environment

- Click an environment name to view its details
- Click **Edit** to update any field
- Click **Delete** to remove the environment (only possible when no assets reference it)

---

## Step 3: Managing Hardware Assets

### 3.1 Add a Hardware Asset

1. Click **CMDB** → **Hardware** → **Add Hardware**
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

3. Click **Save Asset**

### 3.2 Bulk Asset Management

For large inventories, use CSV import:

1. Click **Import** → **CSV Import**
2. Download the CSV template
3. Populate the template with your asset data
4. Upload the completed file
5. Review the import preview for errors
6. Click **Import Assets**

---

## Step 4: Managing Software Assets

### 4.1 Add a Software Asset

1. Click **CMDB** → **Software** → **Add Software**
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

3. Click **Save Asset**

### 4.2 SBOM Integration

Software assets support Software Bill of Materials (SBOM) for component-level visibility:

1. Open a software asset's detail page
2. Click **SBOM** tab
3. Click **Upload SBOM** or **Generate SBOM**
4. Supported formats: CycloneDX, SPDX
5. ControlWeave parses the SBOM and lists all components
6. Click **Scan for Vulnerabilities** to check components against CVE databases

---

## Step 5: Managing AI Agents

AI Agent assets have additional fields to support AI governance and the NIST AI RMF framework.

### 5.1 Add an AI Agent

1. Click **CMDB** → **AI Agents** → **Add AI Agent**
2. Fill in standard asset fields, plus:

**AI Governance Fields**:
- **AI Model Type**: Model architecture (e.g., `LLM`, `computer_vision`, `classification`)
- **AI Risk Level**: Risk classification (`low`, `medium`, `high`, `critical`)
- **AI Training Data Source**: Description of training data origin
- **Bias Testing Completed**: Whether bias testing has been performed
- **Bias Testing Date**: Date of last bias evaluation
- **Human Oversight Required**: Whether a human must review AI outputs
- **AI Transparency Score**: 0–100 score reflecting model explainability

3. Click **Save Asset**

### 5.2 AIBOM Support

AI Agents support AI Bill of Materials (AIBOM) to document model components, training data, and dependencies:

1. Open an AI Agent asset's detail page
2. Click **AIBOM** tab
3. Click **Upload AIBOM** or **Generate AIBOM**
4. Review model components, datasets, and third-party dependencies

> **💡 Tip**: Maintaining accurate AIBOMs is critical for compliance with the EU AI Act and NIST AI RMF. ControlWeave AI Analysis can generate compliance gap reports based on your AIBOM data.

---

## Step 6: Managing Service Accounts

### 6.1 Add a Service Account

Service accounts represent non-human identities such as API keys, CI/CD tokens, and database credentials.

1. Click **CMDB** → **Service Accounts** → **Add Service Account**
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

3. Click **Save Service Account**

### 6.2 Credential Rotation Tracking

ControlWeave tracks credential rotation schedules and alerts when rotation is overdue:

- **Green**: Rotation is current
- **Yellow**: Rotation due within 14 days
- **Red**: Rotation overdue

To record a rotation:

1. Open the service account
2. Click **Record Rotation**
3. Confirm the date credentials were rotated
4. The next rotation date is automatically calculated

---

## Step 7: Managing Password Vaults

Register your organization's password vaults to link service account credentials.

### 7.1 Add a Password Vault

1. Click **CMDB** → **Password Vaults** → **Add Vault**
2. Fill in the details:

**Fields**:
- **Name**: Display name (e.g., "HashiCorp Vault - Production")
- **Vault Type**: `hashicorp_vault`, `cyberark`, `aws_secrets_manager`, `azure_key_vault`, `1password`, `other`
- **Vault URL**: API endpoint or web URL
- **Description**: Notes about this vault's purpose

3. Click **Save Vault**

Once registered, vaults appear as options when creating service accounts.

---

## Step 8: Asset-Control Mapping

Link CMDB assets to compliance controls to demonstrate evidence coverage.

### 8.1 Manual Mapping

1. Navigate to **Controls**
2. Open a control (e.g., CM-8 System Component Inventory)
3. Click **Link Assets**
4. Search for and select relevant assets
5. Click **Save**

### 8.2 AI-Powered Mapping

ControlWeave AI can automatically suggest control-to-asset mappings:

1. Click **AI Analysis** → **Asset-Control Mapping**
2. Select the frameworks to analyze
3. Click **Generate Mappings**
4. Review AI suggestions
5. Accept or reject each mapping
6. Click **Apply Selected**

**Common Control-Asset Mappings**:
- **CM-8** (System Component Inventory) — All CMDB assets
- **AC-2** (Account Management) — Service accounts
- **IA-5** (Authenticator Management) — Service accounts + password vaults
- **CM-6** (Configuration Settings) — Hardware and software assets
- **SA-22** (Unsupported System Components) — Assets approaching end-of-life

---

## Step 9: Reporting & Analytics

### 9.1 Asset Inventory Reports

1. Click **Reports** → **Asset Inventory**
2. Select report type:
   - **Full Inventory**: Complete asset list with all fields
   - **By Environment**: Assets grouped by environment
   - **By Category**: Hardware, Software, AI Agents breakdown
   - **End-of-Life Report**: Assets approaching decommission
   - **Service Account Review**: Accounts with overdue reviews or rotations

3. Configure filters (environment, status, criticality)
4. Choose format: PDF, XLSX, CSV
5. Click **Generate Report**

### 9.2 Compliance Coverage View

See how CMDB assets contribute to compliance:

1. Click **Dashboard** → **Asset Coverage**
2. View: frameworks with and without asset-linked controls
3. Identify gaps where controls lack supporting asset evidence

---

## Step 10: AI-Assisted CMDB Operations

### 10.1 Shadow IT Detection

AI can detect assets that are active in your environment but not registered in the CMDB:

1. Click **AI Analysis** → **Shadow IT Detection**
2. AI compares network data and integration feeds against registered assets
3. Review unregistered assets
4. Add to CMDB or mark as reviewed

### 10.2 Ask AI Copilot

Use the AI Copilot for asset-related questions:

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
3. Link at least one asset to a relevant control
4. Register your password vault (if applicable)

**First Week**:
1. Import full hardware and software inventory
2. Register all service accounts with rotation schedules
3. Link assets to CMDB controls (CM-8, AC-2, IA-5)
4. Run an AI-powered asset-control mapping

**Ongoing**:
1. Monthly: Review service account rotation status
2. Quarterly: Audit asset list for decommissioned systems
3. On change: Update assets when infrastructure changes

---

## ✅ CMDB Setup Checklist

**Environments**:
- [ ] Production environment defined with data classifications
- [ ] All deployment environments registered
- [ ] Network zones and security levels set

**Assets**:
- [ ] Hardware inventory imported
- [ ] Software inventory imported
- [ ] AI Agents registered with governance fields completed
- [ ] Service accounts registered with rotation schedules

**Vaults & Credentials**:
- [ ] Password vaults registered
- [ ] Service accounts linked to vaults
- [ ] Rotation schedules reviewed

**Controls Integration**:
- [ ] CM-8 (System Component Inventory) linked to assets
- [ ] AC-2 (Account Management) linked to service accounts
- [ ] IA-5 (Authenticator Management) linked to service accounts

**Reporting**:
- [ ] Initial asset inventory report generated
- [ ] Asset coverage view reviewed

---

## 🚀 Next Steps

After setting up your CMDB:

1. **Track Vulnerabilities**: [Link vulnerabilities to assets](VULNERABILITIES.md)
2. **Manage SBOM/AIBOM**: Upload SBOMs/AIBOMs via the asset detail page → **SBOM** or **AIBOM** tab
3. **Map to Controls**: [Associate assets with security controls](CONTROLS.md)
4. **Generate Reports**: Navigate to **Reports** → **Asset Inventory** for CSV/PDF exports

---

## 📚 Additional Resources

- [NIST SP 800-128](https://csrc.nist.gov/publications/detail/sp/800-128/final) - Guide for Security-Focused Configuration Management
- [NIST AI RMF](https://www.nist.gov/system/files/documents/2023/01/26/AI%20RMF%201.0.pdf) - AI Risk Management Framework
- [CycloneDX SBOM Standard](https://cyclonedx.org/) - SBOM format specification
- [SPDX SBOM Standard](https://spdx.dev/) - Linux Foundation SBOM format

---

**Need Help?** Use the AI Copilot (purple button) or contact contehconsulting@gmail.com

> **💡 Pro Tip**: Start by registering environments and then add assets into those environments. This ensures all your assets have proper data classification context from day one, which directly improves your compliance control coverage metrics.
