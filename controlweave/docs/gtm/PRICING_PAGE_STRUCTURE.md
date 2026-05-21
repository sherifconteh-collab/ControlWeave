# ControlWeave MCP Pricing Structure (Aligned to ControlWeave Tiers)

## Pricing Principle
ControlWeave MCP should inherit ControlWeave subscription entitlements. Do not sell MCP as a disconnected SKU.

## Positioning Statement
MCP is the AI workflow interface for ControlWeave. Access level, advanced tool families, and limits are determined by the customer's active ControlWeave tier.

## Packaging Model
Use existing ControlWeave tiers as the pricing anchor:

1. Community
2. Pro
3. Enterprise
4. Gov Cloud & Advisory (includes platform + consulting services)

## Recommended Tier Matrix
| Tier | MCP Access | Tool Families | AI Usage Envelope | Buyer Message |
|---|---|---|---|---|
| Community | Included | Core read/query workflows + all 25+ AI analysis features + AI Threat Library + Regulatory News | Unlimited (BYOK) | Full AI-powered GRC — bring your own API key |
| Pro | Included | Adds operational workflows (evidence, CMDB, vulnerability management, AI monitoring) | Unlimited | Run repeatable team workflows with asset management |
| Enterprise | Included | Adds advanced intelligence workflows (SIEM, threat intel, maturity score, AI governance) | Unlimited | Scale AI-led compliance operations |
| Gov Cloud & Advisory | Included | Enterprise-equivalent + consulting services | Unlimited | Full governance, regulated deployment, and expert advisory |

## Commercial Rules
- No separate "MCP license" line item.
- Tier upgrade should automatically unlock additional MCP capabilities.
- Any API/tool rate overage should map to existing platform overage policy, not MCP-only billing.
- Services (onboarding, playbook design, private deployment) can be sold as add-ons.

## Add-On Structure (Optional)
- Implementation package (2-week pilot onboarding)
- Governance pack (advanced audit exports and policy templates)
- Private/self-hosted deployment support
- Premium support SLA

## Pricing Page Sections
1. Hero: "MCP Included in Every ControlWeave Tier"
2. Tier comparison table (above)
3. "How access is enforced" section (role + permission + tier)
4. Security and deployment options
5. Upgrade CTA tied to ControlWeave plan changes

## Enforcement Notes (Product/RevOps Alignment)
Align messaging with backend behavior:
- Tier normalization and limits: `backend/src/config/tierPolicy.js`
- AI usage checks: `backend/src/routes/ai.js`
- Tier-gated route families (examples): pro, enterprise, govcloud route guards

## Sales FAQ Copy
**Q: Do I need to buy MCP separately?**
A: No. MCP capabilities are included based on your ControlWeave tier.

**Q: What happens if I upgrade tiers?**
A: Newly entitled MCP tool families unlock automatically.

**Q: Can we self-host MCP?**
A: Yes. Self-hosted secure MCP is available for customers with stricter control requirements.
