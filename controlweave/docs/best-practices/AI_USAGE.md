# 🤖 AI Usage Guidelines

Best practices for effectively and responsibly using ControlWeave's AI features.

## Principles for AI-Assisted GRC

### 1. AI Assists, Humans Decide
AI analysis provides recommendations and insights. Final compliance decisions, risk acceptances, and remediation plans should always be reviewed and approved by qualified humans.

### 2. Data Quality In = Quality Out
AI outputs are only as good as your underlying data. Before relying on AI analysis:
- Ensure assessments are complete and current
- Upload relevant evidence
- Add implementation notes to controls

### 3. Review and Refine
Always review AI-generated content before using it:
- Check factual accuracy against your actual environment
- Customize generic recommendations to your specific context
- Use AI output as a starting point, not a final answer

## Getting the Best Results from AI Copilot

### Be Specific
Instead of: *"What are my compliance issues?"*  
Ask: *"What are the top 3 unimplemented NIST 800-53 access control gaps that would most impact our SOC 2 audit?"*

### Provide Context
Include relevant details:
- Framework name
- Control family or specific control ID
- System or asset context
- Timeframe

### Iterative Refinement
Follow up on AI responses:
- "Can you prioritize that list by remediation effort?"
- "What evidence should I collect for the top priority gap?"
- "Generate a remediation plan for AC-6"

## AI Analysis Best Practices

### Gap Analysis
- Run after activating a new framework
- Run quarterly for ongoing compliance monitoring
- Filter by control family to get focused recommendations

### Audit Readiness Score
- Run 3-6 months before a planned audit
- Use the output to prioritize your remediation roadmap
- Re-run monthly to track progress

### Compliance Forecast
- Use to set realistic timeline expectations for leadership
- Incorporate into quarterly compliance reviews
- Adjust resource allocation based on trend insights

## Privacy and Data Considerations

When using AI features:
- ControlWeave sends relevant organizational context to LLM providers
- **For sensitive environments**: Configure [Ollama](../integrations/OLLAMA.md) for fully local, offline inference
- Avoid including PII in AI Copilot queries when possible
- Review your LLM provider's data processing agreements

## Request Limit Management

Optimize your AI request usage:
- **Free/Starter tiers**: Use AI Copilot for priority questions, not routine lookups
- **BYOK**: Add your own API key to bypass platform limits entirely
- **Batch analyses**: Run comprehensive analyses rather than many small ones

## Related Guides

- [AI Copilot](../guides/AI_COPILOT.md) - AI Copilot user guide
- [AI Analysis](../guides/AI_ANALYSIS.md) - AI analysis features
- [Ollama Integration](../integrations/OLLAMA.md) - Private AI deployment
- [Settings & LLM Configuration](../guides/SETTINGS.md) - Configure AI providers
