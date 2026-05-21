# 📊 Splunk Integration Guide

Connect ControlWeave to Splunk for SIEM-powered compliance evidence and security event correlation.

> **Note**: Splunk integration is available on the **Pro tier and above**.

## Overview

The ControlWeave–Splunk integration enables:
- Automatic import of Splunk search results as compliance evidence
- Real-time security event forwarding to your Splunk SIEM
- Correlation of compliance posture with security events
- Automated evidence collection for audit and logging controls

## Prerequisites

- ControlWeave Pro subscription (or higher)
- Splunk Enterprise 8.x+ or Splunk Cloud
- Splunk HTTP Event Collector (HEC) enabled
- Network connectivity between ControlWeave and Splunk

## Setup

### Step 1: Configure Splunk HEC Token

In your Splunk instance:
1. Go to **Settings** → **Data Inputs** → **HTTP Event Collector**
2. Click **New Token**
3. Name: `ControlWeave`
4. Set Source Type: `_json`
5. Enable the token and copy the token value

### Step 2: Configure in ControlWeave

1. Go to **Settings** → **Integrations** → **Splunk**
2. Enter your Splunk HEC URL: `https://your-splunk-host:8088`
3. Paste the HEC token
4. Select the Splunk index to use (default: `main`)
5. Click **Test Connection**
6. Click **Save**

## Evidence Collection from Splunk

Automatically import Splunk search results as compliance evidence:

1. Go to **Integrations** → **Splunk** → **Evidence Collection**
2. Click **New Evidence Rule**
3. Configure:
   - **Name**: Descriptive name (e.g., "Quarterly Failed Login Report")
   - **Splunk Query**: Your SPL search query
   - **Schedule**: How often to run
   - **Target Controls**: Which controls this evidence satisfies
4. Click **Save and Test**

**Example SPL queries for compliance evidence:**

```spl
# Failed login attempts (for AU-2, AC-7)
index=security sourcetype=WinEventLog EventCode=4625
| stats count by user, src_ip
| where count > 5

# Privileged access usage (for AC-6, AU-9)
index=security sourcetype=WinEventLog EventCode=4672
| stats count by user, ComputerName
```

## Event Forwarding to Splunk

ControlWeave forwards the following events to Splunk:
- Compliance score changes
- Failed control assessments
- New vulnerability discoveries
- POA&M status updates
- User login and access events

## Splunk Dashboard App

Import the ControlWeave Splunk app for pre-built dashboards:
1. Download the ControlWeave Splunk App from the ControlWeave portal
2. Install in Splunk: **Apps** → **Install app from file**
3. Configure the app to connect to your ControlWeave API

## AI Evidence Suggestions via Splunk

Once Splunk is connected, the AI can scan your Splunk data and suggest evidence items. On the **Evidence** page, click **🔍 Scan Integrations** in the AI Evidence Suggestions section. The AI:

1. Runs predefined audit/security log queries against your Splunk instance
2. Pulls recent data from any enabled auto-collection rules
3. Analyzes the data against your active compliance frameworks
4. Maps results to specific controls and creates pending evidence items

Review and approve each suggestion before it enters your official evidence library. See the [Evidence Management guide](../guides/EVIDENCE.md#ai-evidence-suggestions) for step-by-step instructions.

## Related Guides

- [Integrations](../guides/INTEGRATIONS.md) - All integration options
- [Evidence Management](../guides/EVIDENCE.md) - Managing evidence and AI evidence suggestions
- [AI Analysis](../guides/AI_ANALYSIS.md) - AI features and token-efficient architecture
- [Security Posture](../guides/SECURITY_POSTURE.md) - SIEM integration overview
- [API Documentation](API_DOCS.md) - Pending Evidence API endpoints
