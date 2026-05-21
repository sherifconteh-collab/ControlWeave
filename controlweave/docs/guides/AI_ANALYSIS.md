# 🔍 AI Analysis Features Guide

Comprehensive guide to ControlWeave's AI-powered compliance analysis tools.

## What is AI Analysis?

AI Analysis provides structured, report-quality insights powered by large language models. Unlike the [AI Copilot](AI_COPILOT.md) (which is conversational), AI Analysis runs formal analyses that produce detailed, actionable reports tailored to your organization's data.

**Key Characteristics:**
- 📊 **Structured Output**: Formal reports with sections, tables, and recommendations
- 🏢 **Org-Aware**: Uses your live controls, assessments, evidence, and asset data
- ⏱️ **On-Demand**: Run analyses at any time
- 💾 **Persistent**: Results saved and viewable later
- 🎯 **Actionable**: Specific recommendations tied to your actual compliance gaps

---

## Prerequisites

Before running AI Analysis:

1. **Configure an LLM provider** (Settings → LLM Configuration)
2. **Have data in the system** (activated frameworks, controls, assessments)
3. **Check your tier limits** - each analysis consumes AI request credits

> **💡 Tip**: The more data you have in ControlWeave, the more accurate and specific your AI analyses will be.

---

## Available Analysis Types

### 1. Gap Analysis

**What it does**: Delivers a comprehensive compliance gap analysis with dual-perspective storytelling from a **CISO** (strategic risk) and **Lead Auditor** (evidence sufficiency), enriched with quantitative KPIs.

**Access**: Dashboard → AI Analysis → Gap Analysis  
**Or**: Controls page → AI Analysis button  
**Or**: Dashboard → AI Insights toggle (auto-runs on enable)

**Output includes:**
- **Executive KPI Dashboard** — RAG-rated scorecard of implementation rate, evidence coverage, assessment completion, control ownership, vulnerability exposure, and audit readiness score
- **CISO Strategic Risk Narrative** — business risk translation, financial exposure, regulatory penalties, Mean Time to Compliance (MTTC), and resource allocation recommendations
- **Lead Auditor Assessment** — evidence sufficiency evaluation, material weaknesses vs. significant deficiencies, audit readiness timeline per framework
- **Unified Remediation Roadmap** — phased plan (0-30, 30-90, 90-180 days) synthesizing both perspectives with crosswalk leverage points
- **Quick Wins & Momentum Builders** — 5-10 high-impact, low-effort controls with cross-framework benefit

**Data sources used:**
- Framework and control implementation status
- Evidence coverage (controls with linked evidence artifacts)
- Assessment procedure completion rates
- Control ownership/assignment rates
- Asset inventory and criticality metrics
- Vulnerability findings (open, critical, KEV-listed)

**Best used when:** Preparing for an audit, onboarding a new framework, quarterly compliance review, or presenting compliance posture to the board.

---

### 2. Audit Readiness Score

**What it does**: Scores your organization's readiness for an external audit against a specific framework.

**Access**: Dashboard → AI Analysis → Audit Readiness

**Output includes:**
- Overall readiness percentage
- Per-domain/family breakdown
- List of critical issues that would likely result in findings
- Recommended actions before the audit
- Estimated days to audit-ready

**Tier requirement:** Pro and above

**Example output:**
```
AUDIT READINESS: SOC 2 Type II
Overall Score: 67% — NOT READY

Domain Breakdown:
  CC1 (Control Environment): 85%
  CC6 (Logical Access): 42% ← CRITICAL
  CC7 (System Operations): 71%

Estimated time to ready: ~6 weeks
```

---

### 3. Compliance Forecast

**What it does**: Projects your compliance trajectory with dual-perspective analysis from a **CISO** (strategic timeline) and **Lead Auditor** (audit readiness forecast), enriched with velocity KPIs and trend indicators.

**Access**: Dashboard → AI Analysis → Compliance Forecast  
**Or**: Dashboard → AI Insights toggle (auto-runs on enable)

**Output includes:**
- **Compliance KPI Dashboard** — trend-annotated metrics (▲/▼/►) for implementation rate, velocity, evidence collection rate, assessment completion, and per-framework progress
- **CISO Strategic Forecast** — projected milestone dates, business risk timeline, resource burn rate, risk exposure window, and budget impact analysis
- **Lead Auditor Readiness Assessment** — evidence sufficiency forecast, assessment readiness timeline, control maturity projection, and audit engagement scheduling recommendations
- **Velocity Analysis & Bottleneck Identification** — acceleration/deceleration trends, implementation vs. evidence velocity comparison, framework-specific slowdowns
- **Acceleration Recommendations** — prioritized by CISO risk reduction and auditor evidence gap closure, with combined quick wins
- **Current Pace Risk Assessment** — compliance debt accumulation, regulatory deadline risks, and urgency metrics

