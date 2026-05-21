# Agent Tracking Feature - Test Data Examples

This document shows realistic test data examples of how the agent tracking feature looks in practice.

---

## Example 1: Compliance Bot - Gap Analysis

### Request Made
```bash
POST /api/ai/gap-analysis
Headers:
  X-Agent-ID: compliance-bot-quarterly
  X-Agent-Version: 2.1.0
  X-Data-Sources: NIST-800-53-r5,ISO-27001-2022,SOC2-Type2
  X-Agent-Context: Q1-2026-automated-gap-analysis
```

### Database Record Created

**Table: `ai_decision_log`**

```json
{
  "id": "a7f3c8b2-9e1d-4f5a-8c6b-7d3e2f1a4b5c",
  "organization_id": "org_123456789",
  "ai_agent_id": null,
  
  "input_data": {
    "provider": "claude",
    "model": "claude-sonnet-4-5-20250929"
  },
  "input_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  
  "output_data": {
    "text": "# Gap Analysis Report\n\n## Executive Summary\nYour organization shows 68% compliance across 3 frameworks...\n\n## Critical Gaps\n1. Access Control Review (AC-6) - Not Implemented\n2. Incident Response Plan (IR-1) - In Progress\n3. Security Awareness Training (AT-2) - Not Started..."
  },
  "output_hash": "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
  
  "model_version": "claude-sonnet-4-5-20250929",
  "temperature": null,
  "confidence_score": null,
  "processing_timestamp": "2026-02-13T10:30:45.123Z",
  
  "reasoning": null,
  "key_factors": null,
  "alternative_outputs": null,
  
  "human_reviewed": false,
  "reviewed_by": null,
  "review_timestamp": null,
  "review_notes": null,
  "review_outcome": null,
  
  "correlation_id": "f8e2d1c4-a3b5-4e6f-9d8c-7b6a5e4f3d2c",
  "session_id": "1a2b3c4d-5e6f-7g8h-9i0j-k1l2m3n4o5p6",
  "parent_decision_id": null,
  
  "regulatory_framework": "NIST 800-53",
  "risk_assessment": null,
  "risk_level": "limited",
  "compliance_notes": null,
  
  "feature": "gap_analysis",
  "bias_flags": [
    {
      "type": "framework_inconsistency",
      "severity": "low",
      "detail": "Output references 3 frameworks — verify recommendations are consistent across all."
    }
  ],
  "fairness_notes": null,
  "bias_reviewed": false,
  "bias_reviewed_by": null,
  "bias_review_timestamp": null,
  
  "data_lineage": "Agent: compliance-bot-quarterly | Version: 2.1.0 | Sources: NIST-800-53-r5,ISO-27001-2022,SOC2-Type2 | Context: Q1-2026-automated-gap-analysis",
  "bias_score": null,
  "review_date": null,
  "approved_by": null,
  
  "created_at": "2026-02-13T10:30:45.123Z",
  "updated_at": "2026-02-13T10:30:45.123Z"
}
```

### API Response (GET /api/ai/decisions)

```json
{
  "success": true,
  "data": [
    {
      "id": "a7f3c8b2-9e1d-4f5a-8c6b-7d3e2f1a4b5c",
      "created_at": "2026-02-13T10:30:45.123Z",
      
      "data_lineage": "Agent: compliance-bot-quarterly | Version: 2.1.0 | Sources: NIST-800-53-r5,ISO-27001-2022,SOC2-Type2 | Context: Q1-2026-automated-gap-analysis",
      
      "risk_level": "limited",
      "regulatory_framework": "NIST 800-53",
      "model_version": "claude-sonnet-4-5-20250929",
      
      "correlation_id": "f8e2d1c4-a3b5-4e6f-9d8c-7b6a5e4f3d2c",
      "session_id": "1a2b3c4d-5e6f-7g8h-9i0j-k1l2m3n4o5p6",
      
      "input_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "output_hash": "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
      
      "input_preview": "{\"provider\":\"claude\",\"model\":\"claude-sonnet-4-5-20250929\"}",
      "output_preview": "# Gap Analysis Report\\n\\n## Executive Summary\\nYour organization shows 68% compliance across 3 frameworks. Critical gaps identified in access control (AC-6), incident response (IR-1), and security awareness (AT-2). Immediate action recommended for 15 high-priority controls.\\n\\n## Framework Breakdown\\n\\n### NIST 800-53 (Rev 5)\\n- Total Controls: 200\\n- Implemented: 145 (72.5%)\\n- In Progress: 30 (15%)\\n- Not Started: 25...",
      
      "human_reviewed": false,
      "bias_reviewed": false,
      "bias_flags": [
        {
          "type": "framework_inconsistency",
          "severity": "low",
          "detail": "Output references 3 frameworks — verify recommendations are consistent across all."
        }
      ],
      "bias_score": null,
      "review_date": null,
      "approved_by": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1
  }
}
```

