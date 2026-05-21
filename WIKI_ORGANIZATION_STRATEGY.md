# 🗂️ Wiki Organization Strategy

Comprehensive plan for organizing ControlWeave documentation by document type and tier.

## 📊 Current State Analysis

### Existing Documents
```
controlweave/docs/guides/
├── GETTING_STARTED.md      (All tiers)
├── ACCOUNT_SETUP.md        (All tiers)
├── QUICK_WINS.md           (All tiers)
├── FRAMEWORKS.md           (All tiers)
├── CONTROLS.md             (All tiers)
├── AI_COPILOT.md           (All tiers)
└── VULNERABILITIES.md      (Starter+)
```

### ControlWeave Tiers
- **Free** - Core GRC features, 10 frameworks max, 10 AI requests/month
- **Starter** - Small teams, 20 frameworks max, 50 AI requests/month, CMDB (50 assets)
- **Professional** - Unlimited everything, priority support
- **Enterprise** - SSO/SAML, SIEM integration, dedicated CSM

## 🎯 Proposed Wiki Structure

### Option 1: Hybrid Approach (RECOMMENDED)
Organize by **document type** with **tier badges** in each document.

```
GitHub Wiki Structure:
├── Home.md                              # Landing page with tier legend
│
├── Getting-Started/                     # Getting Started Category
│   ├── Quick-Start.md                   [ALL TIERS]
│   ├── Account-Setup.md                 [ALL TIERS]
│   ├── First-Assessment.md              [ALL TIERS]
│   └── Quick-Wins.md                    [ALL TIERS]
│
├── Core-Features/                       # Core Features Category
│   ├── Frameworks.md                    [ALL TIERS - limits apply]
│   ├── Controls.md                      [ALL TIERS]
│   ├── Assessments.md                   [ALL TIERS]
│   ├── Evidence.md                      [ALL TIERS]
│   └── Dashboard.md                     [ALL TIERS]
│
├── AI-Features/                         # AI-Powered Category
│   ├── AI-Copilot.md                    [ALL TIERS - limits apply]
│   ├── Gap-Analysis.md                  [ALL TIERS - limits apply]
│   ├── Compliance-Forecast.md           [PROFESSIONAL+]
│   └── Advanced-AI.md                   [PROFESSIONAL+]
│
├── Asset-Management/                    # CMDB Category
│   ├── CMDB-Overview.md                 [STARTER+]
│   ├── Asset-Tracking.md                [STARTER+]
│   ├── SBOM.md                          [STARTER+]
│   └── Vulnerability-Management.md      [STARTER+]
│
├── Auditing/                           # Auditor Features Category
│   ├── Auditor-Workspace.md            [STARTER+]
│   ├── Engagements.md                  [STARTER+]
│   ├── Findings.md                     [STARTER+]
│   └── Workpapers.md                   [STARTER+]
│
├── Enterprise-Features/                # Enterprise Only Category
│   ├── SSO-Setup.md                    [ENTERPRISE]
│   ├── SAML-Configuration.md           [ENTERPRISE]
│   ├── SIEM-Integration.md             [ENTERPRISE]
│   └── Advanced-Reporting.md           [ENTERPRISE]
│
├── Administration/                     # Admin Category
│   ├── User-Management.md              [ALL TIERS - limits apply]
│   ├── Settings.md                     [ALL TIERS]
│   ├── Integrations.md                 [STARTER+]
│   └── API-Keys.md                     [STARTER+]
│
└── Reference/                          # Reference Category
    ├── Tier-Comparison.md              [ALL TIERS]
    ├── API-Documentation.md            [PROFESSIONAL+]
    ├── Troubleshooting.md              [ALL TIERS]
    └── FAQ.md                          [ALL TIERS]
```

### Option 2: Tier-First Organization
Separate sections by tier (less recommended - creates duplication).