**Data sources used:**
- Weekly implementation velocity (12-week history)
- Per-framework progress breakdown
- Evidence collection velocity (12-week history)
- Assessment completion rates and outcomes

**Best used when:** Reporting to leadership, planning sprints, setting realistic audit timelines, or justifying resource requests.

---

### 4. Crosswalk Optimizer

**What it does**: Identifies overlapping controls across your active frameworks so you can satisfy multiple requirements with a single implementation.

**Access**: Frameworks page → Crosswalk Optimizer

**Output includes:**
- Control mapping table (e.g., "NIST AC-2 ≈ ISO A.9.2.1 ≈ SOC 2 CC6.3")
- Estimated effort savings
- Implementation priority based on crosswalk value
- Recommended implementation order

**Best used when:** You have multiple frameworks and want to maximize efficiency.

---

### 5. Executive Report

**What it does**: Generates a board-ready compliance status report in non-technical language.

**Access**: Reports → AI Executive Report

**Output includes:**
- Executive summary (1-2 paragraphs)
- Key metrics table
- Top 3-5 risks with business impact
- Recommended investments
- Compliance trend chart data

**Audience:** C-suite, board of directors, non-technical stakeholders.

---

### 6. Regulatory Monitor

**What it does**: Scans for recent regulatory changes relevant to your active frameworks and flags potential impacts.

**Access**: Dashboard → AI Analysis → Regulatory Monitor

**Output includes:**
- Recent regulatory updates affecting your frameworks
- Impact assessment for your organization
- Recommended control updates
- Timeline for compliance with new requirements

**Tier requirement:** Enterprise and above

---

### 7. Risk Heatmap Analysis

**What it does**: Produces a risk heatmap by scoring controls on likelihood × impact dimensions.

**Access**: Dashboard → AI Analysis → Risk Heatmap

**Output includes:**
- Risk matrix visualization data (5×5 heatmap)
- Highest-risk control families
- Risk distribution by framework
- Prioritized mitigation list

---

### 8. Vendor Risk Assessment

**What it does**: Analyzes third-party vendor risk based on your asset inventory and control mappings.

**Access**: CMDB → Vendor Risk Analysis

**Output includes:**
- Vendor risk ratings
- Control gaps introduced by vendor relationships
- Recommended vendor questionnaire items
- Mitigation strategies

**Tier requirement:** Enterprise and above  
**Requires:** CMDB data (assets/environments with vendor information)

---

### 9. Security Posture Analysis

**What it does**: Evaluates your security posture against OWASP and NIST benchmarks.

**Access**: Dashboard → Security Posture

**Output includes:**
- OWASP Top 10 coverage score
- NIST CSF function scores (Identify / Protect / Detect / Respond / Recover)
- Critical gaps by standard
- Remediation priorities with effort estimates

---

### 10. Control-Specific Analysis

**What it does**: Deep-dives into a single control — explains it, assesses your implementation, and suggests improvements.

**Access**: Controls → [Control Detail] → AI Analysis button

**Output includes:**
- Plain-language explanation of the control
- Assessment of your current implementation
- Specific improvement recommendations
- Evidence requirements checklist
- Related controls to consider

---

### 11. Remediation Playbooks

**What it does**: Generates step-by-step remediation plans for specific controls or vulnerabilities.

**Access**: 
- Controls → [Control] → Generate Remediation Plan
- Vulnerabilities → [Vulnerability] → Generate Remediation

**Output includes:**
- Step-by-step remediation instructions
- Estimated time and resource requirements
- Tools and technologies needed
- Success criteria and testing approach
- Evidence to collect after remediation

---

### 12. Evidence Suggestions

**What it does**: Recommends specific evidence documents needed to satisfy a control's requirements.

**Access**: Controls → [Control] → Suggest Evidence

**Output includes:**
- List of recommended evidence types
- Example document names and formats
- Collection instructions
- Template language for common document types

---

### 13. Training Recommendations

**What it does**: Recommends security awareness training based on your framework requirements and current gaps.

