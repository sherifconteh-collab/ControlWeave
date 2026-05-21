# MCP Tools Reference

Complete reference for all available tools in the secure ControlWeave MCP server.

## Overview

The secure MCP server provides **51 tools** across multiple functional areas:
- System & Authentication (2 tools)
- Compliance & Frameworks (7 tools, including crosswalk inheritance trigger)
- Evidence Management (5 tools)
- Asset/CMDB Management (8 tools)
- POA&M (4 tools)
- Reports (2 tools)
- Exceptions (2 tools)
- Audit Logs (2 tools)
- TPRM — Third-Party Risk Management (5 tools)
- Third-Party AI Governance (5 tools) *(Pro tier)*
- Threat Intelligence (2 tools) *(Pro tier)*
- Help Center (2 tools)

All tools follow OWASP security best practices with rate limiting, audit logging, input validation, and output sanitization.

---

## System & Authentication Tools

### `grc_health`
**Description:** Check backend health and database connectivity.  
**Auth Required:** No  
**Parameters:** None  
**Example:**
```json
// No parameters needed
{}
```

### `grc_whoami`
**Description:** Get current authenticated user, organization, roles, and permissions.  
**Auth Required:** Yes  
**Parameters:** None  
**Returns:** User profile, organization details, role list, permission array

---

## Compliance & Framework Tools

### `grc_list_frameworks`
**Description:** List all available compliance frameworks.  
**Auth Required:** Yes  
**Parameters:** None  
**Returns:** Array of frameworks (NIST 800-53, ISO 27001, SOC 2, etc.)

### `grc_get_dashboard_stats`
**Description:** Get compliance and activity summary statistics.  
**Auth Required:** Yes  
**Parameters:** None  
**Returns:** Compliance metrics, control status counts, recent activity

