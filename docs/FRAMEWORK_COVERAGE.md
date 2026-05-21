# ControlWeaver-Pro — Framework Coverage

## Overview

ControlWeaver-Pro provides **comprehensive coverage of 40 compliance frameworks, standards, and regulations**, organized across four tiers. With **675+ controls** and **97 crosswalk mappings**, the platform lets organizations implement once and satisfy many — reducing compliance burden by 40–60%.

---

## Tier 1 — Core Frameworks (All Plans)

These foundational frameworks are available on every plan, including Free.

### NIST Cybersecurity Framework (CSF) 2.0
**Published:** February 2024 | **Controls:** 106 | **Category:** Cybersecurity

Six functions covering the full cybersecurity lifecycle:
- **GOVERN (GV)** — 30 controls: Risk management strategy, roles, supply chain risk, oversight
- **IDENTIFY (ID)** — 18 controls: Asset management, risk assessment, improvement planning
- **PROTECT (PR)** — 20 controls: Access control, awareness, data security, platform security
- **DETECT (DE)** — 12 controls: Continuous monitoring, adverse event analysis
- **RESPOND (RS)** — 14 controls: Incident management, analysis, communication, mitigation
- **RECOVER (RC)** — 12 controls: Recovery planning, communication, improvements

Crosswalked to: NIST 800-53, NIST 800-171, ISO 27001, SOC 2, NIST AI RMF.

---

### NIST SP 800-53 Rev 5 — Security and Privacy Controls
**Published:** September 2020 | **Controls:** 1,000+ (Low/Moderate/High baselines) | **Category:** Federal Security

The definitive federal security controls catalog. Baseline overlays:
- **Low Baseline** — Minimum controls for low-impact systems
- **Moderate Baseline** — Standard federal requirements (most agencies)
- **High Baseline** — Maximum protection for critical systems and classified data

20 control families: AC, AT, AU, CA, CM, CP, IA, IR, MA, MP, PE, PL, PM, PS, PT, RA, SA, SC, SI, SR.

Required for: FedRAMP, FISMA, DoD, IC agencies. Crosswalked to NIST 800-171, CMMC 2.0, ISO 27001.

---

### NIST SP 800-171 Rev 2 — Protecting CUI
**Published:** 2021 | **Controls:** 110 requirements | **Category:** Controlled Unclassified Information

110 security requirements across 14 families for protecting Controlled Unclassified Information (CUI) in non-federal systems. Derived directly from NIST 800-53 Moderate baseline.

Required for: DoD contractors, federal supply chain participants, government research institutions.
Crosswalked to: NIST 800-53, CMMC 2.0, NIST CSF 2.0.

---

### NIST AI Risk Management Framework (AI RMF) 1.0
**Published:** January 2023 | **Controls:** 97 | **Category:** AI Governance

The only major framework purpose-built for AI system risk management. Four core functions:
- **GOVERN** — 18 controls: Organizational roles, accountability, culture, legal requirements
- **MAP** — 16 controls: Context, stakeholder identification, AI impact assessment
- **MEASURE** — 21 controls: Testing, validation, fairness/bias assessment, trustworthiness metrics
- **MANAGE** — 15 controls: Risk treatment, monitoring, incident management, third-party AI risks

AI-specific controls include:
- Bias and fairness testing (MEASURE-2.11)
- Explainability and interpretability tracking (MEASURE-2.6)
- Data cards/datasheets for training datasets (MAP-4.2)
- Foundation model monitoring (MANAGE-3.2)
- AI model inventory and classification (GOVERN-1.6)
- Out-of-distribution robustness testing (MEASURE-2.3)

Crosswalked to: NIST CSF 2.0, ISO 42001, ISO 27001, EU AI Act.

---

### ISO/IEC 27001:2022 — Information Security Management
**Published:** October 2022 | **Controls:** 93 | **Category:** Information Security

The global gold standard for information security management systems (ISMS). Four themes:
- **ORGANIZATIONAL (A.5)** — 37 controls: Policies, roles, asset management, supplier management, incident response, business continuity, legal compliance
- **PEOPLE (A.6)** — 8 controls: Screening, training, awareness, remote working, disciplinary process
- **PHYSICAL (A.7)** — 14 controls: Facility access controls, equipment protection, clear desk policy
- **TECHNOLOGICAL (A.8)** — 34 controls: Access control, cryptography, network security, secure development, vulnerability management

