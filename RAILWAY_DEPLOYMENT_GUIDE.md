# Railway Deployment Guide

Operational reference for deploying ControlWeaver on Railway: service setup,
environment variables, healthcheck configuration, and troubleshooting for
issues that have come up in practice.

## Service Architecture

Railway should run **three services**:

1. **PostgreSQL** — managed Railway PostgreSQL (17+)
2. **Backend** — `controlweave/backend`, Dockerfile build
3. **Frontend** — `controlweave/frontend`, Dockerfile build

Both backend and frontend ship a `Dockerfile`. Each has its own `railway.json`
(`controlweave/backend/railway.json`, `controlweave/frontend/railway.json`
if present) that takes effect once the service's Root Directory is set to
that subfolder — that per-service file is what Railway actually reads, not
the `railway.json` at the repo root.

## Service Type: Web Service, NOT Serverless

**This application must be deployed as a Web Service (container), never
Serverless.** Railway's serverless mode scales the container to zero after
inactivity and queues incoming HTTP requests until it wakes back up. That
queuing only helps request-driven traffic — it does nothing for the
in-process, time-based work this backend depends on:

- **Reminder scheduler** (`src/services/reminderService.js`) — runs on a
  `setInterval` (default every 60 minutes, see `REMINDER_INTERVAL_MINUTES`)
  to send control-review reminders, assessment notifications, and expire
  trials. If the container is asleep, nothing wakes it to run this —
  there's no HTTP request involved, so the scheduler simply stops.
- **Graceful shutdown handling** (SIGTERM/SIGINT close DB pool + scheduler
  cleanly) assumes a long-running process, not frequent cold start/stop
  cycles.
- **Persistent DB connection pool** — pool warm-up/reuse benefits are lost
  on every cold start, and cold starts add connection churn.
- **LLM service cache cleanup** (`src/services/llmService.js`) — also runs
  on a periodic `setInterval`; doesn't run while asleep.

None of this is fixable by "the request queue will wake it eventually" —
these are timers, not request handlers. If cost is the reason serverless
looked appealing, the cost delta for keeping this as an always-on Web
Service is a few dollars/month; that's cheaper than re-architecting around
an external cron trigger or a split API/worker deployment.

Railway's "Metal" (dedicated infrastructure) option is a separate, unrelated
setting — standard containers are sufficient unless you're sustaining
>1000 req/s or need guaranteed CPU/memory; start standard and upgrade only
if you observe consistent >80% memory usage or CPU throttling.

## Deployment Steps

1. **Create the PostgreSQL service** in Railway (managed Postgres 17+).
2. **Create the backend service**:
   - Root Directory: `controlweave/backend`
   - Builder: Dockerfile (auto-detected)
   - Service Type: **Web Service** (not Serverless)
   - Link `DATABASE_URL` from the PostgreSQL service (Settings → Service
     Variables → Reference Variable → select the Postgres service →
     `DATABASE_URL`)
   - Set the remaining required env vars (see table below)
3. **Create the frontend service**:
   - Root Directory: `controlweave/frontend`
   - Builder: Dockerfile (auto-detected)
   - Set `NEXT_PUBLIC_API_URL` to the backend's public URL + `/api/v1`
4. **Deploy** both services and confirm healthchecks pass (see below).
5. **Run migrations.** The backend's `railway.json` already runs
   `npm run migrate` as a `preDeployCommand`, so this happens automatically
   on every deploy. To run manually instead:
   ```bash
   railway run npm run migrate
   ```
6. **Seed reference data** (frameworks/controls/CMDB) if this is a fresh
   database:
   ```bash
   railway run node scripts/seed-frameworks.js
   railway run node scripts/seed-missing-controls.js
   railway run node scripts/seed-cmdb-data.js
   ```
7. **Create the first admin user** and test login end-to-end.
8. **(Optional) Configure custom domains** and update `CORS_ORIGIN`,
   `FRONTEND_URL`, and `NEXT_PUBLIC_API_URL` to match.

### Verify after deploying

```bash
# Backend
curl https://your-backend.up.railway.app/health
# {"status":"healthy","database":{"status":"connected",...},...}

# Frontend
curl https://your-frontend.up.railway.app/health
# {"status":"ok"}
```

Check backend logs for, in order:
- `server.started`
- `reminders.scheduler.started` with `intervalMinutes` — confirms the
  background scheduler is running (this is the thing serverless mode would
  break)
- `reminders.sweep.completed` — appears every time the scheduler fires
- `websocket.initialized`

## Environment Variables

### Backend — required

| Variable | Notes |
|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:port/db?sslmode=require`. Use Railway's service-linking (Reference Variable) rather than pasting manually. Railway Postgres requires SSL. |
| `JWT_SECRET` | ≥32 chars. Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | **Singular**, not `CORS_ORIGINS`. Comma-separated list of allowed origins (see `security.js`), e.g. `https://your-frontend.up.railway.app`. |
| `FRONTEND_URL` | Used for emails/redirects, e.g. `https://your-frontend.up.railway.app` |

