# Cross-Framework Mappings (Crosswalks)

## Overview

ControlWeaver-Pro includes **673 cross-framework control mappings** across **36 compliance frameworks** — every framework in the catalog has at least one crosswalk mapping to another framework; none are isolated. These mappings — called "crosswalks" — identify when controls in different frameworks address the same or closely related requirements.

The platform's **auto-crosswalk engine** automatically credits related controls as satisfied when you implement a source control with a ≥90% similarity match. For 70–89% matches, the platform surfaces a recommendation for human review rather than auto-crediting — keeping your compliance posture defensible for auditors.

---

## What Crosswalks Actually Do

Without crosswalks, a compliance team managing NIST CSF, NIST 800-171, ISO 27001, and SOC 2 simultaneously would implement and document Multi-Factor Authentication **four separate times**. With crosswalks:

```
Implement once:  NIST CSF 2.0 — PR.AA-06 (Multi-factor Authentication)

Auto-satisfied:  NIST 800-171 — 3.5.3   [100% equivalent] ✅
Auto-satisfied:  NIST 800-53  — IA-2    [95% equivalent]  ✅
Auto-satisfied:  CMMC 2.0     — 3.5.3   [100% equivalent] ✅
Flagged review:  ISO 27001    — A.5.17  [85% related]     ⚠️
```

One implementation, four frameworks credited. The ISO 27001 match surfaces for your review — because 85% similarity still warrants human judgment — rather than being silently auto-credited.

**Platform-wide result: 40–60% reduction in compliance implementation effort.**

---

## Supported Framework Pairs (673 Mappings)

The original 97 mappings covered the 12 primary pairs below, each traceable to a published authoritative source:

| From | To | Mapping Basis |
|------|----|---------------|
| NIST CSF 2.0 | NIST SP 800-53 Rev 5 | NIST official crosswalk tool |
| NIST CSF 2.0 | NIST SP 800-171 | NIST SP 800-171r2 Appendix D |
| NIST CSF 2.0 | ISO 27001:2022 | ISO/IEC JTC 1/SC 27 published mapping |
| NIST CSF 2.0 | SOC 2 | AICPA guidance + community validation |
| NIST CSF 2.0 | CMMC 2.0 | DoD-published CMMC mapping |
| NIST CSF 2.0 | NIST AI RMF | NIST AI RMF 1.0 Appendix A |
| NIST SP 800-171 | NIST SP 800-53 | NIST SP 800-171r2 Appendix D (official) |
| NIST SP 800-171 | CMMC 2.0 | DoD-published alignment |
| NIST AI RMF | ISO 27001 | Community-validated |
| NIST AI RMF | EU AI Act | NIST / ENISA mapping guidance |
| NIST AI RMF | ISO 42001 | ISO/IEC JTC 1/SC 42 |
| ISO 27001 | SOC 2 | AICPA + community |

A later completion pass (`backend/scripts/seed-iso27001-2022-crosswalks.js`, `seed-hipaa-crosswalks.js`, `seed-crosswalk-completion.js`) closed every framework that previously had zero crosswalk mappings — HITECH, five ISO 27000-family standards (27002/27005/27017/27018/31000), ISO 42005, FISCAM, FFIEC, SR 11-7, SEC AI Risk Management, FINRA Supervisory Controls for AI, and the International/State AI Governance Law catalogs — bringing the total to 51+ distinct framework pairs across three hub clusters: a security/general-controls hub anchored on NIST 800-53/ISO 27001/NIST CSF 2.0, an AI-governance hub anchored on NIST AI RMF/EU AI Act, and a privacy hub anchored on GDPR/NIST Privacy Framework/ISO 27701. See the "Mapping Sources" section below for how this newer batch is sourced differently from the original 97.

---

## Mapping Types

Each mapping carries a **type** and a **similarity score** (0–100):

### Equivalent (Score 90–100) — Auto-Satisfied ✅
Controls that address the same requirement, potentially with different wording or depth.

**Example**: NIST CSF `PR.AA-06` ↔ NIST 800-171 `3.5.3` — both require multi-factor authentication for privileged access.

**Business impact**: Implement once, automatically credited in both frameworks. No additional documentation needed.

### Subset (Score 80–89) — Flagged for Review ⚠️
One control is a simplified version of another. Implementing the broader control satisfies the narrower one.

**Example**: NIST 800-171 `3.1.1` ↔ NIST 800-53 `AC-2` — 800-171 access control derived from 800-53's more detailed account management control.

**Business impact**: Surface as a recommendation. Your auditor or compliance officer confirms before crediting. Most are approved in the review.

### Related (Score 70–79) — Flagged for Review ⚠️
Controls address similar concerns with different scope or focus.

**Example**: NIST AI RMF `MAP.4.1` ↔ NIST CSF `ID.RA-01` — both involve risk identification, but AI RMF is specific to AI system context.

**Business impact**: Surfaced for human review. Partial credit may apply. Useful for gap analysis even when not fully credited.

