# 🚀 Getting Started with ControlWeave

> 📦 **Tier Availability**: ✅ Free | ✅ Starter | ✅ Professional | ✅ Enterprise  
> ⏱️ **Time Commitment**: 10-45 minutes  
> 📋 **Prerequisites**: Web browser, email address

Welcome! This guide will walk you through your first steps with ControlWeave, from account creation to running your first compliance assessment.

## ⏱️ Time Commitment
- **Quick Setup**: 10 minutes
- **Full Onboarding**: 30-45 minutes

## 📋 Prerequisites
- Web browser (Chrome, Firefox, Safari, or Edge recommended)
- Email address for account registration
- (Optional) API keys for AI features

---

## Step 1: Create Your Account

> 📦 **Available in**: All tiers

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

---

## Step 2: Configure Your Organization Profile

> 📦 **Available in**: All tiers

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
- **Tier**: Automatically set (Free by default)

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

> 📦 **Available in**: All tiers  
> ⚠️ **Tier Limits**:  
> - Free: Maximum 2 frameworks  
> - Starter: Maximum 5 frameworks  
> - Professional/Enterprise: Unlimited

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
1. Click **Activate** on each framework you need
2. Framework status changes to "Active"
3. Controls from that framework are now available

![Framework card with Activate button highlighted](../screenshots/frameworks-activate-button-01.png)
*Figure 3.2: Click Activate to enable a framework*

![Framework showing Active badge after activation](../screenshots/frameworks-active-badge-01.png)
*Figure 3.3: Active framework with green badge*

> **⚠️ Tier Limits**: 
> - Free: Maximum 2 frameworks
> - Starter: Maximum 5 frameworks  
> - Professional/Enterprise: Unlimited

---

## Step 4: Implement Your First Control

> 📦 **Available in**: All tiers

Let's implement a simple control to get familiar with the process.

### 4.1 Navigate to Controls
1. Click **Controls** in the left sidebar
2. You'll see all controls from your activated frameworks

![Controls list page showing control IDs, titles, frameworks, and status](../screenshots/controls-list-01.png)
*Figure 4.1: Controls list - All controls from your activated frameworks*

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

![Successfully uploaded evidence confirmation message](../screenshots/evidence-uploaded-success-01.png)
*Figure 4.5: Evidence uploaded successfully*

### 4.5 Mark as Implemented
1. Once evidence is uploaded and control is implemented
2. Edit implementation status
3. Change **Status** to "Implemented"
4. Click **Save**

**Congratulations!** 🎉 You've implemented your first control!

---

## Step 5: Run Your First Assessment

> 📦 **Available in**: All tiers  
> ⚠️ **Tier Limits**: Community tier limited to "Basic" depth assessments

### 5.1 Navigate to Assessments
1. Click **Assessments** in left sidebar
2. Click **New Assessment**

![Assessments page with New Assessment button highlighted](../screenshots/assessments-list-01.png)
*Figure 5.1: Assessments list page*

### 5.2 Create Assessment
**Assessment Form**:
- **Control**: Select the control you just implemented
- **Assessment Type**: Choose "Self-Assessment"
- **Depth**: Select "Basic" (quickest - available in all tiers)
- **Assessor**: Select yourself
- **Due Date**: Set for today or tomorrow

![New assessment form with fields for control, type, depth, assessor, and due date](../screenshots/assessment-create-form-01.png)
*Figure 5.2: Create new assessment form*

Click **Create Assessment**

> **⚠️ Community Tier**: Only "Basic" depth assessments available. Upgrade to Starter for "Focused" and "Comprehensive" assessments.

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

> 📦 **Available in**: All tiers  
> ⚠️ **Tier Note**: Community tier has basic dashboard. Starter+ has custom dashboards.

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

**Framework Progress**:
- Pie charts showing compliance per framework
- Percentage complete for each active framework

![Framework progress charts showing compliance percentage for each active framework](../screenshots/dashboard-framework-progress-01.png)
*Figure 6.3: Framework progress visualization*

**Priority Actions**:
- Controls requiring attention
- Overdue assessments
- Missing evidence

![Priority actions widget showing overdue items and high-priority controls](../screenshots/dashboard-priority-actions-01.png)
*Figure 6.4: Priority actions requiring attention*

**Recent Activity**:
- Latest actions taken in the system

