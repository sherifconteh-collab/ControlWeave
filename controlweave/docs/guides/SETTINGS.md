# ⚙️ Settings & Configuration Guide

Complete guide to configuring ControlWeave for your organization.

## Accessing Settings

1. Click your **profile icon** (top-right corner)
2. Select **Settings** from the dropdown

Or navigate directly to `/dashboard/settings`.

---

## Settings Tabs Overview

The Settings page is organized into the following tabs:

| Tab | Description | Access |
|-----|-------------|--------|
| **Roles & Users** | Manage team members, roles, and permissions | Admins |
| **LLM Configuration** | Configure AI providers and API keys | Admins |
| **AI Activity** | Monitor AI usage and decisions | Admins |
| **Integrations** | Connect external tools (SIEM, Splunk, webhooks) | Admins |
| **Content Packs** | Import vendor-provided compliance content | Admins |
| **Audit Logs** | Review organization activity history | Admins |
| **Security** | Manage passkeys and security settings | All users with Settings access |
| **Notifications** | Configure alerts and email preferences | All users with Settings access |
| **Account** | Data export and account cancellation | Admins |
| **Platform Admin** | Platform-wide administration | Platform admins only |

At the top of the Settings page (above the tabs), all users with Settings access see a **Plan & Trial** banner showing the current tier and billing status. Admins also see **Subscription Details** and **Available Plans** for upgrading or switching plans.

---

## Billing & Plan Management

The top of the Settings page shows your organization's current plan and billing status before the tab navigation. Admins have additional controls for viewing subscription details and changing plans.

### Plan & Trial Banner

Every user sees a **Plan & Trial** card at the top of Settings showing:
- Your current tier (Community, Pro, Enterprise, or Gov Cloud)
- Billing status: shows your current billing state, such as **Community**, **Trial**, **Active**, **Canceling**, **Comped**, or similar

### Subscription Details (Admins Only)

Admins see a **Subscription Details** section with:
- Current tier and billing status
- Paid tier (if applicable)
- Trial end date (if in trial)
- Stripe subscription status and **Next Billing Date**
- Scheduled cancellation date (if cancellation is pending)
- **Manage Subscription on Stripe →** button to open the Stripe Customer Portal for invoice history, payment method changes, and billing address updates

