# 👤 Account Setup Guide

This guide covers setting up your ControlWeave account, configuring your organization profile, and personalizing your settings for optimal use.

## ⏱️ Time Commitment
- **Quick Setup**: 5 minutes
- **Full Configuration**: 15-20 minutes

## 📋 Prerequisites
- Completed account registration
- Access to ControlWeave platform

---

## Step 1: Access Your Profile Settings

### 1.1 Navigate to Settings
1. Click your profile icon (top-right corner)
2. Select **Settings**

![Profile dropdown menu with Settings option highlighted](../screenshots/settings-menu-01.png)
*Figure 1.1: Access Settings from your profile menu*

---

## Step 2: Configure Organization Profile

### 2.1 Organization Information
Navigate to **Organization Settings** tab:

![Organization Settings page showing org details form](../screenshots/organization-settings-01.png)
*Figure 2.1: Organization Settings - Configure your organization profile*

**Required Fields**:
- **Organization Name**: Already set during registration (can be updated)
- **Industry**: Select your industry vertical
- **Size**: Number of employees

**Optional Fields**:
- **Description**: Brief description of your organization
- **Website**: Company website URL
- **Primary Contact**: Main compliance contact
- **Address**: Physical business address
- **Phone**: Primary contact phone number

Click **Save Organization Settings**

### 2.2 Industry Selection
Choose the industry that best describes your organization:
- Healthcare
- Financial Services
- Government/Public Sector
- Technology/Software
- Manufacturing
- Education
- Retail/E-commerce
- Professional Services
- Non-profit
- Other

> **💡 Tip**: Your industry selection helps ControlWeave recommend relevant compliance frameworks.

### 2.3 Organization Size
Select your organization size:
- **1-10 employees**: Small business
- **11-50 employees**: Small to medium
- **51-200 employees**: Medium business
- **201-1000 employees**: Large business
- **1000+ employees**: Enterprise

---

## Step 3: Data Sensitivity Profile

### 3.1 Configure Data Classification
Under **Data Classification**:

1. Select which data types your organization handles:
   - ☐ **PII** (Personally Identifiable Information)
   - ☐ **PHI** (Protected Health Information)
   - ☐ **PCI** (Payment Card Information)
   - ☐ **CUI** (Controlled Unclassified Information)
   - ☐ **FCI** (Federal Contract Information)
   - ☐ **Export-Controlled Data**
   - ☐ **Proprietary Business Data**
   - ☐ **Financial Data**
   - ☐ **Biometric Data**
   - ☐ **AI Training Data**

![Data classification checkboxes showing various data types](../screenshots/data-classification-01.png)
*Figure 3.1: Data Classification - Select the data types your organization handles*

2. This helps ControlWeave:
   - Suggest relevant frameworks
   - Prioritize applicable controls
   - Focus AI analysis on relevant risks

> **💡 Tip**: Be thorough here - this influences framework recommendations and AI analysis.

### 3.2 Data Location
Specify where your data is stored:
- ☐ **On-premises**
- ☐ **Cloud (US)**
- ☐ **Cloud (EU)**
- ☐ **Cloud (Other regions)**
- ☐ **Hybrid environment**

---

## Step 4: User Profile Settings

### 4.1 Personal Information
In the **Profile** tab, update:
- **Full Name**: Your display name
- **Email**: Your primary email (used for notifications)
- **Job Title**: Your role in the organization
- **Department**: Your department or team
- **Phone**: Your contact number

### 4.2 Time Zone & Locale
Configure your preferences:
- **Time Zone**: Your local time zone (for due dates and notifications)
- **Date Format**: MM/DD/YYYY or DD/MM/YYYY
- **Language**: Interface language (English default)

### 4.3 Avatar
Upload a profile picture:
1. Click **Upload Avatar**
2. Choose an image (JPG, PNG, max 2MB)
3. Crop/resize as needed
4. Click **Save**

---

## Step 5: Notification Preferences

### 5.1 Email Notifications
Configure which events trigger email notifications:
- ☐ **Control assignments**: When you're assigned a control
- ☐ **Assessment due dates**: Reminders for upcoming assessments
- ☐ **Evidence uploads**: When evidence is added to your controls
- ☐ **System updates**: Platform updates and maintenance
- ☐ **Weekly digest**: Summary of activity
- ☐ **Daily reminders**: Daily task list

