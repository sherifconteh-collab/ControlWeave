'use strict';

/**
 * Small JSON HTTP client for connectors: SSRF guard on every request (via
 * utils/netGuard, with the connection pinned to the checked address), a
 * per-request timeout so a slow SaaS API cannot hold a
 * request open, and errors that carry the HTTP status but never the response
 * body (which can echo credentials).
 */

const { assertSafeUrl, safeFetch } = require('../../utils/netGuard');

const DEFAULT_TIMEOUT_MS = Math.max(1000, Number(process.env.CONNECTOR_HTTP_TIMEOUT_MS || 20000));

class ConnectorHttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ConnectorHttpError';
    this.status = status;
  }
}

function describeStatus(status) {
  if (status === 401) return 'the credentials were rejected (401)';
  if (status === 403) return 'the credentials lack a required permission (403)';
  if (status === 404) return 'the endpoint was not found (404); check the URL';
  if (status === 429) return 'the service is rate limiting requests (429); try again later';
  return `the service returned HTTP ${status}`;
}

async function requestJson(url, { method = 'GET', headers = {}, body, form, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  await assertSafeUrl(url);
  const init = {
    method,
    headers: { Accept: 'application/json', ...headers },
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs)
  };
  if (form) {
    init.body = new URLSearchParams(form).toString();
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers['Content-Type'] = 'application/json';
  }
  let response;
  try {
    response = await safeFetch(url, init);
  } catch (error) {
    if (error && error.code === 'EPRIVATEHOST') throw new ConnectorHttpError(`${new URL(url).host}: ${error.message}`, 0);
    const reason = error && error.name === 'TimeoutError' ? `timed out after ${timeoutMs}ms` : 'could not be reached';
    throw new ConnectorHttpError(`${new URL(url).host} ${reason}`, 0);
  }
  if (!response.ok) {
    throw new ConnectorHttpError(`${new URL(url).host}: ${describeStatus(response.status)}`, response.status);
  }
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new ConnectorHttpError(`${new URL(url).host} returned a response that is not JSON`, response.status);
    }
  }
  return { status: response.status, headers: response.headers, data };
}

/** Run async tasks with a concurrency cap, preserving order. */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function daysSince(value, now = Date.now()) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? Math.floor((now - time) / 86400000) : null;
}

module.exports = { requestJson, ConnectorHttpError, mapLimit, daysSince };
