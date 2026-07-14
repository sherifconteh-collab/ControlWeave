# 🏗️ NIST RMF Lifecycle Guide

Manage your system authorization packages through the complete NIST SP 800-37 Rev 2 Risk Management Framework lifecycle.

## Overview

The RMF module implements the seven-step NIST Risk Management Framework (SP 800-37 Rev 2) for system-level authorization. Each information system in your organization gets its own **RMF Package** that tracks its progress through the lifecycle, records step transitions, and stores formal authorization decisions (ATOs, DATOs, IATTs). This feature requires activation of NIST 800-53, NIST 800-171, or CMMC 2.0 frameworks.

---

## The 7 RMF Steps

| Step | Name | Description |
|------|------|-------------|
| 1 | **Prepare** | Establish organizational risk management roles, strategy, and architecture |
| 2 | **Categorize** | Classify the system using FIPS 199 (Confidentiality, Integrity, Availability impact) |
| 3 | **Select** | Choose an initial set of controls based on categorization |
| 4 | **Implement** | Deploy selected controls and document implementation |
| 5 | **Assess** | Evaluate whether controls are implemented correctly and effectively |
| 6 | **Authorize** | Senior official makes risk-based authorization decision |
| 7 | **Monitor** | Continuously monitor controls, the environment, and risks |

---

## RMF Eligibility

The RMF module is only available when your organization has at least one of these frameworks active:

- **NIST SP 800-53** (federal security controls)
- **NIST SP 800-171** (CUI protection)
- **CMMC 2.0** (defense contractor compliance)

If none of these are active, go to **Frameworks** → activate one of the above → return to RMF.

---

## Creating an RMF Package

An RMF Package represents a single information system going through the authorization lifecycle.

### Step 1: Navigate to RMF

1. Click **RMF** in the left sidebar
2. You'll see existing packages listed by last activity date

### Step 2: Create a New Package

1. Click **New RMF Package**
2. Fill in:
   - **System Name** — the name of the information system (required)
   - **System Description** — what the system does and its purpose
   - **System** (optional) — link to a system registered in your CMDB
3. Click **Create Package**
4. The package starts at **Step 1: Prepare** with status **Not Started**
5. An initial history entry is recorded automatically

> **💡 Tip**: Each system can only have one active RMF package. If a system already has a package, you'll see a conflict error.

---

## Package Statuses

| Status | Meaning |
|--------|---------|
| **Not Started** | Package created but work not yet begun |
| **In Progress** | Actively working through RMF steps |
| **Assessment Complete** | Step 5 (Assess) has been completed |
| **Authorized** | ATO granted — system is authorized to operate |
| **Denied** | Authorization denied — system cannot operate |
| **Revoked** | Previously granted ATO has been revoked |

---

## Moving Through Steps

### Advancing a Step

1. Open an RMF Package
2. Review the current step's requirements
3. Complete the work for the current step (in-platform or offline)
4. Click **Advance to Next Step**
5. Add **Notes** describing what was completed
6. The step transition is recorded in the history

### Reverting a Step

If you need to revisit a previous step:

1. Click **Revert Step**
2. Add notes explaining why you are reverting
3. The package returns to the previous step

### Resetting a Package

To restart the entire lifecycle:

1. Click **Reset**
2. The package returns to Step 1: Prepare
3. All history is preserved for audit purposes

### Adding Notes

At any time, add notes to a package without advancing or reverting:

1. Click **Add Note**
2. Enter your note
3. Click **Save** — the note is recorded in the step history

---

## Step History

Every step transition is recorded with:

- **From Step** and **To Step**
- **Action** taken (Advance, Revert, Reset, Note)
- **Notes** from the person who made the transition
- **Performed By** (user name)
- **Timestamp**

This creates a complete audit trail of the system's path through the authorization lifecycle.

---

## Authorization Decisions

When a system reaches Step 6 (Authorize), the Authorizing Official (AO) makes a formal decision.

### Decision Types

| Type | Description |
|------|-------------|
| **ATO** | Authority to Operate — full authorization |
| **DATO** | Denial of Authority to Operate — authorization denied |
| **IATT** | Interim Authority to Test — limited, time-bound testing authorization |
| **Denial** | Authorization request denied without DATO status |

### Recording an Authorization Decision

1. Open the RMF Package at Step 6 (Authorize)
2. Click **Record Authorization Decision**
3. Select:
   - **Decision Type** (ATO, DATO, IATT, Denial)
   - **Risk Level** (Low, Moderate, High, Very High)
   - **Decision Date** and **Expiry Date**
   - **Conditions** — any conditions attached to the authorization
   - **Rationale** — justification for the decision
4. Click **Save Decision**
5. The decision is marked **Active** until expiry or revocation

### Multiple Decisions

A package can have multiple decisions over time (e.g., ATO expires, new ATO is granted). Historical decisions are preserved.

---

## RMF and Controls

The RMF lifecycle is tightly integrated with your controls:

- **Step 3 (Select)**: Use ControlWeave's control selection tools to identify your control baseline
- **Step 4 (Implement)**: Track implementation status in the Controls module
- **Step 5 (Assess)**: Run assessments using the Assessments module
- **Step 7 (Monitor)**: Use continuous monitoring via the AI Monitoring and Security Posture modules

---

ControlWeaver has no tier gating — the RMF lifecycle, RMF packages, authorization decisions, and step history are all available to every authenticated user.

**Required Frameworks**: NIST 800-53, NIST 800-171, or CMMC 2.0 must be active.

---

## Related Features

- [Assessments Guide](ASSESSMENTS.md) — Formal control assessments for Step 5
- [Controls Guide](CONTROLS.md) — Control implementation tracking for Steps 3–4
- [AI Monitoring Guide](AI_MONITORING.md) — Continuous monitoring for Step 7
- [Reports Guide](REPORTS.md) — System Security Plan (SSP) generation
- [POA&M Guide](POAM.md) — Remediation tracking for assessment findings
