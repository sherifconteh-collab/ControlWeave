# 🪝 Webhooks Guide

Use webhooks to receive real-time event notifications from ControlWeave.

## Overview

Webhooks allow ControlWeave to send HTTP POST requests to your endpoint when specific events occur. Use webhooks to:
- Trigger automated workflows on compliance events
- Sync ControlWeave data with external systems
- Send notifications to Slack, Teams, or custom tools
- Update ticketing systems (Jira, ITSM platforms) on new findings

## Configuring a Webhook

1. Go to **Settings** → **Integrations** → **Webhooks**
2. Click **Add Webhook**
3. Configure:
   - **URL**: Your endpoint URL (must be HTTPS)
   - **Events**: Select which events to subscribe to
   - **Secret**: Optional shared secret for request verification
4. Click **Save**
5. Click **Send Test Event** to verify delivery

## Available Events

### Control Events
| Event | Description |
|-------|-------------|
| `control.compliance_change` | Control implementation status updated |
| `control.inheritance.triggered` | Control inheritance triggered across frameworks |

### POA&M Events
| Event | Description |
|-------|-------------|
| `poam.item.created` | New POA&M item created |
| `poam.item.created_from_vulnerability` | POA&M item created from a vulnerability |
| `poam.item.updated` | POA&M item updated |
| `poam.item.note_added` | Note added to a POA&M item |
| `poam.submitted_for_review` | POA&M submitted for auditor review |
| `poam.auditor_reviewed` | POA&M reviewed by auditor |

### Exception Events
| Event | Description |
|-------|-------------|
| `exception.created` | New exception request created |
| `exception.updated` | Exception request updated |
| `exception.approved` | Exception request approved |
| `exception.revoked` | Exception revoked |

### Integration Events
| Event | Description |
|-------|-------------|
| `integration.connector.created` | New integration connector configured |
| `integration.connector.updated` | Integration connector updated |
| `integration.connector.deleted` | Integration connector deleted |
| `integration.connector.run` | Integration connector executed |

### System Events
| Event | Description |
|-------|-------------|
| `webhook.test` | Test event (sent via **Send Test Event**) |

## Webhook Payload Format

Each delivery is a JSON object with the following structure:

```json
{
  "id": "delivery-uuid",
  "event": "control.compliance_change",
  "organization_id": "org-uuid",
  "payload": {
    "control_id": "control-uuid",
    "control_identifier": "AC-6",
    "previous_status": "not_implemented",
    "new_status": "implemented",
    "changed_by": "user@example.com"
  },
  "created_at": "2026-03-05T10:30:00.000Z"
}
```

> **Note:** The `payload` field contains the event-specific data. Its shape varies by event type.

## Verifying Webhook Signatures

If you configured a signing secret, ControlWeave signs each request with HMAC-SHA256. The following headers are included on every delivery:

| Header | Description |
|--------|-------------|
| `X-GRC-Event` | The event type (e.g., `control.compliance_change`) |
| `X-GRC-Delivery-ID` | Unique delivery UUID |
| `X-GRC-Signature-SHA256` | HMAC-SHA256 hex digest of the request body (present only when a signing secret is configured) |

Verify in Node.js:
```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// Usage in an Express handler:
app.post('/webhooks/controlweave', (req, res) => {
  const sig = req.headers['x-grc-signature-sha256'];
  const raw = JSON.stringify(req.body);
  if (!verifySignature(raw, sig, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  // process event …
});
```

## Retry Policy

If your endpoint returns a non-2xx status or times out (default 15 s):
- ControlWeave retries with **exponential backoff**: 2^*attempt* minutes, capped at 60 minutes (i.e., 2 min → 4 min → 8 min → 16 min → 32 min → 60 min …)
- Failed deliveries remain in `failed` status and are retried automatically whenever the delivery queue is processed
- You can manually trigger queue processing via **POST** `/api/v1/webhooks/process`

View delivery history and retry failed deliveries in **Settings** → **Integrations** → **Webhooks** → **Delivery History**

## Example: Jira Integration

Create Jira tickets automatically when new POA&M items are created:

```javascript
app.post('/webhooks/controlweave', (req, res) => {
  const delivery = req.body;
  
  if (delivery.event === 'poam.item.created') {
    createJiraTicket({
      summary: `POA&M Item: ${delivery.payload.title || delivery.payload.id}`,
      description: delivery.payload.description || '',
      priority: delivery.payload.risk_level || 'medium',
      labels: ['compliance', 'poam']
    });
  }
  
  res.status(200).send('OK');
});
```

## Related Guides

- [API Documentation](API_DOCS.md) - REST API reference
- [Integrations](../guides/INTEGRATIONS.md) - All integration options
- [Splunk Integration](SPLUNK.md) - SIEM integration
