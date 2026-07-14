# Performance Monitoring

Real-time request, database, and system performance monitoring, built for
watching the app on Railway. Backend-only today — there is no admin-UI
dashboard wired up yet (see Limitations).

## How it works

`src/middleware/performanceMonitoring.js` tracks every API request (except
`/health` and `/favicon.ico`) in an in-memory ring buffer of the last 1,000
requests (`src/server.js` installs it globally via
`app.use(performanceTracker)`). Per request it records: timestamp, method,
path, status code, duration (ms, via `process.hrtime.bigint()`), and
`userId`/`organizationId` from `req.user` when present. No request bodies,
headers, or auth material are captured.

From that buffer, `getPerformanceStats()` computes: uptime, total/tracked/
error/slow request counts, error and slow-request rates, average and
p50/p95/p99 response times, a status-code histogram, and the top 10 slowest
endpoints by average duration.

- **Slow request threshold**: >1000ms
- **Error**: status code >= 400

## Endpoints

All under `/api/v1/performance/*`, all gated by `requireAdmin`
(`middleware/auth.js`) and the app-wide API rate limiter. Route file:
`src/routes/performance.js`.

### `GET /api/v1/performance/stats`

Overall stats: uptime, request/error/slow counts and rates, response-time
percentiles, status code distribution, slowest endpoints, memory (RSS/heap),
process info, and DB pool stats + a live `SELECT 1` latency probe.

```json
{
  "success": true,
  "data": {
    "uptime": { "seconds": 3600, "formatted": "1h 0m 0s" },
    "requests": {
      "total": 1500, "tracked": 1000, "errors": 15,
      "errorRate": "1.00%", "slowRequests": 20, "slowRate": "1.33%"
    },
    "responseTime": { "avg": 45.32, "p50": 32.15, "p95": 125.67, "p99": 450.23 },
    "statusCodes": { "200": 1200, "201": 150, "400": 10, "404": 5 },
    "slowestEndpoints": [
      { "endpoint": "POST /api/v1/ai/gap-analysis", "count": 25, "avgDuration": 1250.45 }
    ],
    "memory": { "rss": "256 MB", "heapUsed": "128 MB", "heapTotal": "192 MB" },
    "database": { "total": 20, "idle": 18, "waiting": 0, "latency": "2.5 ms" }
  }
}
```

### `GET /api/v1/performance/requests?limit=50`

Recent request history, most recent first. `limit` defaults to 50, capped at
500 server-side regardless of what's requested.

```json
{
  "success": true,
  "data": {
    "count": 50,
    "requests": [
      {
        "timestamp": "2026-02-15T21:30:00.000Z",
        "method": "GET",
        "path": "/api/v1/controls",
        "statusCode": 200,
        "durationMs": 45.23,
        "userId": "user-123",
        "organizationId": "org-456"
      }
    ]
  }
}
```

### `GET /api/v1/performance/database`