---

## Example 2: Security Automation Bot - Incident Response

### Request Made
```bash
POST /api/ai/incident-response
Headers:
  X-Agent-ID: security-automation-v3
  X-Agent-Version: 3.2.1
  X-Data-Sources: NIST-CSF,ISO-27035-2023,Internal-Playbooks-v2
  X-Agent-Context: security-breach-ransomware-detected
```

### Database Record Created

```json
{
  "id": "b8g4d9c3-0f2e-5g6b-9d7c-8e4f3g2b5d6e",
  "organization_id": "org_123456789",
  
  "data_lineage": "Agent: security-automation-v3 | Version: 3.2.1 | Sources: NIST-CSF,ISO-27035-2023,Internal-Playbooks-v2 | Context: security-breach-ransomware-detected",
  
  "risk_level": "high",
  "regulatory_framework": "NIST CSF",
  "model_version": "gpt-4o",
  
  "processing_timestamp": "2026-02-12T03:15:22.456Z",
  "correlation_id": "emergency_ir_2026_0212_0315",
  
  "bias_flags": [],
  "human_reviewed": false,
  "bias_score": null,
  "review_date": null,
  "approved_by": null,
  
  "input_preview": "{\"incidentType\":\"ransomware\",\"severity\":\"critical\",\"affectedSystems\":15}",
  "output_preview": "# INCIDENT RESPONSE PLAN\\n\\n## SEVERITY: CRITICAL\\n\\n### Immediate Actions (0-1 hour)\\n1. ISOLATE affected systems immediately\\n2. PRESERVE evidence - do not power off systems\\n3. ACTIVATE incident response team\\n4. NOTIFY CISO and legal team\\n\\n### Containment Strategy\\n- Network segmentation implemented\\n- Backup systems verified\\n- Forensic imaging in progress...",
  
  "created_at": "2026-02-12T03:15:22.456Z"
}
```

### After Human Review

```json
{
  "id": "b8g4d9c3-0f2e-5g6b-9d7c-8e4f3g2b5d6e",
  "organization_id": "org_123456789",
  
  "data_lineage": "Agent: security-automation-v3 | Version: 3.2.1 | Sources: NIST-CSF,ISO-27035-2023,Internal-Playbooks-v2 | Context: security-breach-ransomware-detected",
  
  "risk_level": "high",
  "regulatory_framework": "NIST CSF",
  "model_version": "gpt-4o",
  
  "human_reviewed": true,
  "reviewed_by": "user_789abc",
  "review_timestamp": "2026-02-12T03:25:10.789Z",
  "review_outcome": "approved",
  "review_notes": "IR plan reviewed and approved by CISO. All containment steps executed successfully. Legal team notified. Forensic team engaged. Incident contained within 45 minutes of detection.",
  
  "review_date": "2026-02-12T03:25:10.789Z",
  "approved_by": "john.smith@company.com",
  
  "bias_reviewed": false,
  "bias_score": null
}
```

---

## Example 3: Compliance Forecasting Bot

### Request Made
```bash
POST /api/ai/compliance-forecast
Headers:
  X-Agent-ID: forecast-bot-monthly
  X-Agent-Version: 1.5.2
  X-Data-Sources: Historical-Compliance-DB,JIRA-Tickets,Implementation-Timeline
  X-Agent-Context: monthly-forecast-february-2026
```

### Database Record

