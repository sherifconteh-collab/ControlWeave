# MCP Authentication Migration Guide

This guide helps existing users migrate to the current **login-based MCP authentication** model in ControlWeave.

## What Changed

ControlWeave MCP now requires an authenticated user session for all users, including admins.

- Required: `npm run mcp:login`
- Optional checks: `npm run mcp:status`
- Sign out: `npm run mcp:logout`

Environment-token based MCP authentication (`GRC_API_TOKEN`, `MCP_LOGIN_EMAIL`, `MCP_LOGIN_PASSWORD`) is no longer used by the MCP runtime auth path.

## Who Should Migrate

- Existing users who previously started MCP with token/env-only auth
- Teams with shared MCP startup scripts
- Admin users (same flow as all users)

## Migration Steps

From `controlweave/backend`:

```bash
npm run mcp:logout
npm run mcp:login
npm run mcp:status
npm run mcp
```

Expected status output should show:

- session file path
- authenticated email
- role
- organization

## VS Code MCP Config

Use the workspace config in `.vscode/mcp.json` and keep MCP auth user-session based.

No token env variables are required in the MCP server config for normal user operation.

## Team Rollout Checklist

1. Announce migration window and expected local re-login.
2. Ask users to run `npm run mcp:logout` once.
3. Ask users to run `npm run mcp:login` with their own account.
4. Verify with `npm run mcp:status`.
5. Start MCP and validate basic calls (`grc_whoami`, `grc_health`).

## Troubleshooting

### `No MCP authentication found`

Run:

```bash
npm run mcp:login
```

### `Invalid token`

Run:

```bash
npm run mcp:logout
npm run mcp:login
npm run mcp:status
```

### Login succeeds but MCP calls fail

Check backend health:

```bash
curl http://localhost:3001/health
```

Ensure `GRC_API_BASE_URL` points to the same backend used for login.

## Security Notes

- Per-user login preserves attribution and RBAC in MCP operations.
- Admin users are intentionally not exempt from login-based MCP auth.
- Do not share session files between users.