### 5.2 In-App Notifications
Configure in-app notifications:
- ☐ **Real-time alerts**: Show notifications immediately
- ☐ **Desktop notifications**: Browser push notifications
- ☐ **Sound alerts**: Audio notification for important events

### 5.3 Notification Frequency
Choose notification batching:
- **Real-time**: Immediate notifications
- **Hourly digest**: Batch notifications every hour
- **Daily digest**: Once-daily summary
- **Weekly digest**: Weekly summary only

---

## Step 6: Security Settings

### 6.1 Password Management
Update your password:
1. Click **Change Password**
2. Enter current password
3. Enter new password (min 12 characters)
4. Confirm new password
5. Click **Update Password**

**Password Requirements**:
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- Special characters recommended

### 6.2 Two-Factor Authentication with TOTP
Add an extra layer of security using a TOTP authenticator app (Google Authenticator, Authy, 1Password, etc.):
1. Navigate to **Security** tab
2. Click **Set Up Two-Factor Authentication**
3. Copy the manual key into your authenticator app (or tap **Open in authenticator app** on mobile to add it automatically)
4. Enter the 6-digit code from the app to confirm setup
5. Save the one-time backup codes in a secure location

After setup, every email + password sign-in will require both your password and a 6-digit code from your authenticator app. Sign-ins using passkeys or SSO may authenticate without a TOTP challenge, depending on your configuration.

> **💡 Security Tip**: Authenticator-based 2FA protects your account even if your password is compromised.

### 6.3 Passkey Setup
Enable passwordless authentication with biometrics or a hardware security key:
1. Navigate to **Security** tab
2. Enter a name for your passkey (e.g., "MacBook Pro", "YubiKey")
3. Click **+ Add Passkey**
4. Follow browser prompts to create your passkey

![Passkey registration interface](../screenshots/passkey-setup-01.png)
*Figure 6.1: Passkey setup for secure authentication*

> **💡 Security Tip**: Passkeys provide stronger security than passwords and are resistant to phishing attacks.

### 6.4 Active Sessions
Review active login sessions:
- View all devices where you're logged in
- See last access time and location
- Click **Revoke** to sign out from specific sessions
- Click **Revoke All Other Sessions** to sign out everywhere except current device

---

## Step 7: API & Integration Settings

### 7.1 Personal API Token
Generate API tokens for programmatic access:
1. Navigate to **API** tab
2. Click **Generate New Token**
3. Name your token (e.g., "CI/CD Pipeline", "Custom Script")
4. Select permissions:
   - Read-only
   - Read and write
   - Full access
5. Copy token (shown only once!)
6. Store securely

> **⚠️ Security Warning**: Never share API tokens or commit them to source control.

### 7.2 Webhook Configuration
Set up webhooks for event notifications:
1. Click **Add Webhook**
2. Enter webhook URL
3. Select events to trigger webhook:
   - Control status changes
   - Assessment completions
   - Evidence uploads
   - Finding creation
4. Choose format: JSON or XML
5. Click **Save**

---

## Step 8: LLM Configuration (AI Features)

### 8.1 Configure AI Provider
To enable AI features, configure your LLM provider:

1. Navigate to **LLM Configuration** tab

![LLM Configuration page showing provider selection and API key entry](../screenshots/settings-llm-config-01.png)
*Figure 8.1: LLM Configuration page*

2. Choose a provider:

![Provider selection dropdown showing Anthropic, OpenAI, Gemini, Groq, Ollama options](../screenshots/llm-provider-select-01.png)
*Figure 8.2: Select your LLM provider*

3. Enter your API key:

![API key input field with show/hide password toggle](../screenshots/llm-api-key-entry-01.png)
*Figure 8.3: Enter your API key*

4. Click **Test Connection** to verify
5. Select default model:

![Model selection dropdown showing available models for the chosen provider](../screenshots/llm-model-select-01.png)
*Figure 8.4: Select your preferred model*

6. Click **Save Configuration**

### 8.2 Provider Options