`PORT` does not need to be set — Railway injects its own and the app reads
`process.env.PORT`.

### Backend — commonly needed

| Variable | Default | Notes |
|---|---|---|
| `JWT_ACCESS_EXPIRY` | `15m` | |
| `JWT_REFRESH_EXPIRY` | `7d` | |
| `JWT_DEMO_SESSION_EXPIRY` | `8h` | |
| `ENCRYPTION_KEY` | dev fallback only | BYOK API key encryption. Required in production. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `HOST` | `0.0.0.0` | Already defaults correctly in code (`server.js`); no action needed unless overriding. |
| `DEMO_ACCOUNT_PASSWORD` | unset | Only needed if using the public contact/demo-account flow. If unset, that flow still works but credential-delivery emails are skipped and onboarding is marked required — this is not a hard failure. |
| `ENABLE_REMINDERS` | `true` | Set to `false` to disable the background reminder scheduler. (There is no `DISABLE_REMINDER_SCHEDULER` var — that name does not exist in code.) |
| `REMINDER_INTERVAL_MINUTES` | `60` | |
| `WEBAUTHN_RP_NAME` / `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` | — | Required for passkey sign-in. `WEBAUTHN_RP_ID` = bare hostname (no port/protocol); `WEBAUTHN_ORIGIN` = full origin. |
| `EDITION` | `pro` | Informational only in this fork — see `.claude/rules/tier-system.md`; all features are available regardless of value. |
| `REDIS_URL` | unset | Optional; needed only for multi-instance WebSocket scaling. Set `REDIS_REQUIRED=true` to fail fast if it's missing in production. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `FROM_EMAIL` / `FROM_NAME` | unset | Leave `SMTP_HOST` blank to disable email delivery; in-app notifications keep working. |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` / `XAI_API_KEY` / `GROQ_API_KEY` | unset | Optional platform-level LLM keys — BYOK per-org keys can override. |
| `LOG_LEVEL` | — | Not currently read by the logger; safe to omit. |

Full reference (SMTP, backups, Sentry, MCP, CE-MCP sandbox, license keys,
etc.) lives in `controlweave/backend/.env.example` — treat that file as the
source of truth for anything not listed here.

Note: `STRIPE_*` variables still exist in `.env.example` but billing is
stubbed out in this fork (`routes/billing.js` returns `410 Gone` for
checkout/portal) — they don't need to be set for a working deployment.

### Frontend — required

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend's public URL + `/api/v1`, e.g. `https://your-backend.up.railway.app/api/v1` |
| `NODE_ENV` | `production` |

`PORT` is injected by Railway automatically; `HOSTNAME=0.0.0.0` is already
set in the frontend Dockerfile.

### PostgreSQL (auto-provided by Railway)

`DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` are
populated automatically. Link `DATABASE_URL` into the backend service via
Reference Variable rather than copying it manually — it stays in sync if
Railway rotates credentials.

### Setting variables

- **UI**: Service → Variables → New Variable (redeploys automatically)
- **CLI**: `railway variables set KEY=value`, or from a file:
  `railway variables set --file .env.production`
- **Service linking** (for `DATABASE_URL`): Service → Settings → Service
  Variables → Reference Variable → pick the Postgres service → `DATABASE_URL`

## Healthcheck Configuration

Both services expose `GET /health`:

- **Backend** (`server.js`): checks DB connectivity, returns `status`,
  `database`, `memory`, `uptime`. Degrades gracefully — if the DB isn't
  configured/reachable it still responds (doesn't hang), so healthchecks
  don't fail purely due to a transient DB blip.
- **Frontend** (`src/app/health/route.ts`): static `{"status":"ok"}`.

Backend Dockerfile also has a Docker-level `HEALTHCHECK` instruction hitting
the same endpoint, independent of Railway's own healthcheck.

Current `controlweave/backend/railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "preDeployCommand": "npm run migrate",
    "startCommand": "npm run start:prod",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 600,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

Key points:
- `healthcheckTimeout: 600` (10 minutes) — generous, to accommodate the
  `preDeployCommand` migration step running before the app is even
  listening.
- `builder: DOCKERFILE` — do **not** switch this to `NIXPACKS`; the app
  ships hand-written multi-stage Dockerfiles and Nixpacks will not produce
  an equivalent build.
- `restartPolicyType: ON_FAILURE` with 3 retries.

For a from-scratch service without a `railway.json`, use `/health` as the
path and 100–300s as the timeout; the checked-in `600` is intentionally
higher to cover the migration step.

## Troubleshooting

### Reminders / scheduled tasks not running

**Symptom**: control-review reminders, trial expirations, or assessment
notifications don't fire.

**Causes, in order of likelihood**:
1. Service is set to **Serverless** instead of Web Service — see the
   section above; this is the #1 cause.
2. `ENABLE_REMINDERS=false` is set (note: not `DISABLE_REMINDER_SCHEDULER`,
   which isn't a real variable).
3. `REMINDER_INTERVAL_MINUTES` set unexpectedly high.

**Fix**: confirm Service Type = Web Service, unset/remove
`ENABLE_REMINDERS` (or set it to `true`), and check logs for
`reminders.scheduler.started`.

### High cold-start latency on first request

**Symptom**: first request after inactivity takes 5+ seconds.

**Cause**: Serverless mode. **Fix**: switch to Web Service mode.

### Health check fails: "service unavailable" / retries exhausted

```
Attempt #1 failed with service unavailable. Continuing to retry for 1m29s
...
1/1 replicas never became healthy!
```

Work through these in order:

1. **Not binding to `0.0.0.0`.** The app must bind to `0.0.0.0`, not
   `localhost`/`127.0.0.1`. Already handled in code
   (`const HOST = process.env.HOST || '0.0.0.0'`) and in the backend
   Dockerfile (`ENV HOST=0.0.0.0`) — if you've overridden `HOST` in
   Railway variables, unset it.
2. **Frontend not setting `HOSTNAME`.** Next.js standalone server defaults
   to `localhost`. Already set via `ENV HOSTNAME=0.0.0.0` in the frontend
   Dockerfile — don't override it.
3. **Server crashing on startup** before it can bind the port. Check
   deploy logs for module-not-found errors or missing required env vars
   (`DATABASE_URL`, `JWT_SECRET`). A past incident here was a missing
   `src/middleware/auditLog.js` file and a route importing a nonexistent
   `authenticateToken` export instead of `authenticate` — both are fixed
   in the current tree, but the failure mode (module resolution errors
   crashing startup, which then fails every healthcheck attempt) is worth
   recognizing quickly if it recurs after a refactor.
4. **Wrong `PORT` handling.** The app must read `process.env.PORT`
   (Railway injects this) rather than hardcoding a port. Already correct
   in code.
5. **Database unreachable and the health check treats that as fatal.**
   The current `/health` implementation degrades gracefully instead of
   throwing, so this shouldn't cause a healthcheck failure — but if
   `DATABASE_URL` is entirely unset/malformed, verify the response is
   still `200` with a `degraded`/`not_configured` body rather than a
   connection-refused error.
6. **`railway.json` builder mismatch.** Must be `"builder": "DOCKERFILE"`.
   If it's `NIXPACKS` and you're relying on the checked-in Dockerfiles,
   fix the builder — don't add npm build/start commands meant for
   Nixpacks alongside a Dockerfile-based build.
7. **Multi-stage Dockerfile copy issues.** Backend: verify
   `node_modules` and source are copied into the final stage. Frontend:
   verify `.next`/`build/standalone`, `build/static`, and `public` are all
   copied (this repo's frontend Dockerfile copies from `builder`'s
   `build/standalone` and `build/static` — check `next.config.ts` still
   has `output: "standalone"` and that Next's build output directory
   matches what the Dockerfile copies from).

**Local repro before redeploying**:
```bash
cd controlweave/backend
docker build -t backend-test .
docker run -p 3001:3001 -e DATABASE_URL=postgresql://... backend-test
curl http://localhost:3001/health
```

### Database connection errors ("connection pool exhausted", random disconnects)

1. Verify `DATABASE_URL` is set and linked via Reference Variable, not a
   stale copy-pasted string.
2. Confirm `?sslmode=require` is present — Railway Postgres requires SSL.
3. Make sure the service is Web Service mode — serverless cold-start churn
   can look like pool exhaustion under load.
4. Check `DB_POOL_MAX` / `DB_POOL_IDLE_TIMEOUT_MS` /
   `DB_POOL_CONNECT_TIMEOUT_MS` if you've overridden the defaults.

### CORS errors in the browser console

1. Verify `CORS_ORIGIN` (singular — not `CORS_ORIGINS`) includes the exact
   frontend origin, protocol included (`https://...`).
2. Multiple origins are comma-separated in the same variable.
3. Confirm the origin matches the actual Railway/custom domain exactly —
   trailing slashes or protocol mismatches will fail CORS silently.

### JWT / login errors

1. `JWT_SECRET` must be set and stable across restarts/redeploys — if it
   changes, all existing sessions invalidate.
2. Must be ≥32 characters (enforced in production —
   `src/config/security.js` throws on startup otherwise).
3. Check `JWT_ACCESS_EXPIRY` / `JWT_REFRESH_EXPIRY` are valid duration
   strings if overridden.

## Resource Sizing

| Environment | Memory | CPU | Notes |
|---|---|---|---|
| Dev/staging | 512 MB – 1 GB | Shared | Standard container |
| Production (small–medium) | 1–2 GB | Shared (1–2 vCPU) | Standard container |
| Production (high traffic) | 2–4 GB | Dedicated (2–4 vCPU) | Consider Metal only here |

Start standard-tier everywhere; move to Metal only if you observe
sustained >80% memory usage or CPU throttling during peak hours.

## Additional Resources

- [Railway Container Deployments](https://docs.railway.com/deploy/deployments)
- [Railway Environment Variables](https://docs.railway.com/develop/variables)
- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/next-config-js/output)
