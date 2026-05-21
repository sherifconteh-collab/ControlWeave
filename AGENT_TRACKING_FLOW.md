# Agent Tracking Flow Diagram

## Complete Request Flow with Agent Tracking

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STEP 1: AGENT MAKES REQUEST                         │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────┐
    │  Compliance Bot      │
    │  (Python/JS/etc)     │
    └──────────┬───────────┘
               │
               │ POST /api/ai/gap-analysis
               │ Headers:
               │   X-Agent-ID: compliance-bot-quarterly
               │   X-Agent-Version: 2.1.0
               │   X-Data-Sources: NIST-800-53,ISO-27001
               │   X-Agent-Context: Q1-2026-gap-analysis
               │
               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STEP 2: CONTROLWEAVER BACKEND                            │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────┐
    │  Express Middleware  │
    │  - authenticate()    │
    │  - checkAIUsage()    │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │  aiHandler()         │
    │  ┌────────────────┐  │
    │  │ Extract Params │  │
    │  └────────┬───────┘  │
    │           ▼           │
    │  ┌────────────────┐  │
    │  │extractAgent    │  │
    │  │Metadata()      │◄─┼─── Reads headers: X-Agent-ID, etc.
    │  └────────┬───────┘  │
    │           │           │      Constructs data_lineage:
    │           ▼           │      "Agent: compliance-bot-quarterly |
    │  [Agent Metadata]     │       Version: 2.1.0 |
    │   - agentId          │       Sources: NIST-800-53,ISO-27001 |
    │   - agentVersion     │       Context: Q1-2026-gap-analysis"
    │   - dataSources      │
    │   - dataLineage      │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │  llmService          │
    │  .gapAnalysis()      │
    └──────────┬───────────┘
               │
               │ Uses org's API key
               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      STEP 3: LLM PROVIDER (CLAUDE)                          │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────┐
    │  Anthropic Claude    │
    │  API                 │
    └──────────┬───────────┘
               │
               │ Returns gap analysis report
               │
               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STEP 4: LOGGING & TRACKING                               │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────┐
    │  logAIUsage()        │────► INSERT INTO ai_usage_log
    │  (for billing)       │      - organization_id
    └──────────────────────┘      - feature: gap_analysis
                                  - provider: claude
                                  - success: true
                                  - tokens_input/output
                                  - byok_used
                                  - duration_ms

    ┌──────────────────────┐
    │  logAIDecision()     │────► INSERT INTO ai_decision_log
    │  (high-stakes only)  │      - organization_id
    └──────────────────────┘      - input_data (JSONB)
                                  - input_hash (SHA-256)
                                  - output_data (JSONB)
                                  - output_hash (SHA-256)
                                  - data_lineage ◄────────────┐
                                  - model_version             │
                                  - correlation_id            │
                                  - session_id                │
                                  - risk_level                │
                                  - regulatory_framework      │
                                  - bias_flags (JSONB)        │
                                  - human_reviewed: false     │
                                  - bias_reviewed: false      │
                                  - review_date: null         │
                                  - approved_by: null         │
                                                              │
                  ┌───────────────────────────────────────────┘
                  │ This comes from agent metadata!
                  │ "Agent: compliance-bot-quarterly | Version: 2.1.0 | ..."

               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STEP 5: RESPONSE TO AGENT                                │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────┐
    │  Compliance Bot      │◄──── { "success": true,
    │  Receives Response   │        "data": {
    └──────────────────────┘          "result": "# Gap Analysis...",
                                      "feature": "gap_analysis",
                                      "provider": "claude"
                                    }
                                  }

               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 STEP 6: HUMAN REVIEW (LATER)                                │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────┐
    │  Compliance Manager  │
    │  Views Dashboard     │
    └──────────┬───────────┘
               │
               │ GET /api/ai/decisions
               │
               ▼
    ┌──────────────────────────────────────────────┐
    │  Dashboard shows:                            │
    │  ┌────────────────────────────────────────┐  │
    │  │ 📋 Gap Analysis - Q1 2026              │  │
    │  │ Agent: compliance-bot-quarterly v2.1.0 │  │
    │  │ Sources: NIST-800-53, ISO-27001        │  │
    │  │ Status: ⚠️ Awaiting Review             │  │
    │  │                                         │  │
    │  │ [Review Now] [View Full Report]        │  │
    │  └────────────────────────────────────────┘  │
    └──────────┬───────────────────────────────────┘
               │
               │ Clicks "Review Now"
               ▼
    ┌──────────────────────┐
    │  Review Form         │
    │  Outcome: [Approved] │
    │  Notes: "Validated..." │
    └──────────┬───────────┘
               │
               │ PATCH /api/ai/decisions/:id/review
               │ { "outcome": "approved", "notes": "..." }
               │
               ▼
    ┌──────────────────────┐
    │  Database Updated    │────► UPDATE ai_decision_log SET
    └──────────────────────┘        human_reviewed = true,
                                    reviewed_by = <manager_id>,
                                    review_timestamp = NOW(),
                                    review_date = NOW(),
                                    approved_by = 'jane.doe@company.com',
                                    review_outcome = 'approved',
                                    review_notes = 'Validated...'

               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STEP 7: AUDIT TRAIL COMPLETE                             │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────┐
    │  Complete Audit Record:                                     │
    │                                                              │
    │  ✓ WHO: compliance-bot-quarterly v2.1.0                     │
    │  ✓ WHAT: Gap analysis using Claude Sonnet                   │
    │  ✓ WHEN: 2026-02-13 10:30:45 UTC                            │
    │  ✓ WHY: Q1-2026-gap-analysis (automated quarterly)          │
    │  ✓ DATA SOURCES: NIST-800-53, ISO-27001                     │
    │  ✓ REVIEWED BY: jane.doe@company.com                        │
    │  ✓ REVIEW DATE: 2026-02-13 14:15:30 UTC                     │
    │  ✓ OUTCOME: Approved                                        │
    │  ✓ INTEGRITY: SHA-256 hashes verified                       │
    │  ✓ RISK LEVEL: Limited                                      │
    │  ✓ FRAMEWORK: NIST 800-53                                   │
    └─────────────────────────────────────────────────────────────┘
