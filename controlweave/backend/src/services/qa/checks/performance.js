'use strict';

// The endpoints behind the pages users open most. Each is requested twice and
// the faster time is kept, so one cold-cache request does not fail the check.
const ENDPOINTS = Object.freeze([
  ['Dashboard overview', '/dashboard/overview'],
  ['Compliance summary', '/dashboard/compliance-summary'],
  ['Controls list', '/implementations?limit=50'],
  ['Evidence list', '/evidence?limit=50'],
  ['Risk register', '/risks?limit=50'],
  ['Frameworks', '/frameworks'],
  ['Audit log', '/audit/logs?limit=50'],
  ['Vendors', '/tprm/vendors']
]);
const WARN_MS = 1000;
const FAIL_MS = 5000;

module.exports = [
  {
    id: 'performance.core_endpoints',
    suite: 'performance',
    title: 'Core pages respond quickly',
    description: `Times the API behind the most-used pages (warn above ${WARN_MS}ms, fail above ${FAIL_MS}ms).`,
    async run(ctx) {
      const timings = [];
      const errors = [];
      for (const [label, path] of ENDPOINTS) {
        let best = Infinity;
        let lastStatus = null;
        for (let i = 0; i < 2; i++) {
          const response = await ctx.api.get(path);
          lastStatus = response.status;
          best = Math.min(best, response.ms);
        }
        if (lastStatus !== 200) errors.push(`${label} (HTTP ${lastStatus})`);
        timings.push({ label, path, ms: best });
      }
      const slowest = [...timings].sort((a, b) => b.ms - a.ms);
      const metrics = { timings };
      const summary = slowest.slice(0, 4).map((t) => `${t.label} ${t.ms}ms`).join(', ');
      if (errors.length) return { status: 'fail', detail: `Endpoints returned errors: ${errors.join(', ')}.`, metrics };
      if (slowest[0].ms > FAIL_MS) return { status: 'fail', detail: `Slowest: ${summary}.`, remediation: 'Check database sizing and indexes; report to support with the run export.', metrics };
      if (slowest[0].ms > WARN_MS) return { status: 'warn', detail: `Slowest: ${summary}.`, remediation: 'Responses above 1s make pages feel slow; check database latency and instance size.', metrics };
      return { status: 'pass', detail: `All ${timings.length} core endpoints under ${WARN_MS}ms (slowest: ${summary}).`, metrics };
    }
  }
];
