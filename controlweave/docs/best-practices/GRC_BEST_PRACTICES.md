# 🏆 GRC Best Practices

Best practices for building and maintaining an effective GRC program with ControlWeave.

## 1. Start with Risk-Driven Framework Selection

Don't activate every available framework at once. Instead:
1. **Identify your compliance obligations** — contractual, regulatory, and industry requirements
2. **Prioritize by business impact** — which frameworks affect revenue or legal standing?
3. **Start with 1-2 frameworks** — master them before expanding
4. **Leverage crosswalks** — when you add a second framework, use crosswalk mappings to avoid duplicate work

## 2. Build an Evidence Library First

Before running assessments, establish your evidence library:
- Upload your existing policies and procedures
- Collect system configuration exports
- Document existing controls with implementation notes
- Tag evidence with relevant control mappings

**Tip**: Evidence linked to multiple controls multiplies its compliance value.

## 3. Conduct Assessments Systematically

Structure your assessment program for efficiency:
- **Prioritize high-risk controls** first (Critical and High)
- **Batch assessments by control family** for context efficiency
- **Use AI to pre-populate assessment notes** with implementation context
- **Schedule recurring assessments** for time-sensitive controls

## 4. Use AI to Accelerate, Not Replace, Judgment

AI analysis tools are most effective when:
- You have sufficient data (10+ controls assessed, evidence uploaded)
- You review and refine AI outputs before acting on them
- You use AI for first-pass gap analysis and prioritization
- Human experts validate AI recommendations for critical controls

## 5. Maintain Evidence Currency

Stale evidence undermines audit credibility:
- Set calendar reminders for evidence renewal (every 90-180 days)
- Monitor the Evidence Expiry widget on your dashboard
- Automate evidence collection where possible (SIEM, cloud configs)
- Document evidence collection procedures as a policy

## 6. Engage Auditors Early

For external audits:
- Create an engagement 3-6 months before the audit
- Grant auditor access to review evidence before fieldwork
- Use workpapers to document testing methodology
- Provide auditors with context through the AI Copilot

## 7. Track Remediation with POA&M

Don't let gaps linger untracked:
- Create POA&M items for every identified gap
- Set realistic target dates (not just aspirational ones)
- Assign clear owners to each item
- Review POA&M status in weekly/monthly compliance meetings

## 8. Use Dashboards for Stakeholder Communication

Different stakeholders need different views:
- **Executive Dashboard**: Overall compliance score, trend, top risks
- **Operational Dashboard**: Assessment queue, evidence expiry, open vulnerabilities
- **Auditor Dashboard**: Evidence status, finding status, engagement timeline

## Related Guides

- [Getting Started](../guides/GETTING_STARTED.md) - Initial setup
- [AI Analysis](../guides/AI_ANALYSIS.md) - AI-powered insights
- [POA&M Tracking](../guides/POAM.md) - Remediation planning
- [Custom Dashboards](../guides/CUSTOM_DASHBOARDS.md) - Stakeholder views
