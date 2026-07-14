# ⚙️ Settings & Configuration Guide

Complete guide to configuring ControlWeave for your organization.

## Accessing Settings

1. Click your **profile icon** (top-right corner)
2. Select **Settings** from the dropdown

Or navigate directly to `/dashboard/settings`.

---

## Settings Tabs Overview

The Settings page is organized into the following tabs (shown left to right, subject to your permissions):

| Tab | Description | Access |
|-----|-------------|--------|
| **Roles & Permissions** | Manage team members, roles, and permissions | Users who can manage roles |
| **LLM Configuration** | Configure AI providers and API keys | Users who can manage settings |
| **AI Activity & Decisions** | Monitor AI usage and decisions | Users who can manage settings |
| **Automation** | Configure auto-crosswalk and other automation | Users who can manage settings |
| **Integrations** | Connect external tools (SIEM, Splunk, webhooks) | Users who can use integrations |
| **Content Packs** | Import vendor-provided compliance content | Users who can manage settings |
| **Audit Logs** | Review organization activity history | Users who can manage settings |
| **Platform Ops** | Platform-wide administration | Platform admins only |
| **Security** | Manage passkeys and security settings | All users with Settings access |
| **Notifications** | Configure alerts and email preferences | All users with Settings access |
| **Account** | Data export and account cancellation | Users who can manage settings |

At the top of the Settings page (above the tabs), all users see an **Open Source** notice confirming ControlWeaver is open source (AGPL v3) and that all features are available to all authenticated users — no subscription required.

---

## Open Source — No Billing or Plan Management

ControlWeaver removed all tier gating and billing/Stripe infrastructure. Every feature described in this guide is available to every authenticated user; there is no Plan & Trial banner, no Subscription Details panel, no Available Plans grid, and no Stripe Checkout or Customer Portal flow. The Settings page shows a simple **Open Source** notice above the tab navigation instead.

---

## Roles & Users

### Viewing Team Members

1. Go to **Settings** → **Roles & Users**
2. View all current users, their roles, and status
3. See pending invitations in the **Pending Invites** section

![Users list showing email, name, role, and status for each team member](../screenshots/settings-users-list-01.png)
*Figure 1: Team members list*

### Inviting a New User

1. Click **Invite User**
2. Enter the user's **Email** and **Full Name**
3. Select a **Role**:

| Role | Description |
|------|-------------|
| **Admin** | Full system access including settings management |
| **Manager** | Can manage controls, assessments, and evidence |
| **Analyst** | Can view and update control status |
| **Viewer** | Read-only access |
| **Auditor** | External auditor portal access |

4. Click **Send Invitation**
5. User receives email invitation to create their account

![Invite user form showing email, name, and role selection fields](../screenshots/users-invite-form-01.png)
*Figure 2: Invite user form*

### Managing Roles

Admins can create custom roles with specific permissions:

1. Click **Manage Roles**
2. Click **Create Role** or edit an existing one
3. Set role **Name** and **Description**
4. Select **Permissions** from the permission groups:
   - Dashboard, Frameworks, Controls, Evidence
   - Assessments, Reports, Assets, Vulnerabilities
   - Settings, Users, AI features, Audit logs

5. Click **Save Role**

**Recommended Role Templates:**

| Template | Best For |
|----------|---------|
| 🔒 Security Analyst | Monitors controls and reviews evidence |
| 📋 Compliance Manager | Full compliance oversight, no settings access |
| 📎 Evidence Collector | Uploads evidence only |
| 👁️ Executive Viewer | Read-only dashboard and reports |

Click **Use Template** on any recommended role to pre-populate permissions.

### Removing a User

1. Find the user in the list
2. Click the **⋮** (more) menu next to their name
3. Select **Deactivate** or **Remove**

> ⚠️ **Note**: Deactivating preserves audit history. Removing is permanent.

---

## LLM Configuration

Configure AI providers to power the AI Copilot and AI Analysis features.

