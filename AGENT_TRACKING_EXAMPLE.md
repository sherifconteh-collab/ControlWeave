# Agent Tracking Feature - Complete Working Example

## Scenario: Compliance Automation Bot
This example shows how a compliance automation bot tracks its AI-assisted gap analysis activities in ControlWeaver.

---

## Step 1: Agent Makes an AI Request

### The Request
Your compliance bot sends a gap analysis request with tracking metadata:

```bash
curl -X POST https://controlweaver.example.com/api/ai/gap-analysis \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -H "X-Agent-ID: compliance-bot-quarterly" \
  -H "X-Agent-Version: 2.1.0" \
  -H "X-Data-Sources: NIST-800-53-r5,ISO-27001-2022,SOC2-Type2" \
  -H "X-Agent-Context: Q1-2026-automated-gap-analysis" \
  -d '{
    "provider": "claude",
    "model": "claude-sonnet-4-5-20250929"
  }'
```

**What happens behind the scenes:**
1. ControlWeaver receives the request
2. `extractAgentMetadata()` extracts the headers:
   - Agent ID: `compliance-bot-quarterly`
   - Version: `2.1.0`
   - Data Sources: `NIST-800-53-r5,ISO-27001-2022,SOC2-Type2`
   - Context: `Q1-2026-automated-gap-analysis`
3. Constructs data_lineage string:
   ```
   "Agent: compliance-bot-quarterly | Version: 2.1.0 | Sources: NIST-800-53-r5,ISO-27001-2022,SOC2-Type2 | Context: Q1-2026-automated-gap-analysis"
   ```

---

## Step 2: ControlWeaver Processes the Request

### AI Processing Flow
```
1. Authentication ✓
2. Check AI usage limits ✓
3. Extract agent metadata ✓
4. Call LLM provider (Claude) → Gap Analysis Generated
5. Log to ai_usage_log ✓
6. Log to ai_decision_log (high-stakes feature) ✓
   - Store input/output hashes
   - Store data_lineage
   - Store correlation_id
   - Store model_version
   - Store risk_level: "limited"
   - Store regulatory_framework: "NIST 800-53"
7. Return response to agent
```

### Response Received by Agent
```json
{
  "success": true,
  "data": {
    "result": "# Gap Analysis Report\n\n## Executive Summary\nYour organization shows 68% compliance across 3 frameworks...",
    "feature": "gap_analysis",
    "provider": "claude"
  }
}
```

---

## Step 3: View Tracked Information

### Query the Decision Log
Your compliance team can now view what the agent did:

```bash
curl -X GET "https://controlweaver.example.com/api/ai/decisions?page=1&limit=10" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### Response Shows Complete Tracking
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
      "output_preview": "# Gap Analysis Report\\n\\n## Executive Summary\\nYour organization shows 68% compliance across 3 frameworks. Critical gaps identified in...",
      
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
    "limit": 10,
    "total": 1
  }
}
```

---

## Step 4: Human Review and Approval

### Compliance Manager Reviews the Decision
```bash
curl -X PATCH "https://controlweaver.example.com/api/ai/decisions/a7f3c8b2-9e1d-4f5a-8c6b-7d3e2f1a4b5c/review" \
  -H "Authorization: Bearer COMPLIANCE_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "outcome": "approved",
    "notes": "Gap analysis reviewed and validated. Agent correctly identified 15 critical gaps. Recommendations align with our remediation roadmap. Approved for executive distribution."
  }'
```

### Response
```json
{
  "success": true
}
```

### Updated Record After Review
Now when you query the decision log, you see:

```json
{
  "id": "a7f3c8b2-9e1d-4f5a-8c6b-7d3e2f1a4b5c",
  "created_at": "2026-02-13T10:30:45.123Z",
  
  "data_lineage": "Agent: compliance-bot-quarterly | Version: 2.1.0 | Sources: NIST-800-53-r5,ISO-27001-2022,SOC2-Type2 | Context: Q1-2026-automated-gap-analysis",
  
  "human_reviewed": true,
  "reviewed_by": "uuid-of-compliance-manager",
  "review_timestamp": "2026-02-13T14:15:30.456Z",
  "review_outcome": "approved",
  "review_notes": "Gap analysis reviewed and validated. Agent correctly identified 15 critical gaps...",
  
  "review_date": "2026-02-13T14:15:30.456Z",
  "approved_by": "jane.doe@company.com"
}
```

---

## Step 5: Audit Trail & Compliance Reporting

### What You Can Now Answer
With this tracking in place, you can answer:

✅ **"Who generated this gap analysis?"**
   → Agent: `compliance-bot-quarterly` version `2.1.0`

