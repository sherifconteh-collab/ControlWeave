# Dynamic Audit Log Fields

## Overview

The Dynamic Audit Log Fields feature allows organizations to capture and track custom fields specific to their integrations (SIEM, SSO, etc.) beyond the standard AU-2 compliant fields. The system includes AI-powered field suggestions that analyze integration data and recommend relevant fields to track.

## Key Features

### 1. Custom Field Definitions
Organizations can define custom fields to capture in audit logs:
- Field name and data type (text, number, boolean, datetime, json)
- Display name and description
- Source integration (siem, sso, splunk, elastic, etc.)
- Active/inactive status

### 2. Column Visibility Preferences
- **User-level preferences**: Each user can customize which audit log columns they want to see
- **Organization defaults**: Admins can set default column visibility for all users
- **Column ordering**: Customize the order of columns in the display

### 3. AI-Powered Field Suggestions
The system automatically analyzes integration data and suggests relevant fields:
- Extracts unique keys from integration payloads
- Uses AI to assess field relevance (confidence score 0-1)
- Provides human-friendly display names and descriptions
- Admins can accept or reject suggestions

### 4. Automatic Field Storage
When audit logs are created with custom fields or integration data:
- Custom field values are automatically stored
- Integration data is analyzed in the background
- AI suggestions are generated for review

## Database Schema

### audit_field_definitions
Stores custom field definitions per organization:
```sql
- id: UUID primary key
- organization_id: UUID
- field_name: VARCHAR(100) - Technical field name
- field_type: VARCHAR(50) - Data type (text, number, boolean, datetime, json)
- display_name: VARCHAR(255) - User-friendly name
- description: TEXT - What the field represents
- source_integration: VARCHAR(100) - Integration source (siem, sso, etc.)
- is_active: BOOLEAN - Whether field is currently tracked
- is_ai_suggested: BOOLEAN - Whether suggested by AI
- ai_confidence_score: DECIMAL(3,2) - AI confidence (0.00-1.00)
- suggested_by_user_id: UUID - Who enabled the field
```

### audit_column_preferences
Stores user/org preferences for column visibility:
```sql
- id: UUID primary key
- organization_id: UUID
- user_id: UUID (null for org defaults)
- is_org_default: BOOLEAN - Whether this is the org default
- visible_columns: JSONB - Array of column names to show
- column_order: JSONB - Display order of columns
```

### audit_log_custom_fields
Stores actual custom field values:
```sql
- id: UUID primary key
- audit_log_id: UUID - Reference to audit log entry
- field_definition_id: UUID - Reference to field definition
- field_value: JSONB - The actual value
```

### audit_field_suggestions
Tracks AI-suggested fields pending review:
```sql
- id: UUID primary key
- organization_id: UUID
- suggested_field_name: VARCHAR(100)
- suggested_field_type: VARCHAR(50)
- display_name: VARCHAR(255)
- description: TEXT
- source_integration: VARCHAR(100)
- sample_values: JSONB - Example values found
- occurrence_count: INTEGER - How often seen
- confidence_score: DECIMAL(3,2) - AI confidence
- status: VARCHAR(50) - pending, accepted, rejected
- reviewed_by_user_id: UUID
- reviewed_at: TIMESTAMP
```

## API Endpoints

### Field Definitions

#### GET /api/v1/audit/fields
List all custom field definitions for the organization.

