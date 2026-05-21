# ControlWeave Perpetual License Guide

## Own ControlWeave Forever — No Subscription Required

ControlWeave offers perpetual software licenses for organizations that need to **own the software outright** rather than pay a recurring subscription. Think of it like buying Microsoft Office instead of subscribing to Microsoft 365: you pay once, and that version of ControlWeave is yours to use forever on your own infrastructure.

ControlWeave's community edition is published under **AGPL v3**, which is free to self-host. Perpetual licenses provide a **Commercial License** on top — removing AGPL copyleft obligations, adding indemnification and IP warranties, and including a year of priority support and updates. This is the right path for organizations that cannot accept AGPL terms or need SLA-backed delivery.

This option is ideal for regulated industries, government environments, and organizations with policies that restrict ongoing SaaS vendor relationships.

---

## Who This Is For

| Buyer Type | Reason for Perpetual |
|---|---|
| **Federal / DoD contractors** | FedRAMP / FISMA asset ownership requirements; SaaS dependencies may not pass ATO |
| **Healthcare organizations** | HIPAA BAA complexity with SaaS vendors; prefer on-premise data residency |
| **Financial services** | Regulatory capital / opex vs. capex accounting; OCC guidance on third-party risk |
| **Large enterprises** | Procurement prefers one-time software asset purchase over perpetual opex |
| **Government agencies** | Budget cycles require one-time purchase; multi-year subscription restrictions |
| **OEM / ISV partners** | Want to embed or white-label ControlWeave in their own product |
| **Systems integrators** | Building ControlWeave into a broader solution for resale |

---

## License Tiers

### Professional Perpetual — $7,995 one-time

> *Right for teams that need a self-hosted compliance platform without a subscription.*

**Includes:**
- Single deployment on your own infrastructure (cloud VM, on-premise server, private cloud)
- Up to 50 named user accounts
- All Professional SaaS features: 25+ frameworks, unlimited CMDB assets, TPRM, evidence automation, AI Copilot (BYOK), Auditor Workspace, Jira/Slack/GitHub integrations, custom dashboards, PDF/Excel exports, MCP Server
- 1 year of software updates (new framework releases, security patches, feature releases)
- 1 year of email support (response within 2 business days)
- Deployment documentation and migration guides

**After year 1:**
- Annual Maintenance Plan: **$1,500/year**
- Covers: all software updates, security patches, email support continuation
- Optional — the software keeps working without maintenance, but you won't receive updates or support

**Not included:**
- Hosted infrastructure (you manage your own servers)
- Utilities-tier frameworks (NERC CIP, FINRA, SEC AI, etc.)
- SSO/SAML/SCIM, white-label, SIEM integration
- 24/7 support or SLA-backed response times

---

### Enterprise Perpetual — $24,995 one-time

> *Right for large organizations, government agencies, or regulated enterprises that need full platform capability on their own infrastructure.*

**Includes everything in Professional Perpetual, plus:**
- Unlimited user accounts
- All Enterprise SaaS features: SSO/SAML/SCIM, white-label reports, SIEM integration (Splunk, Microsoft Sentinel), custom data residency, RMF Lifecycle (NIST SP 800-37), CMDB dependency graph, auto-discovery webhooks (Nmap, Qualys, Tenable), custom asset fields, dedicated deployment options
- 1 year of software updates and **priority support** (response within 4 business hours)
- 2 onboarding sessions (deployment assistance, framework activation, admin training)

**After year 1:**
- Annual Maintenance Plan: **$4,500/year**
- Covers: all software updates, security patches, priority support continuation, 1 quarterly posture review session

**Not included:**
- Utilities-tier frameworks (available as an add-on — see below)
- Hosted infrastructure
- Source code or right to modify

---

### Source Code License — $49,995 one-time

> *Right for organizations that need to audit, modify, or deeply integrate the ControlWeave codebase internally.*

**Includes everything in Enterprise Perpetual, plus:**
- Full source code access (backend, frontend, SDK, migrations)
- Right to build, modify, and deploy internally within your organization
- Internal use only — redistribution and resale are not permitted under this tier
- 1 year of premium support (direct engineering escalation path, response within 2 business hours)
- 1 year of update access
- Code review session for major internal customizations

**After year 1:**
- Annual Maintenance Plan: **$9,500/year**
- Covers: source code updates for new features and security patches, premium support

**Not included:**
- Right to redistribute, resell, or sublicense (requires OEM License)
- White-label distribution

---

### Utilities Add-On — $4,995 one-time (with any perpetual tier)

Adds the full Utilities-tier framework suite to any perpetual deployment:

- FINRA Notice 24-09 AI Governance
- SEC AI Risk Management Guidance
- SR 11-7 Model Risk Management
- NERC CIP (critical infrastructure)
- GDPR, HIPAA, CCPA/CPRA, EU AI Act (full module)
- State AI Governance Laws
- AI Regulatory Monitoring workspace
- Financial Services compliance workspace

