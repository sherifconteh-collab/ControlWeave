# 🔌 Integrations Guide

Connect ControlWeave to your existing security tools — SIEM platforms, vulnerability scanners, threat intelligence feeds, SSO providers, and more.

## Overview

ControlWeave's Integrations Hub lets you configure connectors to external systems and manage API keys and webhooks. Integrations are configured on the **Integrations** page and require `settings.manage` permission. ControlWeaver has no tier gating — every connector below is available to every authenticated user.

---

## Connectors that sync

These connectors call the external system when you click **Sync now**. Everything a run records (counts, findings, metrics) comes from that system; nothing is simulated. Each successful sync of an identity or ticketing connector also saves a JSON snapshot as **evidence**, hashed with SHA-256 and linked to the controls it supports in the frameworks your organization has selected.

| Connector | What it checks | Credentials | Evidence for |
|-----------|----------------|-------------|--------------|
| **Okta** | Active users, enrolled MFA factors, administrator role assignments, accounts with no sign-in for 90 days (configurable) | Okta domain, API token from a Read-Only Administrator | NIST 800-53 AC-2, AC-2(3), IA-2, IA-2(1), IA-2(2); 800-171 03.01.01, 03.05.03; CMMC AC.L2-3.1.1, IA.L2-3.5.3; SOC 2 CC6.1-CC6.3; ISO 27001 A.5.16, A.5.18, A.8.5; HIPAA 164.312(d), 164.312(a)(2)(i), 164.308(a)(3)(ii)(C), 164.308(a)(4)(ii)(C) |
| **Microsoft Entra ID** | Users, MFA registration, administrators, sign-in inactivity (Microsoft Graph) | Tenant ID, client ID, client secret of an app registration with the User.Read.All and AuditLog.Read.All application permissions (sign-in activity needs Entra ID P1/P2) | Same as Okta |
| **Jira** (Cloud or Data Center) | Remediation tickets matching a JQL filter: open, overdue, resolved in the last 30 days, mean days to resolve. Also opens tickets from POA&M items and refreshes their status on every sync | Base URL, project key, and either account email + API token (Cloud) or a personal access token (Data Center) | NIST 800-53 SI-2, CA-5, PM-4, RA-5; 800-171 03.14.01; CMMC SI.L2-3.14.1, CA.L2-3.12.2; SOC 2 CC7.4; ISO 27001 A.8.8, A.5.26; HIPAA 164.308(a)(1)(ii)(B) |
| **AWS Security Hub** | Security Hub findings by severity | Region, access key ID, secret access key (optional role ARN) | - |
| **Qualys VMDR** | Vulnerability detections by severity | Base URL, username, password | - |
| **ITSM / Change Management** | Incident and change records | Instance URL, username, password | - |

The default Jira filter is the project's issues labeled `security`, `poam` or `controlweave`; set **JQL filter** to use your own.

## Connectors with sync coming soon

Splunk (evidence pull and forwarding are configured separately, see below), ACAS/Nessus, SBOM Repository, STIG Content Source, Generic SIEM, Generic Scanner, NIST NVD, CISA KEV, MITRE ATT&CK, AlienVault OTX, SecurityScorecard and BitSight can be saved so their settings are ready, but **Sync now** is disabled and the card is labeled "Sync coming soon". Threat intelligence feeds and vendor ratings are also available in the Threat Intelligence and Vendor Risk modules.

---

## Configuring connectors

1. Go to **Integrations** (sidebar). Requires `settings.manage`.
2. On **Available connectors**, click **Configure** on a connector.
3. Enter a name and the settings. Fields marked * are required. Secrets (tokens, passwords, client secrets) are encrypted at rest with AES-256-GCM and are never returned by the API or shown again. When editing, leave a secret blank to keep the stored value.
4. Click **Save**, then **Sync now** on the **Installed** tab. The card shows the last successful sync and the key metrics from the last run, or the error if it failed.

Connector URLs must use https and must not point to private or internal network addresses (for example the cloud metadata service). The address is checked when each connection is made, so a name that later re-resolves to a private address (DNS rebinding) is refused too. The same rule applies to the ITSM, Qualys and Splunk connectors and to an organization's Ollama URL. Self-hosted installations that connect to intranet systems such as Jira Data Center can set `CONNECTOR_ALLOW_PRIVATE_HOSTS=true`. A connector that cannot reach its service, or gets an error or a response it cannot read, reports the sync as failed; it never records an empty result as a clean one. Each request times out after 20 seconds (`CONNECTOR_HTTP_TIMEOUT_MS`), and only one sync per connector runs at a time.

