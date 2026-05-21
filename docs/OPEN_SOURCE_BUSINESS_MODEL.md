# ControlWeave Open Source Business Model
## Marketing, Services & Acquisition Strategy
*Prepared by Conteh Consulting LLC | March 2026 | For internal use*

---

## 1. Strategic Context: What Changes with Open Source

Transitioning ControlWeave to an open-source model is not a cost reduction — it is a **market positioning move**. For AI governance and GRC, open source signals auditability, trust, and regulatory credibility. These are the exact values that federal agencies, healthcare systems, and financial institutions require before adopting a governance platform.

### Core Positioning Shift

| | Before | After |
|---|---|---|
| **Primary message** | "Trust our platform to govern your AI" | "Audit the code that audits your AI — then let us run it for you" |
| **License** | Proprietary / MIT | AGPL v3 (community) + Commercial License |
| **Community tier purpose** | Lead generation | Genuine community tool + top-of-funnel |
| **Enterprise value prop** | Feature access | Liability reduction + implementation certainty + SLA |

### 1.1 Marketing Message Pivots

| Theme | Updated Message |
|---|---|
| **Transparency** | Every control mapping, evidence schema, and audit workflow is publicly verifiable — no black boxes in your AI governance stack. |
| **Community Signal** | Contributions from AI governance practitioners, federal contractors, and compliance engineers validate the methodology. |
| **Regulatory Credibility** | Open-source methodology aligns with EU AI Act Article 17 auditability expectations and NIST AI RMF traceability requirements. |
| **Vendor Lock-in Defense** | Customers own their governance data and workflows. Enterprise contracts add scale, support, and SLA — not dependency. |
| **SEO / Content Moat** | Community-contributed framework mappings (NIST 800-53, ISO 42001, CMMC) become organic ranking assets. |

### 1.2 Real-World Proof at Enterprise Scale

| Company | Model | Revenue |
|---------|-------|---------|
| GitLab | Open-source DevOps, paid enterprise tiers | $500M+ ARR, $8B market cap |
| Elastic | Open-source search, cloud + enterprise | $1B+ ARR, NYSE listed |
| HashiCorp | Open-source infrastructure tools | $500M+ ARR (acquired by IBM for $6.4B, 2024) |
| MongoDB | Open-source database, Atlas cloud | $1.3B+ ARR, NYSE listed |
| Grafana Labs | Open-source observability | $200M+ ARR |

All started with a free, useful product. Revenue came from hosting, enterprise features, and services. **ControlWeave follows this same playbook in the GRC/AI governance vertical.**

---

## 2. Updated Service Offering Architecture

The open-source transition creates a dual-track model: community adoption fuels brand awareness and inbound pipeline, while commercial tiers monetize scale, support, and enterprise-grade features.

### 2.1 Tier Structure

| Tier | Price | Target | Key Features |
|---|---|---|---|
| **Community** | Community | Practitioners, researchers, small teams | Self-hosted OSS (AGPL v3); community Slack; NIST AI RMF & EU AI Act mappings; basic risk register |
| **Pro (SaaS)** | $499/mo | SMBs, consultants, early GRC buyers | Hosted & managed; SSO; 5-user seats; standard support (48h SLA); quarterly framework updates |
| **Enterprise** | $3,500–$12,000/mo | Federal agencies, regulated industries, large enterprises | BYOK encryption; RBAC; audit-ready evidence packs; dedicated CSM; custom framework ingestion; 4h SLA |
| **Gov Cloud** | Custom / contract | DoD, IC, FedRAMP-required environments | FedRAMP-ready deployment; IL4/IL5 architecture; ITAR-compliant logging; ISSM-level support |
| **Pro Services** | $195–$295/hr | Any tier needing hands-on implementation | ATO package buildout; control mapping workshops; AI risk register setup; ISSM advisory retainer |

### 2.2 What Each Tier Sells (Beyond Features)

Enterprise buyers are not paying for the software — they are paying for:

- **Liability reduction**: Defensible evidence of AI governance for regulators and auditors
- **Implementation certainty**: Expert-configured framework mappings, not DIY setup
- **Continuity assurance**: SLAs, dedicated support, and roadmap alignment
- **Trust transfer**: ControlWeave's federal GRC pedigree as a reputational backstop

### 2.3 The Community-to-Pro Conversion Funnel

