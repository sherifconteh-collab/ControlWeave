# Fastify Migration — Decision Log

> **Status:** Pending. Decision will be recorded after the spike is executed
> against production-like hardware. See `README.md` for methodology and
> `results/summary.md` for measurements once available.

## Context

ControlWeaver's API is built on Express 4.x. The codebase has ~150 routes
across ~20 route modules, four of which are monoliths tracked under
[FOLLOW_UP_TRACKING.md §4.1](../../FOLLOW_UP_TRACKING.md).

## Options considered

1. **Stay on Express** — status quo. Zero migration cost, known compatibility.
2. **Migrate to Fastify** — higher raw throughput in published benchmarks, but
   requires a mechanical rewrite of every route, middleware, and the
   security header layer in `src/server.js`.
3. **Migrate only hot routes** — polyglot server. Rejected early:
   operational complexity of running two framework stacks in one process
   outweighs any plausible throughput gain.

## Evaluation criteria

A migration is only approved if **all three** hold after running `bench.js`
on the chosen hardware target (Railway standard dyno):

| # | Criterion | Threshold |
| - | --- | --- |
| 1 | Write-route throughput improvement at p95 latency | >= 25% |
| 2 | Read-route p99 latency reduction | >= 15% |
| 3 | Estimated migration cost (assuming 4.1 monolith split already landed) | < 3 engineer-weeks |

Rationale for thresholds:

- **25% / 15%** is the published lower bound of Fastify's claimed advantage
  over Express under comparable workloads. If we cannot reproduce at least
  that on our own representative routes, the migration has no measurable
  value.
- **3 engineer-weeks** is the opportunity-cost budget vs. shipping new
  compliance frameworks and agent features. Beyond that, the project's
  return-on-investment turns negative inside a 6-month planning horizon.

## Decision

*To be filled in after the spike runs:*

- [ ] Date: _YYYY-MM-DD_
- [ ] Outcome: `migrate` / `stay-on-express` / `revisit-in-6mo`
- [ ] Rationale: _one paragraph referencing `results/summary.md`_
- [ ] Tracking issue: _link_

## Revisit trigger

If the answer today is `stay-on-express`, revisit automatically when **any**
of the following becomes true:

1. Hot routes start hitting p99 > 500 ms on production data and profiling
   blames framework overhead (not DB or LLM).
2. The monolith-split refactor (4.1) is complete and per-route migration is
   now cheap enough that the <3 engineer-weeks criterion flips.
3. A security advisory against Express that has no straightforward patch is
   published.