### Complementary (Score 60–69) — Informational ℹ️
Controls work together but address different aspects. Not auto-credited; shown for planning purposes.

---

## Business Value

### 1. Quantified Effort Reduction

ControlWeaver-Pro's 97 crosswalk mappings reduce the unique control implementations required for common framework combinations:

| Framework Portfolio | Without Crosswalks | With Crosswalks | Savings |
|--------------------|--------------------|-----------------|---------|
| NIST CSF + ISO 27001 | 199 implementations | ~120 unique | ~40% |
| NIST 800-171 + CMMC 2.0 | 220 implementations | ~110 unique | ~50% |
| CSF + 800-53 + 800-171 + CMMC | 426 implementations | ~180 unique | ~58% |
| CSF + ISO 27001 + SOC 2 | 262 implementations | ~160 unique | ~39% |

At a conservative $2,000 per control implementation (staff time, tooling, documentation):
- **10-framework portfolio without crosswalks**: ~$1M
- **With ControlWeaver-Pro's auto-crosswalk**: ~$400–600k
- **Net savings: $400–600k**

### 2. Accelerated Compliance

If your org already has ISO 27001:
- You start NIST CSF 2.0 at ~41% completion (44 of 106 controls already covered via crosswalks)
- Time to full CSF compliance: **6–8 months** instead of 12–14 months
- Savings: **$80,000–$150,000** in avoided implementation costs

If your org already has NIST 800-171:
- You start FedRAMP (NIST 800-53 Moderate) at ~33% completion
- Time to authorization: **12–18 months** instead of 18–24 months

### 3. Evidence Reuse

A single piece of evidence (e.g., your MFA policy document, access control system screenshot, or penetration test report) can be linked to multiple controls across multiple frameworks through the crosswalk. One upload, many attestations.

### 4. Audit Cost Reduction

**Traditional approach (no crosswalks):**
- ISO 27001 audit: $30,000
- SOC 2 audit: $25,000
- NIST 800-171 assessment: $20,000
- Total: $75,000/year

**With ControlWeaver-Pro crosswalks:**
- Integrated crosswalk audit (all three): $40,000–50,000
- Evidence already organized and linked
- Auditor sees coherent story across frameworks
- Savings: **$25,000–$35,000/year**

---

## Key Crosswalk Insights by Domain

### NIST Family
- **NIST 800-171 is a direct subset of 800-53** (110 of 1,000+ controls). Implementing 800-171 satisfies ~11% of the 800-53 Moderate baseline automatically.
- **CMMC 2.0 Level 2 = NIST 800-171** (110 identical practices). If you have 800-171, you're aligned with CMMC Level 2.
- **NIST CSF 2.0 is the "executive layer"** — each CSF subcategory maps to clusters of 800-53 and 800-171 controls at varying specificity.

### International Standards
- **ISO 27001 shares ~70–80% conceptual overlap with NIST CSF 2.0** across access control, monitoring, incident response, and cryptography domains.
- **SOC 2 Common Criteria (CC1–CC9) align strongly with ISO 27001 Organizational controls (A.5)** — both are rooted in COSO internal control principles.

### AI Governance
- **~40% of NIST AI RMF maps to traditional security frameworks** (CSF, 800-53) — the standard "security hygiene" practices apply.
- **~60% of AI RMF is net-new** — bias testing (MEASURE-2.11), explainability (MEASURE-2.6), training data governance (MAP-4.2), and AI-specific risk identification have no direct counterpart in traditional frameworks.
- **EU AI Act Article 17 maps tightly to NIST AI RMF GOVERN and MAP functions**, making joint compliance significantly more efficient.

---

## Real-World Use Cases

### Use Case 1: DoD Contractor Going from 800-171 → FedRAMP
**Scenario**: Defense contractor has NIST 800-171 compliance, pursuing FedRAMP Moderate ATO.

Without crosswalks:
- FedRAMP Moderate requires ~325 800-53 controls
- Start implementing 800-53 independently
- Timeline: 18–24 months, Cost: $500k–$1M

With ControlWeaver-Pro crosswalks:
- 110 controls from 800-171 map directly to 800-53
- Already ~33% of FedRAMP Moderate compliant
- Focus on ~215 net-new controls
- Timeline: 12–18 months, Cost: $350k–$700k
- **Savings: 6 months, $150k–$300k**

### Use Case 2: AI Company Pursuing ISO 42001 + EU AI Act
**Scenario**: AI startup needs ISO 42001 certification and EU AI Act Article 17 compliance.

Without crosswalks: Treat as two separate compliance programs.

With ControlWeaver-Pro crosswalks:
- NIST AI RMF → ISO 42001 mappings show ~65% overlap
- EU AI Act Article 17 maps to NIST AI RMF GOVERN/MAP functions
- Implement AI governance controls once, satisfy all three simultaneously
- **Savings: 40–50% of total AI governance compliance effort**