```
GitHub Stars / Self-Hosted Community Users
              │
              │ (10-20% conversion trigger)
              │  "I need hosting / support / audit-ready evidence packs"
              ▼
        Free Pro Trial (14-day full-feature trial on hosted)
              │
              │ (30-40% of trial orgs convert)
              ▼
        Pro ($499/mo) → Enterprise ($3,500–$12,000/mo) → Gov Cloud (custom)
              │
              │ (upsell triggers: seat limit, SLA need, federal contract win)
              ▼
        Pro Services ($195–$295/hr) for implementation & advisory
```

---

## 3. Licensing Strategy

Open source without a licensing strategy is just free software. ControlWeave adopts a **dual-licensing model** that protects commercial value while preserving community credibility.

### 3.1 AGPL v3 + Commercial License (Recommended)

| License | Purpose & Terms |
|---|---|
| **AGPL v3 (OSS)** | Public codebase available under AGPL. Any SaaS product built on ControlWeave must open-source their modifications or purchase a commercial license. Prevents free-riders from reselling hosted versions. |
| **Commercial License** | Sold to enterprises that cannot accept AGPL copyleft terms (common in regulated industries). Includes indemnification, IP warranties, and SLA-backed support. Starting at $15,000/yr for base commercial license. |
| **OEM / Embed License** | For GRC platforms, cloud providers, or SI partners who want to embed ControlWeave in their stack. Revenue share or flat annual fee. Retains ControlWeave branding or white-label option at premium. |

### 3.2 Why AGPL vs MIT/Apache?

- **MIT/Apache**: Anyone (including competitors) can take the code, build a SaaS, and owe you nothing.
- **AGPL**: Forces SaaS providers to either open their modifications or buy your commercial license.
- **Result**: Community gets the tool; enterprises pay for the right to use it in proprietary environments.

### 3.3 What Stays Open (AGPL — Forever)

- The compliance engine (controls, frameworks, evidence, assessment procedures)
- The REST API at `/api/v1`
- All framework definitions and crosswalk mappings
- The MCP server
- Basic dashboard and reporting

### 3.4 What Requires a Commercial Plan

- Enterprise-grade deployment (BYOK, RBAC, evidence packs)
- Dedicated CSM and SLA-backed support
- Gov Cloud / FedRAMP deployment
- SSO/SAML/SCIM, white-label, SIEM integration
- Custom framework ingestion
- Indemnification and IP warranty

---

## 4. Revenue Model: Four Streams

### Stream 1 — SaaS Subscriptions (Primary)

```
┌──────────────────────────────────────────────────────────────────┐
│  COMMUNITY                                                        │
│  Self-hosted AGPL v3 • Community Slack & GitHub                   │
│  NIST AI RMF & EU AI Act mappings • Basic risk register           │
├──────────────────────────────────────────────────────────────────┤
│  PRO — $499/month                                                 │
│  Hosted & managed • SSO • 5-seat minimum                          │
│  48h SLA standard support • Quarterly framework updates           │
│  25+ frameworks • Unlimited AI requests (BYOK)                    │
│  MCP Server & API access • Jira/Slack/GitHub integrations         │
├──────────────────────────────────────────────────────────────────┤
│  ENTERPRISE — $3,500–$12,000/month                                │
│  All Pro features • BYOK encryption • RBAC                        │
│  Audit-ready evidence packs • Custom framework ingestion          │
│  Dedicated CSM • 4h SLA • RMF Lifecycle (NIST SP 800-37)         │
│  SIEM integration (Splunk, Sentinel) • White-label                │
│  Commercial license included                                      │
├──────────────────────────────────────────────────────────────────┤
│  GOV CLOUD — Custom / contract                                    │
│  FedRAMP-ready deployment • IL4 / IL5 architecture                │
│  ITAR-compliant audit logging • ISSM-level support                │
│  Air-gapped deployment option • ATO package support               │
│  CMMC 2.0 & RMF Lifecycle                                         │
└──────────────────────────────────────────────────────────────────┘
```

### Stream 2 — Professional Services (High-Margin)

**ATO Package Buildout: $15,000–$50,000**
```
✅ Authority to Operate documentation package
✅ Control implementation statements and evidence mapping
✅ System Security Plan (SSP) framework configuration
✅ Risk Assessment Report template and guidance
✅ Plan of Action & Milestones (POA&M) setup
✅ ISSM advisory throughout the authorization process
Time: 50–150 hours @ $195–$295/hr effective rate
```

