# Agent Tracking Feature - API "Handshake" Implementation

## Overview
This feature enables agentic AI tracking by allowing AI agents to provide metadata through custom headers or request body parameters. This metadata is automatically captured and stored in the `ai_decision_log` table, providing full traceability of AI agent operations.

## How It Works

### 1. Agent Metadata Collection
When making AI requests to any `/api/ai/*` endpoint, agents can provide metadata through:

**Custom Headers:**
- `X-Agent-ID` - Unique identifier for the agent
- `X-Agent-Context` - Context or purpose of the agent's operation
- `X-Data-Sources` - Data sources the agent used
- `X-Agent-Version` - Version of the agent

**Request Body Fields (alternative to headers):**
- `agentId` - Unique identifier for the agent
- `agentContext` - Context or purpose of the agent's operation
- `dataSources` - Data sources the agent used
- `agentVersion` - Version of the agent

### 2. Data Lineage Tracking
The system automatically constructs a `data_lineage` string from the provided metadata:
```
Format: "Agent: <agentId> | Version: <agentVersion> | Sources: <dataSources> | Context: <agentContext>"
Example: "Agent: compliance-bot-v2 | Version: 2.1.0 | Sources: NIST-DB,SOC2-Docs | Context: gap-analysis-automation"
```

### 3. Storage in ai_decision_log
For high-stakes features, the metadata is automatically stored in the `ai_decision_log` table:
- `data_lineage` (TEXT) - Constructed lineage string
- `correlation_id` (UUID) - Auto-generated for request tracking
- `session_id` (UUID) - From `X-Request-ID` header or auto-generated

## Usage Examples

### Example 1: Using Custom Headers
```bash
curl -X POST https://your-app.com/api/ai/gap-analysis \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Agent-ID: compliance-automation-bot" \
  -H "X-Agent-Version: 1.0.0" \
  -H "X-Data-Sources: NIST-800-53,ISO-27001" \
  -H "X-Agent-Context: automated-quarterly-review" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "claude"
  }'
```

### Example 2: Using Request Body
```bash
curl -X POST https://your-app.com/api/ai/gap-analysis \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "claude",
    "agentId": "compliance-automation-bot",
    "agentVersion": "1.0.0",
    "dataSources": "NIST-800-53,ISO-27001",
    "agentContext": "automated-quarterly-review"
  }'
```

### Example 3: JavaScript/TypeScript Client
```javascript
const response = await fetch('/api/ai/gap-analysis', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json',
    'X-Agent-ID': 'compliance-automation-bot',
    'X-Agent-Version': '1.0.0',
    'X-Data-Sources': 'NIST-800-53,ISO-27001',
    'X-Agent-Context': 'automated-quarterly-review'
  },
  body: JSON.stringify({
    provider: 'claude'
  })
});
```

## Viewing Tracked Information

### Get Decision Log with Agent Metadata
```bash
GET /api/ai/decisions?page=1&limit=25
```

**Response includes:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "created_at": "2026-02-13T18:00:00Z",
      "data_lineage": "Agent: compliance-automation-bot | Version: 1.0.0 | Sources: NIST-800-53,ISO-27001 | Context: automated-quarterly-review",
      "risk_level": "high",
      "regulatory_framework": "NIST 800-53",
      "model_version": "claude-sonnet-4-5-20250929",
      "correlation_id": "uuid",
      "human_reviewed": false,
      "bias_score": null,
      "review_date": null,
      "approved_by": null,
      "input_preview": "...",
      "output_preview": "..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 100
  }
}
```

### Filter by Metadata
```bash
# Get unreviewed high-risk decisions
GET /api/ai/decisions?reviewed=false&risk_level=high

# Get decisions for specific feature
GET /api/ai/decisions?feature=gap_analysis
```

## Human Review Workflow

### Mark Decision as Reviewed and Approved
```bash
PATCH /api/ai/decisions/:id/review
Content-Type: application/json

{
  "outcome": "approved",
  "notes": "Gap analysis reviewed and validated by compliance team"
}
```

**This automatically sets:**
- `human_reviewed` = true
- `reviewed_by` = current user ID
- `review_timestamp` = current timestamp
- `review_date` = current timestamp
- `approved_by` = reviewer's email/username (only if outcome is "approved")

## High-Stakes Features (Auto-tracked)
The following features automatically log to `ai_decision_log`:
- `gap_analysis` - Compliance gap analysis
- `compliance_forecast` - Compliance forecasting
- `remediation_playbook` - Remediation recommendations
- `incident_response` - Incident response plans
- `executive_report` - Executive compliance reports
- `risk_heatmap` - Risk assessment heatmaps
- `vendor_risk` - Vendor risk assessments

## Database Schema

### ai_decision_log Table (New Fields)
```sql
-- Migration 048 added these fields:
data_lineage TEXT,              -- Agent metadata and data provenance
bias_score FLOAT CHECK (bias_score >= 0.0 AND bias_score <= 1.0),  -- Numerical bias score
review_date TIMESTAMP,          -- When decision was formally reviewed
approved_by VARCHAR(255)        -- Who approved the decision
```

## Security & Compliance

### Data Integrity
- All input/output data is SHA-256 hashed for integrity verification
- `input_hash` and `output_hash` stored with each decision

### Access Control
- Viewing decisions: Requires `settings.manage` permission
- Reviewing decisions: Requires `assessments.write` permission

### Audit Trail
- Every decision includes:
  - Organization ID
  - Correlation ID (for request tracing)
  - Session ID (for multi-step operations)
  - Processing timestamp
  - Model version used
  - Regulatory framework context

## Best Practices

### For Agent Developers
1. **Always provide Agent ID**: Use a consistent, descriptive identifier
2. **Include version numbers**: Track which agent version made the decision
3. **Document data sources**: List all data sources consulted
4. **Provide context**: Explain the purpose/trigger of the operation

### For Compliance Teams
1. **Regular review**: Check high-risk decisions regularly
2. **Review unreviewed items**: Use `reviewed=false` filter
3. **Document approvals**: Add detailed notes when approving decisions
4. **Track patterns**: Use `data_lineage` to identify problematic agents

## Future Enhancements

### Planned Features
1. **Bias Scoring Service**: Automatic calculation of `bias_score` based on output analysis
2. **Agent Dashboard**: Visualize agent activity and performance
3. **Anomaly Detection**: Alert on unusual agent behavior patterns
4. **Compliance Reports**: Generate reports by agent, data source, or framework

### Integration Opportunities
- SIEM integration for security monitoring
- Webhook notifications for high-risk decisions
- Export to compliance management systems
- API for programmatic bias score updates

## Support

For questions or issues:
- Review the `OPTIMIZATION_SUMMARY.md` for technical details
- Check `REPLICATION_CHECKLIST.md` for deployment guidance
- Contact the development team for custom agent integration support
