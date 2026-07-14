# Agent Tracking Feature (AI Agent "Handshake")

Traceability for AI agents that call ControlWeave's `/api/ai/*` endpoints. Lets
an external agent (bot, script, integration) identify itself and its data
sources on each request, so the resulting AI decision is fully attributable
and auditable.

## How It Works

### 1. Agent Metadata Collection

When calling any `/api/ai/*` endpoint, an agent can supply metadata via
**either** custom headers or request body fields (headers take precedence if
both are present):

| Header | Body field | Meaning |
|---|---|---|
| `X-Agent-ID` | `agentId` | Unique identifier for the agent |
| `X-Agent-Version` | `agentVersion` | Version of the agent |
| `X-Data-Sources` | `dataSources` | Comma-separated data sources the agent used |
| `X-Agent-Context` | `agentContext` | Purpose/trigger of the operation |

Providing this metadata is **opt-in but encouraged** — requests without it
still work (backward compatible with legacy callers), they just get a
`data_lineage` value of `null`.

### 2. Data Lineage Construction

`extractAgentMetadata()` builds a single `data_lineage` string from whatever
fields were provided:

```
Format:  "Agent: <agentId> | Version: <agentVersion> | Sources: <dataSources> | Context: <agentContext>"
Example: "Agent: compliance-bot-quarterly | Version: 2.1.0 | Sources: NIST-800-53-r5,ISO-27001-2022,SOC2-Type2 | Context: Q1-2026-automated-gap-analysis"
```

### 3. Request Flow

```
Agent (Python/JS/curl/etc.)
  │  POST /api/ai/<feature>  + X-Agent-* headers
  ▼
authenticate() → checkAIUsage() → aiHandler()
  │
  ├─ extractAgentMetadata()  → agentId, agentVersion, dataSources, dataLineage
  ├─ llmService.<feature>()  → calls LLM provider (org's BYOK key if configured)
  │
  ├─ logAIUsage()     → INSERT INTO ai_usage_log   (billing/telemetry, every call)
  └─ logAIDecision()  → INSERT INTO ai_decision_log (high-stakes features only)
       - input_data / input_hash   (SHA-256)
       - output_data / output_hash (SHA-256)
       - data_lineage              ← from agent metadata
       - model_version, correlation_id, session_id
       - risk_level, regulatory_framework  (auto-assigned/inferred per feature)
       - bias_flags (JSONB), human_reviewed: false, bias_reviewed: false
  ▼
Response → agent: { success, data: { result, feature, provider } }
```

`correlation_id` is auto-generated per request; `session_id` comes from an
`X-Request-ID` header if present, otherwise auto-generated.

### High-Stakes Features (auto-logged to `ai_decision_log`)

- `gap_analysis`
- `compliance_forecast`
- `remediation_playbook`
- `incident_response`
- `executive_report`
- `risk_heatmap`
- `vendor_risk`

Other/low-stakes features are still recorded in `ai_usage_log` but not in the
decision log.

## Database Schema

Migration 048 added these fields to `ai_decision_log`:

```sql
data_lineage TEXT,              -- Agent metadata and data provenance
bias_score FLOAT CHECK (bias_score >= 0.0 AND bias_score <= 1.0),
review_date TIMESTAMP,          -- When decision was formally reviewed
approved_by VARCHAR(255)        -- Who approved the decision
```

Pre-existing columns relevant to tracking: `input_data`/`input_hash`,
`output_data`/`output_hash`, `model_version`, `correlation_id`, `session_id`,
`parent_decision_id`, `regulatory_framework`, `risk_level`, `bias_flags`,
`human_reviewed`/`reviewed_by`/`review_timestamp`/`review_outcome`/`review_notes`,
`bias_reviewed`/`bias_reviewed_by`/`bias_review_timestamp`, `fairness_notes`.

## API

### Make a tracked request

```bash
curl -X POST https://your-app.com/api/ai/gap-analysis \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Agent-ID: compliance-automation-bot" \
  -H "X-Agent-Version: 1.0.0" \
  -H "X-Data-Sources: NIST-800-53,ISO-27001" \
  -H "X-Agent-Context: automated-quarterly-review" \
  -d '{"provider": "claude"}'
```

Body-field equivalent (no custom headers needed):

```bash
curl -X POST https://your-app.com/api/ai/gap-analysis \
  -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "provider": "claude",
    "agentId": "compliance-automation-bot",
    "agentVersion": "1.0.0",
    "dataSources": "NIST-800-53,ISO-27001",
    "agentContext": "automated-quarterly-review"
  }'
```

JavaScript/TypeScript:

```javascript
const response = await fetch('/api/ai/gap-analysis', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json',
    'X-Agent-ID': 'compliance-automation-bot',
    'X-Agent-Version': '1.0.0',
    'X-Data-Sources': 'NIST-800-53,ISO-27001',
    'X-Agent-Context': 'automated-quarterly-review',
  },
  body: JSON.stringify({ provider: 'claude' }),
});
```

Python:

