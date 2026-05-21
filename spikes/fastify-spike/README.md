# Fastify Migration Spike

> **Status:** Spike — decision-grade benchmark. Not a migration.
> **Dependency:** Self-contained (`spikes/fastify-spike/`). Not included in the production bundle or CI.

## Purpose

Evaluate whether migrating ControlWeaver's Express.js API to Fastify is worth
the cost. This directory is intentionally isolated so running the spike does
not alter production dependencies.

## Scope

Three representative route shapes are implemented side-by-side in Express
(baseline) and Fastify so throughput, latency, and CPU/memory can be compared
on identical hardware:

1. **`GET /api/v1/ping`** — trivial JSON response (baseline overhead).
2. **`GET /api/v1/controls`** — read-heavy list with JWT auth middleware and
   simulated pg-pool latency (sleep). Approximates the majority of
   `routes/organizations.js` and `routes/controls.js` endpoints.
3. **`POST /api/v1/findings`** — auth-gated write with JSON-schema validation
   and simulated DB insert. Approximates the majority of
   `routes/assessments.js` engagement write endpoints.

Both apps share the same JWT verification logic and the same fake
`pgPool.query` implementation so only the framework overhead varies.

## Running the spike

```bash
cd spikes/fastify-spike
npm install        # installs express, fastify, autocannon locally
npm run bench      # runs both apps and pipes autocannon at each
```

Results are written to `./results/` (gitignored).

## Methodology

- Node.js 20.16+, same process.
- Each app run in isolation (not concurrent). Defaults: 5 second warm-up + 30
  seconds measured at concurrency=100. Override with
  `node bench.js --warmup=30 --duration=60 --connections=100` for the more
  rigorous decision-grade run referenced in `DECISION.md`.
- Autocannon with pipelining 1, keep-alive on.
- Valid JWT signed at process start; the same token is reused across
  requests so signing cost is excluded from the hot path.
- Synthetic pg-pool latency: `await sleep(2ms)` per DB call to approximate
  an in-region Postgres RTT without requiring a live DB.

The bench harness records per-route:

| Metric | Unit | Source |
| --- | --- | --- |
| Throughput | requests/sec | autocannon |
| Latency p50, p95, p99 | ms | autocannon |
| Peak RSS during measurement | MB | sampled `process.memoryUsage().rss` of the child server (every 500ms during the measured window) |

See `bench.js` for the full harness.

## Decision framework

We will recommend **migrate** only if all three hold:

1. Measured throughput gain on the write route >= 25% at p95 latency.
2. Measured p99 latency reduction >= 15% on the read route.
3. Estimated migration cost for the ~150 existing Express routes < 3
   engineer-weeks assuming the monolith-split refactor (4.1) has landed first.

If any fail, recommendation is **stay on Express** and revisit post-monolith-split
when per-route migration is mechanically cheaper.

## Compatibility gaps (preliminary)

| Express feature in use | Fastify equivalent | Gap |
| --- | --- | --- |
| `express.Router()` modular mount | `fastify.register(plugin, { prefix })` | None; refactor required |
| `multer` file uploads | `@fastify/multipart` | API differs; route handlers need rewrite |
| Per-route middleware (`requirePermission`) | `preHandler` hooks | 1:1 mapping |
| `req.user` from `authenticate` middleware | `request.user` via decorator | 1:1 mapping |
| `res.status().json()` | `reply.code().send()` | Mechanical find/replace |
| Error-handling middleware (4-arg) | `setErrorHandler` | 1:1 mapping |
| `res.setHeader` CSP/HSTS in `server.js` | `@fastify/helmet` or `onSend` hook | Migration straightforward |
| `express-rate-limit` | `@fastify/rate-limit` | 1:1 feature parity |

## Non-goals

- Migrating any production route.
- Adding Fastify to `controlweave/backend/package.json`.
- Changing response envelope (`{ success, data }` / `{ error }`).

## Outcome

Fill in after running the spike:

- [ ] Benchmark results recorded in `results/summary.md`
- [ ] Decision logged in `DECISION.md` with date and rationale
- [ ] Tracking issue opened (or closed) for the migration itself
