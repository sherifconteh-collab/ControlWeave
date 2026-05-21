# 📋 Framework Management Guide

Learn how to select, activate, and manage compliance frameworks in ControlWeave.

## Overview

ControlWeave supports 15+ compliance frameworks with intelligent crosswalk mappings. This guide shows you how to choose the right frameworks and leverage crosswalks to reduce duplicate work.

---

## Available Frameworks

### Core Security Frameworks
- **NIST 800-53** - Comprehensive federal security controls (20 families, 300+ controls)
- **NIST 800-171** - Protecting Controlled Unclassified Information (CUI)
- **ISO 27001** - International information security standard
- **NIST CSF 2.0** - Cybersecurity Framework for risk management

### Industry-Specific Frameworks
- **SOC 2** - Service Organization Controls (Trust Service Criteria)
- **HIPAA** - Healthcare data protection
- **PCI DSS** - Payment card industry security (coming soon)
- **FFIEC** - Financial institution cybersecurity
- **NERC CIP** - Critical infrastructure protection (energy sector)

### Privacy & Data Protection
- **GDPR** - EU General Data Protection Regulation
- **NIST Privacy Framework** - Privacy risk management

### AI & Emerging Tech
- **NIST AI RMF** - AI Risk Management Framework
- **EU AI Act** - European AI regulation
- **ISO 42001** - AI management system
- **NIST IR 8596 (Cyber AI Profile)** - Cybersecurity Framework Profile for AI (Secure / Defend / Thwart)
- **OWASP LLM Top 10** - LLM application security
- **OWASP Agentic AI Top 10** - Agentic AI security

### Federal & Compliance
- **FISCAM** - Federal financial systems
- **FedRAMP** - Cloud services for government (coming soon)

### Reference Models
- **NIST SP 800-207** - Zero Trust Architecture

---

## Selecting Frameworks

### Step 1: Identify Requirements

**Ask yourself:**
1. What industry am I in?
2. What data types do I handle?
3. Who are my customers/stakeholders?
4. What are contractual requirements?
5. What certifications do I need?

### Step 2: Framework Selection by Industry

#### Healthcare
**Must Have:**
- HIPAA (if handling PHI)
- NIST 800-53 (comprehensive security)

**Should Have:**
- SOC 2 (if service provider)
- ISO 27001 (international operations)

#### Financial Services
**Must Have:**
- SOC 2 (customer requirement)
- FFIEC (if bank/credit union)

**Should Have:**
- NIST CSF 2.0
- ISO 27001
- PCI DSS (if handling cards)

#### Government Contractors
**Must Have:**
- NIST 800-171 (CUI requirement)
- NIST 800-53 (if FedRAMP/IL4+)

**Should Have:**
- FISCAM (if financial systems)
- NIST CSF 2.0

#### Technology/SaaS Companies
**Must Have:**
- SOC 2 (customer trust)

**Should Have:**
- ISO 27001 (enterprise customers)
- NIST CSF 2.0
- OWASP LLM Top 10 (if using AI)

#### AI/ML Companies
**Must Have:**
- NIST AI RMF
- OWASP LLM Top 10

**Should Have:**
- EU AI Act (if EU customers)
- ISO 42001
- OWASP Agentic AI Top 10
- SOC 2

---

## Activating Frameworks

### Basic Activation

1. Navigate to **Frameworks** in sidebar
2. Review framework list
3. Click **Activate** on desired framework
4. Framework badge changes to "Active"
5. Controls are now available

### View Framework Details

Click any framework name to see:

**Framework Overview:**
- Description and purpose
- Number of controls
- Control families/categories
- Assessment procedures available

**Crosswalk Mappings:**
- Which frameworks map to this one
- Number of mapped controls
- Coverage percentage

**Implementation Stats:**
- How many controls implemented
- Assessment completion rate
- Overall compliance percentage

---

## Understanding Crosswalks

### What Are Crosswalks?

Crosswalks are mappings between equivalent controls across different frameworks. When you implement one control, you may automatically satisfy controls in multiple frameworks.

### Example Crosswalk