```

## Data Flow Summary

```
Agent Headers          extractAgentMetadata()         Database
─────────────         ─────────────────────         ──────────

X-Agent-ID      ────►  agentId                  ┐
X-Agent-Version ────►  agentVersion             │
X-Data-Sources  ────►  dataSources              ├──► data_lineage
X-Agent-Context ────►  agentContext             │    (TEXT)
                                                 ┘
                       correlationId (UUID)    ────► correlation_id
                       sessionId (UUID)        ────► session_id
                       
                       input (JSONB)           ────► input_data
                       SHA-256(input)          ────► input_hash
                       
                       output (JSONB)          ────► output_data
                       SHA-256(output)         ────► output_hash
                       
                       Auto-assigned           ────► risk_level
                       Auto-inferred           ────► regulatory_framework
                       
                       On Review:
                       NOW()                   ────► review_date
                       reviewer.email          ────► approved_by
```

## Key Integration Points

### 1. Agent Implementation (Any Language)
```python
# Just add headers to your HTTP requests
headers = {
    "X-Agent-ID": "my-bot",
    "X-Agent-Version": "1.0",
    "X-Data-Sources": "source1,source2",
    "X-Agent-Context": "why-am-i-running"
}
```

### 2. ControlWeaver Backend (Automatic)
- Extracts headers
- Constructs data_lineage
- Stores in database
- No agent changes needed after initial setup

### 3. Compliance Dashboard (Query)
```bash
GET /api/ai/decisions
# Returns all tracked decisions with agent metadata
```

### 4. Review Workflow (Approval)
```bash
PATCH /api/ai/decisions/:id/review
# Sets review_date and approved_by automatically
```

## Architecture Benefits

```
Traditional Approach:        Agent Tracking Approach:
─────────────────           ────────────────────────

Agent → LLM Provider        Agent → ControlWeaver → LLM Provider
         ↓                           ↓         ↓
    Black Box                   Tracking   Full Audit
    No Traceability             Logging    Trail
```

With agent tracking, ControlWeaver acts as the **control plane** that:
- ✓ Authenticates agents
- ✓ Tracks metadata
- ✓ Logs decisions
- ✓ Enables human review
- ✓ Provides audit trails
- ✓ Maintains data integrity

All while maintaining standard LLM provider integrations!