![Recent activity feed showing recent control updates, assessments, and evidence uploads](../screenshots/dashboard-recent-activity-01.png)
*Figure 6.5: Recent activity feed*

---

## Step 7: Set Up AI Features (Optional)

> 📦 **Available in**: All tiers  
> ⚠️ **AI Request Limits**:  
> - Free: 10 requests/month  
> - Starter: 50 requests/month  
> - Professional/Enterprise: Unlimited

### 7.1 Configure LLM Provider
1. Go to **Settings** → **LLM Configuration**

![LLM Configuration page showing provider selection and API key entry](../screenshots/settings-llm-config-01.png)
*Figure 7.1: LLM Configuration page*

2. Choose a provider

![Provider selection dropdown showing Anthropic, OpenAI, Gemini, Groq, Ollama options](../screenshots/llm-provider-select-01.png)
*Figure 7.2: Select your LLM provider*

3. Enter your API key

![API key input field with show/hide password toggle](../screenshots/llm-api-key-entry-01.png)
*Figure 7.3: Enter your API key*

4. Click **Test Connection**
5. Select default model

![Model selection dropdown showing available models for the chosen provider](../screenshots/llm-model-select-01.png)
*Figure 7.4: Select your preferred model*

6. Click **Save**

**Provider Options**:

| Provider | Get Key From | Notes |
|----------|-------------|-------|
| **Google Gemini** | aistudio.google.com | FREE tier available! |
| **Groq** | console.groq.com | FREE tier available! |
| **Anthropic Claude** | console.anthropic.com | Best for analysis |
| **OpenAI** | platform.openai.com | Popular choice |
| **Ollama** | Local install | No key needed! |

### 7.2 Try the AI Copilot
1. Look for purple **Ask AI** button (bottom-right of any page)

![Purple Ask AI button in bottom-right corner of the page](../screenshots/ai-copilot-button-01.png)
*Figure 7.5: AI Copilot button - Available on every page*

2. Click to open AI Copilot panel

![AI Copilot panel slid out from the right showing chat interface](../screenshots/ai-copilot-panel-open-01.png)
*Figure 7.6: AI Copilot panel*

3. Try asking:
   - "What are my top compliance gaps?"
   - "What controls should I prioritize?"
   - "Explain NIST 800-53 AC-2 to me"

![AI Copilot conversation showing user question and AI response](../screenshots/ai-copilot-chat-interface-01.png)
*Figure 7.7: Conversing with the AI Copilot*

> **💡 Community Tier Tip**: With 10 AI requests/month, use them strategically for complex questions. Consider upgrading to Starter (50/month) or Professional (unlimited) for heavy AI usage.

---

## Step 8: Invite Your Team

> 📦 **Available in**: All tiers  
> ⚠️ **User Limits**:  
> - Free: 5 users max  
> - Starter: 25 users max  
> - Professional/Enterprise: Unlimited

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
  - **Auditor**: External auditor role (Starter+)

![Invite user form with email, name, and role fields](../screenshots/users-invite-form-01.png)
*Figure 8.2: Invite a new user*

![Role selection dropdown showing all available roles](../screenshots/users-role-selection-01.png)
*Figure 8.3: Select user role*

3. Click **Send Invitation**

> **⚠️ Note**: External Auditor role requires Pro tier or above.

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
- [ ] Relevant frameworks activated (within tier limit)
- [ ] Framework details reviewed

**Control Management**:
- [ ] First control implemented
- [ ] Evidence uploaded
- [ ] Assessment completed

**AI Features** (Optional):
- [ ] LLM provider configured
- [ ] AI Copilot tested
- [ ] Gap analysis run (if AI quota available)

**Team Setup** (If applicable):
- [ ] Team members invited (within tier limit)
- [ ] Controls assigned

---

## 🆙 Ready to Upgrade?

**Hit your tier limits?**

- **Free → Starter**: Get 5 frameworks, 25 users, 50 AI requests/month, CMDB (50 assets), auditor tools
- **Starter → Professional**: Unlimited everything, advanced AI, custom dashboards, priority support
- **Professional → Enterprise**: SSO/SAML, SIEM integration, dedicated CSM

[View Pricing & Compare Tiers →](https://controlweave.com/pricing)

---

**Need Help?** Use the AI Copilot (purple button) or see [FAQ](FAQ.md)

---

**Category**: Getting Started  
**Tier**: All (Free, Starter, Professional, Enterprise)  
**Last Updated**: February 2026