**Query Parameters:**
- `active_only` (boolean) - Filter to active fields only (default: true)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "organization_id": "uuid",
      "field_name": "siem_severity",
      "field_type": "text",
      "display_name": "SIEM Alert Severity",
      "description": "Severity level from SIEM system",
      "source_integration": "splunk",
      "is_active": true,
      "is_ai_suggested": true,
      "ai_confidence_score": 0.95,
      "created_at": "2024-02-14T00:00:00Z"
    }
  ]
}
```

#### POST /api/v1/audit/fields
Create a new custom field definition.

**Request Body:**
```json
{
  "field_name": "siem_severity",
  "field_type": "text",
  "display_name": "SIEM Alert Severity",
  "description": "Severity level from SIEM system",
  "source_integration": "splunk"
}
```

**Permission Required:** `settings.manage`

#### PUT /api/v1/audit/fields/:id
Update an existing field definition.

**Request Body:**
```json
{
  "display_name": "Updated Display Name",
  "description": "Updated description",
  "is_active": true
}
```

**Permission Required:** `settings.manage`

#### DELETE /api/v1/audit/fields/:id
Deactivate a field definition (soft delete).

**Permission Required:** `settings.manage`

### Column Preferences

#### GET /api/v1/audit/preferences
Get column preferences for the current user (or org default if no user preference exists).

**Response:**
```json
{
  "success": true,
  "data": {
    "visible_columns": [
      "event_type",
      "created_at",
      "actor_name",
      "outcome",
      "siem_severity"
    ],
    "column_order": [
      "event_type",
      "created_at",
      "actor_name",
      "outcome",
      "siem_severity"
    ]
  }
}
```

#### PUT /api/v1/audit/preferences
Save column preferences.

**Request Body:**
```json
{
  "visible_columns": ["event_type", "created_at", "actor_name"],
  "column_order": ["event_type", "created_at", "actor_name"],
  "is_org_default": false
}
```

**Notes:**
- Set `is_org_default: true` to set as organization default (admin only)
- User preferences override org defaults

### AI Field Suggestions

#### GET /api/v1/audit/suggestions
Get pending AI field suggestions for review.

**Permission Required:** `settings.manage`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "suggested_field_name": "authentication_context.device_id",
      "suggested_field_type": "text",
      "display_name": "Device ID",
      "description": "Unique identifier of the device used for authentication",
      "source_integration": "sso",
      "sample_values": ["device-123", "device-456"],
      "occurrence_count": 15,
      "confidence_score": 0.88,
      "status": "pending",
      "created_at": "2024-02-14T00:00:00Z"
    }
  ]
}
```

#### POST /api/v1/audit/suggestions/:id/accept
Accept an AI suggestion and create a field definition.

**Permission Required:** `settings.manage`

#### POST /api/v1/audit/suggestions/:id/reject
Reject an AI suggestion.

**Permission Required:** `settings.manage`

#### POST /api/v1/audit/analyze
Manually trigger AI analysis of integration data.

**Request Body:**
```json
{
  "integration_data": {
    "user": "john@example.com",
    "device_id": "device-123",
    "risk_score": 75,
    "geo_location": "US-CA"
  },
  "source_integration": "sso"
}
```

**Permission Required:** `settings.manage`

**Response:**
```json
{
  "success": true,
  "data": {
    "suggestions": [...],
    "message": "Found 3 new field suggestions"
  }
}
```

## Usage Examples

### 1. Creating Audit Logs with Custom Fields

```javascript
const auditService = require('./services/auditService');

// When logging an SSO authentication with custom fields
await auditService.logAuthentication({
  organizationId,
  userId,
  email,
  authMethod: 'sso',
  ssoProvider: 'okta',
  success: true,
  ipAddress,
  userAgent,
  requestId,
  actorName,
  // Add custom fields from the SSO response
  customFields: {
    'sso_device_id': 'device-abc-123',
    'sso_risk_score': 25,
    'sso_geo_country': 'US',
    'sso_mfa_method': 'totp'
  },
  // Optionally provide full integration data for AI analysis
  integrationData: fullSsoResponse
});
```

### 2. Querying Audit Logs with Custom Fields

```javascript
// GET /api/v1/audit/logs returns custom fields automatically
const response = await fetch('/api/v1/audit/logs');
const logs = await response.json();

// Each log entry now includes custom_fields
logs.data.forEach(log => {
  console.log(log.event_type);
  console.log(log.custom_fields); // { sso_device_id: {...}, sso_risk_score: {...} }
});
```

### 3. Managing Field Definitions