```json
{
  "id": "c9h5e0d4-1g3f-6h7c-0e8d-9f5g4h3c6e7f",
  "organization_id": "org_123456789",
  
  "data_lineage": "Agent: forecast-bot-monthly | Version: 1.5.2 | Sources: Historical-Compliance-DB,JIRA-Tickets,Implementation-Timeline | Context: monthly-forecast-february-2026",
  
  "risk_level": "limited",
  "regulatory_framework": "Multi-Framework",
  "model_version": "gemini-2.5-pro",
  
  "processing_timestamp": "2026-02-01T08:00:00.000Z",
  
  "bias_flags": [
    {
      "type": "optimism_bias",
      "severity": "medium",
      "detail": "Forecast assumes 100% on-time completion for next 30 days — historical data shows 85% average."
    }
  ],
  
  "human_reviewed": true,
  "reviewed_by": "user_456def",
  "review_timestamp": "2026-02-01T14:30:00.000Z",
  "review_outcome": "approved",
  "review_notes": "Forecast reviewed. Noted optimism bias - adjusted internal expectations to 85% completion rate. Approved for executive reporting with caveat.",
  
  "review_date": "2026-02-01T14:30:00.000Z",
  "approved_by": "jane.doe@company.com",
  
  "bias_reviewed": true,
  "bias_reviewed_by": "user_456def",
  "bias_review_timestamp": "2026-02-01T14:35:00.000Z",
  "fairness_notes": "Optimism bias acknowledged and compensated for in reporting.",
  "bias_score": 0.35
}
```

---

## Example 4: Dashboard View - Multiple Agents

### GET /api/ai/decisions?page=1&limit=10

```json
{
  "success": true,
  "data": [
    {
      "id": "c9h5e0d4-1g3f-6h7c-0e8d-9f5g4h3c6e7f",
      "created_at": "2026-02-01T08:00:00.000Z",
      "data_lineage": "Agent: forecast-bot-monthly | Version: 1.5.2 | Sources: Historical-Compliance-DB,JIRA-Tickets,Implementation-Timeline | Context: monthly-forecast-february-2026",
      "risk_level": "limited",
      "human_reviewed": true,
      "approved_by": "jane.doe@company.com",
      "review_date": "2026-02-01T14:30:00.000Z",
      "bias_score": 0.35
    },
    {
      "id": "b8g4d9c3-0f2e-5g6b-9d7c-8e4f3g2b5d6e",
      "created_at": "2026-02-12T03:15:22.456Z",
      "data_lineage": "Agent: security-automation-v3 | Version: 3.2.1 | Sources: NIST-CSF,ISO-27035-2023,Internal-Playbooks-v2 | Context: security-breach-ransomware-detected",
      "risk_level": "high",
      "human_reviewed": true,
      "approved_by": "john.smith@company.com",
      "review_date": "2026-02-12T03:25:10.789Z",
      "bias_score": null
    },
    {
      "id": "a7f3c8b2-9e1d-4f5a-8c6b-7d3e2f1a4b5c",
      "created_at": "2026-02-13T10:30:45.123Z",
      "data_lineage": "Agent: compliance-bot-quarterly | Version: 2.1.0 | Sources: NIST-800-53-r5,ISO-27001-2022,SOC2-Type2 | Context: Q1-2026-automated-gap-analysis",
      "risk_level": "limited",
      "human_reviewed": false,
      "approved_by": null,
      "review_date": null,
      "bias_score": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 3
  }
}
```

---

## Example 5: Query by Agent ID

### GET /api/ai/decisions?agent_id=compliance-bot-quarterly

**Note:** This would require adding a filter parameter, but here's what the data would look like:

```json
{
  "success": true,
  "data": [
    {
      "id": "a7f3c8b2-9e1d-4f5a-8c6b-7d3e2f1a4b5c",
      "created_at": "2026-02-13T10:30:45.123Z",
      "data_lineage": "Agent: compliance-bot-quarterly | Version: 2.1.0 | Sources: NIST-800-53-r5,ISO-27001-2022,SOC2-Type2 | Context: Q1-2026-automated-gap-analysis"
    },
    {
      "id": "z1x2y3w4-v5u6-t7s8-r9q0-p1o2n3m4l5k6",
      "created_at": "2025-11-15T10:30:45.123Z",
      "data_lineage": "Agent: compliance-bot-quarterly | Version: 2.0.3 | Sources: NIST-800-53-r5,ISO-27001-2022 | Context: Q4-2025-automated-gap-analysis"
    },
    {
      "id": "m7n8o9p0-q1r2-s3t4-u5v6-w7x8y9z0a1b2",
      "created_at": "2025-08-12T10:30:45.123Z",
      "data_lineage": "Agent: compliance-bot-quarterly | Version: 2.0.1 | Sources: NIST-800-53-r5,ISO-27001-2022 | Context: Q3-2025-automated-gap-analysis"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 3
  }
}
```

