# 🤖 Auto-Evidence Collection

Schedule automated evidence collection from integrated sources on a recurring basis.

## Source Categories

### 🛡️ SIEM & Security

- **Splunk** — Import search results from Splunk Enterprise or Splunk Cloud. Evidence: failed login reports, firewall deny logs, privileged access audits, correlation search results.
- **Microsoft Sentinel** — Collect security incidents, analytics rule matches, and hunting query results from Azure Sentinel. Evidence: security incidents, analytics rule matches, threat hunting results, watchlist alerts.
- **CrowdStrike Falcon** — Collect endpoint detection and response (EDR) data. Evidence: threat detections, endpoint compliance status, vulnerability assessments, device inventory snapshots.

### ☁️ Cloud Platforms

- **AWS CloudTrail** — Import API activity logs, resource change events, and governance evidence from AWS. Evidence: IAM policy changes, S3 bucket access logs, EC2 instance lifecycle events, root account activity.

### 🔧 DevOps & SCM

- **Jira** — Import issues, epics, and project tracking data. Evidence: change request tickets, risk register issues, remediation task status, sprint completion reports.
- **GitHub** — Import repository audit logs, PR review approvals, code scanning alerts, and Dependabot vulnerability data. Evidence: PR review approvals (code review evidence), Dependabot security alerts, CodeQL results (SAST evidence), repository audit log (access changes, branch protections).

### 🎫 IT Service Management

- **ITSM Platform** — Collect ITSM records including incidents, change requests, and configuration items. Evidence: incident records, change request approvals, CMDB configuration items, problem management records.

### 🔌 Custom

- **Custom Connector** — Use webhooks or API integrations to push evidence from any external source.

## Creating a Rule

1. Navigate to **Evidence** in the sidebar
2. Scroll to **Auto-Collection Rules**
3. Click **+ New Rule**
4. Configure:
   - **Name**: Descriptive rule name
   - **Source**: Select from SIEM, Cloud, DevOps, ITSM, or Custom category
   - **Schedule**: Manual, Daily, Weekly, or Monthly
   - **Source Config**: Fill in source-specific fields (queries, filters, repositories, etc.)
   - **Tags**: Add tags for organization
5. Click **Create Rule**

## How It Works

Evidence is collected as a JSON file containing the search/query results and metadata (rule name, timestamp, source, category). Files are stored in your evidence library and can be linked to controls. For scheduled rules, the next run is computed automatically after each collection.

## Requirements

- Auto-Evidence Collection requires Pro tier or higher
- Each source must be configured in **Settings → Integrations** before use
- Splunk requires base URL and API token
- Cloud sources (Sentinel, CloudTrail) require appropriate API credentials
- GitHub requires a personal access token with appropriate scopes