### `grc_list_controls`
**Description:** List controls with optional framework/status filtering.  
**Auth Required:** Yes  
**Parameters:**
- `organization_id` (UUID, optional) - Organization UUID (defaults to current user's org)
- `framework_id` (UUID, optional) - Filter by framework
- `status` (string, optional) - Filter by implementation status

**Example:**
```json
{
  "framework_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "in_progress"
}
```

### `grc_update_control_implementation`
**Description:** Update implementation details for a specific control.  
**Auth Required:** Yes  
**Permissions:** Appropriate write permissions  
**Parameters:**
- `control_id` (UUID, required) - Control UUID
- `status` (string, required) - New status (implemented, in_progress, not_started, planned)
- `implementation_details` (string, optional, max 10000) - Implementation details
- `evidence_url` (URL, optional, max 2000) - Evidence URL
- `assigned_to` (UUID, optional) - Assignee user UUID
- `notes` (string, optional, max 10000) - Additional notes

**Example:**
```json
{
  "control_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "implemented",
  "implementation_details": "Implemented MFA for all users using Okta",
  "notes": "Completed Q1 2026"
}
```

### `grc_ai_query`
**Description:** Run natural-language compliance Q&A against organization data.  
**Auth Required:** Yes  
**Permissions:** ai.use  
**Parameters:**
- `question` (string, required, 3-10000 chars) - Compliance question
- `provider` (enum, optional) - LLM provider (claude, openai, gemini, grok)
- `model` (string, optional, max 100) - Model override

**Example:**
```json
{
  "question": "What controls do we have for access control in ISO 27001?",
  "provider": "claude"
}
```

### `grc_list_assessment_procedures`
**Description:** List assessment procedures with filters.  
**Auth Required:** Yes  
**Parameters:**
- `framework_code` (string, optional, max 50) - Framework code filter
- `control_id` (string, optional, max 100) - Control ID filter
- `procedure_type` (string, optional, max 50) - Procedure type filter
- `depth` (string, optional, max 20) - Assessment depth (basic, focused, comprehensive)
- `search` (string, optional, max 200) - Full-text search
- `limit` (number, optional, 1-200) - Max results
- `offset` (number, optional, min 0) - Pagination offset

### `grc_list_notifications`
**Description:** List notifications for current user.  
**Auth Required:** Yes  
**Parameters:**
- `unread` (boolean, optional) - Filter to unread only
- `limit` (number, optional, 1-200) - Max results

---

## Evidence Management Tools

### `grc_list_evidence`
**Description:** List evidence files with optional filtering.  
**Auth Required:** Yes  
**Permissions:** evidence.read  
**Tier Required:** Starter or higher  
**Parameters:**
- `search` (string, optional, max 200) - Search file name or description
- `tags` (string, optional, max 200) - Comma-separated tags to filter
- `limit` (number, optional, 1-200) - Max results
- `offset` (number, optional, min 0) - Pagination offset

**Example:**
```json
{
  "search": "audit report",
  "tags": "iso27001,audit",
  "limit": 50
}
```

**Returns:** Array of evidence files with metadata, linked control counts

### `grc_get_evidence`
**Description:** Get detailed information about a specific evidence file.  
**Auth Required:** Yes  
**Permissions:** evidence.read  
**Parameters:**
- `evidence_id` (UUID, required) - Evidence UUID

**Example:**
```json
{
  "evidence_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Returns:** Full evidence details including file info, integrity hash, retention date, linked controls

### `grc_link_evidence`
**Description:** Link an evidence file to one or more controls.  
**Auth Required:** Yes  
**Permissions:** evidence.write  
**Parameters:**
- `evidence_id` (UUID, required) - Evidence UUID
- `control_ids` (UUID array, required, 1-50 items) - Array of control UUIDs
- `notes` (string, optional, max 10000) - Notes about the link

**Example:**
```json
{
  "evidence_id": "550e8400-e29b-41d4-a716-446655440000",
  "control_ids": [
    "660e8400-e29b-41d4-a716-446655440001",
    "770e8400-e29b-41d4-a716-446655440002"
  ],
  "notes": "Annual audit evidence for access control requirements"
}
```

**Note:** MCP does not support file uploads via stdio protocol. Evidence files must be uploaded through the web UI or direct API calls, then linked via MCP.

### `grc_unlink_evidence`
**Description:** Unlink evidence from a specific control.  
**Auth Required:** Yes  
**Permissions:** evidence.write  
**Parameters:**
- `evidence_id` (UUID, required) - Evidence UUID
- `control_id` (UUID, required) - Control UUID to unlink

**Example:**
```json
{
  "evidence_id": "550e8400-e29b-41d4-a716-446655440000",
  "control_id": "660e8400-e29b-41d4-a716-446655440001"
}
```

### `grc_update_evidence`
**Description:** Update evidence file metadata.  
**Auth Required:** Yes  
**Permissions:** evidence.write  
**Parameters:**
- `evidence_id` (UUID, required) - Evidence UUID
- `description` (string, optional, max 10000) - Updated description
- `tags` (string array, optional, max 20 tags, 50 chars each) - Updated tags
- `retention_until` (string, optional, YYYY-MM-DD format) - Retention date

**Example:**
```json
{
  "evidence_id": "550e8400-e29b-41d4-a716-446655440000",
  "description": "2026 Q1 Security Audit Report - Final",
  "tags": ["audit", "q1-2026", "security", "iso27001"],
  "retention_until": "2033-12-31"
}
```

---

## Asset/CMDB Management Tools

### `grc_list_assets`
**Description:** List assets (hardware, software, AI agents, etc.) with filtering.  
**Auth Required:** Yes  
**Permissions:** assets.read  
**Tier Required:** Starter or higher  
**Parameters:**
- `category` (string, optional, max 50) - Category code (hardware, software, ai_agent)
- `status` (string, optional, max 50) - Status filter (active, maintenance, deprecated, decommissioned)
- `environment_id` (UUID, optional) - Environment UUID filter
- `search` (string, optional, max 200) - Search name, hostname, or IP

**Example:**
```json
{
  "category": "software",
  "status": "active",
  "search": "database"
}
```

**Returns:** Array of assets with full details including category, environment, owners

### `grc_get_asset_categories`
**Description:** Get all available asset categories with tier restrictions.  
**Auth Required:** Yes  
**Permissions:** assets.read  
**Parameters:** None  
**Returns:** Available categories for user's tier, plus all categories for upgrade awareness

### `grc_get_asset`
**Description:** Get detailed information about a specific asset.  
**Auth Required:** Yes  
**Permissions:** assets.read  
**Parameters:**
- `asset_id` (UUID, required) - Asset UUID

**Example:**
```json
{
  "asset_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Returns:** Full asset details including dependencies, vulnerabilities, relationships

### `grc_create_asset`
**Description:** Create a new asset (hardware, software, AI agent, etc.).  
**Auth Required:** Yes  
**Permissions:** assets.write  
**Tier Required:** Varies by category (Starter for basic, Professional for AI agents)  
**Parameters:**
- `category_id` (UUID, required) - Asset category UUID (use grc_get_asset_categories)
- `name` (string, required, 1-200 chars) - Asset name
- `asset_tag` (string, optional, max 100) - Asset tag/identifier
- `serial_number` (string, optional, max 100) - Serial number
- `model` (string, optional, max 100) - Model name/number
- `manufacturer` (string, optional, max 100) - Manufacturer
- `location` (string, optional, max 200) - Physical/logical location
- `environment_id` (UUID, optional) - Environment UUID
- `status` (enum, optional) - active, maintenance, deprecated, decommissioned (default: active)
- `security_classification` (string, optional, max 50) - Security classification level
- `criticality` (enum, optional) - critical, high, medium, low
- `ip_address` (string, optional, max 45) - IP address (IPv4/IPv6)
- `hostname` (string, optional, max 255) - Hostname
- `fqdn` (string, optional, max 255) - Fully qualified domain name
- `version` (string, optional, max 100) - Software/firmware version
- `notes` (string, optional, max 10000) - Additional notes

**Example (Server):**
```json
{
  "category_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Production Database Server",
  "asset_tag": "SRV-DB-001",
  "manufacturer": "Dell",
  "model": "PowerEdge R750",
  "hostname": "db-prod-01",
  "ip_address": "10.0.1.50",
  "criticality": "critical",
  "security_classification": "confidential",
  "status": "active"
}
```

**Example (Software):**
```json
{
  "category_id": "660e8400-e29b-41d4-a716-446655440001",
  "name": "PostgreSQL Database",
  "version": "14.10",
  "manufacturer": "PostgreSQL Global Development Group",
  "hostname": "db-prod-01",
  "criticality": "critical"
}
```

**Example (AI Agent):**
```json
{
  "category_id": "770e8400-e29b-41d4-a716-446655440002",
  "name": "Customer Support Chatbot",
  "version": "2.1.0",
  "manufacturer": "OpenAI",
  "model": "GPT-4",
  "criticality": "medium",
  "notes": "Uses GPT-4 for customer inquiries, human escalation after 3 attempts"
}
```

### `grc_update_asset`
**Description:** Update an existing asset. Only provided fields are updated.  
**Auth Required:** Yes  
**Permissions:** assets.write  
**Parameters:**
- `asset_id` (UUID, required) - Asset UUID
- `name` (string, optional, 1-200 chars) - Updated name
- `asset_tag` (string, optional, max 100) - Updated tag
- `status` (enum, optional) - Updated status
- `location` (string, optional, max 200) - Updated location
- `security_classification` (string, optional, max 50) - Updated classification
- `criticality` (enum, optional) - Updated criticality
- `ip_address` (string, optional, max 45) - Updated IP
- `hostname` (string, optional, max 255) - Updated hostname
- `version` (string, optional, max 100) - Updated version
- `notes` (string, optional, max 10000) - Updated notes

**Example:**
```json
{
  "asset_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "maintenance",
  "notes": "Scheduled maintenance window 2026-02-20 02:00-04:00 UTC"
}
```

### `grc_delete_asset`
**Description:** Delete an asset. Use with caution - cannot be undone.  
**Auth Required:** Yes  
**Permissions:** assets.write  
**Parameters:**
- `asset_id` (UUID, required) - Asset UUID to delete

**Example:**
```json
{
  "asset_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### `grc_get_asset_stats`
**Description:** Get asset statistics and summary for dashboard.  
**Auth Required:** Yes  
**Permissions:** assets.read  
**Parameters:** None  
**Returns:** Total assets, status breakdown, category breakdown, environment usage

---

## Security Controls

All tools enforce the following security controls:

### Rate Limiting
- **Default:** 30 requests per minute per tool
- **Window:** Rolling 60-second window
- **Response:** Rate limit error with reset timestamp
- **Configurable:** `MCP_RATE_LIMIT` environment variable

### Input Validation
- **Schema Validation:** Zod schemas for type checking
- **String Sanitization:** Control character removal, length limits
- **UUID Validation:** RFC 4122 format verification
- **URL Validation:** Valid URL format for URLs

### Audit Logging
- **All Operations:** Tool invocations, auth attempts, errors
- **Format:** Structured JSON to stderr
- **Sensitive Data:** Automatically redacted in logs
- **Configurable:** `MCP_ENABLE_AUDIT_LOG` environment variable

### Request Timeouts
- **Default:** 30 seconds per request
- **Protection:** Prevents resource exhaustion
- **Configurable:** `MCP_REQUEST_TIMEOUT_MS` environment variable

### Output Sanitization
- **Sensitive Fields:** Auto-filtered (password_hash, jwt_secret, api_key, secret)
- **Data Minimization:** Only necessary data returned
- **Recursive:** Applied to nested objects and arrays

---

## Error Handling

### Common Errors

**Authentication Failure:**
```json
{
  "content": [{"type": "text", "text": "Authentication failed. Please check your token."}],
  "isError": true
}
```

**Rate Limit Exceeded:**
```json
{
  "content": [{"type": "text", "text": "Rate limit exceeded. Try again after 2026-02-18T13:30:00.000Z"}],
  "isError": true
}
```

**Permission Denied:**
```json
{
  "content": [{"type": "text", "text": "Insufficient permissions"}],
  "isError": true
}
```

**Tier Restriction:**
```json
{
  "content": [{"type": "text", "text": "This feature requires Pro tier or higher"}],
  "isError": true
}
```

**Validation Error:**
```json
{
  "content": [{"type": "text", "text": "control_id is not a valid UUID"}],
  "isError": true
}
```

---

## Third-Party AI Governance Tools *(Pro tier)*

### `ai_governance_get_summary`
**Description:** Get summary stats: vendor count, concentration risk (vendors with >1 AI use case where business_criticality is high or critical), open incidents, unapproved supply chain components.  
**Auth Required:** Yes | **Tier:** Professional  
**Parameters:** None

### `ai_governance_list_vendors`
**Description:** List AI vendor assessments with risk level, vendor type, and per-dimension risk scores.  
**Auth Required:** Yes | **Tier:** Professional  
**Parameters:**
- `risk_level` (enum, optional): `low | medium | high | critical`
- `vendor_type` (enum, optional): `llm_provider | ml_platform | data_provider | ai_tool | consulting`
- `search` (string, optional): Search by vendor name
- `limit` / `offset` (int, optional): Pagination

### `ai_governance_get_vendor`
**Description:** Get full AI vendor assessment details including all risk dimension scores, model transparency rating, bias testing evidence, data provenance clarity, subprocessors, and contract dates.  
**Auth Required:** Yes | **Tier:** Professional  
**Parameters:**
- `vendor_id` (UUID, required): AI vendor assessment UUID

### `ai_governance_list_incidents`
**Description:** List AI vendor incidents (security breaches, data leaks, outages, compliance violations, model failures).  
**Auth Required:** Yes | **Tier:** Professional  
**Parameters:**
- `vendor_assessment_id` (UUID, optional): Filter by vendor
- `status` (enum, optional): `open | closed`
- `incident_type` (enum, optional): `security_breach | data_leak | service_outage | compliance_violation | model_failure`

### `ai_governance_list_supply_chain`
**Description:** List AI supply chain components (models, datasets, libraries, APIs) with approval status and provenance verification.  
**Auth Required:** Yes | **Tier:** Professional  
**Parameters:**
- `source_vendor_id` (UUID, optional): Filter by vendor
- `component_type` (enum, optional): `model | dataset | library | infrastructure | api | tool`
- `approved_for_use` (boolean, optional): Filter by approval status

---

## Threat Intelligence Tools *(Pro tier)*

### `threat_intel_get_stats`
**Description:** Get threat intelligence summary: active feed count, total items, critical/high severity counts, and items with known exploits.  
**Auth Required:** Yes | **Tier:** Professional  
**Parameters:** None

### `threat_intel_list_items`
**Description:** List threat intelligence items (CVEs, indicators) from NVD, CISA KEV, MITRE ATT&CK, and AlienVault OTX with CVSS scores and exploit-available flags.  
**Auth Required:** Yes | **Tier:** Professional  
**Parameters:**
- `severity` (enum, optional): `critical | high | medium | low`
- `exploit_available` (boolean, optional): Filter to items with known exploits
- `search` (string, optional): Search by CVE ID, title, or description
- `limit` / `offset` (int, optional): Pagination

---

## Crosswalk Inheritance Tool

### `grc_trigger_crosswalk_inherit`
**Description:** Manually trigger crosswalk inheritance for a control — propagates the control's implementation status to all mapped controls in other active frameworks that meet the configured similarity threshold (default 90%). Returns count of controls auto-satisfied and the inheritance events created.  
**Auth Required:** Yes | **Permission:** `controls.write`  
**Parameters:**
- `control_id` (UUID, required): Source control UUID
- `inherited_status` (enum, optional): Override status to propagate — `implemented | satisfied_via_crosswalk | in_progress | not_started`

**Example:**
```json
{
  "control_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Returns:**
```json
{
  "source_control_id": "550e8400-e29b-41d4-a716-446655440000",
  "threshold": 90,
  "inherited_status": "satisfied_via_crosswalk",
  "dry_run": false,
  "processed": [
    {
      "target_control_id": "...",
      "target_control_code": "AC-2",
      "target_control_title": "Account Management",
      "similarity_score": 95,
      "previous_status": "not_started",
      "next_status": "satisfied_via_crosswalk",
      "skipped": false
    }
  ]
}
```

---

## Usage Examples

> **Universal Transport:** The ControlWeave MCP server uses the standard stdio transport defined by the Model Context Protocol specification. This means it works out-of-the-box with **any** MCP-compatible client — Claude Desktop, Cursor, VS Code + GitHub Copilot, Continue.dev, Windsurf, and any custom integration. You do not need a separate server build for each client; the same `mcp-server-secure.js` binary and environment variables apply everywhere.

---

### Claude Desktop

Config file: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "controlweave": {
      "command": "node",
      "args": ["/path/to/controlweave/backend/scripts/mcp-server-secure.js"],
      "env": {
        "GRC_API_BASE_URL": "https://your-backend.com/api/v1",
        "GRC_API_TOKEN": "${CONTROLWEAVE_TOKEN}",
        "NODE_ENV": "production",
        "MCP_RATE_LIMIT": "30",
        "MCP_ENABLE_AUDIT_LOG": "true"
      }
    }
  }
}
```

Mention the server in conversation: `@controlweave show me open AI governance incidents`

---

### Cursor

Config file: `~/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "controlweave": {
      "command": "node",
      "args": ["/path/to/controlweave/backend/scripts/mcp-server-secure.js"],
      "env": {
        "GRC_API_BASE_URL": "https://your-backend.com/api/v1",
        "GRC_API_TOKEN": "${CONTROLWEAVE_TOKEN}",
        "NODE_ENV": "production",
        "MCP_ENABLE_AUDIT_LOG": "true"
      }
    }
  }
}
```

Invoke via Cursor Agent mode: `@controlweave list unapproved supply chain components`

---

### VS Code + GitHub Copilot (Agent mode)

Config file: `.vscode/mcp.json` (workspace) or User Settings → `mcp.servers`

Recommended authentication flow (per-user login session):

```bash
cd /path/to/controlweave/backend
npm run mcp:login
```

This stores a local MCP session (access + refresh token) and the secure server will auto-refresh access tokens on expiry. You can clear local auth with:

```bash
npm run mcp:status
npm run mcp:logout
```

```json
{
  "servers": {
    "controlweave": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/controlweave/backend/scripts/mcp-server-secure.js"],
      "env": {
        "GRC_API_BASE_URL": "https://your-backend.com/api/v1",
        "NODE_ENV": "production",
        "MCP_ENABLE_AUDIT_LOG": "true"
      }
    }
  }
}
```

Authentication policy: login-based only.

- All users (including admins) must authenticate via `npm run mcp:login`.
- `GRC_API_TOKEN`, `MCP_LOGIN_EMAIL`, and `MCP_LOGIN_PASSWORD` are not used for MCP server authentication.
- Migration details: [MCP_AUTH_MIGRATION.md](MCP_AUTH_MIGRATION.md)

Use in Copilot Chat (Agent mode): `#controlweave what controls map to NIST AC-2?`

