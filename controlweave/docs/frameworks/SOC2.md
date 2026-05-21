# ✅ SOC 2 Guide

Using ControlWeave with the SOC 2 (System and Organization Controls 2) framework.

## Overview

SOC 2 is an auditing standard developed by the AICPA for service organizations. It evaluates controls relevant to security, availability, processing integrity, confidentiality, and privacy. ControlWeave supports both SOC 2 Type I and Type II audits.

## Trust Services Criteria (TSC)

| Category | Code | Description |
|----------|------|-------------|
| **Security** | CC | Common Criteria — required for all SOC 2 reports |
| **Availability** | A | System availability commitments |
| **Processing Integrity** | PI | Complete, accurate, timely processing |
| **Confidentiality** | C | Protection of confidential information |
| **Privacy** | P | Collection and use of personal information |

## SOC 2 Type I vs. Type II

| Type | Scope | Typical Duration |
|------|-------|-----------------|
| **Type I** | Point-in-time assessment of design | 1-2 months |
| **Type II** | Operating effectiveness over a period | 6-12 month observation period |

## Common Criteria (CC) Sections

| Section | Title |
|---------|-------|
| CC1 | Control Environment |
| CC2 | Communication and Information |
| CC3 | Risk Assessment |
| CC4 | Monitoring Activities |
| CC5 | Control Activities |
| CC6 | Logical and Physical Access Controls |
| CC7 | System Operations |
| CC8 | Change Management |
| CC9 | Risk Mitigation |

## Using SOC 2 in ControlWeave

### Activate the Framework
1. Go to **Frameworks** → **Add Framework**
2. Select **SOC 2** (choose applicable TSC categories)
3. Select your audit type: **Type I** or **Type II**
4. Click **Activate**

### Evidence for SOC 2

Key evidence types for a successful SOC 2 audit:
- Access control screenshots and configuration exports
- Vulnerability scan results (quarterly minimum)
- Security awareness training completion records
- Incident response test documentation
- Vendor security assessments
- Business continuity test results

### Working with External Auditors

Use ControlWeave's Auditor Workspace for SOC 2 audits:
1. Create an engagement in **Auditor Workspace**
2. Invite your CPA firm as an auditor
3. Scope the engagement to SOC 2 controls
4. Auditors can review evidence and create workpapers directly

## Related Guides

- [Framework Management](../guides/FRAMEWORKS.md)
- [Evidence Management](../guides/EVIDENCE.md)
- [Auditor Workspace](../guides/AUDITOR_WORKSPACE.md)
- [Engagements](../guides/ENGAGEMENTS.md)
