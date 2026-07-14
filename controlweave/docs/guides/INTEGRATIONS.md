# 🔌 Integrations Guide

Connect ControlWeave to your existing security tools — SIEM platforms, vulnerability scanners, threat intelligence feeds, SSO providers, and more.

## Overview

ControlWeave's Integrations Hub lets you configure connectors to external systems and manage API keys and webhooks. Integrations are configured in **Settings** → **Integrations** and require `settings.manage` permission. ControlWeaver has no tier gating — every connector below is available to every authenticated user.

---

## Integration Categories

### SIEM / Log Aggregation

Forward compliance events and audit logs to your security operations platform.

| Connector | Credentials |
|-----------|-------------|
| **Splunk** | Base URL, API Token |
| **Elastic SIEM** | Connection URL, Auth Token |
| **Generic SIEM** | Endpoint URL, Auth Type |
| **Webhook** | Webhook URL |
| **Syslog** | Host, Port |

### Vulnerability Scanners

Import vulnerability scan results from external scanners.

| Connector | Credentials |
|-----------|-------------|
| **ACAS/Nessus** | Base URL, API Key |
| **Generic Scanner** | Endpoint URL |

### Software Supply Chain

Integrate with SBOM repositories.

| Connector | Credentials |
|-----------|-------------|
| **SBOM Repository** | Base URL |
| **STIG Content Source** | Source Path |

### Threat Intelligence

Connect to threat feed providers (also configurable in the Threat Intelligence module).

| Connector | Credentials |
|-----------|-------------|
| **NIST NVD** | Optional API Key |
| **CISA KEV** | None (public feed) |
| **MITRE ATT&CK** | None (public data) |
| **AlienVault OTX** | API Key required |

### Vendor Security Ratings

Pull security scores from third-party vendor rating platforms.

| Connector | Credentials |
|-----------|-------------|
| **SecurityScorecard** | API Key |
| **BitSight** | API Key |

### Single Sign-On (SSO)

Configure SSO for your organization.

- **SAML 2.0**
- **OpenID Connect (OIDC)**

---

## Configuring Connectors

### Step 1: Open Integrations Hub

1. Go to **Settings** → **Integrations**
2. Click **Integrations Hub** tab
3. You'll see all available connector templates

### Step 2: Add a Connector

1. Click **Add Connector** on the desired integration type
2. Enter:
   - **Connector Name** — your label for this connection (e.g., "Production Splunk")
   - **Connector Type** — automatically set from the template
   - **Auth Config** — credentials specific to the connector type (API keys, tokens, etc.)
   - **Connector Config** — connection-specific settings (URL, index, etc.)
   - **Status** — Active, Inactive, or Error
3. Click **Save**

### Step 3: Test the Connection

After saving:
1. Click **Test** on the connector card
2. ControlWeave sends a test request
3. Status updates to **Active** on success or **Error** on failure

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

## SSO / SAML Configuration

SSO allows your organization's users to log in via your identity provider (IdP).

### Supported SSO Flows

- **SAML 2.0** — for enterprise IdPs (Okta, Azure AD, OneLogin, etc.)
- **OIDC / OAuth 2.0** — for cloud-native identity providers

### Configuring SSO

1. Go to **Settings** → **Security** → **SSO**
2. Click **Configure SSO**
3. Select **Provider Type** (SAML or OIDC)
4. Enter the **Discovery URL** or **Metadata URL** from your IdP
5. Enter the **Client ID** and any additional configuration
6. Set **Default Role** — the role assigned to new users provisioned via SSO
7. Enable **Auto Provision** — automatically create accounts for SSO users
8. Click **Save**

### SSO Callback URL

Provide this URL to your IdP as the Assertion Consumer Service (ACS) URL:
```
https://your-backend-url/api/v1/sso/callback/<provider>
```

> **💡 Tip**: SSO configuration changes are logged in the audit trail for compliance purposes.

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