---

### Continue.dev

Config file: `~/.continue/config.json`

```json
{
  "mcpServers": [
    {
      "name": "controlweave",
      "command": "node",
      "args": ["/path/to/controlweave/backend/scripts/mcp-server-secure.js"],
      "env": {
        "GRC_API_BASE_URL": "https://your-backend.com/api/v1",
        "GRC_API_TOKEN": "your-jwt-token",
        "NODE_ENV": "production",
        "MCP_ENABLE_AUDIT_LOG": "true"
      }
    }
  ]
}
```

---

### Windsurf

Config file: `~/.codeium/windsurf/mcp_config.json`

```json
{
  "mcpServers": {
    "controlweave": {
      "command": "node",
      "args": ["/path/to/controlweave/backend/scripts/mcp-server-secure.js"],
      "env": {
        "GRC_API_BASE_URL": "https://your-backend.com/api/v1",
        "GRC_API_TOKEN": "your-jwt-token",
        "NODE_ENV": "production",
        "MCP_ENABLE_AUDIT_LOG": "true"
      }
    }
  }
}
```

---

### Custom / Programmatic Integration

Any application can spawn the MCP server as a child process and communicate over stdio using the standard JSON-RPC 2.0 MCP protocol:

```bash
# Start the server — communicate over stdin/stdout
GRC_API_BASE_URL=https://your-backend.com/api/v1 \
GRC_API_TOKEN=your-jwt-token \
NODE_ENV=production \
node /path/to/controlweave/backend/scripts/mcp-server-secure.js
```

