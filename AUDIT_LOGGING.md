# Audit Logging (AU-2 Compliance)

How ControlWeave's `audit_logs` table and `auditService.js` satisfy NIST SP
800-53 AU-2 (Audit Events), plus the SSO/SIEM integration logging built on
top of it.

## AU-2 Requirements

AU-2 requires each audit record to capture, at minimum: event type, date and
time, location, source, outcome, subject identity, and the object/resource
affected.

## Schema (Migration 048: `048_audit_logs_au2_compliance.sql`)

Added to the existing `audit_logs` table (`ADD COLUMN IF NOT EXISTS`,
non-destructive, nullable — historical rows are simply `NULL` for new
fields):

| Field | AU-2 mapping | Description |
|---|---|---|
| `session_id` | — | Correlates events within one user session |
| `authentication_method` | Subject identity | `password`, `sso`, `passkey`, `api_key` |
| `sso_provider` | Subject identity | SSO provider name when auth method is `sso` |
| `siem_forwarded` | — | Boolean; set `true` once the event is forwarded to SIEM |
| `outcome` | Outcome | Standardized: `success`, `failure`, `partial` |
| `request_id` | — | Cross-service request correlation ID |
| `actor_name` | Subject identity | Human-readable name of the actor |
| `source_system` | Location/Source | Originating system/service |

Pre-existing fields also satisfy AU-2: `event_type`, `created_at`,
`ip_address`, `user_id`, `success`/`failure_reason`, `resource_type`,
`resource_id`, `details` (JSONB), `user_agent`, `organization_id`.

Indexes added on `session_id`, `authentication_method`, `sso_provider`,
`request_id`, `outcome`, and `created_at DESC`.

### Related NIST controls also supported

AU-3 (Audit Record Content), AU-6 (Review/Analysis/Reporting — via API +
dashboard), AU-7 (Audit Reduction/Report Generation — filtering/export),
AU-8 (Time Stamps — centralized), AU-9 (Protection of Audit Information —
separate table, restricted access), AU-12 (Audit Generation — centralized
service).

## Centralized Audit Service (`src/services/auditService.js`)

```javascript
// Generic event
auditService.createAuditLog({
  organizationId, userId, eventType, resourceType, resourceId, details,
  ipAddress, userAgent, success, failureReason,
  sessionId, authenticationMethod, ssoProvider, requestId, actorName, sourceSystem,
});

// Authentication event (login/logout)
auditService.logAuthentication({
  organizationId, userId, email, authMethod, ssoProvider, success, failureReason,
  ipAddress, userAgent, sessionId, requestId, actorName,
});

// Convenience: pull IP/user-agent/session/user straight from an Express req
auditService.logFromRequest(req, { eventType, resourceType, resourceId, details, success });

// SSO / SIEM configuration changes
auditService.logSsoConfigChange({ organizationId, userId, action, provider, configId, details, ... });
auditService.logSiemConfigChange({ organizationId, userId, action: 'updated', siemProvider: 'splunk', configId, details, ipAddress, userAgent, requestId, actorName });

// Forward an event to configured SIEM(s) and mark it forwarded
auditService.forwardToSiem(event);
```

Key behaviors:
- Automatically extracts context (IP, user agent, session) from the request object in `logFromRequest`.
- SIEM forwarding is async and non-blocking; `siem_forwarded` is updated on success.
- Audit-logging failures never break the calling request (errors are swallowed/logged, not thrown).

## Where Logging Is Wired In

**SSO (`src/routes/sso.js`):**
- Org SSO callback (`/sso/callback/org`): logs success and failure, captures provider display name, user email/name.
- Social login callback (`/sso/callback/:provider`): logs Google/Microsoft/Apple/GitHub logins, associates with organization for multi-tenant tracking.
- SSO config create/update/delete: logs which admin changed what.

**SIEM (`src/routes/siem.js`):**
- `POST /siem`: logs new integration (provider — Splunk/Elastic/Webhook/Syslog — name, enabled status).
- `PUT /siem/:id`: logs which fields changed.
- `DELETE /siem/:id`: logs removal, preserving the audit trail of the deleted config.
- Test events use `source_system = 'controlweave-siem'`.

**Query API (`GET /api/v1/audit/logs`):** supports existing filters
(`userId`, `eventType`, `resourceType`, date range, pagination) plus new
filters `authenticationMethod` and `ssoProvider` (e.g.
`?authenticationMethod=sso&ssoProvider=google`). Response includes all AU-2
fields listed above. Access is permission-gated.

## Auditable Event Types (non-exhaustive reference)

- **Authentication**: `user.login.success`, `user.login.failure`, `user.logout`, `user.password.changed`, `user.mfa.enabled`, `user.mfa.disabled`
- **Authorization**: `user.permission.granted`, `user.permission.revoked`, `user.role.changed`
- **Configuration**: `sso.config.created/updated/deleted`, `siem.config.created/updated/deleted`
- **Data access**: `control.created/updated/deleted`, `evidence.uploaded/downloaded`, `report.generated/exported`
- **System**: `backup.started/completed/failed`, `migration.started/completed`

## Sample Record

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "organization_id": "123e4567-e89b-12d3-a456-426614174000",
  "user_id": "789e0123-e45b-67c8-d901-234567890000",
  "event_type": "user.login.success",
  "resource_type": "user",
  "resource_id": "789e0123-e45b-67c8-d901-234567890000",
  "details": { "email": "user@example.com", "authentication_method": "sso", "sso_provider": "google" },
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "success": true,
  "failure_reason": null,
  "session_id": "sess_abc123xyz",
  "authentication_method": "sso",
  "sso_provider": "google",
  "siem_forwarded": true,
  "outcome": "success",
  "request_id": "req_xyz789abc",
  "actor_name": "John Doe",
  "source_system": "controlweave-auth",
  "created_at": "2024-02-13T22:00:00.000Z"
}
```

## Verification / Review Process

1. Query audit logs and confirm all AU-2-required fields are populated for
   recent events (historical pre-migration rows are legitimately `NULL`).
2. Review `event_types` coverage against the list above to ensure required
   system events are actually being captured.
3. Retention and access-restriction on the `audit_logs` table follow the
   org's retention policy (separate table, restricted access — AU-9).
4. Recommended cadence: daily dashboard review by security, automated alerts
   for suspicious patterns (failed logins, privilege escalations), quarterly
   comprehensive review, SIEM forwarding for centralized monitoring.

## Reference

- Migration: `migrations/048_audit_logs_au2_compliance.sql`
- Service: `src/services/auditService.js`
- Routes touched: `src/routes/audit.js`, `src/routes/sso.js`, `src/routes/siem.js`
- Manual test script: `node scripts/test-au2-audit-logging.js` (validates SSO success/failure logging, config-change logging, and AU-2 field completeness)
