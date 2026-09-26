'use strict';

/**
 * Loopback client for functional self-test checks. Calls this server's own
 * public API with the tester's bearer token, so each check exercises the same
 * middleware, permissions, validation and audit logging a user's browser
 * does. Requests carry X-QA-Run so they can be told apart in logs.
 */

const REQUEST_TIMEOUT_MS = 20000;

function baseUrl() {
  const explicit = process.env.QA_API_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  return `http://127.0.0.1:${process.env.PORT || 3001}/api/v1`;
}

function createApiClient({ authorization, runId }) {
  async function request(method, path, { json, form, raw = false } = {}) {
    const headers = { Authorization: authorization, 'X-QA-Run': runId };
    let body;
    if (form) body = form;
    else if (json !== undefined) {
      body = JSON.stringify(json);
      headers['Content-Type'] = 'application/json';
    }
    const started = Date.now();
    const response = await fetch(`${baseUrl()}${path}`, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    const ms = Date.now() - started;
    let data;
    if (raw) data = Buffer.from(await response.arrayBuffer());
    else data = await response.json().catch(() => ({}));
    return { status: response.status, ok: response.ok, data, ms, headers: response.headers };
  }

  return {
    get: (path, options) => request('GET', path, options),
    post: (path, json, options = {}) => request('POST', path, { ...options, json }),
    postForm: (path, form) => request('POST', path, { form }),
    put: (path, json) => request('PUT', path, { json }),
    patch: (path, json) => request('PATCH', path, { json }),
    delete: (path) => request('DELETE', path)
  };
}

module.exports = { createApiClient };
