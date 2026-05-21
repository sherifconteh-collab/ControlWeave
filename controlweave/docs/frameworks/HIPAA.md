# 🏥 HIPAA Guide

Using ControlWeave for HIPAA (Health Insurance Portability and Accountability Act) compliance management.

## Overview

HIPAA establishes national standards for protecting sensitive patient health information (PHI). ControlWeave maps HIPAA Security Rule, Privacy Rule, and Breach Notification Rule requirements to actionable controls.

## HIPAA Rules

| Rule | Scope |
|------|-------|
| **Privacy Rule** | Standards for PHI use and disclosure |
| **Security Rule** | Administrative, physical, and technical safeguards for ePHI |
| **Breach Notification Rule** | Requirements for notifying affected parties of PHI breaches |
| **Omnibus Rule** | Business associate requirements and enhanced penalties |

## Security Rule Safeguard Categories

### Administrative Safeguards
- Security Officer designation
- Risk analysis and management
- Workforce training
- Access management procedures
- Contingency planning

### Physical Safeguards
- Facility access controls
- Workstation use policies
- Device and media controls

### Technical Safeguards
- Access controls (unique user IDs, emergency access)
- Audit controls
- Integrity controls
- Transmission security (encryption)

## Required vs. Addressable Specifications

HIPAA distinguishes between:
- **Required**: Must be implemented
- **Addressable**: Implement if reasonable and appropriate, or document why alternative measures were taken

ControlWeave marks controls as Required or Addressable to guide implementation prioritization.

## Using HIPAA in ControlWeave

### Activate the Framework
1. Go to **Frameworks** → **Add Framework**
2. Select **HIPAA**
3. Click **Activate**

### Risk Analysis

HIPAA requires a formal risk analysis:
1. Go to **AI Analysis** → **Risk Assessment**
2. Run the HIPAA Risk Analysis report
3. Document identified threats and vulnerabilities
4. Implement controls to reduce risk to an acceptable level

### Business Associate Agreements (BAAs)

Track BAAs in the Vendor Risk module:
1. Go to **Vendor Risk (TPRM)** → **Vendors**
2. Tag vendors as **Business Associates**
3. Upload BAA documents as evidence
4. Set BAA renewal reminder dates

## Related Guides

- [Framework Management](../guides/FRAMEWORKS.md) - Managing frameworks
- [Vendor Risk (TPRM)](../guides/VENDOR_RISK.md) - Business associate management
- [Evidence Management](../guides/EVIDENCE.md) - PHI safeguard documentation
- [AI Analysis](../guides/AI_ANALYSIS.md) - Risk analysis using AI