Live-queried, not from the ring buffer: connection pool (`total`/`idle`/
`waiting` from the `pg` pool), a `SELECT 1` latency probe, database size
(`pg_database_size`), active connection count (`pg_stat_activity`), slow
queries (`pg_stat_statements`, filtered to `mean_exec_time > 100`, top 5 —
empty array if the extension isn't enabled), and the 10 largest tables in
`public` schema by total relation size. Every sub-query is wrapped so a
missing permission/extension degrades that one field to `'unavailable'`/`[]`
rather than failing the whole endpoint.

### `GET /api/v1/performance/system`

`process.memoryUsage()` (rss/heapUsed/heapTotal/external/arrayBuffers, raw
bytes + MB), `process.cpuUsage()` (user/system, not wall-clock — these are
cumulative microsecond counters, compare deltas over time rather than
reading a single snapshot as "current load"), process info (pid, uptime,
node version, platform, arch), and environment info including Railway
detection (`isRailway` = `!!process.env.RAILWAY_ENVIRONMENT_NAME`).

## Enhanced `/health` endpoint

`GET /health` (public, no auth) includes DB connectivity + latency, memory
usage, uptime, and Railway environment info when
`RAILWAY_ENVIRONMENT_NAME`/`RAILWAY_SERVICE_ID`/`RAILWAY_DEPLOYMENT_ID` are
set:

```json
{
  "status": "healthy",
  "timestamp": "2026-02-15T21:30:00.000Z",
  "database": { "status": "connected", "latency": "2.5 ms" },
  "memory": { "rss": "256 MB", "heapUsed": "128 MB" },
  "uptime": "3600 seconds",
  "railway": { "environment": "production", "serviceId": "srv-abc123", "deploymentId": "dep-xyz789" },
  "requestId": "req-123456"
}
```

It degrades gracefully rather than throwing when the DB is unreachable (see
`RAILWAY_DEPLOYMENT_GUIDE.md` for how this interacts with Railway
healthchecks).

## Usage examples

```bash
# Health (no auth)
curl https://your-app.railway.app/health

# Stats (admin token required)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-app.railway.app/api/v1/performance/stats

# Slowest endpoints only
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-app.railway.app/api/v1/performance/stats | jq '.data.slowestEndpoints'

# Status code distribution (diagnosing error rate spikes)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-app.railway.app/api/v1/performance/stats | jq '.data.statusCodes'

# Database metrics
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-app.railway.app/api/v1/performance/database

# Poll memory every 5 minutes to spot leaks
while true; do
  curl -H "Authorization: Bearer YOUR_TOKEN" \
    https://your-app.railway.app/api/v1/performance/system | jq '.data.memory'
  sleep 300
done
```

A simple threshold-check cron script:

```bash
#!/bin/bash
STATS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://your-app.railway.app/api/v1/performance/stats)

ERROR_RATE=$(echo "$STATS" | jq -r '.data.requests.errorRate' | sed 's/%//')
P95=$(echo "$STATS" | jq -r '.data.responseTime.p95')

if (( $(echo "$ERROR_RATE > 5.0" | bc -l) )); then
  echo "ALERT: High error rate: $ERROR_RATE%"
fi
if (( $(echo "$P95 > 1000" | bc -l) )); then
  echo "ALERT: Slow response times: p95 = ${P95}ms"
fi
```

## Key metric thresholds

| Metric | Excellent/Healthy | Watch | Investigate |
|---|---|---|---|
| Avg response time | < 100ms | 100-500ms good, 500-1000ms acceptable | > 1000ms |
| Error rate | < 1% | 1-5% | > 5% |
| DB latency | < 10ms | 10-100ms | > 100ms |
| Memory (RSS) | < 512 MB | 512 MB - 1 GB | > 1 GB (possible leak) |
| Slow request rate | < 5% | 5-10% | > 10% |

## Monitoring practices

- Check `/api/v1/performance/stats` regularly (at least daily) and record a
  baseline right after deploy so later regressions are visible against a
  known-good number.
- Watch `slowestEndpoints` for AI operations (gap analysis, crosswalk
  optimizer) and large/uncached queries — these dominate p95/p99 in
  practice.
- Watch `statusCodes` for spikes in 401/403 (auth/permission issues) vs 500
  (server errors) — the two point at very different root causes.
- Poll `system.memory` over time rather than once; a single snapshot can't
  distinguish a leak from normal GC sawtooth.
- Railway's own healthcheck (`/health`) and an external uptime monitor
  (UptimeRobot, Pingdom, etc.) pointed at `/health` are the cheapest way to
  get paged before someone else notices.

## Security

- All `/api/v1/performance/*` endpoints require `requireAdmin`.
- Protected by the same app-wide API rate limiter as everything else under
  `/api/v1/*`.
- No passwords, tokens, API keys, or request bodies are ever captured —
  only method/path/status/duration/user id/org id.
- `/health` is intentionally public (monitoring services need it
  unauthenticated) but only exposes coarse status, not per-request detail.

## Limitations

- Ring buffer holds only the last 1,000 requests; older ones are gone, and
  everything resets to zero on every restart/redeploy — there is no
  persistent history or long-term trend storage.
- `database.slowQueries` and related `pg_stat_statements` data require that
  extension to be enabled; without it the field is just `[]`, not an error.
- No frontend/admin-UI dashboard exists yet — despite `lib/api.ts` being the
  natural place for a `performanceAPI` client, no such client is wired up
  today. Consuming these endpoints currently means `curl`/`fetch` with an
  admin bearer token, or building the dashboard as a follow-up.

## Testing

```bash
cd controlweave/backend
node scripts/test-performance-monitoring.js
```

Validates that the middleware, routes, and enhanced health check are
present and wired up correctly (syntax/integration check, not a live load
test).