| Provider | Get Key From | Free Tier | Best For |
|----------|-------------|-----------|----------|
| **Google Gemini** | aistudio.google.com | ✅ Yes | General analysis, FREE option |
| **Groq** | console.groq.com | ✅ Yes | Fast responses, FREE option |
| **Anthropic Claude** | console.anthropic.com | ❌ No | Deep compliance analysis |
| **OpenAI** | platform.openai.com | ❌ No | General purpose, popular |
| **xAI Grok** | console.x.ai | ❌ No | Fast, capable models |
| **Ollama** | Local install | ✅ Free | Privacy-focused, no API key |

> **💡 Note**: ControlWeaver has no tier-based monthly AI request limit. Any limit you hit comes from your configured LLM provider's own rate limit or quota — use BYOK (bring your own API key) to control it directly.

### 8.3 AI Usage Tracking
Monitor your AI usage:
- View requests this month
- See remaining quota (based on your configured provider's limits)
- Review request history
- Download usage reports

---

## Step 9: Display Preferences

### 9.1 Dashboard Configuration
Customize your dashboard:
- Choose default widgets
- Set refresh interval
- Select default time range for charts
- Configure color themes

### 9.2 Table Preferences
Configure table displays:
- **Rows per page**: 10, 25, 50, or 100
- **Default sort**: Choose default column and direction
- **Column visibility**: Show/hide specific columns
- **Compact mode**: Dense or comfortable spacing

### 9.3 Theme Selection
Choose your visual theme:
- **Light mode**: Default bright theme
- **Dark mode**: Dark theme for low-light environments
- **Auto**: Follows system preference
- **High contrast**: Enhanced accessibility

---

## Step 10: Accessibility Settings

### 10.1 Screen Reader Support
Enable enhanced screen reader support:
- ☐ **Verbose labels**: Add detailed ARIA labels
- ☐ **Skip navigation**: Enable skip links
- ☐ **Keyboard shortcuts**: Show keyboard shortcuts

### 10.2 Visual Adjustments
Adjust visual settings:
- **Font size**: Small, Medium, Large, Extra Large
- **Contrast**: Normal, High, Extra High
- **Motion**: Reduce animations
- **Focus indicators**: Enhanced focus outlines

---

## ✅ Setup Checklist

**Organization Configuration**:
- [ ] Organization profile completed
- [ ] Industry and size selected
- [ ] Data sensitivity profile configured
- [ ] Data location specified

**Personal Profile**:
- [ ] Profile information updated
- [ ] Time zone configured
- [ ] Avatar uploaded
- [ ] Notification preferences set

**Security**:
- [ ] Strong password set
- [ ] TOTP two-factor authentication enabled (recommended)
- [ ] Passkey registered (recommended)
- [ ] Active sessions reviewed

**AI Configuration** (Optional):
- [ ] LLM provider selected
- [ ] API key configured and tested
- [ ] Default model chosen

**Preferences**:
- [ ] Display preferences configured
- [ ] Dashboard customized
- [ ] Accessibility settings adjusted

---

## 🎯 Quick Setup (5 Minutes)

If you're short on time, complete these essential items:

1. **Organization Information**: Industry and size
2. **Data Classification**: Select your data types
3. **Notification Preferences**: Enable critical alerts
4. **Security**: Set a strong password (12+ characters); enable TOTP 2FA; add a passkey

---

## 🚀 Next Steps

After completing account setup:

1. **Select Frameworks**: [Choose compliance frameworks](FRAMEWORKS.md)
2. **Invite Team**: [Add team members](../USER_GUIDE.md#user-management)
3. **Start First Control**: [Implement a control](CONTROLS.md)
4. **Configure AI**: [Set up AI features](AI_COPILOT.md)

---

## 💡 Pro Tips

### For Compliance Managers
- Set up **weekly digests** to track team progress
- Configure **control assignment notifications**
- Enable **assessment due date reminders**

### For Security Analysts
- Enable **real-time vulnerability alerts**
- Configure **API tokens** for automation
- Set up **webhooks** for SIEM integration

### For Auditors
- Use **read-only API access** for evidence collection
- Enable **assessment completion notifications**
- Configure **finding alerts**

---

**Need Help?** Use the AI Copilot (purple button) or contact contehconsulting@gmail.com
