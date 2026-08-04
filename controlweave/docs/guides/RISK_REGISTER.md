# 🎲 Risk Register Guide

Recording, assessing, treating and reviewing risks in ControlWeave.

## ⏱️ Time Commitment

- First risk recorded: 5 minutes
- A register worth showing an assessor: ongoing

## 📋 Prerequisites

- The `risks.read` permission to view, `risks.write` to record and change
- Departments configured if you want to attribute risks to one
  (**Organization → Structure**)

---

## Overview

ControlWeave ships ISO 31000, ISO 27005 and the NIST AI RMF as frameworks you
can assess against. The register is where the risks those frameworks are *about*
actually live.

The model follows ISO 31000 / ISO 27005 and NIST SP 800-30 rather than inventing
its own vocabulary:

- **Inherent and residual are both stored**, each as a likelihood × impact pair
  on a 1–5 scale. Recording only the residual figure is the most common way a
  register stops being auditable — there is then no evidence that a control did
  anything.
- **Four treatment strategies**: avoid, mitigate, transfer, accept.
- **Acceptance is explicit**: who accepted it, on what date, and why.
- **Reviews are tracked**, because a register nobody revisits is a stale
  document and the review history is the evidence it was revisited.

---

## Step 1: Open the Register

Click **Risk Register** in the left sidebar, under **Risk**.

The page opens on a 5×5 residual heat map and the register itself, with four
counters for the things that quietly rot a register: unassessed risks, overdue
reviews, expired acceptances and unowned risks.

Click any risk's title to open its detail page.

---

## Step 2: Record a Risk

Click **+ New Risk** and fill in:

| Field | Notes |
|---|---|
| **Title** | What could happen, not what you'll do about it |
| **Reference** | Optional, e.g. `R-001`. Unique per organization |
| **Category** | Drives grouping and reporting |
| **Threat source** | Who or what could cause it |
| **Vulnerability** | The weakness it would exploit |
| **Inherent likelihood / impact** | 1–5 each, *before* any controls |
| **Residual likelihood / impact** | 1–5 each, *after* your existing controls |
| **Owner / Department** | Who answers for it |
| **Next review date** | When you will revisit this |

Scores are the product of likelihood and impact, so 1–25, and are computed by
the database rather than by the form — the heat map and the register can never
disagree about a number.

---

## Step 3: Assess Inherent vs Residual

The detail page shows both assessments side by side, with the reduction between
them stated plainly: *"Controls have reduced this risk by 8 point(s)."*

That number is the argument your control environment makes for itself. If
inherent and residual are the same, either the controls are not working or
nobody has reassessed since they were put in.

---

## Step 4: Decide a Treatment

Set a **treatment strategy** on the risk (avoid, mitigate, transfer, accept),
then record the specific work as **treatments** on the detail page. Each
treatment tracks its own owner, due date, status, progress percentage, estimated
and actual cost, and a **target residual score**.

Comparing that target against the risk's residual score after the treatment
completes is how you find out whether your treatments actually work.

---

## Step 5: Link the Risk to the Rest of the Platform

A register that sits parallel to the compliance work is a spreadsheet with extra
steps. Each risk links to:

- **Controls** — what treats the risk, with an effectiveness rating
- **Evidence** — what proves it is under management. Attach a document and say
  *why* it is evidence: `assessment` (how the risk was scored), `treatment`
  (what is being done), `monitoring` (ongoing proof it stays within appetite) or
  `acceptance` (the decision record). The reason lives on the link rather than
  the document, because the same penetration-test report can be assessment
  evidence for one risk and monitoring evidence for another.

  This is not the same as evidence linked to a control. A control is a thing you
  do; a risk is a thing that could happen. "Show me these controls exist" and
  "show me this risk is under management" are different questions, and going via
  controls answers the second only transitively — when the risk happens to have
  controls linked and those controls happen to carry the document
- **Vendors** — whose failure it would be. Links a register entry to a TPRM
  vendor, and shows up during that vendor's review. A vendor's **risk tier** is
  a static classification set at onboarding ("this is a critical supplier"); a
  linked risk is the specific thing that could go wrong, scored, treated and
  reviewed. Both matter, and where they disagree — a `low` tier vendor carrying
  an open critical risk — the vendor panel says so
- **Assets** — what is exposed. The link is visible from both ends: attach it
  here, and it appears in the **Risk Exposure** panel on that asset's drawer
  in the CMDB, so an asset owner can see what their system carries without
  opening the register
- **Objectives** — what is threatened
- **POA&Ms** — the remediation actually being done

### Remediation

The **Remediation** panel lists every POA&M linked to the risk with live status,
owner and due date. Use **+ Create POA&M from this risk** to raise one directly;
priority is set from the residual score (20+ critical, 12+ high, 6+ medium), and
the new item is linked back automatically.

Where a POA&M exists to execute one specific treatment, select that treatment
when creating it.

> **Closing remediation does not move your residual score.** When every linked
> POA&M closes, the risk is flagged **review due** and the page says so. A human
> records the reassessment. Inherent and residual are stored separately
> precisely so an assessor can see what the controls achieved — a score that
> moved on its own would erase that.

See the [POA&M guide](POAM.md).

---

## Step 6: Accept a Risk

Not every risk gets treated. Accepting one records:

- **Who** accepted it
- **When**
- **The rationale**
- Optionally, **when the acceptance expires**

Expired acceptances surface in the register's attention counters, so an
acceptance made once in 2024 cannot quietly stand forever.

---

## Step 7: Review on a Cadence

Record a review from the detail page with an outcome — unchanged, reassessed,
escalated, de-escalated or closed — and a note on what you looked at.

Each review updates the history and the next review date. Risks past their
review date appear in the **Reviews overdue** counter.

---

## Risk Statuses

| Status | Meaning |
|---|---|
| **Identified** | Recorded, not yet assessed |
| **Assessed** | Inherent and residual scores set |
| **Treated** | Treatment underway |
| **Accepted** | Formally accepted with a rationale |
| **Closed** | No longer applicable |

---

## 📚 Additional Resources

- [POA&M Tracking Guide](POAM.md) — the remediation half
- [Controls Guide](CONTROLS.md) — what treats your risks
- [CMDB Guide](CMDB.md) — the assets that are exposed
- [Vendor Risk](VENDOR_RISK.md) — third-party risk, tracked separately