When you implement **NIST 800-53 AC-2** (Account Management):
- Also satisfies **ISO 27001 A.9.2.1** (User registration)
- Also satisfies **SOC 2 CC6.1** (Logical access controls)
- Also satisfies **HIPAA 164.308(a)(3)(i)** (Unique user identification)

**Result**: One implementation = 4 frameworks covered! 

### Viewing Crosswalks

**In Control Details:**
1. Click any control
2. Scroll to **Crosswalk Mappings** section
3. See list of equivalent controls
4. Click any mapped control to view details

### Crosswalk Visualization

**Crosswalk Visualization:**
- Green checkmark = Both controls implemented
- Yellow warning = Only one control implemented
- Grey = Neither control implemented

> **💡 Improved in v2.3.0**: Crosswalk visualization has been enhanced to display mappings across multiple frameworks simultaneously. When you have three or more frameworks active, the crosswalk view now clearly shows which single implementation satisfies requirements in each of the other frameworks.

### Leveraging Crosswalks

**Strategy 1: Start with Comprehensive Frameworks**
- Implement NIST 800-53 or ISO 27001 first
- Automatically satisfy many controls in other frameworks
- Less duplicate work

**Strategy 2: Focus on Overlaps**
1. Go to **AI Analysis** → **Crosswalk Optimizer**
2. AI identifies controls that satisfy multiple frameworks
3. Prioritize these "high-value" controls
4. Maximize compliance with minimal effort

**Strategy 3: Map to Requirements**
- Have multiple framework requirements (e.g., SOC 2 + HIPAA)
- Look for controls that satisfy both
- Implement once, satisfy multiple auditors

---

## Tier Limits

### Community Tier
- **Limit**: 2 frameworks maximum
- **Strategy**: Choose most critical frameworks only
- **Recommendation**: Start with 1-2 core frameworks

### Pro Tier
- **Limit**: Unlimited frameworks
- **Strategy**: Add all relevant core and industry-specific frameworks
- **Recommendation**: Use crosswalks to manage overlap as you scale beyond a few frameworks

### Enterprise
- **Limit**: Unlimited frameworks
- **Strategy**: Comprehensive coverage
- **Recommendation**: Activate all relevant frameworks for complete view

---

## Best Practices

### DO:
✅ Start with 1-2 core frameworks
✅ Activate frameworks you're actually pursuing
✅ Use crosswalks to reduce duplicate work
✅ Review framework before activating
✅ Deactivate unused frameworks to reduce noise

### DON'T:
❌ Activate all frameworks "just in case"
❌ Ignore crosswalk opportunities
❌ Skip framework research
❌ Activate frameworks without implementation plan
❌ Forget to deactivate when no longer needed

---

## Framework Management Tasks

### Adding a Framework

1. **Research**: Review framework details
2. **Activate**: Click Activate button
3. **Review Controls**: Check new controls added
4. **Plan Implementation**: Identify priority controls
5. **Leverage Crosswalks**: Check existing implementations

### Removing a Framework

1. **Navigate**: Go to Frameworks
2. **Click Framework**: Open framework details
3. **Deactivate**: Click Deactivate button
4. **Confirm**: Acknowledge that controls will be hidden
5. **Note**: Implementation data is preserved (not deleted)

> **💡 Tip**: Deactivating doesn't delete data. You can reactivate later and recover all implementation history.

### Reviewing Framework Coverage

1. **Dashboard**: View overall compliance per framework
2. **Framework Page**: Click framework to see detailed stats
3. **Metrics**:
   - Total controls
   - Implemented controls
   - In progress controls
   - Not started controls
   - Compliance percentage

### Comparing Frameworks

**Side-by-Side View:**
1. Go to **Frameworks**
2. Select multiple frameworks (checkbox)
3. Click **Compare Selected**
4. See control family coverage comparison
5. Identify overlaps and gaps

---

## Advanced Features

### AI Framework Selection

**Let AI help you choose:**

1. Go to **AI Analysis** → **Compliance Q&A**
2. Ask: "What frameworks should my healthcare SaaS company adopt?"
3. AI provides recommendations based on:
   - Your industry
   - Data types handled
   - Organization profile
   - Common requirements

