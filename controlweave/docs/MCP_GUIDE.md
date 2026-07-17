# ControlWeave MCP Guide

Complete reference for the ControlWeave Model Context Protocol (MCP) server:
setup, security model, production deployment, and the full tools reference.

The server exposes ControlWeave compliance data (frameworks, controls,
evidence, assets, POA&Ms, TPRM, threat intelligence, AI governance, etc.) to
AI assistants over the standard MCP stdio transport, so it works out of the
box with any MCP-compatible client — Claude Desktop, Cursor, VS Code +
GitHub Copilot, Continue.dev, Windsurf, or a custom orchestrator. You do not
need a separate server build per client; the same binary and environment
variables apply everywhere.

**Contents:** [Setup](#setup) · [Security](#security) ·
[Deployment](#deployment) · [Tools Reference](#tools-reference)

---

## Setup

### Starting the server

```bash
cd controlweave/backend
npm run mcp          # standard server
npm run mcp:secure   # security-hardened server (recommended, see Security below)
```

**Recommendation:** use `npm run mcp:secure` for every environment, including
local development. It is the actively documented and tool-referenced server
(`scripts/mcp-server-secure.js`); the plain `npm run mcp` entry point is kept
for backward compatibility.

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GRC_API_BASE_URL` | Yes | — | Backend API URL. Use HTTPS in production. |
| `GRC_API_TOKEN` | See [Authentication Model](#authentication-model) | — | JWT token — required under the token-auth flow; not used under the login-session flow. Documentation disagrees on which is current, see below. |
| `GRC_HEALTH_URL` | No | — | Optional health-check endpoint override |
| `NODE_ENV` | No | `development` | `production` disables verbose error messages |
| `MCP_RATE_LIMIT` | No | `30` | Requests per minute, per tool |
| `MCP_REQUEST_TIMEOUT_MS` | No | `30000` | Per-request timeout (ms) |
| `MCP_ENABLE_AUDIT_LOG` | No | `true` | Structured JSON audit log to stderr |
| `MCP_MAX_INPUT_LENGTH` | No | `10000` | Max characters for text input fields |
| `MCP_MAX_RESULT_LIMIT` | No | `200` | Max rows returned per query |
| `MCP_CLIENT_NAME` | No | — | Free-text client identifier included in audit logs (e.g. `"Claude Desktop"`) |
| `MCP_CLIENT_VERSION` | No | — | Client version string included in audit logs |

`DATABASE_URL` and `MCP_PORT` appear in older setup notes but do not apply to
the current stdio-based server — the server talks to the existing backend API
over `GRC_API_BASE_URL`, it does not open its own network port or connect to
Postgres directly. Treat any doc or script referencing `MCP_PORT` as stale.

### Tool categories

The secure server exposes **54 tools** across:

- System & Authentication (2)
- Compliance & Frameworks (9, including the crosswalk-inheritance trigger)
- Evidence Management (5)
- Asset/CMDB Management (10)
- POA&M (4)
- Reports (2)
- Exceptions (2)
- Audit Logs (5)
- TPRM — Third-Party Risk Management (6)
- Third-Party AI Governance (5)
- Threat Intelligence (2)
- Help Center (2)

Full per-tool parameter/return documentation is in
[Tools Reference](#tools-reference) below.

### Client configuration

See [Tools Reference → Usage Examples](#usage-examples) for ready-to-use
config snippets for Claude Desktop, Cursor, VS Code + GitHub Copilot,
Continue.dev, Windsurf, and custom stdio integrations.

---

## Security

The security model is based on
[OWASP's Practical Guide for Secure MCP Server Development](https://genai.owasp.org/resource/a-practical-guide-for-secure-mcp-server-development/).
The hardened server (`mcp-server-secure.js`) implements defense-in-depth
across authentication, input validation, rate limiting, audit logging, and
output sanitization.

### Authentication model

> **⚠️ Documentation conflict — flagged, not resolved.** The source
> documents for this guide describe two different, mutually exclusive
> authentication models and do not agree on which is current:
>
> - **Token-based** (`MCP_SECURITY_GUIDE`, `MCP_SECURITY_QUICKREF`,
>   `MCP_DEPLOYMENT_CHECKLIST`, `MCP_SECURITY_IMPLEMENTATION`,
>   `ISSUE_RESOLUTION_MCP_SECURITY`, and the Claude Desktop / Cursor /
>   Continue.dev / Windsurf examples in the tools reference): `GRC_API_TOKEN`
>   is a **required** environment variable — a JWT passed directly to the
>   server.
> - **Login-session-based** (`MCP_AUTH_MIGRATION`, and the VS Code + GitHub
>   Copilot section of the tools reference): every user, including admins,
>   authenticates via `npm run mcp:login`, which stores a local session
>   (access + refresh token) that the server auto-refreshes. This flow states
>   explicitly that `GRC_API_TOKEN`, `MCP_LOGIN_EMAIL`, and
>   `MCP_LOGIN_PASSWORD` **are no longer used by the MCP runtime auth path**.
>
> The tools-reference file itself contains both models in different client
> sections without reconciling them. Until this is resolved in code/by the
> platform team, **verify against the actual behavior of
> `scripts/mcp-server-secure.js` and `scripts/mcp-login.js` (or equivalent)
> in this checkout** before relying on either flow. The login-session flow
> reads as the more recently written of the two (it's a dedicated migration
> guide, and it's the flow documented for the VS Code client), so it is
> presented first below, with the token flow after it as it appears in the
> majority of the other source documents.

#### Login-session flow (per `MCP_AUTH_MIGRATION.md`)

```bash
cd controlweave/backend
npm run mcp:login     # authenticate; stores local session (access + refresh token)
npm run mcp:status     # verify — shows session file path, email, role, organization
npm run mcp:logout     # sign out
npm run mcp             # or mcp:secure — starts the server using the stored session
```

- Required for all users, including admins — there is no token/env-only
  bypass for admin accounts.
- No token environment variables are required in the MCP client config for
  normal operation.
- Session files must not be shared between users — per-user login preserves
  attribution and RBAC in MCP audit trails.
- Team rollout: announce a migration window, have each user run
  `npm run mcp:logout` once followed by `npm run mcp:login` with their own
  account, verify with `npm run mcp:status`, then validate with `grc_whoami`
  and `grc_health`.
- Troubleshooting:
  - `No MCP authentication found` → run `npm run mcp:login`
  - `Invalid token` → `npm run mcp:logout && npm run mcp:login && npm run mcp:status`
  - Login succeeds but calls fail → check backend health
    (`curl http://localhost:3001/health`) and confirm `GRC_API_BASE_URL`
    points at the same backend used for login.

#### Token-based flow (per the security guide/checklist/quickref)

```bash
export GRC_API_BASE_URL=https://your-api.com/api/v1
export GRC_API_TOKEN=your-jwt-token
export NODE_ENV=production
npm run mcp:secure
```

- Every authenticated tool call validates the JWT before execution; identity
  and organization are resolved from `/auth/me` and cached for the session.
- Recommended token lifetime ≤ 15 minutes, with a rotation mechanism and
  distinct tokens per environment (dev/staging/production).
- Never hardcode the token in client config — use a variable reference
  (`${CONTROLWEAVE_TOKEN}`) resolved by a secrets manager or your MDM tool.

### Security architecture

Defense-in-depth layers, applied in order on every authenticated call:

1. **Authentication** — JWT validation (or session validation, per whichever
   flow is actually wired up — see above)
2. **Authorization** — RBAC, org-scoped data access, backend permission checks
3. **Input validation** — schema validation + sanitization
4. **Rate limiting** — per-tool request throttling
5. **Audit logging** — structured logging of every operation
6. **Output sanitization** — data minimization, sensitive-field filtering

Secure-by-default posture: all tools require authentication except the
health check; rate limiting and audit logging are on by default; verbose
error messages are disabled whenever `NODE_ENV=production`; request timeouts
are always active.

### Threat model

| Threat | Risk | Mitigation |
|---|---|---|
| Prompt injection | High | Input sanitization, length limits, control-character filtering |
| Command injection | Critical | No shell execution; parameterized API requests only |
| Authentication bypass | Critical | JWT/session verification, expiration checks |
| Authorization bypass | High | Permission checks per tool call, org-scoped access |
| Rate limit abuse | Medium | Per-tool throttling (30 req/min default) |
| Data exfiltration | High | Data minimization, sensitive-field filtering, audit logging |
| Resource exhaustion | Medium | Request timeouts, result pagination, input length caps |
| Information disclosure | Medium | Sanitized error messages; verbose mode dev-only |
| Session hijacking | High | Short-lived tokens/sessions, HTTPS required |
| Cross-tool contamination | Medium | Per-tool input sanitization, isolated tool contexts |

### Security controls in detail

**Input validation & sanitization**
- Zod schema validation on every tool input (type checking, UUID format,
  URL format)
- Control-character/null-byte stripping: `input.replace(/[\x00-\x1F\x7F]/g, '')`
- Query-parameter sanitization: `value.replace(/[^\w\s\-@.]/g, '')`
- Length limits: 10,000 chars default; URLs 2,000 chars; framework/control
  codes 50 chars; search terms 200 chars (all configurable)

**Rate limiting**
- 30 requests/minute per tool by default, rolling 1-minute window, tracked
  per tool name, configurable via `MCP_RATE_LIMIT`
- Exceeding the limit returns an error with the reset timestamp, e.g.
  `Rate limit exceeded. Try again after 2026-02-18T13:05:00.000Z`

**Request timeouts**
- 30-second default via `AbortController`, configurable via
  `MCP_REQUEST_TIMEOUT_MS`; prevents resource exhaustion from hanging requests

**Audit logging**
- Logged events: `server_start`, `server_shutdown`, `identity_verified`,
  `tool_invocation`, `tool_success`, `tool_error`, `authentication`,
  `rate_limit_exceeded`, `error_response`
- JSON to stderr (stdout is reserved for the MCP protocol), one object per
  line, e.g.:
  ```json
  {
    "timestamp": "2026-02-18T12:54:23.414Z",
    "event": "tool_invocation",
    "tool": "grc_list_controls",
    "args": {"organization_id": "***REDACTED***"},
    "user_id": "uuid-here",
    "organization_id": "uuid-here",
    "client": {"platform": "darwin", "node_version": "v20.11.0", "client_name": "Claude Desktop", "client_version": "0.5.0"}
  }
  ```
- On startup, the server verifies and logs the authenticated identity (name,
  email, org, role, permission count) — useful for confirming which account
  a client session is actually running as
- Client metadata (`MCP_CLIENT_NAME`, `MCP_CLIENT_VERSION`, platform, Node
  version) is attached to every log entry
- Passwords/tokens/secrets/API keys are redacted automatically; disable
  logging entirely with `MCP_ENABLE_AUDIT_LOG=false` (not recommended in
  production)

**Output sanitization**
- Sensitive fields stripped recursively from every response:
  `password_hash`, `jwt_secret`, `api_key`, `secret`
- Verbose errors only when `NODE_ENV !== 'production'`; production responses
  use a generic `"An error occurred"` while full detail still goes to the
  audit log

**Resource protection**
- Max 200 results per query by default (`MCP_MAX_RESULT_LIMIT`), pagination
  required beyond that

### Best practices

**Deployment**
- Run in an isolated network segment; firewall to trusted LLM clients only
- Dedicated service account with minimal permissions (least privilege)
- Short-lived tokens/sessions with rotation; never log or print them; distinct
  credentials per environment
- Monitor audit logs; alert on auth failures and rate-limit violations

**Development**
- Validate all inputs at tool boundaries; sanitize before any API call;
  parameterized queries only (no string concatenation)
- Test with malicious/fuzzed inputs, expired tokens, forced rate-limit and
  timeout conditions
- Code review every change for hardcoded secrets, missing validation, missing
  audit logging, and error-message verbosity

**Client configuration**
- Reference secrets via environment variable placeholders
  (`${CONTROLWEAVE_TOKEN}`), never hardcode
- Restrict file permissions on client config files; use full paths, not
  relative ones, to avoid path hijacking

### Monitoring & auditing

**Metrics to track:** authentication attempts/failures, unique users/day,
tool invocations/hour, most-used tools, tool error rates, rate-limit
violations/hour, request-timeout occurrences, API response times.

**Log aggregation:**
```bash
node mcp-server-secure.js 2>> /var/log/controlweave/mcp-audit.log
```
Ship to a SIEM (Splunk, ELK, Azure Sentinel, AWS CloudWatch) if available.

**Alerting rules:**
- Critical: 5+ auth failures from one user in 5 minutes; 10+ rate-limit
  violations in 1 hour; admin-tool access from a non-admin user; API error
  rate > 10%
- Warning: rate-limit violations > 5/hour; tool execution > 20s; auth
  failures > 10/day

### Incident response

1. **Detection** — audit log anomalies, alerts, user reports, error pattern review
2. **Containment** — revoke compromised tokens/sessions immediately, disable
   affected accounts, block suspicious IPs
3. **Investigation** — reconstruct timeline from audit logs, identify scope
   of compromised data and the attack vector
4. **Remediation** — patch, rotate credentials, restore from clean backups
   if needed
5. **Recovery** — verify integrity, re-enable services incrementally, monitor
   for continued attack
6. **Lessons learned** — document timeline, update procedures and detection

**Common scenarios:**
- *Token/session compromise* — detect via unusual access location; revoke,
  force re-auth, audit recent activity; consider geo-fencing and MFA on
  token/session generation going forward
- *Rate-limit abuse* — detect via rapid violations; temporarily block,
  investigate intent, adjust limits; consider adaptive rate limiting
- *Prompt injection attempt* — detect via unusual input patterns in the audit
  log; block the input, review responses, patch validation gaps

### Compliance mapping

**OWASP** — authentication/authorization, input validation, output
sanitization, rate limiting, audit logging, secure error handling,
configuration security, and defense-in-depth are all implemented per the
threat model above.

**GDPR** — data minimization (Art. 5.1.c), purpose limitation (Art. 5.1.b),
access logging (Art. 30), security measures (Art. 32).

**HIPAA** — access control (§164.312(a)(1)), audit controls (§164.312(b)),
integrity controls (§164.312(c)(1)), transmission security (§164.312(e))
via HTTPS.

**SOC 2** — CC6.1 (logical access controls), CC6.6 (logical access
restrictions), CC7.2 (system monitoring), CC7.3 (threat detection/response).

### Quick reference

**TL;DR:** use `npm run mcp:secure` in production. Rate limiting, audit
logging, input validation, and output sanitization are on by default.

Pre-production checklist:
- [ ] `NODE_ENV=production`
- [ ] HTTPS for `GRC_API_BASE_URL`
- [ ] Credentials stored securely, not in code
- [ ] Audit logging enabled, log rotation configured
- [ ] Monitoring/alerting configured
- [ ] Security guide reviewed by the deploying team

Post-deployment checklist:
- [ ] Audit logs confirmed writing
- [ ] Rate limiting confirmed enforced
- [ ] 24-hour monitoring window completed
- [ ] First week of logs reviewed
- [ ] Rate limits tuned to observed usage

Common troubleshooting:
| Symptom | Fix |
|---|---|
| `Authentication failed` | Confirm the auth flow actually wired up (see conflict note above) and that credentials are valid |
| `Rate limit exceeded` | `export MCP_RATE_LIMIT=60` or wait for the 1-minute window to reset |
| `Request timeout` | `export MCP_REQUEST_TIMEOUT_MS=60000` |

### Migration: standard → secure server

**Side-by-side (recommended):** deploy the secure server alongside the
standard one, test with a non-production credential, verify all tools,
monitor audit logs, then cut over production traffic and decommission the
standard server.

**In-place:**
```bash
cd backend/scripts
cp mcp-server.js mcp-server.legacy.js   # backup for rollback
cp mcp-server-secure.js mcp-server.js
cat >> ../.env << EOF
MCP_RATE_LIMIT=30
MCP_REQUEST_TIMEOUT_MS=30000
MCP_ENABLE_AUDIT_LOG=true
MCP_MAX_RESULT_LIMIT=200
EOF
```
Then update the client config to point at the new server and watch the
audit log (`node mcp-server.js 2>&1 | grep AUDIT`) during rollout.

Compatibility: tool names, signatures, and response formats are unchanged
between the standard and secure servers. New behavior: rate-limit error
responses, and stricter input validation may reject previously-accepted
malformed input.

### Performance impact

~10% average overhead (5–8ms/request), constant regardless of payload size:

| Operation | Time added |
|---|---|
| Input validation | ~2ms |
| Rate limit check | <1ms |
| Audit logging | ~3ms |
| Output sanitization | ~2ms |

---

## Deployment

### Pre-deployment checklist

**Configuration**
- [ ] `GRC_API_BASE_URL` set to an HTTPS backend URL
- [ ] Auth credential configured per whichever flow is actually active (see
      [Authentication model](#authentication-model))
- [ ] `NODE_ENV=production`
- [ ] `MCP_RATE_LIMIT` and `MCP_REQUEST_TIMEOUT_MS` set appropriately
- [ ] `MCP_ENABLE_AUDIT_LOG=true`

**Credential security**
- [ ] Stored in a secure credential store, not in code
- [ ] Short expiration (≤15 min recommended) with a rotation mechanism
- [ ] Distinct credentials per environment (dev/staging/production)

**Network security**
- [ ] Backend on HTTPS with TLS 1.2+ and a valid certificate
- [ ] Firewall rules restrict access appropriately

**File permissions**
- [ ] Server script: `chmod 750 mcp-server-secure.js`
- [ ] `.env`: `chmod 600`
- [ ] Log directory: `chmod 750 /var/log/controlweave/`
- [ ] Dedicated service account with minimal permissions

**Infrastructure**
- [ ] Log directory created with rotation configured (`logrotate`)
- [ ] Monitoring/alerting configured
- [ ] Backup strategy in place

### Installation

```bash
cd /opt/controlweave/backend/scripts
cp mcp-server-secure.js mcp-server.js
chmod 750 mcp-server.js
chown controlweave:controlweave mcp-server.js

mkdir -p /var/log/controlweave
chmod 750 /var/log/controlweave
chown controlweave:controlweave /var/log/controlweave

sudo tee /etc/logrotate.d/controlweave-mcp << EOF
/var/log/controlweave/mcp-audit.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 controlweave controlweave
    sharedscripts
}
EOF
```

### Testing before go-live

- **Smoke test:** `npm run mcp:secure` should log
  `[INFO] Secure AI GRC MCP server running on stdio`
- **Authentication test:** run with a deliberately invalid credential and
  confirm the failure is logged
- **Rate-limit test:** invoke the same tool 35+ times rapidly; confirm a
  rate-limit error appears after the configured threshold (30 by default)
- **Timeout test:** set `MCP_REQUEST_TIMEOUT_MS=5000` and confirm a slow
  operation times out cleanly

### Post-deployment verification

- Server starts without errors; `grc_health` and `grc_whoami` return expected
  data
- Audit log file exists, is being written to, is valid JSON, and redacts
  sensitive fields
- Rate limiting and input validation are actually enforced; invalid
  credentials are actually rejected

### Monitoring setup

- Track tool invocation counts, auth failure rate, rate-limit violations,
  API error rate
- Alert on: 5+ auth failures/5min, 10+ rate-limit violations/hour, API error
  rate > 10%, no activity for 6+ hours (if activity is expected)
- Forward logs to a SIEM if one is in use; confirm retention policy and
  search capability

### Client configuration for deployment

See [Tools Reference → Usage Examples](#usage-examples) for the standard
per-client JSON snippets. General rules: `chmod 600` on config files, no
hardcoded credentials, full (not relative) paths.

#### Windows Enterprise — managed settings (MDM/Intune)

> **⚠️ Windows path migration (required by March 12, 2026).** Claude Code on
> Windows is migrating the managed-settings file path.
> - New path (required): `C:\Program Files\ClaudeCode\managed-settings.json`
> - Legacy path (deprecated): `C:\ProgramData\ClaudeCode\` — stops being read
>   after March 12, 2026.
>
> Update your MDM/endpoint management config (e.g., Microsoft Intune) to
> deploy `managed-settings.json` to the new path before that date.

For enterprise Windows fleets, push the ControlWeave MCP server config to all
endpoints via MDM using `managed-settings.json`. A ready-to-use template is
at `docs/templates/managed-settings.json`.

The template:
- Allows all ControlWeave MCP tools while denying shell and secrets access
- Sets `disableBypassPermissionsMode: "disable"` — `"disable"` is the only
  valid value per the
  [Claude Code permissions docs](https://code.claude.com/docs/en/permissions);
  it blocks bypass-permissions ("YOLO") mode fleet-wide
- Configures the ControlWeave MCP server with production environment variables
- Disables nonessential Claude Code network traffic

**Steps:**
1. Copy and customize `docs/templates/managed-settings.json`: replace the
   placeholder backend URL
   (`https://your-controlweave-backend.example.com/api/v1`) — leaving it will
   cause connection failures — and inject `CONTROLWEAVE_TOKEN` as a managed
   environment variable via your MDM solution.
2. Deploy to `C:\Program Files\ClaudeCode\managed-settings.json` via MDM.
3. Restrict the ACL to administrators:
   ```powershell
   icacls "C:\Program Files\ClaudeCode\managed-settings.json" /inheritance:r /grant "BUILTIN\Administrators:(F)" /grant "SYSTEM:(F)"
   ```

Checklist:
- [ ] Deployed to the new path; legacy path removed from MDM config
- [ ] File ACL restricts modification to administrators
- [ ] `GRC_API_BASE_URL` points at the production backend
- [ ] Credential injected via MDM/secure mechanism, not hardcoded
- [ ] Verified on a test endpoint before broad rollout

### Ongoing maintenance

- **Daily:** review audit logs for anomalies, check monitoring dashboards,
  confirm no critical alerts
- **Weekly:** review auth failures, analyze tool usage patterns, check for
  unusual activity, review rate-limit violations
- **Monthly:** rotate credentials, review/update rate limits, `npm audit &&
  npm update`, review security documentation
- **Quarterly:** review access permissions, refresh security training,
  review incident-response procedures, test backup/restore

### Rollback plan

```bash
cd /opt/controlweave/backend/scripts
cp mcp-server.legacy.js mcp-server.js
systemctl restart controlweave-mcp
tail -f /var/log/controlweave/mcp-audit.log
```
Document the issue with error messages, relevant log entries, reproduction
steps, and impact assessment.

### Security incident playbooks

**Suspected credential compromise:**
1. Revoke the compromised token/session, force re-authentication, review
   audit logs for unauthorized access
2. Investigate: `grep "tool_invocation" mcp-audit.log | jq '. | select(.user_id=="<user-id>")'`
3. Issue new credentials, update client config, monitor for 24 hours

**Unusual tool access:**
1. Temporarily disable the affected account, review recent invocations
2. Investigate: `grep "tool_invocation" mcp-audit.log | jq '. | select(.tool=="grc_update_control_implementation")' | jq -s 'group_by(.user_id) | map({user: .[0].user_id, count: length})'`
3. Confirm legitimacy with the user; if malicious, revoke access, reset
   credentials, update detection rules

---

## Tools Reference

The secure MCP server provides **54 tools**. All tools follow the security
controls described above: rate limiting, audit logging, input validation,
output sanitization. Detailed per-tool documentation is provided below for
System & Auth, Compliance & Frameworks, Evidence, Asset/CMDB, Third-Party AI
Governance, Threat Intelligence, and Crosswalk Inheritance; the remaining
categories (POA&M, Reports, Exceptions, Audit Logs, TPRM, Help Center) exist
in the tool count above but are not yet individually documented here.

### System & Authentication Tools

#### `grc_health`
Check backend health and database connectivity.
Auth required: No. Parameters: none.

#### `grc_whoami`
Get the current authenticated user, organization, roles, and permissions.
Auth required: Yes. Parameters: none.
Returns: user profile, organization details, role list, permission array.

### Compliance & Framework Tools

#### `grc_list_frameworks`
List all available compliance frameworks. Auth required: Yes. Parameters: none.
Returns: array of frameworks (NIST 800-53, ISO 27001, SOC 2, etc.).

#### `grc_get_dashboard_stats`
Get compliance and activity summary statistics. Auth required: Yes.
Parameters: none. Returns: compliance metrics, control status counts, recent
activity.

#### `grc_list_controls`
List controls with optional framework/status filtering. Auth required: Yes.
- `organization_id` (UUID, optional) — defaults to the current user's org
- `framework_id` (UUID, optional)
- `status` (string, optional)

```json
{ "framework_id": "550e8400-e29b-41d4-a716-446655440000", "status": "in_progress" }
```

#### `grc_update_control_implementation`
Update implementation details for a specific control. Auth required: Yes,
appropriate write permission.
- `control_id` (UUID, required)
- `status` (string, required) — `implemented | in_progress | not_started | planned`
- `implementation_details` (string, optional, max 10000)
- `evidence_url` (URL, optional, max 2000)
- `assigned_to` (UUID, optional)
- `notes` (string, optional, max 10000)

```json
{
  "control_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "implemented",
  "implementation_details": "Implemented MFA for all users using Okta",
  "notes": "Completed Q1 2026"
}
```

#### `grc_ai_query`
Run natural-language compliance Q&A against organization data. Auth
required: Yes, `ai.use` permission.
- `question` (string, required, 3–10000 chars)
- `provider` (enum, optional) — `claude | openai | gemini | grok`
- `model` (string, optional, max 100)

```json
{ "question": "What controls do we have for access control in ISO 27001?", "provider": "claude" }
```

#### `grc_list_assessment_procedures`
List assessment procedures with filters. Auth required: Yes.
- `framework_code` (string, optional, max 50)
- `control_id` (string, optional, max 100)
- `procedure_type` (string, optional, max 50)
- `depth` (string, optional, max 20) — `basic | focused | comprehensive`
- `search` (string, optional, max 200)
- `limit` (number, optional, 1–200), `offset` (number, optional, ≥0)

#### `grc_list_notifications`
List notifications for the current user. Auth required: Yes.
- `unread` (boolean, optional)
- `limit` (number, optional, 1–200)

### Evidence Management Tools

#### `grc_list_evidence`
List evidence files with optional filtering. Auth required: Yes,
`evidence.read`.
- `search` (string, optional, max 200), `tags` (string, optional, max 200,
  comma-separated), `limit` (1–200), `offset` (≥0)

```json
{ "search": "audit report", "tags": "iso27001,audit", "limit": 50 }
```
Returns: evidence files with metadata, linked control counts.

#### `grc_get_evidence`
Get detailed information about a specific evidence file. Auth required:
Yes, `evidence.read`. Parameters: `evidence_id` (UUID, required).
Returns: full details including file info, integrity hash, retention date,
linked controls.

#### `grc_link_evidence`
Link an evidence file to one or more controls. Auth required: Yes,
`evidence.write`.
- `evidence_id` (UUID, required)
- `control_ids` (UUID array, required, 1–50 items)
- `notes` (string, optional, max 10000)

```json
{
  "evidence_id": "550e8400-e29b-41d4-a716-446655440000",
  "control_ids": ["660e8400-e29b-41d4-a716-446655440001", "770e8400-e29b-41d4-a716-446655440002"],
  "notes": "Annual audit evidence for access control requirements"
}
```

**Note:** MCP does not support file uploads over stdio. Upload evidence via
the web UI or the REST API directly, then link it via MCP.

#### `grc_unlink_evidence`
Unlink evidence from a specific control. Auth required: Yes,
`evidence.write`. Parameters: `evidence_id` (UUID, required), `control_id`
(UUID, required).

#### `grc_update_evidence`
Update evidence file metadata. Auth required: Yes, `evidence.write`.
- `evidence_id` (UUID, required)
- `description` (string, optional, max 10000)
- `tags` (string array, optional, max 20 tags, 50 chars each)
- `retention_until` (string, optional, `YYYY-MM-DD`)

### Asset/CMDB Management Tools

#### `grc_list_assets`
List assets (hardware, software, AI agents, etc.) with filtering. Auth
required: Yes, `assets.read`.
- `category` (string, optional, max 50) — `hardware | software | ai_agent`
- `status` (string, optional, max 50) — `active | maintenance | deprecated | decommissioned`
- `environment_id` (UUID, optional)
- `search` (string, optional, max 200)

#### `grc_get_asset_categories`
Get all available asset categories. Auth required: Yes, `assets.read`.
Parameters: none.

#### `grc_get_asset`
Get detailed information about a specific asset. Auth required: Yes,
`assets.read`. Parameters: `asset_id` (UUID, required). Returns:
dependencies, vulnerabilities, relationships.

#### `grc_create_asset`
Create a new asset. Auth required: Yes, `assets.write`.
- `category_id` (UUID, required) — from `grc_get_asset_categories`
- `name` (string, required, 1–200 chars)
- `asset_tag`, `serial_number`, `model`, `manufacturer` (string, optional, max 100 each)
- `location` (string, optional, max 200)
- `environment_id` (UUID, optional)
- `status` (enum, optional, default `active`)
- `security_classification` (string, optional, max 50)
- `criticality` (enum, optional) — `critical | high | medium | low`
- `ip_address` (string, optional, max 45)
- `hostname`, `fqdn` (string, optional, max 255 each)
- `version` (string, optional, max 100)
- `notes` (string, optional, max 10000)

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

#### `grc_update_asset`
Update an existing asset; only provided fields change. Auth required: Yes,
`assets.write`. Same field set as `grc_create_asset` (minus `category_id`),
plus required `asset_id` (UUID).

#### `grc_delete_asset`
Delete an asset — irreversible. Auth required: Yes, `assets.write`.
Parameters: `asset_id` (UUID, required).

#### `grc_get_asset_stats`
Asset statistics for dashboard use. Auth required: Yes, `assets.read`.
Parameters: none. Returns: totals, status breakdown, category breakdown,
environment usage.

### Third-Party AI Governance Tools

#### `ai_governance_get_summary`
Vendor count, concentration risk (vendors with >1 AI use case where business
criticality is high/critical), open incidents, unapproved supply-chain
components. Auth required: Yes. Parameters: none.

#### `ai_governance_list_vendors`
List AI vendor assessments with risk level, vendor type, per-dimension risk
scores. Auth required: Yes.
- `risk_level` (enum, optional) — `low | medium | high | critical`
- `vendor_type` (enum, optional) — `llm_provider | ml_platform | data_provider | ai_tool | consulting`
- `search` (string, optional), `limit`/`offset` (int, optional)

#### `ai_governance_get_vendor`
Full AI vendor assessment: risk dimension scores, model transparency rating,
bias-testing evidence, data-provenance clarity, subprocessors, contract
dates. Auth required: Yes. Parameters: `vendor_id` (UUID, required).

#### `ai_governance_list_incidents`
List AI vendor incidents (security breaches, data leaks, outages, compliance
violations, model failures). Auth required: Yes.
- `vendor_assessment_id` (UUID, optional)
- `status` (enum, optional) — `open | closed`
- `incident_type` (enum, optional) — `security_breach | data_leak | service_outage | compliance_violation | model_failure`

#### `ai_governance_list_supply_chain`
List AI supply-chain components (models, datasets, libraries, APIs) with
approval status and provenance verification. Auth required: Yes.
- `source_vendor_id` (UUID, optional)
- `component_type` (enum, optional) — `model | dataset | library | infrastructure | api | tool`
- `approved_for_use` (boolean, optional)

### Threat Intelligence Tools

#### `threat_intel_get_stats`
Active feed count, total items, critical/high severity counts, items with
known exploits. Auth required: Yes. Parameters: none.

#### `threat_intel_list_items`
List threat intelligence items (CVEs, indicators) from NVD, CISA KEV, MITRE
ATT&CK, and AlienVault OTX with CVSS scores and exploit-available flags. Auth
required: Yes.
- `severity` (enum, optional) — `critical | high | medium | low`
- `exploit_available` (boolean, optional)
- `search` (string, optional), `limit`/`offset` (int, optional)

### Crosswalk Inheritance Tool

#### `grc_trigger_crosswalk_inherit`
Manually trigger crosswalk inheritance for a control — propagates its
implementation status to mapped controls in other active frameworks that
meet the configured similarity threshold (default 90%). Auth required: Yes,
`controls.write`.
- `control_id` (UUID, required) — source control
- `inherited_status` (enum, optional) — override status to propagate,
  `implemented | satisfied_via_crosswalk | in_progress | not_started`

```json
{ "control_id": "550e8400-e29b-41d4-a716-446655440000" }
```

Returns count of controls auto-satisfied and the inheritance events created,
e.g.:
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

### Error handling

```json
// Authentication failure
{ "content": [{"type": "text", "text": "Authentication failed. Please check your token."}], "isError": true }

// Rate limit exceeded
{ "content": [{"type": "text", "text": "Rate limit exceeded. Try again after 2026-02-18T13:30:00.000Z"}], "isError": true }

// Permission denied
{ "content": [{"type": "text", "text": "Insufficient permissions"}], "isError": true }

// Validation error
{ "content": [{"type": "text", "text": "control_id is not a valid UUID"}], "isError": true }
```

### Usage Examples

The server uses the standard stdio transport, so the same
`mcp-server-secure.js` binary and environment variables work across clients —
only the client-side config file format changes.

#### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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
Invoke with: `@controlweave show me open AI governance incidents`

#### Cursor

`~/.cursor/mcp.json`:

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

#### VS Code + GitHub Copilot (Agent mode)

`.vscode/mcp.json` (workspace) or User Settings → `mcp.servers`. This client
uses the login-session flow (see [Authentication model](#authentication-model)):

```bash
cd /path/to/controlweave/backend
npm run mcp:login
```
This stores a local session (access + refresh token); the server
auto-refreshes on expiry. Check/clear with `npm run mcp:status` /
`npm run mcp:logout`.

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
`GRC_API_TOKEN`, `MCP_LOGIN_EMAIL`, and `MCP_LOGIN_PASSWORD` are not used in
this flow. Use in Copilot Chat: `#controlweave what controls map to NIST AC-2?`

#### Continue.dev

`~/.continue/config.json`:

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

#### Windsurf

`~/.codeium/windsurf/mcp_config.json`:

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

#### Custom / programmatic integration

```bash
GRC_API_BASE_URL=https://your-backend.com/api/v1 \
GRC_API_TOKEN=your-jwt-token \
NODE_ENV=production \
node /path/to/controlweave/backend/scripts/mcp-server-secure.js
```

For orchestrators that need HTTP/SSE instead of stdio (OpenAI Agents SDK,
LangChain, etc.), run the server behind a stdio-to-HTTP bridge (e.g.
`mcp-proxy`) or call the ControlWeave REST API directly via `lib/api.ts`.

### Common workflows

**Add a new server to CMDB:**
```
User: "Add a new database server named db-prod-02 with IP 10.0.1.51"
→ grc_get_asset_categories (find hardware category ID)
→ grc_create_asset with appropriate parameters
```

**Link audit evidence to controls:**
```
User: "Link the Q1 audit report to ISO 27001 access control"
→ grc_list_evidence (find evidence by name)
→ grc_list_controls (find controls by framework)
→ grc_link_evidence with evidence_id and control_ids
```

**Update control implementation status:**
```
User: "Mark AC-2 as implemented with details about our MFA setup"
→ grc_list_controls (find AC-2)
→ grc_update_control_implementation
```

**Trigger crosswalk to auto-satisfy related controls:**
```
User: "AC-2 is now implemented — propagate to our other frameworks"
→ grc_trigger_crosswalk_inherit with the AC-2 control_id
```

**Audit third-party AI vendor risk:**
```
User: "What's the risk status of our AI vendors? Any open incidents?"
→ ai_governance_get_summary
→ ai_governance_list_incidents (status: "open")
```

**Check threat landscape for critical exploitable CVEs:**
```
User: "Show me critical CVEs with known exploits from our threat feeds"
→ threat_intel_list_items (severity: "critical", exploit_available: true)
```

### Performance

- Average overhead: ~10% (5–8ms per request)
- Rate limiting: <1ms per check
- Input validation: ~2ms per request
- Audit logging: ~3ms per request
- Output sanitization: ~2ms per request
