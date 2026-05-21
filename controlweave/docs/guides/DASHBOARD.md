# 📊 Dashboard Guide

Your compliance command center — a real-time view of your organization's security and compliance posture.

## Overview

The ControlWeave Dashboard provides an at-a-glance summary of your compliance status across all active frameworks, recent activity, priority actions, crosswalk impact, and trend data. The dashboard refreshes automatically and uses server-side caching (30-second TTL) for performance.

---

## Dashboard Sections

### Overall Compliance Score

The top-level metric showing your organization's compliance posture:

- **Total Controls** — all controls from active frameworks
- **Implemented** — controls marked as fully implemented
- **Satisfied via Crosswalk** — controls satisfied through crosswalk mappings
- **Compliance Percentage** — `(Implemented + Crosswalked) / Total × 100`

> **💡 Tip**: Compliance percentage includes crosswalk credits. Implementing one high-coverage control may satisfy requirements across multiple frameworks simultaneously.

### Compliance Maturity Score

> **💡 Tier requirement**: The Maturity Score panel requires **Enterprise tier or above**.

The Maturity Score rates your GRC program on a **0–5 scale** across multiple dimensions:

| Level | Label | Description |
|-------|-------|-------------|
| 0–1 | Initial | Ad-hoc, undocumented, reactive |
| 2 | Developing | Some processes defined but inconsistent |
| 3 | Defined | Documented, standardized processes |
| 4 | Managed | Measured and monitored regularly |
| 5 | Optimizing | Continuous improvement and automation |

The Maturity Score panel shows:
- **Overall score** (e.g., 3.2/5)
- **Maturity label** (e.g., "Defined")
- **Dimension breakdown** — scores for individual areas such as control implementation, evidence quality, and assessment coverage
- **Recommendations** — up to 3 actionable steps to advance your maturity level

> **💡 Tip**: Work through the listed recommendations to progress to the next maturity level.

### Framework Breakdown

A card or table for each active framework showing:

- Framework name and code
- Total controls in the framework
- Implemented count
- Crosswalked count
- Framework-level compliance percentage

Click any framework card to navigate directly to that framework's control list.

### Priority Actions

Up to 20 high-priority controls that have **not yet been started**:

- Control ID and title
- Framework name
- Priority level (P1 / High / Critical)

Use this list to focus your implementation effort on the most impactful controls first.

### Recent Activity

The last 20 audit log events for your organization, showing:

- Event type (e.g., control status changed, evidence uploaded)
- Resource type and details
- User who performed the action
- Timestamp

### Control Implementation Activity

Recent changes to control implementations:

- Control ID and title
- Previous and new status
- Who made the change
- When the change occurred

### Compliance Trend

A time-series chart of control implementation activity over your selected period:

| Period | Description |
|--------|-------------|
| **7d** | Last 7 days |
| **30d** | Last 30 days (default) |
| **90d** | Last 90 days |
| **1y** | Last 12 months |

The trend shows daily counts of controls implemented and total implementation changes.

### Crosswalk Impact

How much coverage you're gaining through crosswalk mappings:

- Per-framework count of crosswalk-satisfied controls
- Which frameworks benefit most from your current implementations

---

## Dashboard Customizer

Personalize your dashboard by showing or hiding individual sections.

### Toggle Sections On/Off

1. Click **Customize Dashboard** (top-right of the dashboard header)
2. A checklist appears with all available sections:
   - ☑ Top KPI Cards
   - ☑ Maturity Score
   - ☑ Status & Framework Charts
   - ☑ Compliance Trend
   - ☑ Auto-Crosswalk Highlight
   - ☑ Framework Progress
   - ☑ Recent Activity Feed
3. Check or uncheck each section to show or hide it
4. Click **Close Customizer** — preferences are saved automatically per user

> **💡 Note**: Dashboard preferences are stored locally per browser session and are not synced across devices.

---

## AI Insights

The dashboard includes on-demand **AI Insights** powered by your configured LLM provider.

### Toggle AI Insights

Click **AI Insights: Off** (top-right of the dashboard) to turn AI insights on. The button label toggles between **AI Insights: On** and **AI Insights: Off**.

When enabled, the dashboard automatically fetches:
- **Gap Analysis** — a plain-language summary of your top compliance gaps and recommended next steps
- **Compliance Forecast** — a projected compliance trajectory based on your current implementation velocity

> **💡 Tip**: AI Insights results are cached for 6 hours. Disable AI Insights if you want to minimize AI API usage.

> **⚠️ Requirement**: AI Insights require a configured LLM provider in **Settings → LLM Configuration**.

---

## Dashboard Metrics

### Understanding Your Score

| Score Range | Status |
|------------|--------|
| 0–39% | 🔴 Critical — significant gaps in control implementation |
| 40–64% | 🟡 Needs Improvement — foundational controls partially in place |
| 65–79% | 🟠 Progressing — most controls implemented, gaps remain |
| 80–94% | 🟢 Good — strong compliance posture |
| 95–100% | ✅ Excellent — near-complete implementation with evidence |

### What Affects Your Score

**Increases score:**
- Marking controls as **Implemented**
- Controls automatically satisfied via **Crosswalk**

**Does not increase score (yet):**
- Controls marked **In Progress**
- Controls marked **Needs Review**

---

## Navigating from the Dashboard

The dashboard is your navigation hub. From here you can:

- Click **Framework** cards → drill into that framework's controls
- Click **Priority Actions** → open the specific control
- Click **Recent Activity** events → see audit log details
- Use the sidebar to navigate to any module

---

## Performance

The dashboard data is cached server-side for 30 seconds to ensure fast load times even with large control inventories (500+ controls). If you need the very latest data, refresh the page.

> **💡 Performance note (v2.3.0)**: Dashboards for organizations with 500 or more controls received targeted query optimizations in this release, resulting in measurably faster load times for framework breakdowns and priority actions.

---

## NIST RMF Lifecycle Dashboard

Organizations managing federal system authorizations can access the dedicated **RMF Lifecycle Dashboard** from the left sidebar under **RMF**. It provides:

- Step-by-step tracking across all six NIST RMF lifecycle phases (Categorize, Select, Implement, Assess, Authorize, Monitor)
- Authorization package management and ATO status
- Direct links between RMF steps and the controls and evidence associated with each system

See the [NIST RMF Lifecycle Guide](RMF.md) for full details.

---

## Related Features

- [Frameworks Guide](FRAMEWORKS.md) — Activate and manage frameworks
- [Controls Guide](CONTROLS.md) — Implement controls to improve your score
- [AI Analysis Guide](AI_ANALYSIS.md) — AI-powered gap analysis and recommendations
- [Reports Guide](REPORTS.md) — Export your compliance metrics
- [NIST RMF Lifecycle Guide](RMF.md) — Manage system authorization packages