> **Note**: If your organization has no active Stripe subscription yet (for example, you're on a free trial or your account was provisioned manually), a link to complete checkout is shown instead.

### Available Plans (Admins Only)

Admins see an **Available Plans** grid showing all available tiers with pricing and key features. You can toggle between **Monthly** and **Annual** pricing (annual billing offers a discount where available).

| Tier | Monthly | Annual |
|------|---------|--------|
| **Community** | $0/forever | $0/forever |
| **Pro** | $499/mo | $416/mo ($4,990/yr) |
| **Enterprise** | Custom ($3,500–$12,000/mo) | Custom |
| **Gov Cloud** | Custom | Custom |

Each plan card shows a button based on your current subscription state:

| Scenario | Button shown |
|----------|-------------|
| Already on that plan | "Your current plan" (no action) |
| Active Stripe subscription exists | **Switch to [Plan]** — changes plan immediately via Stripe |
| Stripe customer exists but no active subscription | **Subscribe to [Plan]** → redirects to Stripe Checkout |
| No Stripe account yet | **Upgrade to [Plan]** → redirects to Stripe Checkout |

For **Enterprise and Gov Cloud** licensing and custom contracts, contact **contehconsulting@gmail.com**.

To downgrade to the Community tier, use the **Account** tab (see [Account Cancellation](#account-cancellation) below).

### Upgrading Your Plan

**If you already have a Stripe subscription:**
1. Go to **Settings** and scroll to **Available Plans**
2. Select **Monthly** or **Annual**
3. Click **Switch to [Plan Name]** on the desired plan
4. The plan change takes effect immediately; upgrades are prorated and downgrades credit unused time

**If you are on the Community tier or have no Stripe subscription:**
1. Go to **Settings** and scroll to **Available Plans**
2. Click **Upgrade to [Plan Name]** or **Subscribe to [Plan Name]**
3. You will be redirected to Stripe Checkout to enter payment details
4. After successful payment, your tier is upgraded automatically

### Managing Your Subscription via Stripe Portal

Admins with an active Stripe subscription can access the Stripe Customer Portal to:
- View and download invoices
- Update payment methods
- Change billing address

1. Go to **Settings** → scroll to **Subscription Details**
2. Click **Manage Subscription on Stripe →**
3. Complete any changes in the Stripe portal
4. Click **Return to ControlWeave** to come back

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
| **Auditor** | External auditor portal access (Pro+) |

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

> **💡 Recommendation**: BYOK is ideal for Pro, Enterprise, and Gov Cloud users who want to use their own AI provider directly without routing through platform limits.

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

### SIEM Integration (Enterprise+)

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

> **Compliance Note**: Audit logs are retained per your tier's data retention policy and support AU-2 (Audit Events) control requirements.

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

### SSO / SAML (Pro+)

Pro, Enterprise, and Gov Cloud tier organizations can configure Single Sign-On:

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

> ⚠️ **Important**: Cancelling your account **downgrades your organization to the Community tier immediately**. It does **not** permanently delete your data — your data is retained for 30 days and you can reactivate by upgrading again.

**What happens when you cancel:**
- Organization is downgraded to the Community tier immediately
- Framework access is limited to 2 frameworks (Community tier limit)
- AI features remain available with reduced usage limits (10 requests/month)
- Active Stripe subscription is cancelled — no further charges
- Your data is retained for 30 days

**To cancel:**

1. Go to **Settings** → **Account**
2. Review the "What happens when you cancel" information
3. Click **Cancel Account**
4. In the confirmation dialog, enter the reason for cancelling (required)
5. Click **Confirm Cancellation**

After cancellation, your organization is immediately set to the Community tier. You can reactivate at any time by returning to **Settings** and upgrading your plan in the **Available Plans** section.

> **Note**: If you have an active Stripe subscription, it is cancelled immediately with no further charges. If you do not have a Stripe subscription, the downgrade to Community is applied without any payment interaction.

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
- Adjust tier settings
- Investigate issues

---

## Frequently Asked Questions

### Can I use multiple AI providers at once?

Yes. Configure multiple providers with their own API keys. You can set a default provider and switch per-session as needed.

### What happens when I hit my AI request limit?

You'll see an error when attempting an AI action. Options:
1. Wait until the 1st of next month for the limit to reset
2. Upgrade your tier
3. Add your own API key (BYOK) to bypass limits

### How do I remove a user without losing their history?

Use **Deactivate** instead of **Remove**. Deactivated users cannot log in but their audit trail, evidence uploads, and assessment completions are preserved.

### Where are my API keys stored?

API keys are stored encrypted at rest in the database. They are never logged or exposed in plain text after saving (only masked preview is shown).

### Can I export audit logs?

Yes. Go to Settings → Audit Logs → Export. Logs are available as CSV.

### How do I upgrade my plan?

Go to **Settings**, scroll to **Available Plans**, and click **Upgrade to [Plan]** or **Switch to [Plan]** on the desired tier. See [Billing & Plan Management](#billing--plan-management) for details.

### How do I cancel my subscription?

Go to **Settings** → **Account** → **Cancel Account**. This immediately downgrades your organization to the Community tier and cancels your Stripe subscription. Your data is retained for 30 days.

### Can I manage invoices or update my payment method?

Yes. Admins with an active Stripe subscription can click **Manage Subscription on Stripe →** in the Subscription Details section to access the Stripe Customer Portal for invoice downloads, payment method changes, and billing address updates.

---

## Related Guides

- [🤖 AI Copilot](AI_COPILOT.md) - Using the AI assistant
- [🔍 AI Analysis](AI_ANALYSIS.md) - Running AI-powered analyses
- [👥 User Management](ACCOUNT_SETUP.md) - Account and organization setup guide
- [🔐 Vulnerabilities](VULNERABILITIES.md) - Vulnerability management guide
- [🚀 Getting Started](GETTING_STARTED.md) - Initial platform setup
- [💳 Tier Comparison](../TIER_COMPARISON.md) - Detailed feature comparison across tiers