New in 2022 vs. 2013: Threat intelligence (A.5.7), Cloud security (A.5.23), Configuration management (A.8.9), Data masking (A.8.11), Web filtering (A.8.23), Information deletion (A.8.10), DLP (A.8.12), Monitoring (A.8.16).

Crosswalked to: NIST CSF 2.0, NIST 800-53, SOC 2, ISO 42001.

---

### SOC 2 — Trust Services Criteria
**Published:** 2017 (AICPA) | **Controls:** 64+ | **Category:** Service Organization Controls

Five trust service categories:
- **Common Criteria (CC1–CC9)** — 20 foundational controls based on COSO framework
- **Availability (A1)** — 3 controls for system availability commitments
- **Processing Integrity (PI)** — 7 controls (highly relevant for AI/ML systems)
- **Confidentiality (C1)** — 2 controls for confidential information protection
- **Privacy (P1–P8)** — 13 controls for personal information management

Required for: SaaS companies, cloud service providers, B2B technology vendors.
Crosswalked to: NIST CSF 2.0, ISO 27001, NIST 800-53.

---

### CMMC 2.0 — Cybersecurity Maturity Model Certification
**Published:** 2021 (DoD) | **Category:** Defense Industrial Base

Three maturity levels mapped to existing NIST standards:
- **Level 1** (Foundational) — 17 practices (FAR 52.204-21 basic safeguarding)
- **Level 2** (Advanced) — 110 practices (NIST SP 800-171 full alignment)
- **Level 3** (Expert) — 110+ practices (NIST SP 800-172 subset)

Required for: All DoD prime contractors and subcontractors handling CUI or FCI.
Crosswalked to: NIST 800-171, NIST 800-53, NIST CSF 2.0.

---

### FISCAM — Federal Information System Controls Audit Manual
**Category:** Federal Audit | **Controls:** 140+ | **Organization:** GAO

The audit methodology used by federal inspectors general and the Government Accountability Office. Five general control areas: Security Management, Access Controls, Configuration Management, Segregation of Duties, Contingency Planning.

---

### NIST SP 800-207 — Zero Trust Architecture
**Published:** August 2020 | **Category:** Reference Architecture

Normative guidance on Zero Trust Architecture (ZTA) principles. Includes: Never Trust, Always Verify; Micro-segmentation; Continuous verification; Least privilege enforcement. Implementation roadmap with tenets and deployment models.

---

## Tier 2 — Regulatory & Industry Frameworks

Available on Starter, Professional, Enterprise, and Utilities plans.

### HIPAA Security Rule + HITECH
**Published:** 2003/2009 | **Controls:** 45 | **Category:** Healthcare

Three safeguard categories protecting electronic Protected Health Information (ePHI):
- **Administrative (164.308)** — 23 controls: Risk analysis, workforce security, access management, contingency planning, BAAs
- **Physical (164.310)** — 13 controls: Facility access, workstation use, device/media controls
- **Technical (164.312)** — 9 controls: Unique user IDs, audit controls, integrity, encryption, transmission security

HITECH additions: Breach notification requirements, expanded covered entity obligations, increased penalties.

Required for: Covered entities (health plans, providers, clearinghouses) and business associates.
Penalties: $100–$50,000 per violation; criminal penalties for knowing violations.

---

### GDPR — General Data Protection Regulation
**Published:** 2016 (Effective May 2018) | **Category:** Privacy (EU)

Key article groups implemented:
- **Data Protection Principles (Art. 5–6)** — 8 requirements: Lawfulness, purpose limitation, data minimization, accuracy, storage limitation, accountability
- **Data Subject Rights (Art. 12–23)** — 11 rights: Access, rectification, erasure, portability, objection, automated decision-making restrictions
- **Accountability (Art. 24–39)** — 7 requirements: Data protection by design, DPIAs, DPO appointment, processor contracts, records of processing
- **Security & Breach (Art. 32–34)** — 3 requirements: Appropriate technical/organizational measures, 72-hour breach notification

AI-specific: Article 22 restricts fully automated decisions with legal/significant effects. Article 35 requires DPIA for high-risk AI systems.

Maximum penalties: €20M or 4% of global annual turnover.

---

### CCPA / CPRA — California Consumer Privacy Act
**Category:** Privacy (US — California)