**Access**: Dashboard → AI Analysis → Training Recommendations

**Output includes:**
- Recommended training topics by role
- Framework-required training programs
- Training schedule suggestions
- Documentation requirements

---

### 14. AI Governance Assessment

**What it does**: Evaluates your organization's AI system governance against NIST AI RMF, EU AI Act, and ISO 42001.

**Access**: Dashboard → AI Analysis → AI Governance

**Output includes:**
- AI governance maturity score
- Gaps against AI-specific frameworks
- Recommended policies and procedures
- Regulatory compliance status

**Requires:** AI/ML framework activated (NIST AI RMF, ISO 42001, or EU AI Act)

---

## Running an Analysis

### Step-by-Step

1. **Navigate** to the relevant page (Dashboard, Controls, etc.)
2. **Click** the AI Analysis button or select from the analysis menu
3. **Select analysis type** if prompted
4. **Configure options** (framework scope, date range, depth level)
5. **Click Run Analysis**
6. **Wait** for completion (typically 10–60 seconds)
7. **Review** the generated report

![AI Analysis running indicator showing spinner and progress message](../screenshots/ai-analysis-running-01.png)
*Figure 1: Analysis in progress*

![AI Analysis results panel showing structured report output](../screenshots/ai-analysis-results-01.png)
*Figure 2: AI Analysis results*

### Options Available

**Framework Scope:**
- All active frameworks
- Specific framework(s)
- Single framework

**Depth:**
- Quick (broader strokes, faster)
- Comprehensive (detailed analysis, may take longer)

**Date Range:**
- Point-in-time (current state)
- Trend comparison (compare to past period)

---

## AI Request Usage

Each analysis consumes AI request credits from your monthly allowance:

| Tier | Monthly AI Requests | Resets |
|------|---------------------|--------|
| Community | 10 | 1st of each month |
| Pro | Unlimited | N/A |
| Enterprise | Unlimited | N/A |
| Gov Cloud | Unlimited | N/A |

**Each analysis = 1 request** (regardless of complexity or length)

