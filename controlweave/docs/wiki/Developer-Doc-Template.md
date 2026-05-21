# Developer Doc Template

Use this template for developer-facing wiki pages.

---

# <Page Title>

Short one-line summary of what this page enables.

## Overview

Describe the feature/system in 3-5 bullets:

- What it does
- Why it exists
- When to use it
- Primary dependencies

## Prerequisites

List required setup before starting.

- Environment access
- Required roles/permissions
- Required services and keys
- Minimum version requirements

## Quickstart

Use numbered steps with clear outcomes.

1. Step one command/action.
2. Step two command/action.
3. Validation step and expected result.

## Configuration

Document settings with defaults and production recommendations.

| Setting | Required | Default | Production Recommendation |
|---------|----------|---------|---------------------------|
| `EXAMPLE_VAR` | Yes | `none` | Set via secret manager |

## Workflows

Describe common workflows.

### Workflow 1: <Name>

- Trigger
- Processing
- Output

### Workflow 2: <Name>

- Trigger
- Processing
- Output

## API or Tool Reference

List key endpoints/tools and expected inputs/outputs.

| Name | Method/Type | Purpose |
|------|-------------|---------|
| `/api/v1/example` | `GET` | Returns example payload |

## Testing

Document how to verify behavior.

- Unit tests
- Integration tests
- Smoke tests
- Expected pass/fail criteria

## Troubleshooting

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| Request fails with 401 | Missing token | Verify auth config |

## Security Notes

List security controls and operational safeguards.

- Secret handling
- Access control boundaries
- Audit log requirements
- Data retention and redaction

## Change Management

- Owner:
- Review Cadence:
- Last Reviewed:
- Approval Required By:

## Related Docs

- [Home](Home)
- [Developer Resources](Developer-Resources)
- Reference index (coming soon)