### Supported Providers

| Provider | Free Tier | Best For | Where to Get Key |
|----------|-----------|---------|-----------------|
| **Google Gemini** | ✅ Yes | Getting started | aistudio.google.com |
| **Groq** | ✅ Yes | Speed | console.groq.com |
| **Ollama** | ✅ (self-hosted) | Privacy | Install locally |
| **Anthropic Claude** | ❌ Paid | Deep analysis | console.anthropic.com |
| **OpenAI GPT** | ❌ Paid | General purpose | platform.openai.com |
| **xAI Grok** | ❌ Paid | Latest reasoning | console.x.ai |

### Adding an API Key

1. Go to **Settings** → **LLM Configuration**

![LLM Configuration page showing provider selection and API key entry fields](../screenshots/settings-llm-config-01.png)
*Figure 3: LLM Configuration page*

2. Select your **Provider** from the dropdown

![Provider selection dropdown showing all available AI providers](../screenshots/llm-provider-select-01.png)
*Figure 4: Select AI provider*

3. Enter your **API Key** in the key field

![API key entry field with masked display and show/hide toggle](../screenshots/llm-api-key-entry-01.png)
*Figure 5: API key entry*

4. Click **Test Connection** to verify the key works
5. Select your **Default Model** from the available models for that provider

| Provider | Available Models |
|----------|----------------|
| Anthropic Claude | claude-opus-4-7, claude-sonnet-4-6, claude-sonnet-4-5-20250929, claude-haiku-4-5-20251001 |
| OpenAI | gpt-4.1, gpt-4.1-mini, gpt-4o, gpt-4o-mini, o3, o4-mini |
| Google Gemini | gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash, gemini-2.0-flash-lite |
| Groq | llama-3.3-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768, gemma2-9b-it, deepseek-r1-distill-llama-70b |
| xAI Grok | grok-4-latest, grok-3-latest |
| Ollama | llama3.2, llama3.1:8b-q4_K_M, mistral:7b-q4_K_M, qwen2.5:14b-q4_K_M (or any locally installed model) |

6. Set as **Default Provider** if desired
7. Click **Save**

### Using Multiple Providers

You can configure multiple providers simultaneously:
- Each provider with its own API key
- Switch between providers per session
- Set a default for automatic selection

### BYOK (Bring Your Own Key)

When you use your own API key (BYOK):
- ✅ No AI request limits (bypass monthly caps)
- ✅ You control costs directly with the provider
- ✅ Data goes directly to your provider (not stored by ControlWeave)
- ✅ Subject to your provider's privacy policy

> **💡 Recommendation**: BYOK is ideal for anyone who wants to use their own AI provider directly and control costs at the provider level.

### Ollama (Self-Hosted)

For maximum privacy, run AI locally:

1. [Install Ollama](https://ollama.ai) on your server
2. Pull a model: `ollama pull llama3.1:8b-q4_K_M` (quantized for efficiency)
3. In Settings → LLM Configuration, select **Ollama**
4. Enter your Ollama server URL (e.g., `http://localhost:11434`)
5. Enter the model name you pulled
6. Click **Save**

Benefits:
- No API costs
- No data leaves your network
- Full control over models
- Quantized (`q4_K_M`) models use ~50% less RAM with minimal accuracy tradeoff

> 💡 **Tip**: Use quantized GGUF models (e.g., `llama3.1:8b-q4_K_M`) to run larger, more capable models on standard hardware. A quantized 70B model can run on a 24GB GPU — hardware that would otherwise only support an 8B full-precision model. See the [Model Quantization Guide](../guides/MODEL_QUANTIZATION.md) for details.

### Auto-Crosswalk Configuration

The **Automation** tab contains the **Auto-Crosswalk Configuration** section:

| Setting | Description | Default |
|---------|-------------|---------|
| **Similarity Threshold** | Minimum semantic similarity score (50–100%) required before a crosswalk mapping is applied automatically | 90% |

**Adjusting the threshold:**

1. Go to **Settings** → **Automation**
2. Open **Auto-Crosswalk Configuration**
3. Drag the **Similarity Threshold** slider (50–100%, step 5%)
4. Click **Save** — the new value is persisted and takes effect immediately for all future crosswalk operations

**Choosing a value:**
- **Higher (85–100%)**: Fewer false-positive auto-satisfactions, stricter matching — recommended for organizations with distinct framework implementations
- **Lower (50–70%)**: More aggressive auto-satisfaction, broadens coverage — useful when frameworks share significant conceptual overlap (e.g., NIST 800-53 + ISO 27001)

> **💡 Note**: After marking a control "implemented" or "verified", a confirmation banner will appear reading "🗺️ Auto-Crosswalk fired — N related controls auto-satisfied above the configured similarity threshold". The exact threshold value is not hardcoded in the UI — it reflects whatever you set here.

---

## AI Activity

Monitor how AI is being used across your organization.

### Viewing AI Usage

1. Go to **Settings** → **AI Activity**
2. See a log of all AI requests:
   - Timestamp
   - Feature used (gap analysis, chat, etc.)
   - Provider and model
   - User who triggered it
   - Token usage and cost estimate

![AI Activity log showing recent AI requests with feature type, user, and usage data](../screenshots/settings-ai-activity-01.png)
*Figure 6: AI Activity log*

### AI Decisions Log

The AI Decisions section shows AI recommendations that were acted upon:
- Which controls were flagged by AI
- Which recommendations were accepted vs ignored
- Audit trail for AI-assisted decisions

This log supports compliance requirements for AI oversight and explainability (e.g., NIST AI RMF, EU AI Act).

### Usage Statistics

View your monthly AI consumption:
- Requests used vs limit
- Breakdown by feature
- Usage trend over time

---

## Integrations

Connect ControlWeave with external security and compliance tools.

### SIEM Integration

Connect to your Security Information and Event Management (SIEM) platform:

1. Go to **Settings** → **Integrations**
2. Click **Add SIEM Integration**
3. Select your SIEM type (Splunk, others)
4. Enter connection details:
   - **Base URL**: Your SIEM server URL
   - **API Token**: Authentication token
   - **Default Index**: Log index to use
5. Click **Test Connection**
6. Click **Save**

**Splunk Configuration:**

| Field | Description | Example |
|-------|-------------|---------|
| Base URL | Splunk server URL | `https://splunk.company.com:8089` |
| HEC Token | HTTP Event Collector token | `abc123-def456-...` |
| Default Index | Splunk index for events | `controlweave` |

### Webhooks

Configure webhook notifications for external systems:

1. Click **Add Webhook**
2. Enter the **Endpoint URL** (your receiving server)
3. Select **Events** to trigger the webhook:
   - Control status changes
   - Assessment completions
   - Evidence uploads
   - POA&M updates
   - Vulnerability status changes
4. Click **Save**

Webhooks send JSON payloads to your endpoint for each selected event.

### API Keys

Generate API keys for programmatic access:

1. Click **API Keys** section
2. Click **Generate New Key**
3. Set a **Name** and **Expiry** (optional)
4. Copy the key (shown only once)
5. Use in API requests: `Authorization: Bearer <key>`

See the API Documentation (available in the platform under Settings → Integrations → API Keys) for endpoint reference.

---

## Content Packs

Import vendor-provided compliance content packs (control descriptions, assessment procedures, etc.).

### What Are Content Packs?

Content packs are standardized bundles of:
- Control descriptions from official framework documents
- Assessment procedures aligned to framework requirements
- Pre-built policy templates

### Importing a Content Pack

1. Go to **Settings** → **Content Packs**
2. Click **Import Content Pack**
3. Upload the content pack file (provided by your vendor or ControlWeave)
4. Review the **Parse Summary**:
   - Matched controls
   - Unmatched controls (review required)
   - Warnings
5. If `review_required` is flagged, approve or reject the pack
6. Click **Confirm Import**

> ⚠️ **Note**: Content packs that modify existing controls require attestation and admin approval before activation.

---

## Audit Logs

Review a complete history of actions taken in your organization.

### Viewing Logs

1. Go to **Settings** → **Audit Logs**
2. Logs show:
   - **Timestamp**: When the action occurred
   - **User**: Who performed the action
   - **Action**: What was done (create, update, delete, login, etc.)
   - **Resource**: What was affected (control, evidence, user, etc.)
   - **Details**: Additional context

![Audit log table showing timestamped actions by user and resource type](../screenshots/settings-audit-log-01.png)
*Figure 7: Audit logs*

### Filtering Logs

- Filter by **Date Range**
- Filter by **User**
- Filter by **Action Type**
- Filter by **Resource Type**

### Exporting Logs

Click **Export** to download logs as CSV for external audit tools.

> **Compliance Note**: Audit logs support AU-2 (Audit Events) control requirements. Retention is not tier-dependent — there is no tier gating in ControlWeaver.

---

## Security

Manage authentication and security settings for your account.

### Passkeys (Passwordless Login)

ControlWeave supports passkeys (WebAuthn) for secure, password-free authentication.

**Add a Passkey:**
1. Go to **Settings** → **Security**
2. Click **Register Passkey**
3. Follow your browser/device prompt (Face ID, Touch ID, security key, etc.)
4. Name your passkey (e.g., "MacBook Touch ID")
5. Click **Save**

**Managing Passkeys:**
- View all registered passkeys
- Remove passkeys you no longer use
- Add multiple passkeys for different devices

**Supported authenticators:**
- Platform authenticators: Touch ID, Face ID, Windows Hello
- Roaming authenticators: YubiKey, hardware security keys

### SSO / SAML

Any organization can configure Single Sign-On:

1. Go to **Settings** → **Security** → **SSO Configuration**
2. Enter your IdP details:
   - **IdP Entity ID**
   - **IdP SSO URL**
   - **IdP Certificate**
3. Download the **ControlWeave SP Metadata**
4. Configure your IdP with the SP metadata
5. Test and enable SSO

Contact your ControlWeave administrator or support for detailed SSO setup instructions specific to your identity provider.

### Changing Your Password

Password changes are handled through the password reset flow:

1. Go to the ControlWeave **sign-in** page
2. Click **Forgot your password?**
3. Enter the email address associated with your account
4. Open the password reset email and click the link
5. Set and confirm your new password, then submit

> **Note**: If your organization uses SSO/SAML, your password is managed by your identity provider (e.g., Okta, Azure AD, Google Workspace). Change your password through your IdP, not in ControlWeave.

---

## Notifications

Configure when and how you receive alerts from ControlWeave.

### Notification Channels

- **Email**: Sent to your registered email address
- **In-App**: Notification bell in the top navigation
- **Webhooks**: Sent to configured webhook endpoints (see Integrations)

### Notification Preferences

1. Go to **Settings** → **Notifications**
2. Toggle notifications on/off for each event type:

| Event | Description |
|-------|-------------|
| Assessment Due | Assessment approaching due date |
| Control Overdue | Control past implementation deadline |
| Evidence Expiring | Evidence older than 90 days |
| New Assignment | Control or task assigned to you |
| POA&M Update | Plan of Action & Milestones status change |
| Audit Finding | New finding added to an engagement |
| AI Analysis Complete | AI report ready to view |
| User Invited | New team member invited |
| Vulnerability Alert | New or updated vulnerability |

3. Set **Notification Frequency** (Immediate / Daily Digest / Weekly Summary)
4. Click **Save Preferences**

---

## Account

Manage data export and account cancellation.

### Data Export

Export a complete JSON archive of your organization's data:

1. Go to **Settings** → **Account**
2. Click **Download Data Export (JSON)**
3. The file downloads immediately — it includes:
   - Organization profile
   - Activated frameworks
   - Controls and implementation status
   - Assets (CMDB)
   - Users
   - Audit logs

> **Tip**: Export your data before cancelling your account. Data is retained for 30 days after cancellation.

### Account Cancellation

> ⚠️ **Important**: Cancelling your account does **not** permanently delete your data — your data is retained for 30 days. It also does **not** reduce which features you can use: ControlWeaver has no tier gating, so every feature stays available to every authenticated user regardless of this setting.

**What happens when you cancel:**
- The organization record is marked cancelled internally (a legacy `tier`/`billing_status` field is set for historical bookkeping — this has no effect on which features or frameworks you can use)
- If the organization has an active Stripe subscription attached, it is cancelled — no further charges
- Your data is retained for 30 days
- A cancellation record and audit log entry are created with the reason you provide

**To cancel:**

1. Go to **Settings** → **Account**
2. Review the "What happens when you cancel" information
3. Click **Cancel Account**
4. In the confirmation dialog, enter the reason for cancelling (required)
5. Click **Confirm Cancellation**

There is no self-service reactivation flow — cancellation does not affect feature access, so there is nothing to "upgrade" back to. Contact your administrator if you need the cancellation record cleared.

---

## Platform Admin (Platform Admins Only)

Platform-level administration for ControlWeave operators.

### Platform Overview

View aggregate metrics across all organizations:
- Total users and active users
- Events in the last 24 hours
- Open vulnerabilities across platform
- Job queue status (queued / running / completed / failed)
- Webhook delivery status
- Recent failures

### Managing Organizations

Platform admins can:
- View all organizations
- Investigate issues

---

## Frequently Asked Questions

### Can I use multiple AI providers at once?

Yes. Configure multiple providers with their own API keys. You can set a default provider and switch per-session as needed.

### Is there a monthly AI request limit?

No. ControlWeaver has no tier gating, so there is no monthly AI request cap. If you see an AI error, it's from the underlying provider (rate limit, quota, or a misconfigured API key) — check **Settings** → **LLM Configuration**, or use BYOK to control your own provider quota directly.

### How do I remove a user without losing their history?

Use **Deactivate** instead of **Remove**. Deactivated users cannot log in but their audit trail, evidence uploads, and assessment completions are preserved.

### Where are my API keys stored?

API keys are stored encrypted at rest in the database. They are never logged or exposed in plain text after saving (only masked preview is shown).

### Can I export audit logs?

Yes. Go to Settings → Audit Logs → Export. Logs are available as CSV.

### Do I need to upgrade a plan to unlock features?

No. ControlWeaver has no tier gating or paid plans — every feature described in this guide is available to every authenticated user. There is no Available Plans grid or Stripe Checkout flow.

### How do I cancel my account?

Go to **Settings** → **Account** → **Cancel Account**. This cancels any active Stripe subscription (if one exists) and retains your data for 30 days. See [Account Cancellation](#account-cancellation) for details — cancelling does not change which features you can use.

### Can I manage invoices or update a payment method?

Not from the Settings page — there is no billing/invoice management UI. If your organization has a legacy Stripe subscription from before tier gating was removed, cancelling your account (**Settings** → **Account** → **Cancel Account**) will cancel that subscription so no further charges apply.

---

## Related Guides

- [🤖 AI Copilot](AI_COPILOT.md) - Using the AI assistant
- [🔍 AI Analysis](AI_ANALYSIS.md) - Running AI-powered analyses
- [👥 User Management](ACCOUNT_SETUP.md) - Account and organization setup guide
- [🔐 Vulnerabilities](VULNERABILITIES.md) - Vulnerability management guide
- [🚀 Getting Started](GETTING_STARTED.md) - Initial platform setup
- [💳 Tier Comparison](../TIER_COMPARISON.md) - Why there's no tier comparison anymore (open source, no gating)