```
├── Free-Tier/
│   ├── Getting-Started.md
│   └── Core-Features.md
├── Starter-Tier/
│   ├── All-Free-Features.md
│   └── CMDB-Features.md
├── Professional-Tier/
│   └── Advanced-Features.md
└── Enterprise-Tier/
    └── Enterprise-Features.md
```

**Cons**: Duplication, harder to maintain, confusing navigation

## 🏷️ Tier Badge System

### Badge Format
Use consistent badges at the top of each document:

```markdown
# Document Title

> 📦 **Tier Availability**: <badge-here>

## Quick Info
- **Available in**: Free, Starter, Professional, Enterprise
- **Limits**: Free (10/month), Starter (50/month), Professional+ (Unlimited)
```

### Badge Examples

```markdown
<!-- All Tiers -->
> 📦 **Tier**: ✅ Free | ✅ Starter | ✅ Professional | ✅ Enterprise

<!-- Starter and Above -->
> 📦 **Tier**: ❌ Free | ✅ Starter | ✅ Professional | ✅ Enterprise

<!-- Professional and Above -->
> 📦 **Tier**: ❌ Free | ❌ Starter | ✅ Professional | ✅ Enterprise

<!-- Enterprise Only -->
> 📦 **Tier**: ❌ Free | ❌ Starter | ❌ Starter | ✅ Enterprise

<!-- With Limits -->
> 📦 **Tier**: ✅ All Tiers  
> ⚠️ **Limits**: Free (10 frameworks), Starter (20 frameworks), Professional+ (Unlimited)
```

### Color-Coded Badges (for HTML)

```html
<!-- Community Tier Badge -->
<span style="background-color: #28a745; color: white; padding: 2px 8px; border-radius: 3px;">FREE</span>

<!-- Pro Tier Badge -->
<span style="background-color: #007bff; color: white; padding: 2px 8px; border-radius: 3px;">STARTER+</span>

<!-- Pro Tier Badge -->
<span style="background-color: #6f42c1; color: white; padding: 2px 8px; border-radius: 3px;">PROFESSIONAL+</span>

<!-- Enterprise Tier Badge -->
<span style="background-color: #fd7e14; color: white; padding: 2px 8px; border-radius: 3px;">ENTERPRISE</span>
```

## 📝 Document Type Categories

### 1. **Getting Started** 
**Purpose**: Onboarding and first-time user guides  
**Tier**: All tiers  
**Examples**:
- Quick-Start.md
- Account-Setup.md
- First-Assessment.md
- Quick-Wins.md

### 2. **Core Features**
**Purpose**: Essential GRC functionality  
**Tier**: All tiers (some with limits)  
**Examples**:
- Frameworks.md
- Controls.md
- Assessments.md
- Evidence.md
- Dashboard.md

### 3. **AI Features**
**Purpose**: AI-powered analysis and automation  
**Tier**: All tiers with usage limits  
**Examples**:
- AI-Copilot.md
- Gap-Analysis.md
- Compliance-Forecast.md (Professional+)
- Risk-Assessment.md (Professional+)

### 4. **Asset Management**
**Purpose**: CMDB and vulnerability tracking  
**Tier**: Starter and above  
**Examples**:
- CMDB-Overview.md
- Asset-Tracking.md
- SBOM.md
- Vulnerability-Management.md

### 5. **Auditing**
**Purpose**: External auditor features  
**Tier**: Starter and above  
**Examples**:
- Auditor-Workspace.md
- Engagements.md
- Findings.md
- Workpapers.md

### 6. **Enterprise Features**
**Purpose**: Advanced enterprise capabilities  
**Tier**: Enterprise only  
**Examples**:
- SSO-Setup.md
- SAML-Configuration.md
- SIEM-Integration.md
- Splunk-Integration.md

### 7. **Administration**
**Purpose**: System configuration and management  
**Tier**: All tiers (some features restricted)  
**Examples**:
- User-Management.md
- Settings.md
- Integrations.md
- API-Keys.md