**Implementation Package: $8,000–$20,000**
```
✅ Platform deployment on customer infrastructure (if self-hosted)
✅ Framework activation and configuration
✅ Control library migration from existing tools
✅ Team onboarding (admin, auditor, viewer roles)
✅ RMF package setup (federal/DoD customers)
✅ 90-day post-implementation email support
Time: 25–50 hours
```

**Advisory Retainer: $5,000–$15,000/month**
```
• ISSM advisory on an ongoing basis
• Monthly AI governance posture review
• Framework update integration (new NIST revisions, EU AI Act guidance)
• Audit preparation and evidence review
• Crosswalk optimization as new frameworks activate
```

### Stream 3 — Perpetual Software Licenses

For organizations that need to own the software outright — not pay a monthly subscription.

```
┌─────────────────────────────────────────────────────────────────┐
│  PROFESSIONAL PERPETUAL — $7,995 one-time                        │
│  Single self-hosted deployment • Up to 50 users                  │
│  1 year updates & email support included                         │
│  Annual maintenance renewal: $1,500/yr after year 1              │
├─────────────────────────────────────────────────────────────────┤
│  ENTERPRISE PERPETUAL — $24,995 one-time                         │
│  Single self-hosted deployment • Unlimited users                  │
│  All Enterprise features • Commercial license included            │
│  1 year updates & priority support included                      │
│  Annual maintenance renewal: $4,500/yr after year 1              │
├─────────────────────────────────────────────────────────────────┤
│  SOURCE CODE LICENSE — $49,995 one-time                          │
│  Full source code rights to build, modify, and deploy internally │
│  1 year premium support & upgrade assistance included            │
│  Annual maintenance renewal: $9,500/yr after year 1              │
├─────────────────────────────────────────────────────────────────┤
│  OEM / WHITE-LABEL LICENSE — Custom pricing                      │
│  Embed or resell ControlWeave under your own brand               │
│  Revenue share or flat-fee arrangements available                │
└─────────────────────────────────────────────────────────────────┘
```

See `docs/PERPETUAL_LICENSE_GUIDE.md` for full terms.

### Stream 4 — Commercial License & Marketplace (Future)

**Commercial License (Base):** $15,000/yr for organizations that cannot accept AGPL terms. Includes indemnification, IP warranties, SLA-backed support.

**Licensed Content Packs:** Proprietary framework overlays (licensed from standards bodies or consulting firms). ControlWeave earns a platform fee on content pack transactions.

**Integration Marketplace:** Revenue share from third-party integration developers as the connector ecosystem grows (SIEM, MDM, cloud scanners).

---

## 5. Revenue Scenarios

### Year 1: Foundation
```
Revenue sources:
• 10 hosted Pro orgs @ $499/mo                  =   $59,880/yr
• 2 hosted Enterprise @ $5,000/mo (avg)         =  $120,000/yr
• 3 implementation projects @ $12,000           =   $36,000/yr
• 4 ATO/advisory engagements @ $20,000          =   $80,000/yr
• 1 commercial license @ $15,000                =   $15,000/yr

Target ARR: ~$311k
Gross margin: ~78%
Team: Founder + 1 support/implementation
```

### Year 2: Growth
```
Revenue sources:
• 40 hosted Pro orgs @ $499/mo                  =  $239,520/yr
• 8 hosted Enterprise @ $6,000/mo (avg)         =  $576,000/yr
• 1 Gov Cloud contract @ $150,000               =  $150,000/yr
• 10 implementation/ATO projects @ $18,000      =  $180,000/yr
• 6 advisory retainers @ $7,500/mo × 12mo      =  $540,000/yr
• 5 commercial licenses @ $15,000               =   $75,000/yr

Target ARR: ~$1.76M
Gross margin: ~70%
Team: 5–7 people (sales, customer success, engineering, GRC consulting)
```

### Year 3: Scale
```
Revenue sources:
• 120 hosted Pro orgs @ $499/mo                 =  $718,560/yr
• 20 Enterprise @ $7,500/mo (avg)               = $1,800,000/yr
• 3 Gov Cloud contracts @ $200,000              =  $600,000/yr
• 20 implementation/ATO projects @ $20,000      =  $400,000/yr
• 15 advisory retainers @ $8,000/mo × 12mo     = $1,440,000/yr
• 15 commercial licenses @ $15,000              =  $225,000/yr

Target ARR: ~$5.18M
Gross margin: ~62%
Team: 15–20 people
```