---

## Example 6: Audit Trail Report

### Parsed Data Lineage Information

For audit and compliance reporting, the `data_lineage` field can be parsed to extract:

```javascript
// Parse data_lineage string
const dataLineage = "Agent: compliance-bot-quarterly | Version: 2.1.0 | Sources: NIST-800-53-r5,ISO-27001-2022,SOC2-Type2 | Context: Q1-2026-automated-gap-analysis";

const parsed = {
  agentId: "compliance-bot-quarterly",
  version: "2.1.0",
  sources: ["NIST-800-53-r5", "ISO-27001-2022", "SOC2-Type2"],
  context: "Q1-2026-automated-gap-analysis"
};
```

### Audit Report Format

```
AI DECISION AUDIT REPORT
Generated: 2026-02-13 15:00:00 UTC

Decision ID: a7f3c8b2-9e1d-4f5a-8c6b-7d3e2f1a4b5c
Organization: Acme Corporation (org_123456789)

AGENT INFORMATION:
  Agent ID: compliance-bot-quarterly
  Version: 2.1.0
  Data Sources: NIST-800-53-r5, ISO-27001-2022, SOC2-Type2
  Context: Q1-2026-automated-gap-analysis

AI PROCESSING:
  Feature: Gap Analysis
  Model: claude-sonnet-4-5-20250929
  Provider: Anthropic Claude
  Timestamp: 2026-02-13 10:30:45 UTC
  Risk Level: Limited
  Framework: NIST 800-53

DATA INTEGRITY:
  Input Hash: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
  Output Hash: d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592
  Verified: ✓

HUMAN OVERSIGHT:
  Reviewed: No
  Review Date: N/A
  Approved By: N/A
  Bias Reviewed: No
  Bias Score: N/A

TRACEABILITY:
  Correlation ID: f8e2d1c4-a3b5-4e6f-9d8c-7b6a5e4f3d2c
  Session ID: 1a2b3c4d-5e6f-7g8h-9i0j-k1l2m3n4o5p6

BIAS FLAGS:
  1. Type: framework_inconsistency
     Severity: low
     Detail: Output references 3 frameworks — verify recommendations are consistent across all.
```

---

## Example 7: Time Series Analysis

### Agent Activity Over Time

```json
{
  "agent": "compliance-bot-quarterly",
  "activity": [
    {
      "date": "2026-02-13",
      "requests": 1,
      "approved": 0,
      "pending_review": 1,
      "avg_bias_score": null
    },
    {
      "date": "2025-11-15",
      "requests": 1,
      "approved": 1,
      "pending_review": 0,
      "avg_bias_score": 0.15
    },
    {
      "date": "2025-08-12",
      "requests": 1,
      "approved": 1,
      "pending_review": 0,
      "avg_bias_score": 0.22
    }
  ]
}
```

---

## Summary of Test Data Fields

### Always Populated (Automatic)
- `id` - UUID
- `organization_id` - From authenticated user
- `data_lineage` - Constructed from agent headers
- `correlation_id` - Auto-generated UUID
- `session_id` - From X-Request-ID or auto-generated
- `processing_timestamp` - NOW()
- `risk_level` - Auto-assigned based on feature
- `regulatory_framework` - Auto-inferred from feature
- `model_version` - From request
- `input_hash` / `output_hash` - SHA-256 hashes
- `created_at` / `updated_at` - Timestamps

### Populated on Review (Manual)
- `human_reviewed` - Set to true
- `reviewed_by` - User ID of reviewer
- `review_timestamp` - NOW()
- `review_outcome` - "approved" | "rejected" | "needs_revision"
- `review_notes` - Reviewer comments
- `review_date` - NOW()
- `approved_by` - Reviewer email (if approved)

### Optional (May be populated)
- `bias_score` - 0.0 to 1.0 (if calculated)
- `bias_reviewed` - If bias was specifically reviewed
- `bias_reviewed_by` - User who reviewed bias
- `bias_review_timestamp` - When bias was reviewed
- `fairness_notes` - Notes about bias/fairness
- `bias_flags` - Array of detected bias indicators

This test data shows realistic examples of how agent tracking data flows through the system from request to storage to retrieval to human review.