### 8. **Reference**
**Purpose**: Reference materials and troubleshooting  
**Tier**: Varies by document  
**Examples**:
- Tier-Comparison.md
- API-Documentation.md
- Troubleshooting.md
- FAQ.md

## 🎨 Home Page Design

### Recommended Layout

```markdown
# ControlWeave Documentation

Welcome to ControlWeave! Find documentation for your tier:

## 🎯 Quick Start by Tier

<table>
<tr>
<th>Community Tier</th>
<th>Pro Tier</th>
<th>Pro Tier</th>
<th>Enterprise Tier</th>
</tr>
<tr>
<td>
• Quick Start<br/>
• Core Features<br/>
• Basic AI (10/mo)
</td>
<td>
• All Free features<br/>
• CMDB (50 assets)<br/>
• Auditor tools<br/>
• More AI (50/mo)
</td>
<td>
• All Starter features<br/>
• Unlimited everything<br/>
• Advanced AI<br/>
• Priority support
</td>
<td>
• All Professional<br/>
• SSO/SAML<br/>
• SIEM integration<br/>
• Dedicated CSM
</td>
</tr>
</table>

## 📚 Documentation by Category

### 🚀 Getting Started (All Tiers)
Start here if you're new to ControlWeave.
- [Quick Start Guide](Getting-Started/Quick-Start)
- [Account Setup](Getting-Started/Account-Setup)
- [Your First Assessment](Getting-Started/First-Assessment)

### 🎛️ Core Features (All Tiers)
Essential GRC functionality available to all users.
- [Framework Management](Core-Features/Frameworks)
- [Control Implementation](Core-Features/Controls)
- [Assessment Procedures](Core-Features/Assessments)

### 🤖 AI Features (All Tiers - Usage Limits)
AI-powered compliance assistance.
- [AI Copilot](AI-Features/AI-Copilot) - All tiers
- [Gap Analysis](AI-Features/Gap-Analysis) - All tiers
- [Compliance Forecast](AI-Features/Compliance-Forecast) - Professional+

### 🗄️ Asset Management (Starter+)
CMDB and vulnerability tracking.
- [CMDB Overview](Asset-Management/CMDB-Overview)
- [Vulnerability Management](Asset-Management/Vulnerability-Management)
- [SBOM/AIBOM](Asset-Management/SBOM)

### 👔 Auditing (Starter+)
External auditor workspace and tools.
- [Auditor Workspace](Auditing/Auditor-Workspace)
- [Engagements](Auditing/Engagements)
- [Findings Management](Auditing/Findings)

### 🏢 Enterprise Features (Enterprise Only)
Advanced capabilities for large organizations.
- [SSO/SAML Setup](Enterprise-Features/SSO-Setup)
- [SIEM Integration](Enterprise-Features/SIEM-Integration)
- [Advanced Reporting](Enterprise-Features/Advanced-Reporting)

### ⚙️ Administration
System configuration and user management.
- [User Management](Administration/User-Management) - All tiers
- [Settings](Administration/Settings) - All tiers
- [API Keys](Administration/API-Keys) - Starter+

### 📖 Reference
Additional resources and reference materials.
- [Tier Comparison](Reference/Tier-Comparison)
- [Troubleshooting](Reference/Troubleshooting)
- [FAQ](Reference/FAQ)

## 🎓 Learning Paths

### For Community Tier Users
1. Quick Start Guide
2. Framework Selection
3. Control Implementation
4. Basic AI Features

### For Starter+ Users
1. Everything in Free
2. CMDB Setup
3. Vulnerability Tracking
4. Auditor Workspace

### For Professional Users
1. Everything in Starter
2. Advanced AI Analysis
3. Custom Integrations
4. Advanced Reporting

### For Enterprise Users
1. Everything in Professional
2. SSO/SAML Configuration
3. SIEM Integration
4. Dedicated Support

## 🔍 Not Sure Which Tier You Need?
[View Complete Tier Comparison →](Reference/Tier-Comparison)
```

