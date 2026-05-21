# 📁 Evidence Collection Tips

Best practices for building a strong, audit-ready evidence library in ControlWeave.

## What Makes Good Evidence?

High-quality compliance evidence is:
- **Accurate**: Reflects the actual state of the control
- **Current**: Collected within the required timeframe (typically 90-180 days)
- **Complete**: Covers the full scope of the control requirement
- **Authentic**: Clearly sourced from authoritative systems
- **Understandable**: Clearly explains what it demonstrates

## Evidence Types by Control Category

### Access Control Evidence
- Screenshots of user access lists with dates
- Role permission matrix exports
- Access review completion records
- Terminated account removal documentation

### Audit & Logging Evidence
- SIEM log configuration screenshots
- Log retention policy documentation
- Sample log exports (redact sensitive data)
- Alert rule configuration exports

### Vulnerability Management Evidence
- Vulnerability scan reports (PDF exports from scanning tools)
- Patch deployment records
- Remediation tickets or tracking system exports

### Training & Awareness Evidence
- Training completion certificates
- LMS (Learning Management System) completion reports
- Training attendance records

### Incident Response Evidence
- Incident response plan (dated)
- Tabletop exercise records
- Actual incident post-mortems (redacted)
- Contact list for incident response team

## Evidence Collection Frequency

| Control Type | Recommended Frequency |
|-------------|----------------------|
| Access reviews | Quarterly |
| Vulnerability scans | Monthly or quarterly |
| Training completion | Annual |
| Configuration baselines | Quarterly |
| Penetration tests | Annual |
| Policy reviews | Annual |

## Organizing Evidence in ControlWeave

### Tagging Strategy
Tag evidence to maximize reuse across frameworks:
- Use consistent naming: `[Control Family]-[Type]-[Date]` (e.g., `AC-UserAccessReview-2026Q1`)
- Add descriptive notes explaining what the evidence demonstrates
- Link to multiple controls when applicable

### Evidence Expiry Management
1. Check the **Evidence Expiry** dashboard widget weekly
2. Set ControlWeave reminders 30 days before evidence expires
3. Assign evidence renewal responsibilities to control owners

## Automating Evidence Collection

Starting with the **Pro tier**, ControlWeave offers two automated approaches to evidence collection:

### AI Evidence Suggestions (Recommended)

The fastest way to collect evidence automatically:

1. **Connect an integration** — Configure Splunk in **Settings → Integrations → Splunk**
2. **Scan** — Go to the **Evidence** page and click **🔍 Scan Integrations** in the AI Evidence Suggestions section
3. **Review** — The AI analyzes recent logs from your connected integrations, maps data to your active framework controls, and creates evidence suggestions with confidence scores
4. **Approve or Reject** — Each suggestion shows the AI's analysis, mapped controls, and confidence level. Click **✓ Approve** to add it to your official evidence library, or **✗ Reject** to dismiss

Best practices for AI evidence suggestions:
- Run scans regularly (weekly or after significant events)
- Review confidence scores — items below 50% may need manual verification
- Check the control mappings before approving to ensure accuracy
- Use the reject option freely — the AI will learn from your patterns over time

### Collection Rules

For scheduled, recurring evidence collection:

1. Create a rule in the **Auto-Collection Rules** section on the Evidence page
2. Set the schedule (daily, weekly, or monthly)
3. Define the Splunk query and control mappings
4. Evidence is collected automatically on schedule

### Manual Splunk Import

For one-off imports, use the **Import from Splunk** button in the Upload Evidence panel.

> **Tip**: AI Evidence Suggestions are the most efficient approach because the AI handles control mapping automatically. Collection rules are better for recurring queries where you want the same data collected on a fixed schedule.

## Related Guides

- [Evidence Management](../guides/EVIDENCE.md) - Full evidence guide including AI workflow
- [Splunk Integration](../integrations/SPLUNK.md) - Setting up Splunk
- [Integrations](../guides/INTEGRATIONS.md) - Connect evidence sources
- [GRC Best Practices](GRC_BEST_PRACTICES.md) - Overall GRC program guidance
- [API Documentation](../integrations/API_DOCS.md) - Pending Evidence API endpoints
