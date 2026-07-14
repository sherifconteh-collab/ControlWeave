# ❓ Frequently Asked Questions (FAQ)

## General Questions

**Q: What is ControlWeave?**  
A: ControlWeave is an AI-powered Governance, Risk, and Compliance (GRC) platform that helps organizations manage multi-framework compliance with crosswalk intelligence, evidence automation, and AI-assisted operations.

**Q: What compliance frameworks does ControlWeave support?**  
A: ControlWeave supports 15+ frameworks including NIST 800-53, ISO 27001, SOC 2, GDPR, HIPAA, PCI DSS, CMMC, FedRAMP, and more. See [Framework Management](FRAMEWORKS.md) for the full list.

**Q: Can I use ControlWeave without AI features?**  
A: Yes. The core platform (frameworks, controls, evidence, assessments, reports) works fully without configuring an AI provider.

---

## Pricing & Licensing

**Q: Is ControlWeaver free?**  
A: Yes. ControlWeaver is fully open source with no tier gating — every feature (unlimited frameworks, all assessment depths, evidence management, POA&M tracking, AI features, integrations, and more) is available to every authenticated user. See [Tier Comparison](../TIER_COMPARISON.md) for background on the old tiered pricing model.

**Q: Is there a limit on AI requests?**  
A: No platform-imposed limit. AI requests are only bound by your configured LLM provider's own rate limits and quotas — using your own API key (BYOK — Bring Your Own Key) gives you direct control over that.

---

## AI Features

**Q: Which AI providers are supported?**  
A: Google Gemini, Groq, Ollama (self-hosted), Anthropic Claude, OpenAI GPT-4, and xAI Grok.

**Q: Is my data sent to AI providers?**  
A: When using AI features, relevant context from your organization's data is sent to the configured LLM provider. Use Ollama for fully offline/private deployments.

**Q: What counts as an AI request?**  
A: Each AI Copilot message and each AI Analysis run counts as one request. Viewing past results does not.

---

## Evidence & Assessments

**Q: What file types can I upload as evidence?**  
A: PDF, DOCX, XLSX, PNG, JPG, CSV, and TXT files up to 25MB each.

**Q: Can evidence be linked to multiple controls?**  
A: Yes. Evidence can be attached to multiple controls across frameworks.

**Q: How do crosswalk mappings work?**  
A: ControlWeave maps controls across frameworks so that a single piece of evidence or assessment can satisfy requirements in multiple frameworks simultaneously.

---

## Administration

**Q: Can I have multiple organizations?**  
A: Each account belongs to one organization. Contact support for multi-org arrangements.

**Q: How do I add external auditors?**  
A: Use the [Auditor Workspace](AUDITOR_WORKSPACE.md) to invite external auditors. They get scoped access limited to their assigned engagements.

**Q: Is there an API?**  
A: Yes. See [API Documentation](../integrations/API_DOCS.md) for the REST API reference.

---

## Related Guides

- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions
- [Error Messages](ERROR_MESSAGES.md) - Error message reference
- [Getting Started](GETTING_STARTED.md) - First steps with ControlWeave
