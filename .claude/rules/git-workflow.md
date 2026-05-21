---
description: Git workflow and commit conventions
globs:
  - "**/*"
---
# Git Workflow

## Branch Naming

Format: `<type>/CW-<number>/<short-description>`

- Description: 3–5 lowercase hyphenated words
- Example: `feat/CW-42/add-rmf-dashboard`

Allowed types: feat, fix, hotfix, security, refactor, migration, docs, test, chore, build, ci, perf, revert

## Commit Message Format

```
<type>(<scope>): <description>
```

- **type**: feat, fix, hotfix, security, refactor, migration, docs, test, chore, build, ci, perf, revert
- **scope**: Module area (e.g., rmf, billing, dashboard, auth, cmdb)
- **description**: Imperative mood, lowercase start (e.g., "add RMF lifecycle dashboard")

Examples:
```
feat(rmf): add RMF lifecycle dashboard
fix(billing): resolve Stripe redirect after registration
security(auth): enforce minimum JWT secret length
migration(db): add TOTP 2FA columns to users table
```

## Version Bumping

- `feat/` branches → MINOR bump (x.Y+1.0)
- `fix/`, `hotfix/`, `security/`, `docs/`, `chore/`, `build/`, `ci/`, `perf/`, `test/`, `refactor/`, `migration/`, `revert/` → PATCH bump (x.y.Z+1)
- MAJOR bumps require explicit workflow_dispatch

## Pre-Commit Checklist

Before committing:
1. `npm run check:syntax` in `controlweave/backend/`
2. `npm run typecheck` in `controlweave/frontend/`
3. Verify no hardcoded secrets
4. Verify all new routes use `authenticate` middleware
5. Verify all queries filter by `organization_id`

## Pull Request Requirements

- All CI checks must pass (6 TEVV layers)
- No merge conflicts
- Descriptive PR title matching conventional commit format