✅ **"What data sources did it use?"**
   → NIST-800-53-r5, ISO-27001-2022, SOC2-Type2

✅ **"Why was this analysis run?"**
   → Context: Q1-2026-automated-gap-analysis

✅ **"What LLM model was used?"**
   → claude-sonnet-4-5-20250929

✅ **"Has this been human-reviewed?"**
   → Yes, approved by jane.doe@company.com on 2026-02-13

✅ **"Can we verify data integrity?"**
   → Yes, via SHA-256 hashes of input/output

✅ **"What was the risk level?"**
   → Limited (automatically assigned based on feature type)

✅ **"Which regulatory framework applies?"**
   → NIST 800-53 (automatically inferred from feature)

---

## Real-World Integration Example

### Python Agent Implementation
```python
import requests
import json

class ComplianceBot:
    def __init__(self, api_url, token):
        self.api_url = api_url
        self.token = token
        self.agent_id = "compliance-bot-quarterly"
        self.version = "2.1.0"
    
    def run_gap_analysis(self, data_sources, context):
        """
        Run an AI-assisted gap analysis with full tracking.
        """
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            # Agent tracking headers
            "X-Agent-ID": self.agent_id,
            "X-Agent-Version": self.version,
            "X-Data-Sources": ",".join(data_sources),
            "X-Agent-Context": context,
        }
        
        payload = {
            "provider": "claude",
            "model": "claude-sonnet-4-5-20250929"
        }
        
        response = requests.post(
            f"{self.api_url}/api/ai/gap-analysis",
            headers=headers,
            json=payload
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✓ Gap analysis completed")
            print(f"✓ Tracked in ControlWeaver decision log")
            return result["data"]["result"]
        else:
            raise Exception(f"Error: {response.status_code} - {response.text}")

# Usage
bot = ComplianceBot(
    api_url="https://controlweaver.example.com",
    token="your_api_token_here"
)

gap_analysis = bot.run_gap_analysis(
    data_sources=["NIST-800-53-r5", "ISO-27001-2022", "SOC2-Type2"],
    context="Q1-2026-automated-gap-analysis"
)

print(gap_analysis)
```

### Output
```
✓ Gap analysis completed
✓ Tracked in ControlWeaver decision log

# Gap Analysis Report

## Executive Summary
Your organization shows 68% compliance across 3 frameworks...
[Full report content]
```

---

## Step 6: Dashboard View (Conceptual)

### What Compliance Teams See

**Unreviewed High-Risk Decisions Dashboard**
```
┌─────────────────────────────────────────────────────────────────┐
│ AI Decision Log - Pending Review                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 📋 Gap Analysis - Q1 2026                                       │
│ ├─ Agent: compliance-bot-quarterly (v2.1.0)                     │
│ ├─ Sources: NIST-800-53-r5, ISO-27001-2022, SOC2-Type2         │
│ ├─ Risk: Limited                                                │
│ ├─ Date: 2026-02-13 10:30 AM                                    │
│ └─ Status: ⚠️ Awaiting Review                                   │
│    [Review Now] [View Details] [Download Report]                │
│                                                                  │
│ 🔥 Incident Response Plan - Security Breach                     │
│ ├─ Agent: security-automation-v3 (v3.2.1)                       │
│ ├─ Sources: NIST-CSF, ISO-27035, Internal-Playbooks            │
│ ├─ Risk: High ⚠️                                                │
│ ├─ Date: 2026-02-12 03:15 AM                                    │
│ └─ Status: 🔴 URGENT - Requires Immediate Review                │
│    [Review Now] [View Details] [Emergency Approval]             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Benefits

### For Agents/Developers
✅ Simple header-based tracking (no complex setup)
✅ Works with any HTTP client
✅ Backward compatible (headers are optional)
✅ Clear audit trail for debugging

### For Compliance Teams
✅ Full visibility into AI agent activities
✅ Data provenance tracking
✅ Human-in-the-loop review workflows
✅ Regulatory compliance evidence
✅ Risk-based prioritization
✅ Integrity verification via hashes

### For Security/Audit
✅ Complete traceability
✅ Tamper detection (SHA-256 hashes)
✅ Version tracking for reproducibility
✅ Framework-aligned risk assessment
✅ Automated bias detection flags

---

## Summary

This "handshake" feature creates a contract between AI agents and ControlWeaver:

1. **Agent promises:** "I'll tell you who I am, what data I'm using, and why I'm making this request"
2. **ControlWeaver promises:** "I'll track everything, verify integrity, and provide full audit trails"
3. **Result:** Complete transparency and accountability for AI-assisted compliance decisions

The beauty is it's **opt-in but encouraged** - agents that provide metadata get better tracking, while legacy systems continue to work without headers.