## 🔧 Implementation Plan

### Phase 1: Structure Setup
1. Create category directories in `controlweave/docs/wiki/`
2. Add tier badges to existing documents
3. Create category index pages

### Phase 2: Document Migration
1. Copy documents to new category structure
2. Update internal links
3. Add tier information to each document

### Phase 3: Workflow Updates
1. Update sync-wiki.yml to handle categories
2. Update health check to validate categories
3. Update auto-review to check tier badges

### Phase 4: Home Page
1. Create new Home.md with tier-based navigation
2. Add visual tier comparison
3. Add learning paths

### Phase 5: Testing
1. Test all links
2. Verify tier badges
3. Test sync workflow
4. Validate health checks

## 📊 Tier Feature Matrix (for reference)

| Feature | Community | Pro | Pro | Enterprise |
|---------|------|---------|--------------|------------|
| **Frameworks** | 10 max | 20 max | Unlimited | Unlimited |
| **AI Requests/Month** | 10 | 50 | Unlimited | Unlimited |
| **CMDB Assets** | ❌ | 50 | Unlimited | Unlimited |
| **Auditor Workspace** | ❌ | ✅ | ✅ | ✅ |
| **Custom Dashboards** | ❌ | ✅ | ✅ | ✅ |
| **SBOM/AIBOM** | ❌ | Basic | Full | Full |
| **Vulnerability Mgmt** | ❌ | ✅ | ✅ | ✅ |
| **SSO/SAML** | ❌ | ❌ | ❌ | ✅ |
| **SIEM Integration** | ❌ | ❌ | ❌ | ✅ |
| **Priority Support** | ❌ | ❌ | ✅ | ✅ |
| **Dedicated CSM** | ❌ | ❌ | ❌ | ✅ |

## 🎯 Benefits of This Approach

### For Users
- ✅ **Easy Navigation**: Find docs relevant to your tier
- ✅ **Clear Limitations**: Know what features you have access to
- ✅ **Upgrade Path**: See what's available in higher tiers
- ✅ **Consistent Structure**: Predictable organization

### For Maintainers
- ✅ **Single Source**: One document per feature (no duplication)
- ✅ **Easy Updates**: Change once, applies to all tiers
- ✅ **Clear Ownership**: Category-based organization
- ✅ **Automated Validation**: Health checks verify structure

### For Sales/Marketing
- ✅ **Feature Visibility**: Clear tier differentiation
- ✅ **Upgrade Incentive**: Users see higher-tier features
- ✅ **Self-Service**: Users can explore all features

## 📋 Document Template

```markdown
# Feature Name

> 📦 **Tier**: ✅ Free | ✅ Starter | ✅ Professional | ✅ Enterprise  
> ⏱️ **Time**: 15 minutes  
> 📋 **Prerequisites**: Account setup complete

## Overview
Brief description of the feature.

## Tier-Specific Information

### Community Tier
- Available: Yes/No
- Limits: Describe limitations
- Notes: Additional information

### Pro Tier
- Available: Yes/No
- Limits: Describe limitations
- Notes: Additional information

[Continue for other tiers...]

## Getting Started
Step-by-step guide...

## Common Tasks
How to use the feature...

## Troubleshooting
Common issues and solutions...

## Upgrading
What you get with higher tiers...

---
**Category**: [Category Name]  
**Tier**: [Tier Info]  
**Last Updated**: [Date]
```

## 🚀 Next Steps

1. Review and approve this strategy
2. Create category directories
3. Update existing documents with tier badges
4. Update workflows for new structure
5. Test and validate
6. Deploy to wiki

---

**Recommendation**: Proceed with **Option 1: Hybrid Approach** - organize by document type with tier badges in each document.