---

## 6. Sales Motion

### Inbound (Community-Driven)

1. Practitioner discovers platform via GitHub, Hacker News, LinkedIn, conference talk
2. Self-hosts community edition OR starts Pro trial
3. Hits capacity/SLA need → upgrades to hosted Pro or Enterprise
4. Uses Auditor Workspace → invites external auditor → creates second org (services opportunity)

**No sales rep needed up to Pro tier.** Self-serve checkout via Stripe.

### Outbound (CISO/Compliance Officer / Contracting Officer Target)

Target personas:
- **CISO / Security Director** at 100–2,000 person companies pursuing multi-framework compliance
- **Compliance Officer** at financial services firms needing AI governance (FINRA, SEC, SR 11-7)
- **RMF Practitioner / ISSO** at federal contractors pursuing CMMC 2.0 or FedRAMP ATO
- **CTO/VP Engineering** at AI-native companies needing NIST AI RMF + EU AI Act coverage
- **Contracting Officer** at DoD/IC agencies needing Gov Cloud deployment

Outbound sequence:
1. Scout (LinkedIn, SEC EDGAR, USASpending.gov for federal contractors, SAM.gov for DoD awards)
2. Lead score against buying signals (AI system disclosure, compliance job postings, DoD contract award)
3. Personalized cold outreach referencing specific framework need and open-source verifiability angle
4. Demo → trial → commercial close

### SEO Target Terms
- "open source GRC platform"
- "NIST AI RMF compliance software"
- "CMMC 2.0 compliance tool"
- "FedRAMP GRC platform"
- "EU AI Act Article 17 implementation"
- "AI governance software open source"
- "audit the code that audits your AI"

---

## 7. Competitive Positioning

### The Real Competitive Set

ControlWeave is **not** competing with Vanta and Drata (SMB checkbox compliance). The real competition is:

| Competitor | Their Positioning | Our Advantage |
|------------|------------------|---------------|
| **Archer (RSA)** | Enterprise GRC, legacy | Open-source core, modern API-first, 1/10th the cost |
| **ServiceNow GRC** | Platform-of-platforms | Purpose-built for compliance (not bolted on), AI-native from day 1 |
| **OneTrust** | Privacy + GRC | AGPL verifiability + 40 frameworks + BYOK AI with no surcharge |
| **Hyperproof** | Mid-market compliance ops | Auto-crosswalk (40–60% effort reduction), RMF Lifecycle, SBOM/AIBOM |
| **Drata/Vanta** | SMB/startup SOC 2 | 40 frameworks, NIST AI RMF, MAESTRO, federal/DoD support |

### Why We Win

1. **Open-source trust (AGPL)** — Regulated industries can audit the code before committing. Competitors are closed source.
2. **Auto-crosswalk** — Implement once, satisfy many; competitors make you duplicate work
3. **AI-native from day 1** — NIST AI RMF, MAESTRO, ISO/IEC AI standards, EU AI Act; not retrofitted
4. **RMF Lifecycle** — Full NIST SP 800-37 workflow; no competitor has this as a native module
5. **BYOK AI with no surcharge** — All AI features work with your own Anthropic/OpenAI/Gemini key
6. **Federal pedigree** — ISSM expertise embedded in the product methodology; no competitor was built by an ISSM

---

## 8. Key Metrics to Track

| Metric | Target |
|--------|--------|
| GitHub stars (monthly growth) | +15–25% MoM |
| Community-to-trial conversion | 8–12% |
| Trial-to-paid conversion | 25–35% |
| Monthly churn (paid) | <2% |
| Net Revenue Retention | >115% |
| ACV (avg. contract value) | $15,000–$90,000 |
| CAC (customer acquisition cost) | <$2,000 (inbound), <$10,000 (outbound) |
| Time to first value (self-serve) | <30 minutes |

---

*For acquisition scenarios and valuation guidance, see `docs/ACQUISITION_STRATEGY.md`.*
*For perpetual license terms, see `docs/PERPETUAL_LICENSE_GUIDE.md`.*

*This document represents current GTM strategy and pricing. All figures subject to revision as market conditions and product capabilities evolve.*