```javascript
// Create a custom field
await fetch('/api/v1/audit/fields', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    field_name: 'splunk_severity',
    field_type: 'text',
    display_name: 'Splunk Alert Severity',
    description: 'Alert severity from Splunk SIEM',
    source_integration: 'splunk'
  })
});

// Update field definition
await fetch('/api/v1/audit/fields/{id}', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    display_name: 'Alert Severity',
    is_active: true
  })
});
```

### 4. Setting Column Preferences

```javascript
// Set user preferences
await fetch('/api/v1/audit/preferences', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    visible_columns: [
      'event_type',
      'created_at',
      'actor_name',
      'outcome',
      'splunk_severity',  // Custom field
      'sso_device_id'     // Custom field
    ],
    column_order: [
      'event_type',
      'created_at',
      'actor_name',
      'splunk_severity',
      'outcome',
      'sso_device_id'
    ]
  })
});
```

### 5. Reviewing AI Suggestions

```javascript
// Get pending suggestions
const suggestions = await fetch('/api/v1/audit/suggestions');

// Accept a suggestion
await fetch(`/api/v1/audit/suggestions/${suggestionId}/accept`, {
  method: 'POST'
});

// Reject a suggestion
await fetch(`/api/v1/audit/suggestions/${suggestionId}/reject`, {
  method: 'POST'
});
```

## AI Field Analysis

The AI analyzes integration data to suggest relevant fields:

1. **Field Discovery**: Extracts all unique keys from nested JSON structures
2. **Frequency Analysis**: Tracks how often each field appears
3. **Sample Collection**: Gathers example values for each field
4. **AI Evaluation**: Uses LLM to assess:
   - Security relevance
   - Compliance value
   - Operational importance
   - Appropriate data type
   - User-friendly naming
5. **Confidence Scoring**: Assigns score based on relevance (0.00-1.00)
6. **Suggestion Storage**: Only suggests fields with confidence >= 0.5

### AI Prompt Structure

The AI receives:
- List of discovered fields with occurrence counts
- Sample values for each field
- Source integration type
- Existing field definitions (to avoid duplicates)

The AI provides:
- Field relevance score
- Suggested display name
- Description of field meaning
- Appropriate data type
- Reasoning for the suggestion

## Security Considerations

1. **Permission Controls**:
   - Field definition management requires `settings.manage` permission
   - Org default preferences require `settings.manage` permission
   - Reading audit logs requires `audit.read` permission

2. **Data Privacy**:
   - Custom field values are stored per audit log entry
   - Field definitions can be deactivated without deleting historical data
   - Sample values in suggestions are limited to prevent data leakage

3. **AI Safety**:
   - AI suggestions require admin review before activation
   - All suggestions are logged in audit trail
   - Confidence scores help admins make informed decisions

## Migration

Run migration 049 to create the required tables:
```bash
npm run migrate
```

The migration creates:
- audit_field_definitions table
- audit_column_preferences table
- audit_log_custom_fields table
- audit_field_suggestions table
- All necessary indexes and constraints

## Best Practices

1. **Field Naming**: Use descriptive, hierarchical names (e.g., `sso.device_id` not just `device_id`)
2. **Data Types**: Choose appropriate types to enable filtering and sorting
3. **Review Suggestions**: Regularly review and accept/reject AI suggestions
4. **Column Selection**: Keep visible columns focused on most important fields
5. **Integration Mapping**: Tag fields with source_integration for clear provenance
6. **Performance**: Limit active custom fields to essential ones to maintain query performance

## Troubleshooting

### Custom fields not appearing in logs
- Check that field definitions are active (`is_active = true`)
- Verify field names match exactly what's being passed in `customFields`
- Ensure source_integration matches the sourceSystem parameter

### AI not suggesting fields
- Verify LLM service is configured and available
- Check that integration data is being passed in audit log calls
- Review error logs for AI analysis failures

### Column preferences not saving
- Verify user has appropriate permissions
- Check for conflicts with org default settings
- Ensure column names are valid (check available columns first)
