# AU-2 Compliance Documentation

## Overview
This document describes how the ControlWeave Pro audit logging system complies with NIST SP 800-53 AU-2 (Audit Events) requirements.

## AU-2 Requirements

AU-2 requires organizations to:
1. Determine that the system is capable of auditing specific events
2. Coordinate audit event selection with other entities
3. Provide rationale for auditable events
4. Review and update auditable events

### Required Audit Record Content

According to AU-2, each audit record must include at minimum:
- **Event type** - What happened
- **Date and time** - When it happened  
- **Location** - Where it happened (system component)
- **Source** - What/who initiated the event
- **Outcome** - Success or failure
- **Subject identity** - User/process that caused the event
- **Object** - Resource/data affected

## Implementation

### Database Schema

The `audit_logs` table includes all required AU-2 fields:

| Field | AU-2 Requirement | Description |
|-------|-----------------|-------------|
| `event_type` | Event type | Type of event (e.g., user.login.success, control.updated) |
| `created_at` | Date and time | Timestamp when event occurred |
| `source_system` | Location/Source | System/service that generated the event |
| `ip_address` | Location | Source IP address of the request |
| `user_id` | Subject identity | ID of user who performed action |
| `actor_name` | Subject identity | Human-readable name of the actor |
| `outcome` | Outcome | success, failure, or partial |
| `success` | Outcome | Boolean success indicator |
| `failure_reason` | Outcome | Details when outcome is failure |
| `resource_type` | Object | Type of resource affected |
| `resource_id` | Object | ID of specific resource affected |
| `details` | Additional context | JSONB field with event-specific details |

### Additional AU-2 Enhanced Fields

Beyond basic AU-2 requirements, we include:

| Field | Purpose |
|-------|---------|
| `session_id` | Correlate events within a user session |
| `request_id` | Trace events across distributed services |
| `authentication_method` | Track how user authenticated (password, sso, passkey, api_key) |
| `sso_provider` | Identify SSO provider when auth method is SSO |
| `siem_forwarded` | Track if event was forwarded to SIEM |
| `user_agent` | Client application/browser information |
| `organization_id` | Multi-tenant isolation |

## Auditable Events

### Authentication Events
- `user.login.success` - Successful login
- `user.login.failure` - Failed login attempt
- `user.logout` - User logout
- `user.password.changed` - Password change
- `user.mfa.enabled` - Multi-factor auth enabled
- `user.mfa.disabled` - Multi-factor auth disabled

### Authorization Events  
- `user.permission.granted` - Permission granted
- `user.permission.revoked` - Permission revoked
- `user.role.changed` - Role assignment changed

### Configuration Events
- `sso.config.created` - SSO configuration created
- `sso.config.updated` - SSO configuration updated
- `sso.config.deleted` - SSO configuration deleted
- `siem.config.created` - SIEM configuration created
- `siem.config.updated` - SIEM configuration updated
- `siem.config.deleted` - SIEM configuration deleted

### Data Access Events
- `control.created` - Control created
- `control.updated` - Control modified
- `control.deleted` - Control deleted
- `evidence.uploaded` - Evidence file uploaded
- `evidence.downloaded` - Evidence file accessed
- `report.generated` - Report generated
- `report.exported` - Report exported

### System Events
- `backup.started` - Backup initiated
- `backup.completed` - Backup completed
- `backup.failed` - Backup failed
- `migration.started` - Database migration started
- `migration.completed` - Database migration completed

## SSO Integration Tracking

When users authenticate via SSO, the audit log captures:
- Authentication method = "sso"
- SSO provider name (e.g., "google", "microsoft", "okta")
- User email from SSO provider
- Success/failure status
- Failure reason if applicable

## SIEM Integration Tracking

When events are forwarded to SIEM systems:
- `siem_forwarded` flag is set to `true` upon successful forwarding
- Original event details remain in local audit log
- SIEM configuration changes are themselves audited
- Test events are logged with `source_system = 'controlweave-siem'`

## Centralized Audit Service

The `auditService.js` provides standardized logging functions:

```javascript
// Create generic audit log
auditService.createAuditLog({
  organizationId,
  userId,
  eventType,
  resourceType,
  resourceId,
  details,
  ipAddress,
  userAgent,
  success,
  failureReason,
  sessionId,
  authenticationMethod,
  ssoProvider,
  requestId,
  actorName,
  sourceSystem
});

// Log authentication event
auditService.logAuthentication({
  organizationId,
  userId,
  email,
  authMethod,
  ssoProvider,
  success,
  failureReason,
  ipAddress,
  userAgent,
  sessionId,
  requestId,
  actorName
});

// Log from Express request
auditService.logFromRequest(req, {
  eventType,
  resourceType,
  resourceId,
  details,
  success
});
```

## API Access

Audit logs are accessible via REST API at `/api/v1/audit/logs` with:
- Filtering by event type, resource type, user, date range
- Pagination support
- Permission-based access control
- All AU-2 fields included in response

## Compliance Verification

To verify AU-2 compliance:

1. **Event Coverage**: Review `event_types` table to ensure all required system events are captured
2. **Field Completeness**: Query audit logs and verify all AU-2 required fields are populated
3. **Retention**: Audit logs are retained according to organization's retention policy
4. **Protection**: Audit logs are in separate table with restricted access
5. **Review Process**: Regular audit log reviews via dashboard and API

## Event Review Process

1. Security team reviews audit logs daily via dashboard
2. Automated alerts for suspicious patterns (failed logins, privilege escalations)
3. Quarterly comprehensive audit log review
4. SIEM integration forwards events for centralized monitoring
5. Audit logs exported for compliance reporting

## Sample Audit Log Entry

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "organization_id": "123e4567-e89b-12d3-a456-426614174000",
  "user_id": "789e0123-e45b-67c8-d901-234567890000",
  "event_type": "user.login.success",
  "resource_type": "user",
  "resource_id": "789e0123-e45b-67c8-d901-234567890000",
  "details": {
    "email": "user@example.com",
    "authentication_method": "sso",
    "sso_provider": "google"
  },
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
  "created_at": "2024-02-13T22:00:00.000Z",
  "user_name": "John Doe",
  "user_email": "user@example.com"
}
```

## Related Controls

This implementation also supports:
- **AU-3**: Audit Record Content - All required fields captured
- **AU-6**: Audit Review, Analysis, and Reporting - API and dashboard for review
- **AU-7**: Audit Reduction and Report Generation - Filtering and export capabilities
- **AU-8**: Time Stamps - Centralized timestamps on all events
- **AU-9**: Protection of Audit Information - Restricted access, separate table
- **AU-12**: Audit Generation - Centralized service ensures consistent audit generation

## Migration

Database migration `048_audit_logs_au2_compliance.sql` adds all required fields to existing `audit_logs` table while preserving existing data.