California's comprehensive consumer privacy law including CPRA amendments:
- Consumer rights: Know, delete, correct, opt-out of sale/sharing, limit sensitive data use
- Business obligations: Privacy notices, opt-out mechanisms, data minimization
- Sensitive personal information categories and handling requirements
- CPPA enforcement (California Privacy Protection Agency)

---

### EU AI Act — Artificial Intelligence Act
**Published:** 2024 | **Category:** AI Regulation (EU)

Risk-based classification system for AI systems operating in the EU:
- **Unacceptable Risk** — Prohibited AI systems (social scoring, real-time biometric surveillance)
- **High Risk** — Mandatory requirements: Risk management, data governance, transparency, human oversight, accuracy, robustness
- **Limited Risk** — Transparency obligations (chatbots, deepfakes)
- **Minimal Risk** — No mandatory requirements

Article 17 compliance checklist: 22-point evidence collection workflow implemented in the platform.

Mandatory for: AI systems deployed in the EU across all risk categories.
Crosswalked to: NIST AI RMF, ISO 42001, GDPR.

---

### NERC CIP — Critical Infrastructure Protection
**Category:** Energy Sector | **Controls:** 47+

NERC CIP reliability standards for bulk electric system (BES) cybersecurity:
- CIP-002: BES Cyber System Categorization
- CIP-003: Security Management Controls
- CIP-004: Personnel & Training
- CIP-005: Electronic Security Perimeters
- CIP-006: Physical Security
- CIP-007: Systems Security Management
- CIP-008: Incident Reporting & Response
- CIP-009: Recovery Plans
- CIP-010: Configuration Change Management
- CIP-011: Information Protection
- CIP-013: Supply Chain Risk Management

Required for: Electric utilities, grid operators, generation owners subject to NERC jurisdiction.
Crosswalked to: NIST 800-53.

---

### FFIEC — Federal Financial Institutions Examination Council
**Category:** Financial Services | **Organization:** FFIEC

IT examination guidance for financial institutions including:
- FFIEC IT Examination Handbook (11 booklets: Audit, Business Continuity, Development, E-Banking, Information Security, Management, Operations, Outsourcing, Retail Payment Systems, Supervision, Wholesale Payment Systems)
- FFIEC Cybersecurity Assessment Tool (CAT) aligned to NIST CSF
- Cloud computing guidance

Required for: Banks, credit unions, thrift institutions, bank holding companies regulated by Federal Reserve, FDIC, OCC, NCUA, or CFPB.

---

### OWASP Top 10:2025 — Web Application Security
**Category:** Application Security | **Organization:** OWASP

Updated 2025 web application security risks with NIST AI guidance integration:
- A01: Broken Access Control
- A02: Cryptographic Failures
- A03: Injection
- A04: Insecure Design
- A05: Security Misconfiguration
- A06: Vulnerable and Outdated Components
- A07: Identification and Authentication Failures
- A08: Software and Data Integrity Failures
- A09: Security Logging and Monitoring Failures
- A10: Server-Side Request Forgery (SSRF)

---

### OWASP LLM Top 10 — AI/LLM Security
**Category:** AI Security | **Organization:** OWASP

Top 10 security risks specific to Large Language Model applications:
- LLM01: Prompt Injection
- LLM02: Insecure Output Handling
- LLM03: Training Data Poisoning
- LLM04: Model Denial of Service
- LLM05: Supply Chain Vulnerabilities
- LLM06: Sensitive Information Disclosure
- LLM07: Insecure Plugin Design
- LLM08: Excessive Agency
- LLM09: Overreliance
- LLM10: Model Theft

---

### OWASP Agentic AI Top 10 — AI Agent Security
**Category:** AI Agent Security | **Organization:** OWASP

Emerging top 10 risks for autonomous AI agent systems — critical for agentic compliance platforms and MCP-connected tools.

---

### MAESTRO Framework — AI Code Execution Security
**Category:** MCP/Agentic Security | **Controls:** 16 attack classes

All 16 MAESTRO attack classes for Code Execution MCP (CE-MCP) security:
- Exception-mediated injection
- Authorization corruption
- Sandbox escape vectors
- Resource exhaustion attacks
- Data exfiltration channels
- And 11 additional attack class mitigations

Implemented in ControlWeave's four-layer CE-MCP security defense (Static Analysis → Semantic Gating → Sandbox Execution → Output Sanitization).

