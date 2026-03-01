// @tier: free
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const { normalizeTier, tierLevel } = require('../config/tierPolicy');
const { createOrgRateLimiter } = require('../middleware/rateLimit');

router.use(authenticate);

// Rate limit: 60 help requests per minute per org (generous for documentation browsing)
const helpRateLimiter = createOrgRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  label: 'help'
});

// Docs root is the docs/ directory relative to the backend package root
const DOCS_ROOT = path.resolve(__dirname, '../../../docs');

// Tier levels for comparison
const TIER_FREE = 0;
const TIER_STARTER = 1;
const TIER_PROFESSIONAL = 2;
const TIER_ENTERPRISE = 3;

// Help article catalog — each entry declares the minimum tier required to view it.
// The slug maps to a Markdown file path relative to DOCS_ROOT.
const ARTICLE_CATALOG = [
  // ── Getting Started ──────────────────────────────────────────────────────
  {
    slug: 'getting-started',
    title: 'Getting Started',
    description: 'Your first steps with ControlWeave — account creation, org setup, and initial framework selection.',
    icon: '🚀',
    category: 'Getting Started',
    file: 'guides/GETTING_STARTED.md',
    minTier: TIER_FREE
  },
  {
    slug: 'account-setup',
    title: 'Account Setup',
    description: 'Configure your profile, organization information, and security settings.',
    icon: '👤',
    category: 'Getting Started',
    file: 'guides/ACCOUNT_SETUP.md',
    minTier: TIER_FREE
  },
  {
    slug: 'quick-wins',
    title: 'Quick Wins',
    description: 'Get immediate value from ControlWeave in your first 30 minutes.',
    icon: '🎯',
    category: 'Getting Started',
    file: 'guides/QUICK_WINS.md',
    minTier: TIER_FREE
  },
  // ── Core Features ─────────────────────────────────────────────────────────
  {
    slug: 'frameworks',
    title: 'Framework Management',
    description: 'Select, activate, and manage compliance frameworks (NIST, ISO 27001, SOC 2, and more).',
    icon: '📋',
    category: 'Core Features',
    file: 'guides/FRAMEWORKS.md',
    minTier: TIER_FREE
  },
  {
    slug: 'controls',
    title: 'Controls & Implementation',
    description: 'Track security controls, assign owners, and record implementation evidence.',
    icon: '✅',
    category: 'Core Features',
    file: 'guides/CONTROLS.md',
    minTier: TIER_FREE
  },
  {
    slug: 'settings',
    title: 'Settings & Configuration',
    description: 'Configure users, roles, integrations, LLM providers, and notifications.',
    icon: '⚙️',
    category: 'Core Features',
    file: 'guides/SETTINGS.md',
    minTier: TIER_FREE
  },
  // ── AI Features ───────────────────────────────────────────────────────────
  {
    slug: 'ai-copilot',
    title: 'AI Copilot',
    description: 'Use the conversational AI assistant for GRC questions, guidance, and quick analysis.',
    icon: '🤖',
    category: 'AI Features',
    file: 'guides/AI_COPILOT.md',
    minTier: TIER_FREE
  },
  {
    slug: 'ai-analysis',
    title: 'AI Analysis',
    description: 'Run structured AI-powered analyses — gap analysis, risk heatmaps, forecasting, and more.',
    icon: '🔍',
    category: 'AI Features',
    file: 'guides/AI_ANALYSIS.md',
    minTier: TIER_FREE
  },
  // ── Advanced Features ─────────────────────────────────────────────────────
  {
    slug: 'vulnerabilities',
    title: 'Vulnerability Management',
    description: 'Import scan results (Nessus, STIG, SARIF, IAVM), track findings, and generate AI remediation plans.',
    icon: '🛡️',
    category: 'Advanced Features',
    file: 'guides/VULNERABILITIES.md',
    minTier: TIER_FREE
  },
  // ── Reference ─────────────────────────────────────────────────────────────
  {
    slug: 'tier-comparison',
    title: 'Tier Comparison',
    description: 'Full feature-by-feature comparison across Free, Starter, Professional, and Enterprise tiers.',
    icon: '📊',
    category: 'Reference',
    file: 'TIER_COMPARISON.md',
    minTier: TIER_FREE
  },
  {
    slug: 'user-guide',
    title: 'Complete User Guide',
    description: 'Full navigation guide covering every feature area with learning paths by role.',
    icon: '📚',
    category: 'Reference',
    file: 'USER_GUIDE.md',
    minTier: TIER_FREE
  }
];

function getUserTierLevel(req) {
  const tier = normalizeTier(req.user?.effectiveTier || req.user?.organization_tier);
  return tierLevel(tier);
}

