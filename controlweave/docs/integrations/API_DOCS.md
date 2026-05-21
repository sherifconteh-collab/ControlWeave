# 🔌 API Documentation

ControlWeave REST API reference for programmatic access to compliance data.

## Overview

The ControlWeave API provides programmatic access to all platform features, enabling integration with your existing tools and workflows.

**Base URL**: `https://your-instance.controlweave.com/api/v1`  
**Authentication**: JWT Bearer token  
**Format**: JSON

## Authentication

### Obtaining a Token

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "expiresIn": 900
  }
}
```

### Using the Token

```http
GET /api/v1/controls
Authorization: Bearer eyJhbGci...
```

### API Keys (Enterprise — External AI Ingestion Only)

Enterprise-tier organizations can generate long-lived API keys (`cw_live_…`) for the **external AI decision ingestion** endpoints only. These keys are managed in **Settings** → **External AI Keys** and authenticated via the `X-API-Key` header.

> **Note:** All other `/api/v1/*` endpoints require a JWT Bearer token as shown above. API keys cannot be used for general API access.

## Core Endpoints

### Frameworks

```http
# List active frameworks
GET /api/v1/frameworks

# Get framework details
GET /api/v1/frameworks/{frameworkId}
```

### Controls

```http
# List all controls
GET /api/v1/controls

# Filter by framework
GET /api/v1/controls?framework_id={id}

# Get a specific control
GET /api/v1/controls/{controlId}

# Update control status
PATCH /api/v1/controls/{controlId}
Content-Type: application/json
{
  "status": "implemented",
  "implementation_notes": "Implemented via IAM policies"
}
```

### Evidence

```http
# List evidence items
GET /api/v1/evidence

# Upload evidence
POST /api/v1/evidence
Content-Type: multipart/form-data
(file, control_id, title, description)

# Get evidence item
GET /api/v1/evidence/{evidenceId}
```

### Assessments

```http
# List assessments
GET /api/v1/assessments

# Create an assessment
POST /api/v1/assessments
Content-Type: application/json
{
  "control_id": "uuid",
  "depth": "focused",
  "outcome": "satisfied",
  "notes": "Assessment notes",
  "assessor": "user@example.com"
}
```

### Vulnerabilities

```http
# List vulnerabilities
GET /api/v1/vulnerabilities

# Create a vulnerability
POST /api/v1/vulnerabilities
Content-Type: application/json
{
  "title": "CVE-2024-1234",
  "severity": "high",
  "cvss_score": 8.1,
  "description": "...",
  "status": "open"
}
```

## Pagination

All list endpoints support pagination:

```http
GET /api/v1/controls?page=2&per_page=50
```

Response includes pagination metadata:
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 250,
    "page": 2,
    "per_page": 50,
    "total_pages": 5
  }
}
```

## AI Evidence Suggestions (Pending Evidence)

The Pending Evidence API enables AI-powered evidence collection from connected integrations. The AI scans integration data, analyzes it against your organization's active frameworks, maps it to controls, and creates evidence suggestions in a staging area. Users approve or reject each suggestion before it enters the official evidence library.

**Base path**: `/api/v1/pending-evidence`
**Minimum tier**: Pro

### Scan Integrations

Triggers an AI scan of all connected integrations (e.g., Splunk). The AI analyzes recent logs, maps them to framework controls, and creates pending evidence items.

```
POST /api/v1/pending-evidence/scan
```

**Response** (200):
```json
{
  "success": true,
  "message": "AI scan complete — 3 evidence suggestions created for your review.",
  "data": [
    {
      "id": "uuid",
      "ai_title": "Authentication Audit Logs — Access Control Evidence",
      "ai_confidence": 0.87,
      "status": "pending"
    }
  ]
}
```

### List Pending Evidence

```
GET /api/v1/pending-evidence?status=pending
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `pending`, `approved`, or `rejected` (default: `pending`) |

**Response** (200):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "source_type": "splunk",
      "source_summary": "Splunk audit-logs: 42 events",
      "ai_title": "Authentication Audit Logs",
      "ai_description": "Audit trail of user login events for access control compliance...",
      "ai_confidence": 0.87,
      "suggested_controls": ["uuid-1", "uuid-2"],
      "suggested_tags": ["audit-log", "access-control"],
      "status": "pending",
      "created_at": "2026-03-06T12:00:00Z"
    }
  ]
}
```

### Approve Pending Evidence

Promotes a pending evidence item to the official evidence library, writes the payload to disk, links it to the AI-suggested controls, and creates an audit log entry.

```
POST /api/v1/pending-evidence/:id/approve
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `notes` | string | Optional reviewer notes |

**Response** (200):
```json
{
  "success": true,
  "message": "Evidence approved and added to the official evidence library.",
  "data": {
    "pending_id": "uuid",
    "evidence_id": "uuid",
    "file_name": "authentication-audit-logs-2026-03-06.json"
  }
}
```

### Reject Pending Evidence

```
POST /api/v1/pending-evidence/:id/reject
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `notes` | string | Optional rejection reason |

### Get Stats

Returns counts of pending, approved, and rejected evidence items.

```
GET /api/v1/pending-evidence/stats
```

**Response** (200):
```json
{
  "success": true,
  "data": { "pending": 5, "approved": 12, "rejected": 3 }
}
```

## Error Responses

```json
{
  "error": "Validation error",
  "details": "control_id is required"
}
```

| Status Code | Meaning |
|-------------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Internal Server Error |

## Rate Limiting

API requests are rate-limited per organization by IP address. The global limit is configurable via the `API_RATE_LIMIT_MAX` environment variable (default: 2000 requests/minute). Contact your administrator if you need a custom limit for high-volume integrations.

## Related Guides

- [Webhooks Guide](WEBHOOKS.md) - Event-driven integrations
- [Integrations](../guides/INTEGRATIONS.md) - Available integrations
