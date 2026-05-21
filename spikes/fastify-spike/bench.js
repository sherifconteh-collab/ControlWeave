'use strict';

/**
 * Benchmark harness: runs Express and Fastify apps in isolation and fires
 * autocannon at three representative routes. Writes results/summary.md and
 * results/results.json.
 *
 * Usage:
 *   node bench.js [--duration=60] [--connections=100] [--warmup=10]
 */

const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const autocannon = require('autocannon');

const { signDemoToken } = require('./lib/fixtures');

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  acc[k] = v === undefined ? true : v;
  return acc;
}, {});

const DURATION = parseInt(args.duration || '30', 10);
const CONNECTIONS = parseInt(args.connections || '100', 10);
const WARMUP = parseInt(args.warmup || '5', 10);

const TOKEN = signDemoToken();
const AUTH_HEADERS = { Authorization: `Bearer ${TOKEN}` };

const APPS = [
  { name: 'express', entry: path.join(__dirname, 'apps/express-app.js'), port: 3011 },
  { name: 'fastify', entry: path.join(__dirname, 'apps/fastify-app.js'), port: 3012 },
];

const ROUTES = [
  { key: 'ping',     method: 'GET',  path: '/api/v1/ping',     headers: {}, body: undefined },
  { key: 'controls', method: 'GET',  path: '/api/v1/controls', headers: AUTH_HEADERS, body: undefined },
  {
    key: 'findings',
    method: 'POST',
    path: '/api/v1/findings',
    headers: { ...AUTH_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'spike finding', severity: 'medium', description: 'synthetic' }),
  },
];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function startServer(entry, port) {
  return new Promise((resolve, reject) => {
    const child = fork(entry, [], {
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    let ready = false;
    const onData = (buf) => {
      const line = buf.toString();
      if (!ready && /listening on/.test(line)) {
        ready = true;
        resolve(child);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', reject);
    setTimeout(() => {
      if (!ready) reject(new Error(`Server ${entry} did not start within 5s`));
    }, 5000);
  });
}

function runAutocannon(opts) {
  return new Promise((resolve, reject) => {
    autocannon(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

async function benchApp(app) {
  // eslint-disable-next-line no-console
  console.log(`\n=== ${app.name} ===`);
  const child = await startServer(app.entry, app.port);
  const result = {};
  try {
    for (const route of ROUTES) {
      // eslint-disable-next-line no-console
      console.log(`  ${route.method} ${route.path} (warmup ${WARMUP}s, measure ${DURATION}s, conn=${CONNECTIONS})`);
      // warmup
      await runAutocannon({
        url: `http://127.0.0.1:${app.port}${route.path}`,
        method: route.method,
        headers: route.headers,
        body: route.body,
        connections: CONNECTIONS,
        duration: WARMUP,
        pipelining: 1,
      });
      // Sample child-process RSS every 500ms during the measured window.
      let peakRss = 0;
      const sampler = setInterval(() => {
        try {
          // process.memoryUsage.rss(pid) is not available; fall back to /proc on Linux.
          if (process.platform === 'linux' && child.pid) {
            const fs = require('fs');
            const status = fs.readFileSync(`/proc/${child.pid}/status`, 'utf8');
            const m = status.match(/^VmRSS:\s+(\d+)\s+kB/m);
            if (m) {
              const rssBytes = parseInt(m[1], 10) * 1024;
              if (rssBytes > peakRss) peakRss = rssBytes;
            }
          }
        } catch (_e) { /* sampling is best-effort */ }
      }, 500);
      // measure
      let res;
      try {
        res = await runAutocannon({
          url: `http://127.0.0.1:${app.port}${route.path}`,
          method: route.method,
          headers: route.headers,
          body: route.body,
          connections: CONNECTIONS,
          duration: DURATION,
          pipelining: 1,
        });
      } finally {
        clearInterval(sampler);
      }
      result[route.key] = {
        rps: res.requests.average,
        latency_p50: res.latency.p50,
        latency_p95: res.latency.p95,
        latency_p99: res.latency.p99,
        peak_rss_mb: peakRss > 0 ? +(peakRss / (1024 * 1024)).toFixed(1) : null,
        non2xx: res.non2xx,
        errors: res.errors,
      };
    }
  } finally {
    child.kill('SIGTERM');
    await sleep(250);
  }
  return result;
}

function fmtRow(app, key, r) {
  const rss = r.peak_rss_mb == null ? 'n/a' : r.peak_rss_mb.toFixed(1);
  return `| ${app} | ${key} | ${r.rps.toFixed(0)} | ${r.latency_p50} | ${r.latency_p95} | ${r.latency_p99} | ${rss} | ${r.non2xx} | ${r.errors} |`;
}

async function main() {
  const out = {
    duration_s: DURATION,
    connections: CONNECTIONS,
    warmup_s: WARMUP,
    node: process.version,
    platform: process.platform,
    apps: {},
  };
  for (const app of APPS) {
    out.apps[app.name] = await benchApp(app);
  }

  const resultsDir = path.join(__dirname, 'results');
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(path.join(resultsDir, 'results.json'), JSON.stringify(out, null, 2));

  const lines = [
    '# Fastify Spike — Benchmark Results',
    '',
    `- Node: ${out.node}  Platform: ${out.platform}`,
    `- Warmup: ${WARMUP}s  Measurement: ${DURATION}s  Connections: ${CONNECTIONS}`,
    '',
    '| App | Route | RPS | p50 (ms) | p95 (ms) | p99 (ms) | Peak RSS (MB) | non-2xx | errors |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const app of APPS) {
    for (const route of ROUTES) {
      lines.push(fmtRow(app.name, route.key, out.apps[app.name][route.key]));
    }
  }
  fs.writeFileSync(path.join(resultsDir, 'summary.md'), lines.join('\n') + '\n');

  // eslint-disable-next-line no-console
  console.log('\nWrote results/summary.md and results/results.json');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