> **💡 Tip**: Use your own API key (BYOK) to avoid request limits. See [Settings → LLM Configuration](SETTINGS.md#llm-configuration).

### Checking Your Usage

1. Go to **Settings** → **AI Activity**
2. View current month usage
3. See breakdown by analysis type
4. Monitor usage trends

---

## Interpreting Results

### Severity Levels

AI Analysis uses consistent severity terminology:

| Level | Meaning | Recommended Action |
|-------|---------|-------------------|
| 🔴 Critical | Immediate audit risk or regulatory exposure | Address within 2 weeks |
| 🟠 High | Significant gap that needs prompt attention | Address within 30 days |
| 🟡 Medium | Notable gap but manageable risk | Address within 90 days |
| 🟢 Low | Minor gap or best practice improvement | Address within 6 months |

### Confidence Indicators

Results include confidence levels based on available data:
- **High Confidence**: Sufficient data in system for accurate analysis
- **Medium Confidence**: Some data gaps may affect accuracy
- **Low Confidence**: Limited data — add more controls/assessments for better results

---

## Best Practices

### Getting the Best Results

1. **Keep data current**: Regularly update control statuses and upload evidence
2. **Complete assessments**: More assessment data = better analysis
3. **Use specific scopes**: Analyzing one framework at a time gives more focused results
4. **Run regularly**: Monthly gap analysis tracks your improvement trajectory
5. **Act on results**: Create POA&M items directly from analysis findings

### Workflow Integration

**Weekly:**
- Run quick gap analysis to check for new gaps
- Generate remediation playbooks for priority controls

**Monthly:**
- Full audit readiness assessment
- Compliance forecast for leadership reporting
- Review AI activity logs for trends

**Quarterly:**
- Executive report generation
- Crosswalk optimizer review
- Regulatory monitor for framework updates

---

## Saving and Sharing Results

### Exporting Reports

1. After running an analysis, click **Export** or **Download**
2. Choose format: PDF, Markdown, or JSON
3. Reports are also saved in the system under **Reports** history

### Sharing with Team

1. Navigate to **Reports** in the sidebar
2. Select a saved analysis result
3. Click **Share** to generate a shareable link (viewers need account access)

---

## Troubleshooting

### "No LLM Provider Configured"

**Solution**: Go to Settings → LLM Configuration and add an API key.  
See [LLM Configuration Guide](SETTINGS.md#llm-configuration).

### "Insufficient Data for Analysis"

**Meaning**: Not enough controls, assessments, or evidence to generate meaningful results.

**Solution**:
1. Activate at least one framework
2. Implement 5+ controls with status updates
3. Complete at least 3 assessments
4. Upload evidence for implemented controls

### "AI Request Limit Reached"

**Solutions**:
1. Wait for monthly reset (1st of next month)
2. Upgrade your tier
3. Add your own API key (BYOK) to bypass limits — see [Settings → LLM Configuration](SETTINGS.md#llm-configuration)

### Slow or Incomplete Results

**Causes**: Large dataset, complex analysis, or LLM provider latency.

**Solutions**:
- Switch to a faster provider (Groq is fastest)
- Narrow the framework scope
- Run during off-peak hours

### Generic or Inaccurate Results

**Causes**: Insufficient org data, or analysis scope too broad.

**Solutions**:
- Add more implementation notes to controls
- Upload more evidence
- Complete more assessments
- Narrow analysis to one framework

---

## AI Analysis vs AI Copilot

| | AI Analysis | AI Copilot |
|---|---|---|
| **Format** | Structured report | Conversational |
| **Use case** | Formal deliverables | Quick questions |
| **Trigger** | On-demand button | Chat message |
| **Output** | Saved report | Chat response |
| **Best for** | Audits, executive reviews | Learning, exploring |

**Rule of thumb**: Need a PDF or executive summary? Use AI Analysis. Need a quick answer? Use [AI Copilot](AI_COPILOT.md).

---

## AI Evidence Suggestions

ControlWeave's AI can scan connected integrations (such as Splunk), analyze incoming logs and data against your active compliance frameworks, and suggest evidence items mapped to the correct controls. Each suggestion includes a confidence score and control mappings — nothing is added to your official evidence library until you approve it.

1. Go to the **Evidence** page
2. Scroll to the **AI Evidence Suggestions** section
3. Click **🔍 Scan Integrations** — the AI scans your connected integrations, analyzes the data, and creates pending evidence items
4. Review each suggestion's title, description, confidence score, and control mappings
5. Click **✓ Approve** to promote to the official evidence library, or **✗ Reject** to dismiss

> **💡 Token-Efficient**: AI evidence scans use a lightweight prompt profile that includes only the reference modules needed for evidence mapping, reducing token usage by ~70% compared to full-context analyses. Each scan sends only a small data sample and a compact control list to the AI.

See the full workflow in the [Evidence Management Guide](EVIDENCE.md#ai-evidence-suggestions).

**API**: `POST /api/v1/pending-evidence/scan` — see [API Documentation](../integrations/API_DOCS.md#ai-evidence-suggestions-pending-evidence) for all endpoints.

---

## Token-Efficient AI Architecture

ControlWeave uses a modular prompt system to minimize token usage across all AI features. Instead of sending the full ~2,000-token reference prompt on every call, each feature declares which reference modules it needs:

| Profile | Modules Included | Typical Token Savings |
|---------|-----------------|----------------------|
| `controls` | NIST pubs, control families, frameworks | ~50% fewer system tokens |
| `vulnerability` | NIST pubs, MITRE ATT&CK, OWASP | ~50% fewer system tokens |
| `evidence` | NIST pubs, control families | ~60% fewer system tokens |
| `audit` | NIST pubs, control families, frameworks | ~50% fewer system tokens |
| `policy` | NIST pubs, frameworks | ~60% fewer system tokens |
| `ai_governance` | NIST pubs, frameworks, MAESTRO | ~50% fewer system tokens |
| `risk` | NIST pubs, frameworks | ~60% fewer system tokens |
| `lean` | Core identity only | ~80% fewer system tokens |

All features retain the core GRC identity, behavioral instructions, and adversarial robustness protections regardless of profile.

---

## Related Guides

- [🤖 AI Copilot](AI_COPILOT.md) - Conversational AI assistant
- [📄 Evidence Management](EVIDENCE.md) - Evidence collection and AI suggestions
- [⚙️ Settings & LLM Configuration](SETTINGS.md#llm-configuration) - Configure AI providers
- [🎛️ Controls](CONTROLS.md) - Manage controls and track remediation
- [🔗 Integrations](INTEGRATIONS.md) - Connect Splunk and other tools
- [📊 API Documentation](../integrations/API_DOCS.md) - Pending Evidence API endpoints
- [🚀 Getting Started](GETTING_STARTED.md) - Initial platform setup
