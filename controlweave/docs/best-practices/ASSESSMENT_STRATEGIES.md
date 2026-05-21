# ✅ Assessment Strategies

Best practices for conducting efficient and effective compliance assessments in ControlWeave.

## Assessment Depths

ControlWeave supports three assessment depths for each control:

| Depth | Time | Rigor | Best For |
|-------|------|-------|----------|
| **Basic** | 5-15 min | Low | Initial scoping, first pass |
| **Focused** | 15-45 min | Medium | Regular assessments |
| **Comprehensive** | 45-120 min | High | Pre-audit, high-risk controls |

## Prioritization Strategy

Don't assess all controls simultaneously. Use a risk-based approach:

### Step 1: Identify High-Risk Controls
Use AI Gap Analysis to identify controls with:
- No evidence uploaded
- No implementation notes
- Prior assessment findings of "Other Than Satisfied"
- High criticality in your framework

### Step 2: Group by Control Family
Assess related controls together for efficiency:
- Access Control (AC) controls share common evidence
- Audit (AU) controls share log evidence
- Contingency Planning (CP) controls share BCP/DR artifacts

### Step 3: Assign Assessors
Match assessor expertise to control domains:
- IT Admins → Technical controls (IA, SC, SI)
- HR → People controls (AT, PS)
- Facilities → Physical controls (PE, MA)
- Legal/Compliance → Program controls (PL, PM, RA)

## Assessment Outcomes (NIST Standard)

ControlWeave uses NIST-standard assessment outcomes:

| Outcome | Meaning |
|---------|---------|
| **Satisfied** | Control fully implemented with supporting evidence |
| **Other Than Satisfied** | Control not fully implemented; findings documented |
| **Not Applicable** | Control not applicable to this system/org |

## Writing Quality Assessment Notes

**Good assessment notes include:**
- What was tested
- How it was tested (method)
- What evidence was reviewed
- What was found
- Any gaps or exceptions noted

**Example:**
> "Reviewed user access list exported from Active Directory on 2026-01-15. All 47 accounts verified to have role-appropriate permissions. Two terminated employee accounts found that were deactivated within 24 hours per policy. Evidence: AD_Export_Jan2026.xlsx attached."

## Assessment Scheduling

Create a sustainable assessment calendar:
- **Monthly**: Critical controls (High risk, complex)
- **Quarterly**: Most operational controls
- **Semi-Annual**: Administrative and policy controls
- **Annual**: Physical, legal, and program controls

Use ControlWeave's **Assessment Schedule** feature to set recurring assessments with automated reminders.

## Pre-Audit Assessments

Before a formal audit:
1. Run Comprehensive assessments on all in-scope controls
2. Use AI Audit Readiness Score to identify weak areas
3. Upload fresh evidence for any stale items
4. Document remediation plans for any gaps found

## Related Guides

- [Assessments](../guides/ASSESSMENTS.md) - Assessments guide
- [AI Analysis](../guides/AI_ANALYSIS.md) - AI-powered gap analysis
- [Evidence Collection Tips](EVIDENCE_COLLECTION.md) - Evidence best practices
- [GRC Best Practices](GRC_BEST_PRACTICES.md) - Overall program guidance
