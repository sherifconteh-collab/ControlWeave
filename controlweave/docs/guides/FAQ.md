# ❓ Frequently Asked Questions (FAQ)

## General Questions

**Q: What is ControlWeave?**  
A: ControlWeave is an AI-powered Governance, Risk, and Compliance (GRC) platform that helps organizations manage multi-framework compliance with crosswalk intelligence, evidence automation, and AI-assisted operations.

**Q: What compliance frameworks does ControlWeave support?**  
A: ControlWeave supports 15+ frameworks including NIST 800-53, ISO 27001, SOC 2, GDPR, HIPAA, PCI DSS, CMMC, FedRAMP, and more. See [Framework Management](FRAMEWORKS.md) for the full list.

**Q: Can I use ControlWeave without AI features?**  
A: Yes. The core platform (frameworks, controls, evidence, assessments, reports) works fully without configuring an AI provider.

---

## Pricing & Tiers

**Q: What's included in the Community tier?**  
A: The Community tier includes up to 2 frameworks, basic assessments, evidence management, POA&M tracking, and 10 AI requests per month.

**Q: How do I upgrade my tier?**  
A: Go to **Settings** → **Billing** → **Upgrade Plan**.

**Q: Do AI API keys count against my request limits?**  
A: If you configure your own API key (BYOK — Bring Your Own Key), AI requests made with that key do not count against ControlWeave's platform limits.

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
