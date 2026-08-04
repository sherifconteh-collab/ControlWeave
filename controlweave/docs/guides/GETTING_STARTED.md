# 🚀 Getting Started with ControlWeave

Welcome! This guide will walk you through your first steps with ControlWeave, from account creation to running your first compliance assessment.

> This page and
> [`wiki/getting-started/Getting-Started.md`](../wiki/getting-started/Getting-Started.md)
> are published to different places (the guides index and the GitHub Wiki) and
> carry the same content. Change both together.

## ⏱️ Time Commitment
- **Quick Setup**: 10 minutes
- **Full Onboarding**: 30-45 minutes


## Finding Your Way Around

The left sidebar groups everything into collapsible sections rather than one long
list. Only the section you are currently in is expanded, so when a step below
says *"click **Frameworks** in the left sidebar"*, expand the section it lives
under first:

| Section | What is inside |
|---|---|
| **Compliance** | Controls, AI Control Assessments, Exceptions, Frameworks, Evidence, Assessments, Auditor Workspace, RMF Lifecycle, Cyber Resilience |
| **Risk** | Risk Register, Indicators, Incidents, Third-Party Risk, Vendor Contracts |
| **Regulatory** | Obligations, Regulatory News, AI Laws |
| **Assets & Security** | Assets, SBOM, Financial Compliance, Vulnerabilities, Threat Intelligence, Security Posture, AI Threat Library |
| **Insights & Reporting** | AI Insights, Reports, Dashboard Views |
| **Organization** | Organization Profile, Structure (Departments + Business Objectives), My Organizations, Access Governance, Data Governance, Operations, Settings, Notifications |
| **Learn & Support** | Knowledge Base, Training, Help Center, Report Issue |

**Dashboard** sits above the sections and is always visible. Sections you expand
stay expanded between visits, and navigating straight to a URL expands whichever
section contains it. Items you lack permission for are hidden, so your sidebar
may show fewer entries than the table above.

## 📋 Prerequisites
- Web browser (Chrome, Firefox, Safari, or Edge recommended)
- Email address for account registration
- (Optional) API keys for AI features

---

## Step 1: Create Your Account

### 1.1 Register
1. Navigate to ControlWeave: `http://yourinstance.com/register`
2. Fill in the registration form:
   - **Email**: Your work email address
   - **Password**: Strong password (min 12 characters)
   - **Full Name**: Your name as it should appear in the system
   - **Organization Name**: Your company or organization name

![Registration form showing email, password, full name, and organization name fields](../screenshots/register-form-01.png)
*Figure 1.1: Registration form - Enter your details to create your account*

3. Click **Register**

> **💡 Tip**: Choose your organization name carefully - this will be visible in all reports and assessments.

### 1.2 First Login
1. You'll be automatically logged in after registration
2. You'll land on the Dashboard (mostly empty for now - that's normal!)

![Empty dashboard on first login showing welcome message and setup prompts](../screenshots/dashboard-first-login-01.png)
*Figure 1.2: Dashboard on first login - Don't worry, it will fill up as you add data*

> **🔐 Login Options**: The login page (`/login`) supports:
> - **Password** (email + password) — available to all users
> - **Two-Factor Authentication (TOTP)** — available to all users; pair with Google Authenticator, Authy, or any TOTP app
> - **Passkey** (biometrics or hardware security key) — available to all users
> - **SSO / Social login** (Google, Microsoft, etc.) — available when configured by your administrator
>
> If you forget your password, click **Forgot password?** on the login page to receive a reset link by email.

> **⏱️ Inactivity Timeout**: By default, ControlWeave automatically signs you out after **30 minutes of inactivity** to keep your account secure. Your deployment administrator may configure a different timeout.

---

## Step 2: Configure Your Organization Profile

### 2.1 Access Settings
1. Click your profile icon (top-right corner)
2. Select **Settings**

![Profile dropdown menu with Settings option highlighted](../screenshots/settings-menu-01.png)
*Figure 2.1: Access Settings from your profile menu*

### 2.2 Organization Information
Navigate to **Organization Settings** tab:

![Organization Settings page showing org details form](../screenshots/organization-settings-01.png)
*Figure 2.2: Organization Settings - Configure your organization profile*

**Required Fields**:
- **Organization Name**: Already set during registration
- **Industry**: Select your industry vertical
- **Size**: Number of employees

**Optional Fields**:
- **Description**: Brief description of your organization
- **Website**: Company website URL
- **Primary Contact**: Main compliance contact

Click **Save Organization Settings**

### 2.3 Data Sensitivity Profile
Under **Data Classification**:

1. Select which data types your organization handles:
   - ☐ PII (Personally Identifiable Information)
   - ☐ PHI (Protected Health Information)
   - ☐ PCI (Payment Card Information)
   - ☐ CUI (Controlled Unclassified Information)
   - ☐ FCI (Federal Contract Information)
   - ☐ Export-Controlled Data
   - ☐ Proprietary Business Data

![Data classification checkboxes showing various data types](../screenshots/data-classification-01.png)
*Figure 2.3: Data Classification - Select the data types your organization handles*

2. This helps ControlWeave suggest relevant frameworks

> **💡 Tip**: Be thorough here - this influences framework recommendations and AI analysis.

---

## Step 3: Select Your Compliance Frameworks

### 3.1 Navigate to Frameworks
1. Click **Frameworks** in the left sidebar
2. You'll see a list of 15+ available frameworks

![Frameworks list page showing all available compliance frameworks](../screenshots/frameworks-list-01.png)
*Figure 3.1: Frameworks page - View all available compliance frameworks*

### 3.2 Choose Relevant Frameworks

**For Different Industries**:

**Healthcare Organizations**:
- ✅ HIPAA (required for healthcare data)
- ✅ NIST 800-53 (comprehensive security controls)
- ✅ SOC 2 (if you're a service provider)

**Financial Services**:
- ✅ SOC 2 (required for service providers)
- ✅ PCI DSS (if handling payment cards)
- ✅ FFIEC (for financial institutions)
- ✅ NIST CSF 2.0 (risk management framework)

**Government Contractors**:
- ✅ NIST 800-171 (required for CUI)
- ✅ NIST 800-53 (comprehensive baseline)
- ✅ FedRAMP (if providing cloud services)

**Technology Companies**:
- ✅ SOC 2 (customer requirement)
- ✅ ISO 27001 (international standard)
- ✅ NIST CSF 2.0 (risk framework)
- ✅ OWASP LLM Top 10 (if using AI)

**AI/ML Companies**:
- ✅ NIST AI RMF (AI risk management)
- ✅ EU AI Act (if serving EU customers)
- ✅ ISO 42001 (AI management system)
- ✅ OWASP Agentic AI Top 10

### 3.3 Activate Frameworks
1. Tick each framework you need in the list
2. Click **Save Selection**
3. Controls from those frameworks become available

There is no per-framework "Activate" button — selection is a checklist you save
in one action. **Show Library** reveals the full NIST publications library, and
**Import CSV** / **Export CSV** move a selection between environments.

![Frameworks page listing the selectable frameworks with the Save Selection action](../screenshots/frameworks-list-01.png)
*Figure 3.2: Selecting frameworks, then Save Selection*

---

## Step 4: Implement Your First Control

Let's implement a simple control to get familiar with the process.

### 4.1 Navigate to Controls
1. Click **Controls** in the left sidebar
2. You'll see all controls from your activated frameworks


### 4.2 Choose a Control
Good starter controls:
- **AC-1** (Access Control Policy) - NIST 800-53
- **A.5.1** (Policies for information security) - ISO 27001
- **CC1.1** (Control Environment) - SOC 2

### 4.3 Update Control Status
1. Click the control to open details
2. Click **Edit Implementation**

![Control detail page showing full description, status, and actions](../screenshots/control-detail-01.png)
*Figure 4.2: Control detail page with implementation options*

3. Set **Status** to "In Progress"

![Control status dropdown showing options: Not Started, In Progress, Implemented, etc.](../screenshots/control-status-dropdown-01.png)
*Figure 4.3: Control status options*
4. Add **Owner**: Assign to yourself
5. Set **Due Date**: Choose a reasonable deadline
6. Add **Implementation Notes**: Document what you're doing
7. Click **Save**

### 4.4 Upload Evidence
1. In the control details, click **Add Evidence**
2. Click **Upload File** or drag-and-drop

![Evidence upload modal with drag-drop area and file browser button](../screenshots/evidence-upload-form-01.png)
*Figure 4.4: Evidence upload interface*

3. Supported formats: PDF, DOCX, XLSX, JPG, PNG
4. Add description: "Information Security Policy v1.0"
5. Add tags: "policy", "access-control", "approved"
6. Click **Upload**

![Evidence Library listing the uploaded file](../screenshots/evidence-list-01.png)
*Figure 4.5: Evidence uploaded successfully*

### 4.5 Mark as Implemented
1. Once evidence is uploaded and control is implemented
2. Edit implementation status
3. Change **Status** to "Implemented"
4. Click **Save**

**Congratulations!** 🎉 You've implemented your first control!

---

## Step 5: Run Your First Assessment

### 5.1 Navigate to Assessments
1. Click **Assessments** in left sidebar
2. Click **New Assessment**

![Assessments page with New Assessment button highlighted](../screenshots/assessments-list-01.png)
*Figure 5.1: Assessments list page*

### 5.2 Create Assessment
**Assessment Form**:
- **Control**: Select the control you just implemented
- **Assessment Type**: Choose "Self-Assessment"
- **Depth**: Select "Basic" (quickest)
- **Assessor**: Select yourself
- **Due Date**: Set for today or tomorrow

![New assessment form with fields for control, type, depth, assessor, and due date](../screenshots/assessment-create-form-01.png)
*Figure 5.2: Create new assessment form*

Click **Create Assessment**

### 5.3 Conduct Assessment
1. Assessment opens with procedure checklist
2. Review each procedure step
3. Check evidence (click link to view uploaded evidence)

![Assessment in progress showing procedure checklist and evidence links](../screenshots/assessment-conduct-01.png)
*Figure 5.3: Conducting an assessment*

4. For each procedure:
   - ✅ **Satisfied**: Control meets requirement
   - ⚠️ **Other Than Satisfied**: Partial compliance or issues found
   - ⊘ **Not Applicable**: Procedure doesn't apply

![Assessment result options: Satisfied, Other Than Satisfied, Not Applicable](../screenshots/assessment-results-options-01.png)
*Figure 5.4: Assessment outcome options*

5. Add notes explaining your determination
6. Click **Save Results**

---

## Step 6: Explore the Dashboard

### 6.1 Dashboard Overview
Navigate back to **Dashboard** to see:

![Full dashboard view showing compliance overview, framework progress, priority actions, and recent activity](../screenshots/dashboard-overview-01.png)
*Figure 6.1: Dashboard overview - Your compliance command center*

**Compliance Overview Panel**:
- Overall compliance percentage
- Number of controls by status
- Assessment completion rate

![Compliance overview panel showing overall percentage and control status breakdown](../screenshots/dashboard-compliance-panel-01.png)
*Figure 6.2: Compliance overview panel*

**Framework Progress and Recent Activity**:
- Per-framework completion, alongside the latest actions taken in the system
- Both render together in one panel at the foot of the dashboard

![Framework progress and recent activity panel at the foot of the dashboard](../screenshots/dashboard-recent-activity-01.png)
*Figure 6.3: Framework progress and recent activity*

The dashboard also carries **Control Health Overview**, **Compliance Maturity
Score**, **Control Status Distribution**, **Compliance Trend (Last 30 Days)** and
a **Per-Framework Compliance Summary**, plus a **Customize Dashboard** action.

There is no separate "Priority Actions" widget. For work that needs attention,
use the Controls page filters or the register pages (Risks, Incidents,
Obligations), which carry their own due-date and status filters.

---

## Step 7: Set Up AI Features (Optional)

### 7.1 Configure LLM Provider
1. Go to **Settings** → **LLM Configuration**

![LLM Configuration page showing provider selection and API key entry](../screenshots/settings-llm-config-01.png)
*Figure 7.1: LLM Configuration page*

2. Choose a provider


3. Enter your API key


4. Click **Test Connection**
5. Select default model


6. Click **Save**

**Provider Options**:

| Provider | Get Key From | Notes |
|----------|-------------|-------|
| **Google Gemini** | aistudio.google.com | FREE tier available! |
| **Groq** | console.groq.com | FREE tier available! |
| **Anthropic Claude** | console.anthropic.com | Best for analysis |
| **OpenAI** | platform.openai.com | Popular choice |
| **Ollama** | Local install | No key needed! |

> **💡 Note**: ControlWeaver has no tier-based AI request limit. Any limit you hit comes from your configured provider's own rate limit or quota — use BYOK to control it directly.

### 7.2 Use the AI features

There is **no floating "Ask AI" chat button**. Earlier versions of this guide
described a copilot widget in the bottom-right corner of every page; no such
component exists in the product. AI is reached through the pages that use it:

| Where | What it does |
|---|---|
| **Insights & Reporting → AI Insights** | Gap analysis, audit-readiness scoring, compliance forecast |
| **Compliance → AI Control Assessments** | AI-assisted control assessment |
| Vulnerability detail panel | Per-finding AI remediation plan |
| Access Governance → Import & AI | Analyzes an uploaded RBAC document |

Each requires a configured provider. Without one, these panels report **"No AI
provider configured."** and offer a provider picker rather than failing.

---

## Step 8: Invite Your Team

### 8.1 Navigate to Users
1. Go to **Settings** → **Users**
2. Click **Invite User**

![Users list page with Invite User button highlighted](../screenshots/settings-users-list-01.png)
*Figure 8.1: User management page*

### 8.2 Set Up User
**User Form**:
- **Email**: Team member's email
- **Full Name**: Their name
- **Role**: Select appropriate role:
  - **Admin**: Full system access
  - **Manager**: Can edit controls, assessments
  - **Analyst**: Can view and update status
  - **Viewer**: Read-only access
  - **Auditor**: External auditor role

![Invite user form with email, name, and role fields](../screenshots/users-invite-form-01.png)
*Figure 8.2: Invite a new user*

![Role selection dropdown showing all available roles](../screenshots/users-role-selection-01.png)
*Figure 8.3: Select user role*

3. Click **Send Invitation**

---

## 🎯 Quick Wins (First 30 Minutes)

**✅ 5-Minute Quick Start**:
1. Register account
2. Activate 1-2 relevant frameworks
3. Explore dashboard

**✅ 15-Minute Setup**:
1. Everything above, plus:
2. Implement 1 policy control
3. Upload policy evidence
4. Run one assessment

**✅ 30-Minute Onboarding**:
1. Everything above, plus:
2. Configure AI
3. Run AI gap analysis
4. Invite one team member

---

## 📚 Next Steps

### Week 1
- [ ] Implement 5-10 high-priority controls
- [ ] Upload evidence for existing policies/procedures
- [ ] Complete assessments for implemented controls
- [ ] Review AI gap analysis recommendations

### Month 1
- [ ] Achieve 20% overall compliance
- [ ] Complete all high-priority controls
- [ ] Generate first compliance report
- [ ] Review crosswalk opportunities

---

## ✅ Onboarding Checklist

**Account Setup**:
- [ ] Account created
- [ ] Organization profile completed
- [ ] Data sensitivity profile configured

**Framework Configuration**:
- [ ] Relevant frameworks activated
- [ ] Framework details reviewed

**Control Management**:
- [ ] First control implemented
- [ ] Evidence uploaded
- [ ] Assessment completed

**AI Features** (Optional):
- [ ] LLM provider configured
- [ ] AI Copilot tested
- [ ] Gap analysis run

**Team Setup**:
- [ ] Team members invited
- [ ] Controls assigned

---

**Need Help?** Use the AI Copilot (purple button) or see [FAQ](FAQ.md)
