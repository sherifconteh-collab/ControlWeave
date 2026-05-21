# How the Auto-Crosswalk Engine Works

This guide explains exactly how ControlWeaver-Pro's cross-framework mapping engine operates — from database structure through the auto-satisfaction logic — with real SQL examples.

---

## What Auto-Crosswalk Does

When you mark a control as **Implemented** in one framework, ControlWeaver-Pro automatically evaluates whether that implementation satisfies equivalent or closely related controls in your other active frameworks. If the similarity score between two controls is **≥ 90%**, the mapped control is automatically credited as satisfied without any additional action.

```
You implement:  NIST CSF 2.0 — PR.AA-06 (Multi-Factor Authentication)
                                │
                Auto-satisfied: NIST 800-171 — 3.5.3  [100% equivalent]
                Auto-satisfied: NIST 800-53  — IA-2   [95% equivalent]
                Flagged:        ISO 27001    — A.5.17 [85% — related, manual review]
```

**Result**: One implementation satisfies three frameworks. The 85% match surfaces as a recommendation, not an automatic credit — keeping your compliance posture defensible.

---

## The Data Model

### Core Tables

```sql
-- Frameworks catalog (40 frameworks in ControlWeaver-Pro)
frameworks (
    id              UUID PRIMARY KEY,
    name            VARCHAR,
    version         VARCHAR,
    description     TEXT,
    category        VARCHAR,            -- 'security', 'privacy', 'ai-governance', etc.
    code            VARCHAR UNIQUE,     -- 'nist_csf_2.0', 'iso_27001', etc. (added migration 009)
    tier_required   VARCHAR,            -- minimum subscription tier (added migration 009)
    framework_group VARCHAR,            -- grouping label (added migration 081)
    is_active       BOOLEAN
)

-- Individual controls within each framework (675+ total)
framework_controls (
    id              UUID PRIMARY KEY,
    framework_id    UUID REFERENCES frameworks(id),
    control_id      VARCHAR,            -- 'PR.AA-06', '3.5.3', 'A.5.17'
    title           VARCHAR,
    description     TEXT,
    priority        VARCHAR,            -- 'critical', 'high', 'medium', 'low'
    family          VARCHAR             -- control family grouping
)

-- Cross-framework mappings (97 mappings in ControlWeaver-Pro)
control_mappings (
    id                  UUID PRIMARY KEY,
    source_control_id   UUID REFERENCES framework_controls(id),
    target_control_id   UUID REFERENCES framework_controls(id),
    mapping_type        VARCHAR,        -- 'equivalent', 'subset', 'related', 'complementary'
    similarity_score    INTEGER,        -- 0–100 (added migration 009)
    notes               TEXT,
    mapping_notes       TEXT            -- descriptive rationale for the mapping
)

-- Organization-specific implementation status
control_implementations (
    id                      UUID PRIMARY KEY,
    organization_id         UUID REFERENCES organizations(id),
    control_id              UUID REFERENCES framework_controls(id),
    status                  VARCHAR,        -- 'not_started', 'in_progress', 'implemented', 'needs_review'
    implementation_notes    TEXT,
    implementation_date     DATE,
    assigned_to             UUID REFERENCES users(id),
    assigned_to_contact     UUID,           -- external contact reference (added migration 078)
    test_result             VARCHAR,        -- 'not_assessed', 'satisfied', 'other_than_satisfied', 'not_applicable'
    test_notes              TEXT,           -- assessment test notes (added migration 039)
    notes                   TEXT
)
```

---

## Mapping Types & Similarity Scores

| Score | Type | Meaning | Auto-Satisfied? |
|-------|------|---------|----------------|
| 100 | `equivalent` | Identical requirement, identical language | ✅ Yes |
| 90–99 | `equivalent` | Same requirement, different wording | ✅ Yes |
| 80–89 | `subset` | One contains the other (implementing the larger satisfies both) | ❌ Flagged for review |
| 70–79 | `related` | Similar focus, different scope | ❌ Flagged for review |
| 60–69 | `complementary` | Work together, address different aspects | ❌ Informational only |
| <60 | — | Weak relationship | Not mapped |

---

## Demo: Multi-Factor Authentication Across Frameworks

### Step 1 — Query What Frameworks Require MFA

```sql
SELECT
    f.code            AS framework,
    fc.control_id,
    fc.title,
    fc.priority
FROM framework_controls fc
JOIN frameworks f ON f.id = fc.framework_id
WHERE fc.title ILIKE '%multi%factor%'
   OR fc.title ILIKE '%MFA%'
ORDER BY f.name;
```

