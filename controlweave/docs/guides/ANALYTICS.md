# 📉 Analytics Dashboard Guide

Visualize and analyze your compliance data with ControlWeave's analytics capabilities.

## Overview

The Analytics Dashboard provides data-driven insights into your compliance program's health, trends, and risk exposure. Use it to track progress over time, identify patterns, and make informed decisions.

## Accessing Analytics

Navigate to **Reports** → **Analytics** or click the **📉 Analytics** tab in the main navigation.

## Available Analytics Views

### 1. Compliance Trend

Track your overall compliance percentage over time:
- Weekly / Monthly / Quarterly views
- Framework-level breakdown
- Control family drill-down

**Key metrics:**
- Overall compliance score trajectory
- Rate of improvement
- Stagnant or declining areas

### 2. Control Status Distribution

Visual breakdown of all controls by implementation status:

| Status | Color | Description |
|--------|-------|-------------|
| **Implemented** | 🟢 Green | Fully implemented and evidenced |
| **Partial** | 🟡 Yellow | Partially implemented |
| **Not Implemented** | 🔴 Red | Not started |
| **Not Applicable** | ⚫ Gray | Marked as N/A |

### 3. Evidence Age Analysis

Monitor evidence currency to ensure compliance evidence is fresh:
- Evidence older than 90 days flagged as stale
- Filter by control family or framework
- Identify controls at risk of evidence expiry

### 4. Assessment Completion Rates

Track assessment progress across your team:
- Completed vs. overdue assessments
- Assessor productivity metrics
- Assessment timeline adherence

### 5. Vulnerability Trends

For organizations using Vulnerability Management:
- Open vulnerability count over time
- Mean time to remediation (MTTR)
- Severity distribution trends
- SLA compliance rates

### 6. AI Usage Analytics

Track your AI feature utilization:
- AI analysis runs per month
- Most-used analysis types
- AI request quota consumption

## Filtering and Segmentation

All analytics views support filtering by:
- **Date Range**: Custom date picker
- **Framework**: Specific compliance framework
- **Control Family**: Domain or control category
- **User/Assessor**: Team member filter
- **Asset/System**: CMDB-linked filtering

## Exporting Analytics Data

1. Click **Export** in any analytics view
2. Choose format: **PDF**, **Excel**, or **CSV**
3. Select date range
4. Click **Download**

## Related Guides

- [Reports](REPORTS.md) - Generate formal compliance reports
- [Custom Dashboards](CUSTOM_DASHBOARDS.md) - Build personalized views
- [Dashboard](DASHBOARD.md) - Real-time compliance dashboard
- [AI Analysis](AI_ANALYSIS.md) - AI-powered compliance insights