/**
 * GET /api/v1/help
 * Returns the list of help articles the current user is entitled to view,
 * grouped by category.  Articles requiring a higher tier are returned but
 * marked as `locked: true` so the UI can show an upgrade prompt.
 */
router.get('/', helpRateLimiter, (req, res) => {
  const userTier = getUserTierLevel(req);

  const articles = ARTICLE_CATALOG.map(({ slug, title, description, icon, category, minTier }) => ({
    slug,
    title,
    description,
    icon,
    category,
    locked: userTier < minTier,
    minTierRequired: Object.entries({ free: 0, starter: 1, professional: 2, enterprise: 3 })
      .find(([, v]) => v === minTier)?.[0] || 'free'
  }));

  // Group by category preserving declaration order
  const grouped = {};
  for (const article of articles) {
    if (!grouped[article.category]) grouped[article.category] = [];
    grouped[article.category].push(article);
  }

  res.json({ success: true, data: { categories: grouped } });
});

/**
 * GET /api/v1/help/:slug
 * Returns the Markdown content of a specific help article.
 * Returns 403 if the article requires a higher tier than the user has.
 */
router.get('/:slug', helpRateLimiter, (req, res) => {
  const { slug } = req.params;
  const article = ARTICLE_CATALOG.find((a) => a.slug === slug);

  if (!article) {
    return res.status(404).json({ success: false, error: 'Article not found' });
  }

  const userTier = getUserTierLevel(req);
  if (userTier < article.minTier) {
    return res.status(403).json({
      success: false,
      error: 'This article requires a higher subscription tier.',
      minTierRequired: Object.entries({ free: 0, starter: 1, professional: 2, enterprise: 3 })
        .find(([, v]) => v === article.minTier)?.[0] || 'free'
    });
  }

  const filePath = path.resolve(DOCS_ROOT, article.file);

  // Prevent path traversal: resolved path must be inside DOCS_ROOT
  const relative = path.relative(DOCS_ROOT, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return res.status(400).json({ success: false, error: 'Invalid article path' });
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    // Docs directory may not be present in production deployment — serve embedded fallback
    console.warn(`Help article file not found (${article.file}), using embedded fallback:`, err.message);
    content = EMBEDDED_ARTICLES[article.slug] || null;
  }

  if (!content) {
    return res.status(404).json({ success: false, error: 'Article content not available' });
  }

  res.json({
    success: true,
    data: {
      slug: article.slug,
      title: article.title,
      icon: article.icon,
      category: article.category,
      content
    }
  });
});