**Result:**
```
framework     | control_id | title                       | priority
--------------+------------+-----------------------------+----------
iso_27001     | A.5.17     | Authentication information  | high
nist_800_171  | 3.5.3      | Multi-Factor Authentication | critical
nist_800_53   | IA-2       | Identification & Auth.      | critical
nist_csf_2.0  | PR.AA-06   | Multi-factor Authentication | critical
```

---

### Step 2 — Implement Once, Query the Crosswalk

```sql
WITH target AS (
    SELECT fc.id, fc.control_id, fc.title
    FROM framework_controls fc
    JOIN frameworks f ON f.id = fc.framework_id
    WHERE f.code = 'nist_csf_2.0'
      AND fc.control_id = 'PR.AA-06'
)
SELECT
    f2.code                             AS also_satisfies_framework,
    fc2.control_id,
    fc2.title,
    cm.mapping_type,
    cm.similarity_score,
    CASE
        WHEN cm.similarity_score >= 90 THEN 'AUTO-SATISFIED ✅'
        WHEN cm.similarity_score >= 70 THEN 'REVIEW RECOMMENDED ⚠️'
        ELSE 'INFORMATIONAL ℹ️'
    END AS status
FROM target t
JOIN control_mappings cm
    ON cm.source_control_id = t.id
    OR cm.target_control_id = t.id
JOIN framework_controls fc2
    ON fc2.id = CASE
        WHEN cm.source_control_id = t.id THEN cm.target_control_id
        ELSE cm.source_control_id
    END
JOIN frameworks f2 ON f2.id = fc2.framework_id
ORDER BY cm.similarity_score DESC;
```

**Result:**
```
also_satisfies_framework | control_id | title                       | mapping_type | similarity_score | status
-------------------------+------------+-----------------------------+--------------+------------------+-----------------------
nist_800_171             | 3.5.3      | Multi-Factor Authentication | equivalent   |              100 | AUTO-SATISFIED ✅
nist_800_53              | IA-2       | Identification & Auth.      | equivalent   |               95 | AUTO-SATISFIED ✅
iso_27001                | A.5.17     | Authentication information  | related      |               85 | REVIEW RECOMMENDED ⚠️
cmmc_2.0                 | 3.5.3      | Multi-Factor Authentication | equivalent   |              100 | AUTO-SATISFIED ✅
```

**Business result**: Implement MFA for NIST CSF → automatically satisfied in NIST 800-171, NIST 800-53, and CMMC 2.0. ISO 27001 surfaces for human review.

---

## The Auto-Satisfaction Query (Platform Core Logic)

This is the logic ControlWeaver-Pro runs every time a control is marked implemented:

```sql
-- Triggered when: control_implementations.status → 'implemented'
WITH newly_implemented AS (
    SELECT
        ci.organization_id,
        ci.control_id                AS source_control_id,
        fc.framework_id              AS source_framework_id
    FROM control_implementations ci
    JOIN framework_controls fc ON fc.id = ci.control_id
    WHERE ci.id = $1   -- the implementation just recorded
),
auto_candidates AS (
    SELECT
        ni.organization_id,
        CASE
            WHEN cm.source_control_id = ni.source_control_id THEN cm.target_control_id
            ELSE cm.source_control_id
        END AS candidate_control_id,
        cm.similarity_score
    FROM newly_implemented ni
    JOIN control_mappings cm
        ON cm.source_control_id = ni.source_control_id
        OR cm.target_control_id = ni.source_control_id
    WHERE cm.similarity_score >= 90          -- auto-satisfaction threshold
),
org_active_frameworks AS (
    -- organization_frameworks has no 'active' flag; all rows represent active selections
    SELECT framework_id
    FROM organization_frameworks
    WHERE organization_id = (SELECT organization_id FROM newly_implemented)
)
INSERT INTO control_implementations
    (organization_id, control_id, status, notes)
SELECT
    ac.organization_id,
    ac.candidate_control_id,
    'implemented',
    'Auto-satisfied via crosswalk from source implementation ' || $1
FROM auto_candidates ac
JOIN framework_controls fc ON fc.id = ac.candidate_control_id
JOIN org_active_frameworks oaf ON oaf.framework_id = fc.framework_id
WHERE ac.candidate_control_id NOT IN (
    -- Don't overwrite existing implementations
    SELECT control_id FROM control_implementations
    WHERE organization_id = ac.organization_id
      AND status = 'implemented'
)
ON CONFLICT (organization_id, control_id) DO NOTHING;
```