### Use Case 3: ISO-Certified SaaS Company Adding SOC 2
**Scenario**: UK-based SaaS company with ISO 27001 certification needs SOC 2 for US enterprise customers.

Without crosswalks:
- 64 SOC 2 TSC controls implemented from scratch
- Timeline: 6–9 months
- Cost: $60k–$100k

With ControlWeaver-Pro crosswalks:
- ~78% of SOC 2 Common Criteria covered by ISO 27001 controls
- Implement ~14 SOC 2-specific controls
- Timeline: 2–3 months
- Cost: $20k–$35k
- **Savings: 4–6 months, $40k–$65k**

---

## Using Crosswalks in ControlWeaver-Pro

### In the Dashboard
1. Navigate to any control in your active frameworks
2. Click **Crosswalks** tab — shows all mapped controls with similarity scores and auto-satisfaction status
3. Implement a control → watch mapped controls update in real time

### In the API
```http
GET /api/v1/controls/:id/mappings
Authorization: Bearer <token>
```

Response:
```json
{
  "control": { "id": "...", "control_id": "PR.AA-06", "title": "Multi-factor Authentication" },
  "mappings": [
    {
      "mapped_control": { "control_id": "3.5.3", "framework": "NIST SP 800-171", "title": "Multi-Factor Authentication" },
      "mapping_type": "equivalent",
      "similarity_score": 100,
      "auto_satisfied": true
    },
    {
      "mapped_control": { "control_id": "A.5.17", "framework": "ISO 27001", "title": "Authentication information" },
      "mapping_type": "related",
      "similarity_score": 85,
      "auto_satisfied": false,
      "review_required": true
    }
  ]
}
```

### Via MCP (AI Agent Integration)
```
// Claude or another MCP client can query crosswalks directly:
"What controls in my other active frameworks are satisfied by implementing NIST CSF PR.AA-06?"
"Show me the top 10 controls I should implement next to satisfy the most frameworks at once."
"Which of my ISO 27001 controls automatically cover NIST 800-171 requirements?"
```

---

## Crosswalk Governance

### Mapping Sources (by authority)

| Source | Examples | Trust Level |
|--------|----------|-------------|
| Official NIST crosswalk publications | CSF ↔ 800-53, 800-171 ↔ 800-53 | Authoritative |
| AICPA published guidance | SOC 2 ↔ CSF | Authoritative |
| ISO/IEC published mappings | ISO 27001 ↔ CSF, AI RMF ↔ ISO 42001 | Authoritative |
| ENISA / EU guidance | AI RMF ↔ EU AI Act | Regulatory |
| Community-validated | ISO 27001 ↔ SOC 2, AI RMF ↔ ISO 27001 | Reviewed |
| Direct control-text comparison (single best match per control, not exhaustive) | HITECH ↔ HIPAA, ISO 27002/27005/27017/27018/31000/42005 ↔ their nearest hub framework, FISCAM/FFIEC ↔ NIST 800-53/CSF, SR 11-7/SEC AI Risk/FINRA Supervisory AI ↔ NIST AI RMF, International/State AI Governance Law catalogs ↔ NIST AI RMF/EU AI Act | Platform-reasoned — not traceable to a single published external crosswalk; weak/generic-overlap candidates were deliberately omitted rather than forced. Treat as a starting point for review, same as any "related"/"subset" match above. |

### Accuracy and Updates
- Mapping accuracy is reviewed when source frameworks publish new versions
- Framework stewards are responsible for each major framework family
- Community contributions via PR welcome — each mapping requires a citation to a published source

### Disclaimer
Control mappings are guidance to support professional compliance judgment, not legal advice. Organizations should work with qualified auditors to determine which crosswalk credits are defensible for their specific regulatory context and assessor expectations.

---

## Roadmap

### Current State
- ✅ 673 crosswalk mappings across 36 frameworks — every framework has at least one mapping
- ✅ Auto-satisfaction engine (≥90% threshold)
- ✅ AI Crosswalk Optimizer (AI feature: finds highest-leverage controls to implement next)
- ✅ Crosswalk inheritance trigger (recalculates all impacted controls when framework updates)

### Planned Enhancements
- [ ] AI-powered mapping suggestions for newly added community frameworks
- [ ] Industry-specific mapping overlays (healthcare, financial services, federal)
- [ ] Customizable auto-satisfaction threshold per org (adjust from 90% up or down)
- [ ] Mapping confidence audit trail (surfaced in auditor workspace)
- [ ] Evidence inheritance (auto-link evidence from source control to mapped controls)

---

## Resources

- **[How Crosswalks Work](./HOW_CROSSWALKS_WORK.md)** — Technical deep-dive with SQL and auto-satisfaction engine details
- **[Framework Coverage](./FRAMEWORK_COVERAGE.md)** — Full list of all 40 frameworks with control counts and implementation priority by industry
- **[API Reference](../controlweave/README.md)** — Full REST API including `/controls/:id/mappings` endpoint
