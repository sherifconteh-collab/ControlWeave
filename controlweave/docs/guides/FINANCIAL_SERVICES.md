# 🏦 Financial Services Compliance Workspace

Specialized compliance tools for financial institutions using AI in advisory, trading, and client-facing operations.

## Access

Navigate to **Financial Compliance** in the sidebar or **Assets → Financial Compliance Workspace** in the CMDB.

## Reg BI Alignment

Track best-interest obligation alignment for AI-powered recommendations:

- **Best-Interest Obligation Disclosure** — AI recommendations include conflicts-of-interest disclosure
- **Care Obligation — Suitability** — Model validates customer risk profile before recommendation
- **Conflict of Interest Identification** — Automated detection of proprietary product bias
- **Customer Communication Review** — Supervisory pre-review of AI-generated communications
- **Algorithmic Trading Surveillance** — Real-time monitoring of AI trading decisions

## SR 11-7 Model Inventory

Maintain a model risk inventory per Federal Reserve SR 11-7 guidance:

- Track model name, risk tier (critical/high/medium/low), last validation date, and validation status
- Identify overdue validations and pending reviews
- Link models to CMDB AI Agent records for traceability

## FINRA Supervisory Audit Trail

Log supervisory review actions for AI-generated content per FINRA Notice 24-09:

- Enter supervisory review notes describing actions taken and AI output reviewed
- Each entry is timestamped, attributed to the reviewer, and immutable once logged
- View the full audit trail of logged entries directly in the workspace
- Entries are stored in the organization audit log for regulatory examination

## SEC Explainability Narrative Generator

Generate compliance narratives for SEC filings and examinations:

- AI-powered narrative generation explaining how AI is used in operations
- Covers Reg BI alignment, SR 11-7 model risk, and FINRA obligations
- Narratives are generated using the configured LLM provider
- Review and edit before submission

## Cross-Framework Crosswalk

Financial services frameworks (FINRA, SEC, SR 11-7) are pre-crosswalked to NIST AI RMF. Evidence collected for your AI RMF programme automatically satisfies overlapping requirements.

## Tips

- Use the FINRA Audit Trail regularly to document every supervisory review of AI-generated content
- Run the SEC Narrative Generator before regulatory examinations
- Check SR 11-7 validation statuses monthly to avoid overdue reviews