---

## Tier 3 — AI & International ISO/IEC Standards

Available on Professional, Enterprise, and Utilities plans.

### ISO 42001:2023 — AI Management System
**Category:** AI Governance | **Organization:** ISO/IEC

First international standard for AI management systems (AIMS). Covers:
- AI policy and objectives
- AI risk assessment and treatment
- AI system impact assessment
- Responsible AI development and deployment
- Supplier relationships and AI procurement
- Performance evaluation and continual improvement

Crosswalked to: NIST AI RMF, EU AI Act.

---

### ISO 42005 — AI System Impact Assessment
**Category:** AI Governance | **Organization:** ISO/IEC
Guidance for conducting AI system impact assessments, including stakeholder identification, impact domains, assessment methodology, and mitigation strategies.

---

### ISO/IEC 23894 — AI Risk Management
Detailed guidance on risk management specific to AI systems, extending ISO 31000 principles to AI contexts including technical, operational, and societal risks.

### ISO/IEC 38507 — Governance of AI
Governance guidance for boards and executive leadership on oversight of AI use within organizations, including accountability, transparency, and strategic direction for AI.

### ISO/IEC 22989 — AI Concepts and Terminology
Standardized vocabulary for AI and machine learning concepts — the definitional baseline for all other ISO/IEC AI standards.

### ISO/IEC 23053 — Framework for AI Systems Using ML
Framework for AI systems that use machine learning, covering lifecycle, functional components, and quality characteristics.

### ISO/IEC 5259 — Data Quality for AI
Multi-part standard on data quality for AI and ML systems covering data collection, preprocessing, quality measurement, and governance.

### ISO/IEC TR 24027 — Bias in AI Systems
Technical report on bias types, sources, and mitigation approaches in AI systems — directly supporting NIST AI RMF MEASURE-2.11 compliance.

### ISO/IEC TR 24028 — Trustworthiness in AI
Technical report on AI trustworthiness properties (accuracy, robustness, reliability, security, privacy, safety, fairness, transparency, accountability, explainability) and measurement approaches.

### ISO/IEC TR 24368 — AI Ethics Overview
Technical report providing an overview of AI ethics frameworks, principles, and their practical application in AI system development and deployment.

---

## Tier 4 — Financial Services (Utilities Add-On)

The Utilities add-on is available exclusively to Enterprise-tier organizations. It unlocks specialized frameworks for financial services firms, AI governance for regulated financial markets, and privacy-first compliance.

### FINRA Notice 24-09 — Supervisory Controls for AI
**Category:** Financial Services (US) | **Organization:** FINRA

Supervisory obligations for AI-generated communications and algorithmic systems:
- AI-generated customer communications oversight
- Reg BI compliance for AI-assisted recommendations
- Algorithmic trading surveillance and controls
- Third-party AI vendor due diligence
- Written supervisory procedures (WSPs) for AI

Required for: FINRA member broker-dealers and registered representatives.

---

### SEC AI Risk Management — RIAs & Broker-Dealers
**Category:** Financial Services (US) | **Organization:** SEC

SEC guidance on AI use by registered investment advisers and broker-dealers:
- Conflicts-of-interest disclosure for AI-driven advice
- Fiduciary duty explainability requirements
- Robo-advisory governance and oversight
- Model validation and backtesting requirements
- Third-party AI model assessment obligations

Required for: SEC-registered investment advisers, broker-dealers, and investment companies using AI in client-facing applications.

---

### SR 11-7 — Model Risk Management
**Category:** Financial Services (US) | **Organization:** Federal Reserve / OCC

The definitive model risk management framework for financial institutions:
- **Model Inventory** — Cataloging and tiering all models by risk
- **Development Standards** — Documentation, conceptual soundness, and testing requirements
- **Independent Validation** — Three lines of defense for model review
- **Ongoing Monitoring** — Performance tracking, stability analysis, outcome analysis
- **Vendor Model Oversight** — Third-party model due diligence and validation
- **Model Retirement** — Controlled decommissioning of end-of-life models

Required for: Federal Reserve-supervised institutions, OCC-chartered banks, and increasingly adopted by all regulated financial institutions with material model exposure.

Crosswalked to: NIST AI RMF (pre-built in the Gov Cloud & Advisory tier), FINRA Notice 24-09, SEC AI Risk Management.