For OpenAI Agents SDK, LangChain, or custom orchestrators that need HTTP/SSE rather than stdio, run the server behind a stdio-to-HTTP bridge (e.g., `mcp-proxy`) or use the ControlWeave REST API directly via `lib/api.ts`.

---

### Common Workflows

**1. Add a new server to CMDB:**
```
User: "Add a new database server named db-prod-02 with IP 10.0.1.51"
Assistant calls: grc_get_asset_categories (find hardware category ID)
Assistant calls: grc_create_asset with appropriate parameters
Result: New asset created and tracked
```

**2. Link audit evidence to controls:**
```
User: "Link the Q1 audit report to ISO 27001 access control"
Assistant calls: grc_list_evidence (find evidence by name)
Assistant calls: grc_list_controls (find controls by framework)
Assistant calls: grc_link_evidence with evidence_id and control_ids
Result: Evidence linked to controls
```

**3. Update control implementation status:**
```
User: "Mark AC-2 as implemented with details about our MFA setup"
Assistant calls: grc_list_controls (find AC-2 control)
Assistant calls: grc_update_control_implementation
Result: Control status updated
```

**4. Trigger crosswalk to auto-satisfy related controls:**
```
User: "AC-2 is now implemented — propagate to our other frameworks"
Assistant calls: grc_trigger_crosswalk_inherit with the AC-2 control_id
Result: Returns count of controls auto-satisfied across ISO 27001, SOC 2, etc.
```

**5. Audit third-party AI vendor risk:**
```
User: "What's the risk status of our AI vendors? Any open incidents?"
Assistant calls: ai_governance_get_summary
Assistant calls: ai_governance_list_incidents (status: "open")
Result: Summary of concentration risk and open incident list
```

**6. Check threat landscape for critical exploitable CVEs:**
```
User: "Show me critical CVEs with known exploits from our threat feeds"
Assistant calls: threat_intel_list_items (severity: "critical", exploit_available: true)
Result: Filtered list of highest-priority CVEs for remediation
```

---

## Performance

- **Average Overhead:** ~10% (5-8ms per request)
- **Rate Limiting:** <1ms per check
- **Input Validation:** ~2ms per request
- **Audit Logging:** ~3ms per request
- **Output Sanitization:** ~2ms per request

---

## Support

- **Documentation:** See `docs/MCP_SECURITY_GUIDE.md` for complete security details
- **Testing:** Run `npm run test:mcp-security` to validate installation
- **Deployment:** Follow `docs/MCP_DEPLOYMENT_CHECKLIST.md` for production setup

---

**Last Updated:** 2026-02-26  
**MCP Server Version:** 2.0.0  
**Total Tools:** 51