// ── Embedded fallback articles ──────────────────────────────────────────────
// Served when the docs/ directory isn't mounted in the production container.
const EMBEDDED_ARTICLES = {
  'getting-started': `# 🚀 Getting Started with ControlWeave

Welcome! This guide walks you through your first steps with ControlWeave.

## Quick Setup (~10 minutes)

### 1. Create Your Account
- Navigate to the registration page and fill in your email, password, full name, and organization name
- Verify your email and log in

### 2. Select Compliance Frameworks
- Go to **Frameworks** in the sidebar
- Choose the frameworks your organization needs (e.g. NIST CSF 2.0, ISO 27001, SOC 2)
- Free tier supports up to 2 frameworks

### 3. Review Your Controls
- Navigate to **Controls** to see all controls from your selected frameworks
- Controls are grouped by family for easy navigation
- Use the search bar to find specific controls

### 4. Start Implementing
- Click on any control to expand its details
- Update the status (Not Started → In Progress → Implemented)
- When you mark a control as **Implemented**, Auto-Crosswalk automatically satisfies similar controls across other frameworks

### 5. Try AI Features
- Click **AI Analysis** for gap analysis, risk heatmaps, and compliance forecasting
- Use the **AI Copilot** (bottom-right) for quick GRC questions
- All AI features work with the platform key — no configuration needed

## Next Steps
- **Evidence**: Upload compliance artifacts and documentation
- **Assessments**: Run structured assessment procedures
- **Reports**: Generate compliance reports for stakeholders
- **Settings**: Configure users, roles, and integrations`,

  'account-setup': `# 👤 Account Setup

Configure your profile, organization, and security settings.

## Profile Settings
- Navigate to **Settings → Account**
- Update your display name, email, and notification preferences
- Change your password under the Security section

## Organization Profile
- Go to **Organization Profile** in the sidebar
- Set your organization name, industry, and size
- Define your compliance scope and boundary

## User Management
- Navigate to **Settings → Roles & Permissions**
- Invite team members and assign roles (Admin, Analyst, Auditor, Viewer)
- Each role has specific permissions for controls, evidence, and reporting

## Security
- Enable multi-factor authentication for enhanced security
- Configure session timeout and password policies
- Review audit logs under **Settings → Audit Logs**`,

  'quick-wins': `# 🎯 Quick Wins

Get immediate value from ControlWeave in your first 30 minutes.

## 5-Minute Wins
1. **Select your top framework** — Go to Frameworks and activate your primary compliance framework
2. **Run AI Gap Analysis** — Click AI Analysis → Gap Analysis for an instant compliance assessment
3. **Ask the AI Copilot** — Use the chat widget to ask "What are my highest priority controls?"

## 15-Minute Wins
4. **Implement 3 controls** — Mark your easiest controls as Implemented and watch Auto-Crosswalk work
5. **Upload evidence** — Drop a policy document into the Evidence section
6. **Review your dashboard** — Check compliance percentage and maturity score

## 30-Minute Wins
7. **Set up your team** — Invite colleagues and assign control owners
8. **Run a full assessment** — Use Assessments to test controls against procedures
9. **Generate a report** — Export a compliance summary for management`,

  'frameworks': `# 📋 Framework Management

Select, activate, and manage compliance frameworks.

## Selecting Frameworks
- Navigate to **Frameworks** in the sidebar
- Browse available frameworks by category (Cybersecurity, Privacy, Financial, AI Governance)
- Click **Activate** to add a framework to your organization
- Free tier: up to 2 frameworks | Starter: 5 | Professional+: unlimited

## Supported Frameworks
- **NIST CSF 2.0** — Cybersecurity Framework with 6 core functions
- **NIST 800-53 Rev 5** — Security and privacy controls for information systems
- **ISO 27001:2022** — Information security management system
- **SOC 2** — Trust Service Criteria for service organizations
- **NIST 800-171** — Protecting CUI in non-federal systems
- **CMMC Level 2** — DoD contractor cybersecurity maturity
- **GDPR** — EU data protection regulation
- **HIPAA** — Healthcare security requirements
- And 15+ more frameworks

## Auto-Crosswalk
When you implement a control in one framework, ControlWeave automatically finds matching controls (90%+ similarity) in other frameworks and marks them as satisfied. This dramatically reduces duplicate work across multi-framework environments.

## Framework Progress
Track implementation progress per framework on the Dashboard with real-time percentage completion.`,

  'controls': `# ✅ Controls & Implementation

Track security controls, assign owners, and record implementation evidence.

## Viewing Controls
- Controls are organized by **Control Family** (e.g., AC - Access Control, AU - Audit)
- Filter by framework, status, or search by ID/title
- Expand any control to see its full description and implementation details

## Control Statuses
- **Not Started** — Control has not been addressed
- **In Progress** — Implementation is underway
- **Implemented** — Control is fully implemented (triggers Auto-Crosswalk)
- **Satisfied via Crosswalk** — Automatically satisfied by a related control
- **Verified** — Implementation verified by assessor
- **Not Applicable** — Control does not apply to your environment

## Implementing Controls
1. Click a control to expand its details
2. Select a new status from the dropdown
3. Add implementation notes describing how the control is met
4. Assign an owner responsible for the control
5. Link evidence artifacts from the Evidence section

## Import / Export
- **Export XLSX/CSV** — Download all controls with current statuses for offline review
- **Import** — Upload updated statuses and notes back into ControlWeave
- Use Merge mode to preserve existing data while updating changed fields`,

  'settings': `# ⚙️ Settings & Configuration

Configure users, roles, integrations, LLM providers, and notifications.

## Plan & Billing
View your current tier, usage limits, and upgrade options.

## Roles & Permissions
- **Admin** — Full access to all features and settings
- **Analyst** — Read/write access to controls, evidence, and assessments
- **Auditor** — Read access with assessment and finding capabilities
- **Viewer** — Read-only access to dashboards and reports

## AI / LLM Configuration
- Configure AI providers (OpenAI, Anthropic, Google, etc.)
- Set organization-level BYOK (Bring Your Own Key) for AI features
- Manage AI usage limits per tier

## Integrations
- Connect external tools and services
- Configure webhook endpoints for event notifications
- Set up SSO/SAML for enterprise authentication

## Notifications
- Configure email notification preferences
- Set alert thresholds for compliance changes
- Enable real-time notifications for control updates`,

  'ai-copilot': `# 🤖 AI Copilot

Use the conversational AI assistant for GRC questions, guidance, and quick analysis.

## Getting Started
The AI Copilot is available via the chat widget in the bottom-right corner of every page. It has full context about your organization's compliance posture.

## What You Can Ask
- "What are my highest risk controls?"
- "Draft a policy for access control"
- "Explain the difference between NIST 800-53 AC-2 and ISO 27001 A.5.15"
- "What evidence do I need for SOC 2 CC6.1?"
- "Summarize my compliance gaps"

## How It Works
The Copilot uses your organization's data (frameworks, controls, evidence, assessments) to provide contextual, accurate answers. It supports multiple AI providers and respects your BYOK configuration.

## Tips
- Be specific in your questions for better answers
- Reference control IDs when asking about specific requirements
- Use "Draft a policy for..." to generate policy templates
- The Copilot remembers context within a conversation session`,

  'ai-analysis': `# 🔍 AI Analysis

Run structured AI-powered analyses for compliance insights.

## Available Analyses
- **Gap Analysis** — Identify unaddressed controls and compliance gaps
- **Risk Heatmap** — Visual risk assessment across control families
- **Compliance Forecast** — Predict compliance trajectory based on current progress
- **Audit Readiness** — Assess preparedness for upcoming audits
- **Crosswalk Optimizer** — Find opportunities to reduce duplicate compliance work
- **Evidence Mapper** — Map evidence artifacts to control requirements

## Parallel Assessment Swarms
Run multiple analyses simultaneously:
- **Full Assessment** (4 agents) — Gap analysis + forecast + risk heatmap + audit readiness
- **Risk Assessment** (2 agents) — Risk heatmap + gap analysis
- **Audit Preparation** (3 agents) — Audit readiness + gap analysis + crosswalk optimization

## Using AI Analysis
1. Navigate to **AI Analysis** in the sidebar
2. Select the analysis type you want to run
3. Click **Run** and wait for results (typically 10-30 seconds)
4. Review the detailed findings and recommendations
5. Export or share results with your team`,

  'vulnerabilities': `# 🛡️ Vulnerability Management

Import scan results, track findings, and generate AI-powered remediation plans.

## Importing Vulnerabilities
Supported formats:
- **Nessus** (.nessus XML files)
- **STIG** (STIG Viewer checklists)
- **SARIF** (Static analysis results)
- **IAVM** (Information Assurance Vulnerability Management)
- **CSV** (Generic vulnerability data)

## Tracking Findings
- View all vulnerabilities with CVSS scores and severity ratings
- Filter by severity (Critical, High, Medium, Low, Informational)
- Link vulnerabilities to affected assets in the CMDB
- Track remediation status and due dates

## AI Remediation Plans
- Click **Generate Remediation Plan** on any vulnerability
- AI analyzes the vulnerability context and suggests specific remediation steps
- Plans include priority, estimated effort, and control mappings

## Requirements
- Vulnerability features require Starter tier or higher
- AI remediation plans use your configured AI provider`,

  'tier-comparison': `# 📊 Tier Comparison

Feature-by-feature comparison across all ControlWeave tiers.

## Free Tier
- Up to 2 compliance frameworks
- 3 AI requests per month
- Core dashboard, controls, and assessments
- AI Copilot with basic context
- Community support

## Starter Tier
- Up to 5 frameworks
- 50 AI requests per month
- CMDB with up to 50 assets
- Vulnerability management
- Evidence management and reporting
- Email support

## Professional Tier
- Unlimited frameworks
- 500 AI requests per month
- Full CMDB with unlimited assets
- Knowledge Base (RAG) for AI enrichment
- Advanced AI analysis features
- Parallel assessment swarms
- Priority support

## Enterprise Tier
- Everything in Professional
- Unlimited AI requests
- SSO/SAML integration
- Custom integrations and webhooks
- Dedicated support
- SLA guarantees`,

  'user-guide': `# 📚 Complete User Guide

Full navigation guide covering every feature area.

## Dashboard
Your compliance command center showing KPIs, maturity score, framework progress, and recent activity. The Auto-Crosswalk counter shows how many controls are automatically satisfied.

## Controls
Browse, search, and manage all compliance controls. Group by framework or control family. Update implementation status and assign owners.

## Frameworks
Select and manage your active compliance frameworks. View framework-specific progress and requirements.

## Evidence
Upload, organize, and link compliance evidence to controls. Supports documents, screenshots, and policy files.

## Assets (CMDB)
Track hardware, software, AI agents, and service accounts. Link assets to controls for complete traceability.

## Assessments
Run structured assessment procedures against controls. Document findings and track remediation.

## Reports
Generate compliance reports, export data, and share progress with stakeholders.

## AI Features
- **AI Copilot** — Conversational GRC assistant
- **AI Analysis** — Structured compliance analyses
- **AI Monitoring** — Track AI usage and decisions
- **Knowledge Base** — Organization document search (Professional+)

## Settings
Configure users, roles, integrations, AI providers, and notifications.`
};

module.exports = router;
