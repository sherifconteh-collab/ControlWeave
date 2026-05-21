# Public Mirror Setup

Guide for maintaining the public open-source mirror of ControlWeave at [`sherifconteh-collab/ControlWeave`](https://github.com/sherifconteh-collab/ControlWeave).

## Overview

The Community Edition is mirrored to a public repository under the AGPL v3 license. Enterprise-only features remain in the private `ControlWeaver-Pro` repository.

## Mirror Configuration

The sync process uses `sync-mirror-allowlist.js` to control which files are included in the public mirror.

### Included in Public Mirror

- Core backend routes and middleware
- Frontend application (Community-tier features)
- Database migrations
- Documentation (public-facing guides)
- Seed scripts for framework data

### Excluded from Public Mirror

- Enterprise-only routes and services
- Gov Cloud deployment configurations
- Internal agent configurations (`.openclaw/`)
- Commercial license management code
- Platform admin tooling

## Sync Process

```bash
node controlweave/backend/scripts/sync-mirror-allowlist.js
```

Set `EDITION=community` on the public mirror deployment.
