# [Document Title]

<!-- ============================================================
     R11 DOCUMENT METADATA (R11.1) — Required for all controlled documents.
     Fill in every field. Delete this comment block when complete.
     ============================================================ -->

| Field                  | Value                                          |
|------------------------|------------------------------------------------|
| **Document ID**        | `POL-XXX` *(unique, e.g. POL-001, PROC-042)*  |
| **Version**            | `0.1.0` *(SemVer: MAJOR.MINOR.PATCH)*         |
| **Status**             | `Draft` *(Draft \| Approved \| Deprecated)*   |
| **Owner**              | [Role – Named Function, e.g. "Control Owner – IAM"] |
| **Approver(s)**        | [Role(s) responsible for approval]             |
| **Effective Date**     | YYYY-MM-DD                                     |
| **Next Review Date**   | YYYY-MM-DD *(or review cadence, e.g. Annual)* |
| **Classification**     | `Internal` *(Public \| Internal \| CUI \| PII \| PHI)* |
| **Applicable Frameworks** | [e.g. NIST 800-53, ISO 27001, SOC 2, HIPAA] |

---

## Revision History

<!-- R11.2 — All controlled documents MUST maintain this table.
     Add a row for every change; reference the PR/ticket that approved it. -->

| Version | Date       | Author         | Summary of Change                    | Approval Reference | Reason for Change                      |
|---------|------------|----------------|--------------------------------------|--------------------|----------------------------------------|
| 0.1.0   | YYYY-MM-DD | [Author Name]  | Initial draft                        | PR #—              | New document                           |

<!-- Semantic Versioning (R11.3) guidance:
     MAJOR — breaking policy change or materially changes compliance obligations
     MINOR — additive requirements, clarifications, new sections
     PATCH — typos, formatting, non-substantive clarifications -->

---

## 1. Purpose

[Describe the purpose of this document in 2–3 sentences. State what compliance
objective or risk this policy/procedure addresses.]

## 2. Scope

[Define who and what this document applies to: systems, roles, organizational
units, data classifications, geographic scope, etc.]

## 3. Applicable Controls

<!-- R11.6 — List impacted control IDs for compliance-oriented documents. -->

| Framework    | Control ID | Control Name                          |
|--------------|------------|---------------------------------------|
| NIST 800-53  | AC-1       | Policy and Procedures                 |
| ISO 27001    | A.5.1      | Policies for information security     |
| *(add more)* |            |                                       |

## 4. Definitions

| Term | Definition |
|------|------------|
| [Term 1] | [Definition] |
| [Term 2] | [Definition] |

## 5. Policy / Procedure

[Main body of the document. Use numbered sub-sections for procedures.
Include clear, actionable requirements. Use "MUST", "SHALL", "SHOULD",
"MAY" per RFC 2119 conventions.]

### 5.1 [Sub-section Title]

[Content]

### 5.2 [Sub-section Title]

[Content]

## 6. Roles and Responsibilities

| Role | Responsibility |
|------|----------------|
| [Role 1] | [What they are responsible for] |
| [Role 2] | [What they are responsible for] |

## 7. Enforcement and Exceptions

[Describe consequences of non-compliance and the process for requesting
an exception or waiver, including required approval level.]

## 8. Related Documents

<!-- R11.7 — Reference related policies, procedures, and evidence artifacts. -->

| Document ID | Title | Relationship |
|-------------|-------|--------------|
| [POL-XXX]   | [Title] | [e.g. Parent policy, Supersedes, Related procedure] |

## 9. Evidence Artifacts

<!-- R11.6 — List evidence artifacts that demonstrate compliance with this document. -->

| Artifact | Description | Location / Link |
|----------|-------------|-----------------|
| [e.g. audit log] | [Description] | [Path or URL] |

---

<!-- ============================================================
     DEPRECATION NOTICE (R11.5) — Complete this section ONLY if
     Status = "Deprecated". Remove this block if not applicable.
     ============================================================

## Deprecation Notice

**Deprecated as of**: YYYY-MM-DD

**Reason**: [Explain why this document is deprecated]

**Successor Document**: [Document ID and title of the replacement document]

**Migration Timeline**: [Specify what remains valid and for how long]

     ============================================================ -->

---

*This document was created using the ControlWeave R11-compliant document
template. All controlled documents must meet the R11 Version Control &
Document Governance standard. Automated compliance checks are enforced
via the `auto-review-docs` workflow.*