Annual maintenance for Utilities frameworks: **$995/year**

---

### OEM / White-Label License — Custom Pricing

For partners building ControlWeave into their own product or service:

- Embed ControlWeave under your own brand
- Distribute to your end customers
- Revenue share or flat-fee arrangements depending on volume and use case
- Source code rights available under OEM terms (separate from Source Code License)
- White-label UI, custom domain, custom branding
- API-only embedding also available

Contact **contehconsulting@gmail.com** to discuss OEM terms, volume pricing, and deal structure.

---

## What You Get — Delivery Process

Once a perpetual license is purchased:

1. **License agreement** — digitally signed software license agreement delivered within 1 business day
2. **License key** — a perpetual license key issued for your deployment, tied to your domain/org identifier
3. **Software package** — access to the versioned software build (Docker images, source archives, or GitHub private fork access depending on tier)
4. **Documentation** — deployment guides, migration scripts, environment variable reference, backup/restore procedures
5. **Onboarding** — kickoff session within 5 business days to assist with initial deployment and framework activation

---

## Comparison: Perpetual vs. SaaS

| | SaaS Subscription | Perpetual License |
|---|---|---|
| **Payment model** | Monthly or annual recurring | One-time purchase |
| **Infrastructure** | Hosted by ControlWeave | You manage your own |
| **Updates** | Automatic, always current | Included in year 1; maintenance plan optional after |
| **Uptime guarantee** | 99.9% SLA (Enterprise) | Your responsibility |
| **Data residency** | Configurable (Enterprise) | Fully your control |
| **Procurement model** | Opex / subscription | Capex / software asset |
| **Vendor dependency** | Ongoing | Minimal — software runs without us |
| **Best for** | Fast deployment, no ops team | Regulated, air-gapped, or capex environments |

---

## Annual Maintenance Plans

Maintenance is **optional** but recommended. Without an active maintenance plan, ControlWeave continues working but you will not receive:

- New compliance framework releases (e.g., new NIST revisions, new EU AI Act guidance)
- Security patches for newly discovered vulnerabilities
- Feature releases
- Technical support

| License Tier | Annual Maintenance |
|---|---|
| Professional Perpetual | $1,500/year |
| Enterprise Perpetual | $4,500/year |
| Source Code License | $9,500/year |
| Utilities Add-On | $995/year |

Maintenance plans renew annually. Lapsed maintenance can be reinstated at the current maintenance rate (no reinstatement fee if lapsed for less than 12 months).

---

## Frequently Asked Questions

**Can I upgrade from SaaS to a perpetual license?**
Yes. If you are an existing SaaS subscriber, we will credit up to 6 months of subscription payments toward a perpetual license purchase. Contact sales to arrange.

**Does perpetual include AI features?**
Yes — all AI Copilot features are included. AI features use BYOK (Bring Your Own Key) for Anthropic, OpenAI, Gemini, or other supported providers. Your API keys, your costs, no AI surcharge from ControlWeave.

**Can I run it in an air-gapped environment?**
Yes. ControlWeave can be deployed fully air-gapped. AI features require network access to your chosen LLM provider unless you use a self-hosted model (Ollama is supported).

**What happens if my maintenance lapses?**
The software continues to run. You just won't receive updates or support until you renew. There's no license expiration or kill switch.

**Can I transfer the license if we are acquired?**
Yes. Perpetual licenses are transferable to a successor entity in an acquisition (M&A transfer). Notify contehconsulting@gmail.com and provide acquisition documentation.

**Does the Source Code License let me build a competing product?**
No. The Source Code License grants rights for internal use and modification only, within your organization. Building a competing product or redistributing the source requires an OEM license with separate terms.

**Can we negotiate volume pricing or multi-deployment licenses?**
Yes. Contact contehconsulting@gmail.com for multi-site, multi-subsidiary, or campus licensing arrangements.

---

## How to Purchase

1. **Email contehconsulting@gmail.com** with:
   - Desired license tier
   - Organization name and deployment domain/environment
   - Expected user count
   - Any specific compliance frameworks or requirements

2. We will respond within 1 business day with a formal quote and license agreement draft.

3. On signature and payment (wire transfer, ACH, or credit card), license key and software delivery begin within 1 business day.

---

## Contact

| Inquiry | Contact |
|---|---|
| **Perpetual license purchase** | contehconsulting@gmail.com |
| **OEM / white-label** | contehconsulting@gmail.com |
| **Technical pre-sales questions** | contehconsulting@gmail.com |
| **Existing license support** | contehconsulting@gmail.com |

---

*Pricing effective as of March 2026. All prices in USD. Volume discounts available for multi-site or multi-entity deployments. Government and education pricing available — contact sales.*
