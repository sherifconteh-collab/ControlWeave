# ⚖️ State & International AI Laws Guide

Track AI governance requirements across US state laws and international AI regulations.

## Overview

The State AI Laws module provides a structured, searchable registry of US state AI governance laws and their corresponding compliance controls. Alongside state laws, ControlWeave also tracks international AI regulations (EU AI Act, ISO 42001, NIST AI RMF) through the main Frameworks module.

---

## Why This Matters

AI regulation is expanding rapidly. As of 2025, over 12 US states and jurisdictions have enacted AI-specific laws with varying requirements for:

- **Algorithmic impact assessments**
- **Bias testing and disclosure**
- **AI transparency and explainability**
- **High-risk AI system restrictions**
- **AI-generated content disclosure**

Organizations using AI in their products or operations need to track compliance with each applicable jurisdiction.

---

## Supported Jurisdictions

The State AI Laws module covers these US jurisdictions:

| Code | Jurisdiction | Law | Effective |
|------|-------------|-----|-----------|
| CO | Colorado | SB 205 (Colorado AI Act) | February 1, 2026 |
| IL | Illinois | AI Video Interview Act / HB 3773 | August 9, 2019 |
| NYC | New York City | Local Law 144 (AEDT) | July 5, 2023 |
| CA | California | SB 942 / AB 2013 / AB 2885 / AB 1008 | January 1, 2024 |
| TX | Texas | Texas Responsible AI Governance Act (TRAIGA) | September 1, 2025 |
| VA | Virginia | HB 2048 (AI Impact Assessment) | July 1, 2026 |
| CT | Connecticut | SB 2 (Connecticut AI Act) | January 1, 2026 |
| TN | Tennessee | ELVIS Act | July 1, 2024 |
| UT | Utah | SB 149 (Utah AI Policy Act) | May 1, 2024 |
| WA | Washington | SB 5838 / HB 1951 | July 27, 2025 |
| MD | Maryland | HB 1281 (Automated Decision Tools) | October 1, 2025 |
| NY | New York State | AI Transparency Legislation | January 1, 2025 |
| MULTI | Multi-State | SAI-CORE (cross-cutting requirements) | January 1, 2025 |

---

## Using the State AI Laws Module

### Step 1: Access State AI Laws

1. Navigate to **Frameworks** → **State AI Laws** (or use the sidebar link)
2. You'll see the jurisdictions list and control inventory

### Step 2: Browse Jurisdictions

1. Click **Jurisdictions** tab
2. See all supported jurisdictions with their law name, effective date, and status
3. Click any jurisdiction to filter controls to that state/locality

### Step 3: Browse Controls

1. Click **Controls** tab
2. Browse all state AI law controls across all jurisdictions
3. Filter by:
   - **Jurisdiction** — specific state or locality (e.g., `CO`, `CA`, `NYC`)
   - **Control Type** — the category of requirement
   - **Priority** — importance level
   - **Search** — keyword search in control ID, title, or description

### Control ID Format

Controls follow a predictable naming convention:

| Prefix | Jurisdiction |
|--------|-------------|
| `CO-AI-*` | Colorado |
| `IL-AI-*` | Illinois |
| `NYC-AI-*` | New York City |
| `CA-AI-*` | California |
| `TX-AI-*` | Texas |
| `VA-AI-*` | Virginia |
| `CT-AI-*` | Connecticut |
| `TN-AI-*` | Tennessee |
| `UT-AI-*` | Utah |
| `WA-AI-*` | Washington |
| `MD-AI-*` | Maryland |
| `NY-AI-*` | New York State |
| `SAI-CORE-*` | Multi-State Cross-Cutting |

---

## SAI-CORE Controls

The `SAI-CORE` control set represents requirements that appear across multiple state AI laws — a "common denominator" set that satisfies the most frequent cross-state requirements. Implementing SAI-CORE controls first provides broad multi-jurisdiction coverage.

---

## Implementing State AI Law Controls

State AI law controls appear in the standard **Controls** module when the `state_ai_governance` framework is active:

1. Go to **Frameworks** → activate **State AI Governance**
2. Go to **Controls** → filter by framework `state_ai_governance`
3. Implement controls as you would any other framework:
   - Assign an owner
   - Document implementation notes
   - Upload evidence
   - Mark as Implemented

---

## International AI Laws

For international AI regulations, activate these frameworks in the **Frameworks** module:

| Framework | Description | Region |
|-----------|-------------|--------|
| **EU AI Act** | Risk-based AI regulation | European Union |
| **NIST AI RMF** | AI Risk Management Framework | USA (voluntary) |
| **ISO 42001** | AI management system standard | International |
| **NIST IR 8596** | Cybersecurity Framework Profile for AI | USA |
| **OWASP LLM Top 10** | LLM application security | International |
| **OWASP Agentic AI Top 10** | Agentic AI security | International |

To track international AI laws:
1. Go to **Frameworks** → activate the relevant international AI framework
2. Controls appear automatically in the **Controls** module
3. Track implementation alongside your other frameworks

---

ControlWeaver has no tier gating — the State AI Laws module, international AI frameworks, and the state AI governance framework are all available to every authenticated user.

---

## Related Features

- [Frameworks Guide](FRAMEWORKS.md) — Activate international AI frameworks
- [Controls Guide](CONTROLS.md) — Implement AI law controls
- [Regulatory News Guide](REGULATORY_NEWS.md) — Stay updated on new AI legislation
- [AI Governance Guide](AI_GOVERNANCE.md) — Govern your AI vendor ecosystem
- [Data Governance Guide](DATA_GOVERNANCE.md) — AI-related data requirements by jurisdiction