```python
class ComplianceBot:
    def __init__(self, api_url, token):
        self.api_url = api_url
        self.token = token
        self.agent_id = "compliance-bot-quarterly"
        self.version = "2.1.0"

    def run_gap_analysis(self, data_sources, context):
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "X-Agent-ID": self.agent_id,
            "X-Agent-Version": self.version,
            "X-Data-Sources": ",".join(data_sources),
            "X-Agent-Context": context,
        }
        payload = {"provider": "claude"}
        response = requests.post(f"{self.api_url}/api/ai/gap-analysis", headers=headers, json=payload)
        response.raise_for_status()
        return response.json()["data"]["result"]
```

### View tracked decisions

```bash
GET /api/ai/decisions?page=1&limit=25
GET /api/ai/decisions?reviewed=false&risk_level=high
GET /api/ai/decisions?feature=gap_analysis
```

Response fields include `data_lineage`, `risk_level`, `regulatory_framework`,
`model_version`, `correlation_id`, `session_id`, `input_hash`/`output_hash`,
`input_preview`/`output_preview`, `human_reviewed`, `bias_reviewed`,
`bias_flags`, `bias_score`, `review_date`, `approved_by`.

### Human review workflow

```bash
PATCH /api/ai/decisions/:id/review
Content-Type: application/json

{
  "outcome": "approved",
  "notes": "Gap analysis reviewed and validated by compliance team"
}
```

This automatically sets `human_reviewed = true`, `reviewed_by` (current
user), `review_timestamp` / `review_date` = now, `review_outcome`, and
`approved_by` (reviewer's email — only populated when outcome is
`"approved"`).

## Access Control

- Viewing decisions (`GET /api/ai/decisions`): requires `settings.manage` permission.
- Reviewing decisions (`PATCH .../review`): requires `assessments.write` permission.

## Example Record (`ai_decision_log`)

```json
{
  "id": "a7f3c8b2-9e1d-4f5a-8c6b-7d3e2f1a4b5c",
  "organization_id": "org_123456789",
  "input_data": { "provider": "claude", "model": "claude-sonnet-4-5-20250929" },
  "input_hash": "e3b0c442...",
  "output_data": { "text": "# Gap Analysis Report..." },
  "output_hash": "d7a8fbb3...",
  "model_version": "claude-sonnet-4-5-20250929",
  "processing_timestamp": "2026-02-13T10:30:45.123Z",
  "correlation_id": "f8e2d1c4-a3b5-4e6f-9d8c-7b6a5e4f3d2c",
  "session_id": "1a2b3c4d-5e6f-7g8h-9i0j-k1l2m3n4o5p6",
  "regulatory_framework": "NIST 800-53",
  "risk_level": "limited",
  "feature": "gap_analysis",
  "bias_flags": [
    { "type": "framework_inconsistency", "severity": "low", "detail": "Output references 3 frameworks — verify recommendations are consistent." }
  ],
  "data_lineage": "Agent: compliance-bot-quarterly | Version: 2.1.0 | Sources: NIST-800-53-r5,ISO-27001-2022,SOC2-Type2 | Context: Q1-2026-automated-gap-analysis",
  "human_reviewed": false,
  "bias_reviewed": false,
  "bias_score": null,
  "review_date": null,
  "approved_by": null,
  "created_at": "2026-02-13T10:30:45.123Z"
}
```

After a review is submitted, the record additionally carries
`human_reviewed: true`, `reviewed_by`, `review_timestamp`, `review_outcome`,
`review_notes`, `review_date`, and `approved_by`.

The `data_lineage` string can be parsed by splitting on `|` for reporting:

```javascript
const dataLineage = "Agent: compliance-bot-quarterly | Version: 2.1.0 | Sources: NIST-800-53-r5,ISO-27001-2022,SOC2-Type2 | Context: Q1-2026-automated-gap-analysis";
const parsed = {
  agentId: "compliance-bot-quarterly",
  version: "2.1.0",
  sources: ["NIST-800-53-r5", "ISO-27001-2022", "SOC2-Type2"],
  context: "Q1-2026-automated-gap-analysis",
};
```

## Security & Integrity

- All `input_data`/`output_data` are SHA-256 hashed (`input_hash`,
  `output_hash`) so tampering can be detected.
- `correlation_id`/`session_id` support cross-request and multi-step tracing.
- `regulatory_framework` and `risk_level` are auto-assigned/inferred per
  feature — not agent-supplied — so an agent can't self-report a lower risk
  level.

## Best Practices

**For agent developers:**
1. Always send a consistent, descriptive `X-Agent-ID`.
2. Include a version number so decisions are reproducible/traceable to agent code.
3. List all data sources actually consulted.
4. Provide context explaining why the request was made.

**For compliance teams:**
1. Regularly review `GET /api/ai/decisions?reviewed=false&risk_level=high`.
2. Add detailed notes when approving/rejecting.
3. Use `data_lineage` to spot problematic agents or data sources over time.

## Known Gaps / Not Yet Implemented

- No dedicated `?agent_id=` query filter on `/api/ai/decisions` yet — agent
  identity currently has to be extracted from `data_lineage` client-side.
- `bias_score` is not automatically computed; it's populated only when
  manually set during bias review.
- No dashboard/UI for agent-activity trends — this doc previously described
  one conceptually, but nothing analogous exists in the codebase yet.