---

## Demo: "What's My ROI if I'm Already ISO 27001?"

```sql
-- Scenario: org already has ISO 27001 implemented
-- Question: how much NIST CSF 2.0 coverage do we get free via crosswalks?

WITH iso_implemented AS (
    SELECT ci.control_id
    FROM control_implementations ci
    JOIN framework_controls fc ON fc.id = ci.control_id
    JOIN frameworks f ON f.id = fc.framework_id
    WHERE ci.organization_id = $org_id
      AND ci.status = 'implemented'
      AND f.code = 'iso_27001'
),
csf_via_crosswalk AS (
    SELECT DISTINCT
        CASE
            WHEN cm.source_control_id IN (SELECT control_id FROM iso_implemented)
            THEN cm.target_control_id
            ELSE cm.source_control_id
        END AS csf_control_id
    FROM control_mappings cm
    JOIN framework_controls fc_csf ON (
        fc_csf.id = cm.source_control_id OR fc_csf.id = cm.target_control_id
    )
    JOIN frameworks f_csf ON f_csf.id = fc_csf.framework_id AND f_csf.code = 'nist_csf_2.0'
    WHERE cm.similarity_score >= 90
    AND (
        cm.source_control_id IN (SELECT control_id FROM iso_implemented)
     OR cm.target_control_id IN (SELECT control_id FROM iso_implemented)
    )
)
SELECT
    (SELECT COUNT(*) FROM framework_controls fc JOIN frameworks f ON f.id = fc.framework_id AND f.code = 'nist_csf_2.0') AS total_csf_controls,
    COUNT(*)                                                  AS already_covered,
    ROUND(COUNT(*)::numeric /
        (SELECT COUNT(*) FROM framework_controls fc JOIN frameworks f ON f.id = fc.framework_id AND f.code = 'nist_csf_2.0')
        * 100, 1)                                            AS pct_covered_for_free
FROM csf_via_crosswalk;
```

**Example result:**
```
total_csf_controls | already_covered | pct_covered_for_free
-------------------+-----------------+---------------------
               106 |              44 |                 41.5
```

**Interpretation**: If your org is already ISO 27001 certified, you begin NIST CSF 2.0 compliance at ~41.5% — covering 44 of 106 controls before you do any new work. At a conservative $2,000 per control implementation (staff time, tooling, documentation), those 44 controls represent **$88,000 in avoided compliance spend** that would otherwise be required to reach the same coverage starting from zero.

---

## Priority Matrix: Bang-for-Your-Buck Controls

Which controls should you implement first to satisfy the most frameworks simultaneously?

```sql
SELECT
    f.code                                   AS framework,
    fc.control_id,
    LEFT(fc.title, 55)                       AS title,
    fc.priority,
    COUNT(DISTINCT f2.id) + 1                AS total_frameworks_satisfied
FROM framework_controls fc
JOIN frameworks f ON f.id = fc.framework_id
JOIN control_mappings cm
    ON cm.source_control_id = fc.id
    OR cm.target_control_id = fc.id
JOIN framework_controls fc2
    ON fc2.id = CASE
        WHEN cm.source_control_id = fc.id THEN cm.target_control_id
        ELSE cm.source_control_id
    END
JOIN frameworks f2 ON f2.id = fc2.framework_id AND f2.id != fc.framework_id
WHERE cm.similarity_score >= 90
GROUP BY f.id, f.code, fc.id, fc.control_id, fc.title, fc.priority
ORDER BY total_frameworks_satisfied DESC, fc.priority DESC
LIMIT 15;
```

**Sample result:**
```
framework     | control_id | title                                                  | priority | total_frameworks_satisfied
--------------+------------+--------------------------------------------------------+----------+---------------------------
nist_csf_2.0  | PR.AA-06   | Multi-factor Authentication                            | critical |                          5
nist_csf_2.0  | ID.AM-01   | Physical Assets Inventory                              | high     |                          4
nist_csf_2.0  | DE.CM-01   | Network Monitoring                                     | high     |                          4
nist_csf_2.0  | RS.MA-01   | Incident Response Plan                                 | critical |                          4
nist_800_171  | 3.4.1      | Baseline Configurations                                | critical |                          4
nist_800_171  | 3.1.1      | Authorized Access                                      | critical |                          3
iso_27001     | A.5.1      | Policies for information security                      | critical |                          3
iso_27001     | A.5.16     | Identity Management                                    | critical |                          3
nist_csf_2.0  | PR.DS-01   | Data-at-Rest Protection                                | critical |                          3
nist_csf_2.0  | GV.PO-01   | Policy Establishment                                   | critical |                          3
nist_800_171  | 3.6.1      | Incident Handling                                      | critical |                          3
nist_csf_2.0  | PR.AT-01   | Security Awareness Training                            | high     |                          3
soc2          | CC6.1      | Logical and Physical Access                            | critical |                          3
iso_27001     | A.6.3      | Information security awareness, education and training | critical |                          3
nist_csf_2.0  | GV.PO-02   | Policy Review and Update                               | high     |                          3
```