### Framework Crosswalk Optimizer

**Find optimal implementation path:**

1. Go to **AI Analysis** → **Crosswalk Optimizer**
2. Click **Run Analysis**
3. AI identifies:
   - Controls satisfying multiple frameworks
   - Optimal implementation order
   - Maximum coverage with minimum effort
4. Export results for planning

### Custom Framework Mappings

**Enterprise Feature:**

Create your own crosswalk mappings:
1. Go to **Settings** → **Custom Crosswalks**
2. Select source control
3. Select target control
4. Define mapping relationship
5. Save mapping

---

## Common Scenarios

### Scenario 1: New SOC 2 Customer Requirement

**Situation**: Customer requires SOC 2 Type II audit

**Steps**:
1. Activate SOC 2 framework
2. Review 5 Trust Service Criteria
3. Check crosswalks with existing implementations
4. Identify net-new controls needed
5. Create implementation plan
6. Use AI to generate policies/procedures

### Scenario 2: Government Contract Requiring NIST 800-171

**Situation**: Won federal contract requiring NIST 800-171

**Steps**:
1. Activate NIST 800-171
2. Note 110 controls required
3. If already have NIST 800-53, leverage crosswalks
4. Run AI gap analysis to identify missing controls
5. Create POA&M for non-compliant controls
6. Implement controls systematically

### Scenario 3: International Expansion (ISO 27001)

**Situation**: Expanding to Europe, need ISO 27001

**Steps**:
1. Activate ISO 27001
2. Review Annex A controls (93 controls)
3. Cross-reference with existing SOC 2/NIST implementations
4. Use Crosswalk Optimizer to find coverage
5. Implement gaps
6. Engage certification body

---

## Framework Updates

### NIST Publications Library

ControlWeave includes 62 seeded NIST publications:
- Direct links to source documents
- Mappings to in-app controls
- Assessment procedures
- Implementation guidance

**Access:**
1. Click any NIST control
2. See **Related Publications** section
3. Click publication to view details
4. Link to official NIST PDF

### Framework Revision Tracking

When frameworks are updated:
- System flags controls with updates
- Notification sent to affected control owners
- Review required before marking current
- Change history preserved

---

## Reporting on Frameworks

### Framework Status Report

Generate reports showing:
- Compliance percentage per framework
- Control implementation status
- Assessment completion
- Evidence coverage
- Timeline to full compliance

**Generate Report:**
1. Go to **Reports**
2. Select **Framework Status Report**
3. Choose frameworks
4. Click **Generate**
5. Export as PDF or Excel

### Executive Summary

High-level framework compliance:
1. Go to **AI Analysis** → **Executive Report**
2. Select frameworks
3. AI generates board-ready summary
4. Includes risks, gaps, recommendations
5. Professional formatting

---

## Troubleshooting

### Too Many Controls?

**Problem**: Activated too many frameworks, overwhelmed

**Solution**:
- Deactivate non-critical frameworks
- Focus on 2-3 core frameworks initially
- Use filters to view one framework at a time
- Leverage crosswalks to reduce work

### Missing Framework?

**Problem**: Need a framework not listed

**Solution**:
- Check if covered by existing framework
- Contact support for framework addition
- Enterprise customers can request custom frameworks
- Use Licensed Content Packs (if available)

### Crosswalk Not Showing?

**Problem**: Expected crosswalk mapping missing

**Solution**:
- Verify both frameworks are activated
- Check if controls are truly equivalent
- Some controls don't have direct mappings
- Enterprise: Create custom mapping

---

## Quick Reference

### Framework Selection Checklist

- [ ] Identified business requirements
- [ ] Reviewed industry standards
- [ ] Checked customer requirements
- [ ] Considered contractual obligations
- [ ] Reviewed tier limits
- [ ] Activated relevant frameworks
- [ ] Reviewed control counts
- [ ] Checked crosswalk opportunities
- [ ] Created implementation plan

---

**Next Steps:**
- [Control Management Guide](CONTROLS.md)
- [Assessment Guide](ASSESSMENTS.md)
- [Crosswalk Optimizer](AI_ANALYSIS.md#crosswalk-optimizer)