---

## Framework Coverage Summary

| Category | Frameworks | Controls | Crosswalk Mappings |
|----------|-----------|---------|-------------------|
| Core (NIST + ISO + SOC) | 9 | 675+ | 97 |
| Regulatory & Industry | 8 | — | — |
| AI & International ISO/IEC | 10 | — | — |
| Financial Services (Utilities) | 3 | — | — |
| Application Security (OWASP) | 3 | — | — |
| Reference Models | 2 | — | — |
| **Total** | **40** | **675+** | **97** |

---

## Control Overlap Hotspots

These areas have the highest density of cross-framework overlap — implementing controls here satisfies the most requirements across the most frameworks simultaneously:

| Domain | Frameworks Covered |
|--------|-------------------|
| **Access Control & Identity** | NIST CSF, NIST 800-53, NIST 800-171, ISO 27001, SOC 2, HIPAA, CMMC, PCI DSS |
| **Audit Logging & Monitoring** | NIST CSF, NIST 800-53, ISO 27001, SOC 2, HIPAA, FFIEC, NERC CIP |
| **Encryption** | NIST 800-53, ISO 27001, SOC 2, HIPAA, GDPR, NERC CIP |
| **Incident Response** | NIST CSF, NIST 800-53, ISO 27001, SOC 2, HIPAA, NERC CIP, FFIEC |
| **Risk Assessment** | NIST CSF, NIST 800-53, ISO 27001, SOC 2, HIPAA, GDPR, AI RMF, ISO 42001 |
| **AI Bias & Fairness** | NIST AI RMF, EU AI Act, GDPR (Art. 22), ISO/IEC TR 24027, ISO 42001 |
| **Supply Chain Security** | NIST CSF, NIST 800-53, CMMC, ISO 27001, NERC CIP |

---

## Implementation Priority by Industry

### Technology & SaaS Companies
1. **Start:** SOC 2 (customer requirement) + NIST CSF 2.0 (operational foundation)
2. **Add AI:** NIST AI RMF + OWASP LLM Top 10 + MAESTRO (if using agentic AI)
3. **Scale:** ISO 27001 (global certification) + GDPR (EU customers)
4. **Enterprise:** NIST 800-53 (federal customers) + CMMC 2.0 (DoD pipeline)

### Healthcare Organizations
1. **Start:** HIPAA/HITECH (mandatory) + NIST CSF 2.0 (security foundation)
2. **Add:** ISO 27001 (for partner trust) + SOC 2 (if serving other covered entities)
3. **Add AI:** NIST AI RMF + GDPR Art. 22 (if using automated clinical decision support)

### Financial Services
1. **Start:** FFIEC (regulatory baseline) + NIST CSF 2.0 + SOC 2
2. **Add:** FINRA Notice 24-09 + SEC AI Risk Management + SR 11-7 (Gov Cloud & Advisory tier)
3. **Add AI:** NIST AI RMF (mapped to FINRA/SEC/SR 11-7 via Utilities crosswalks)

### Federal Contractors
1. **Start:** NIST 800-171 + CMMC 2.0 (DoD requirement)
2. **Add:** NIST 800-53 (FedRAMP path) + FISCAM (audit readiness)
3. **Scale:** RMF Lifecycle module (NIST SP 800-37 ATO workflow)

### AI-Native Companies
1. **Start:** NIST AI RMF (AI governance core) + ISO 42001 (AIMS certification)
2. **Add:** EU AI Act (EU market access) + OWASP LLM + OWASP Agentic AI + MAESTRO
3. **Add Security:** NIST CSF 2.0 + ISO 27001 + ISO/IEC TR 24027 (bias)
4. **Scale:** GDPR Art. 22 + ISO/IEC 23894 + ISO/IEC 38507

---

## Resources

- **[Crosswalk Guide](./CROSSWALK_GUIDE.md)** — How cross-framework mappings reduce compliance burden
- **[How Crosswalks Work](./HOW_CROSSWALKS_WORK.md)** — Technical deep-dive with SQL examples
- **[Open Source Business Model](./OPEN_SOURCE_BUSINESS_MODEL.md)** — GTM strategy and pricing tiers
- **[API Reference](../controlweave/README.md)** — Full REST API documentation

---

*Last updated: March 2026. Framework versions reflect the most current published standards as of this date.*