**Use case**: A new customer with no prior compliance work should implement these 15 controls first — each one satisfies 3–5 frameworks, covering roughly 40% of total cross-framework requirements in a single sprint.

---

## Crosswalk Coverage: ControlWeaver-Pro Stats

| Metric | Value |
|--------|-------|
| Total frameworks | 40 |
| Total controls | 675+ |
| Crosswalk mappings | 97 |
| Equivalent mappings (≥90%, auto-satisfy) | ~45 |
| Subset/Related mappings (flagged for review) | ~52 |
| Average frameworks satisfied per critical control | 3–5 |
| Estimated compliance effort reduction | 40–60% |

### Key Framework Overlap Insights

**NIST Family:**
- NIST 800-171 is a direct subset of NIST 800-53 (110 of 1,000+ controls)
- Implementing NIST 800-171 satisfies ~11% of 800-53 Moderate baseline automatically
- NIST CSF 2.0 maps strategically to both — it's the "executive layer" above the technical standards

**International:**
- ISO 27001 shares ~70–80% conceptual overlap with NIST CSF 2.0
- ISO 27001 certification gives you ~41% NIST CSF coverage at no extra work
- SOC 2 Common Criteria aligns strongly with ISO 27001 Organizational controls

**AI Governance:**
- NIST AI RMF has ~40% overlap with traditional security frameworks (CSF, 800-53)
- The remaining ~60% of AI RMF is net-new (bias, explainability, data provenance)
- EU AI Act Article 17 maps tightly to NIST AI RMF GOVERN/MAP functions

---

## Auditor Q&A: Defensible Crosswalk Claims

### "How can one implementation satisfy multiple frameworks?"

Each mapping in ControlWeaver-Pro is sourced from authoritative crosswalk publications or community-validated mappings with documented rationale:

| Mapping pair | Source |
|--------------|--------|
| NIST 800-171 ↔ 800-53 | NIST SP 800-171r2 Appendix D (official) |
| NIST CSF ↔ 800-53 | NIST CSF 2.0 Reference Tool (official) |
| ISO 27001 ↔ NIST CSF | ISO/IEC JTC 1/SC 27 published mapping |
| SOC 2 ↔ NIST CSF | AICPA guidance + community validation |
| NIST AI RMF ↔ CSF | NIST AI RMF 1.0 Appendix A (official) |

### "What's the difference between auto-satisfied and manually verified?"

Both appear on the dashboard, but are clearly labeled:
- **Directly Implemented** — You explicitly marked this control with evidence
- **Auto-Satisfied** — Satisfied via crosswalk from another implementation (linked to source)
- **Needs Review** — Similarity 70–89%; platform surfaced the connection but requires your human judgment

All three states are captured in the immutable audit log with the acting user, timestamp, and cross-reference to the source control implementation.

### "Will an auditor accept crosswalk-based compliance?"

For **equivalent mappings (100% score)** like NIST CSF PR.AA-06 ↔ NIST 800-171 3.5.3: yes, universally. Both NIST and AICPA explicitly publish and endorse these mappings for this purpose.

For **subset/related mappings (70–89%)**: this requires professional judgment. The platform surfaces these for your review — it does not auto-satisfy them — precisely so you can make the defensible determination yourself with your auditor.

---

## Next Steps

- **[Framework Coverage](./FRAMEWORK_COVERAGE.md)** — Full list of all 40 frameworks and what's covered
- **[Crosswalk Guide](./CROSSWALK_GUIDE.md)** — Business-focused guide to using crosswalks
- **[ControlWeave README](../controlweave/README.md)** — Full API reference and setup guide

---

*Note: All crosswalk mappings are guidance to support professional compliance judgment, not legal advice. Work with qualified auditors to determine which mappings are defensible for your specific regulatory context.*