### POA&M tickets in Jira

On a POA&M item, **Create Jira ticket** opens a ticket in the Jira connector's project. The title, description, control, remediation plan, priority and due date are copied, and the ticket is labeled `controlweave` and `poam`. The ticket key and link appear on the POA&M item and in the POA&M list. The ticket's status is refreshed each time the Jira connector syncs.

---

## Splunk Integration

Splunk is the most common integration for forwarding compliance events.

### Configuring Splunk

1. Go to **Settings** → **Integrations** → **Splunk**
2. Enter:
   - **Base URL** — your Splunk HEC endpoint (e.g., `https://splunk.example.com:8088`)
   - **API Token** — your Splunk HEC token
   - **Default Index** — the Splunk index to write events to
3. Click **Save**
4. Click **Test Connection** to verify

### What Gets Forwarded

All audit log events are forwarded to Splunk as structured JSON events, including:
- Event type and timestamp
- User who performed the action
- Resource type and ID
- Success/failure status
- Event-specific details

### Evidence Pull from Splunk

With Splunk configured, you can query Splunk for evidence directly from within ControlWeave:
1. Go to any control's detail page
2. Click **Pull Evidence from Splunk**
3. Enter your search query
4. Results are downloaded and stored as evidence

### AI Evidence Suggestions (via Splunk)

Once Splunk is connected, ControlWeave's AI can automatically scan your Splunk data and suggest evidence items mapped to your framework controls. Go to the **Evidence** page and click **🔍 Scan Integrations** in the AI Evidence Suggestions section. The AI analyzes recent audit logs, authentication events, and any data from your auto-collection rules, then creates pending evidence items for your review. See [Evidence Management → AI Evidence Suggestions](EVIDENCE.md#ai-evidence-suggestions) for the full workflow.

---

## SSO / SAML and SCIM

Single sign-on (SAML 2.0 or OpenID Connect) and automatic user provisioning (SCIM 2.0) are configured under **Settings → Security**. See `ENTERPRISE_SSO.md` for step-by-step setup with Okta and Microsoft Entra ID.

---

## API Keys

Generate API keys to allow external systems to access the ControlWeave API.

1. Go to **Settings** → **API Keys**
2. Click **Generate API Key**
3. Name the key and set permissions
4. Copy the key immediately — it is only shown once
5. Use the key in the `Authorization: Bearer <key>` header

---

## Webhooks

Configure outgoing webhooks to notify external systems of ControlWeave events.

1. Go to **Settings** → **Webhooks**
2. Click **Add Webhook**
3. Enter:
   - **Name** — descriptive label
   - **URL** — HTTPS endpoint to receive events
   - **Events** — select which event types to send
   - **Secret** — optional HMAC signing secret for payload verification
4. Click **Save**

The URL must use HTTPS and must resolve to a public address. The check runs when each delivery connects, so a name that points (or is re-pointed) at a private or internal address is refused, and redirects are not followed. Self-hosted installations that deliver to intranet receivers set `WEBHOOK_ALLOW_PRIVATE_HOSTS=true` (and `WEBHOOK_ALLOW_HTTP=true` for plain HTTP).

### Webhook Delivery Status

Monitor webhook delivery health in **Settings** → **Operations**:
- Pending, Delivered, and Failed delivery counts
- Retry automatically on failure

---

ControlWeaver has no tier gating — the Integrations Hub, Splunk integration, AI Evidence Suggestions, SIEM (Elastic/Syslog), SSO/SAML, webhooks, and API keys are all available to every authenticated user.

---

## Related Features

- [Evidence Management](EVIDENCE.md) — Upload, organize, and AI-suggest evidence
- [AI Analysis Guide](AI_ANALYSIS.md) — AI features including evidence suggestions and token-efficient architecture
- [Security Posture Guide](SECURITY_POSTURE.md) — SIEM event forwarding
- [Threat Intelligence Guide](THREAT_INTELLIGENCE.md) — Threat feed integrations
- [Settings Guide](SETTINGS.md) — Other configuration options
- [Vendor Risk Guide](VENDOR_RISK.md) — SecurityScorecard/BitSight integration
