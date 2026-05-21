#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tls = require('node:tls');

// Enforce TLS 1.2 minimum for all outbound connections from this process.
// Node.js 18+ already defaults to TLSv1.2, but we set it explicitly for
// auditability and CNSA Suite / STIG APSC-DV-000240 compliance.
// Setting DEFAULT_MIN_VERSION to 'TLSv1.2' means TLSv1.2 and TLSv1.3 are
// both accepted; it does NOT downgrade a TLSv1.3-only server.
tls.DEFAULT_MIN_VERSION = 'TLSv1.2';

function normalizeApiBaseUrl(value) {
  const configured = String(value || 'http://localhost:3001/api/v1').trim().replace(/\/+$/, '');
  const url = configured.endsWith('/api/v1') ? configured : `${configured}/api/v1`;

  // In production, disallow plain HTTP for non-localhost endpoints.
  // Bearer tokens MUST NOT be transmitted in cleartext.
  if (process.env.NODE_ENV === 'production' && url.startsWith('http://')) {
    const isLocal = /^http:\/\/(localhost|127\.0\.0\.1|\[?::1\]?)(:\d+)?(\/|$)/.test(url);
    if (!isLocal) {
      throw new Error(
        `[SECURITY] MCP API base URL must use HTTPS in production. ` +
        `Received: ${url} — set GRC_API_BASE_URL to an https:// endpoint.`
      );
    }
  }

  return url;
}

function getDefaultSessionFile() {
  return path.join(os.homedir(), '.controlweave', 'mcp-session.json');
}

function getSessionFilePath(env = process.env) {
  const override = String(env.GRC_MCP_SESSION_FILE || '').trim();
  if (!override) return getDefaultSessionFile();
  return path.resolve(override);
}

function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function getJwtExpiryMs(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return null;
  return payload.exp * 1000;
}

function isJwtExpiring(token, leewayMs = 60000) {
  const expiryMs = getJwtExpiryMs(token);
  if (!expiryMs) return false;
  return Date.now() >= (expiryMs - Math.max(0, Number(leewayMs) || 0));
}

function readSession(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      apiBaseUrl: parsed.apiBaseUrl ? normalizeApiBaseUrl(parsed.apiBaseUrl) : null,
      accessToken: parsed.accessToken || null,
      refreshToken: parsed.refreshToken || null,
      email: parsed.email || null,
      userId: parsed.userId || null,
      organizationId: parsed.organizationId || null,
      organizationName: parsed.organizationName || null,
      role: parsed.role || null,
      accessTokenExpiresAt: parsed.accessTokenExpiresAt || null,
      createdAt: parsed.createdAt || null,
      updatedAt: parsed.updatedAt || null
    };
  } catch {
    return null;
  }
}

function writeSession(filePath, session) {
  const normalizedPath = path.resolve(filePath || getDefaultSessionFile());
  const dir = path.dirname(normalizedPath);
  fs.mkdirSync(dir, { recursive: true });

  const payload = {
    apiBaseUrl: normalizeApiBaseUrl(session.apiBaseUrl),
    accessToken: session.accessToken || null,
    refreshToken: session.refreshToken || null,
    email: session.email || null,
    userId: session.userId || null,
    organizationId: session.organizationId || null,
    organizationName: session.organizationName || null,
    role: session.role || null,
    accessTokenExpiresAt: session.accessTokenExpiresAt || (session.accessToken ? new Date(getJwtExpiryMs(session.accessToken) || Date.now()).toISOString() : null),
    createdAt: session.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(normalizedPath, JSON.stringify(payload, null, 2), { mode: 0o600 });
  return normalizedPath;
}

function clearSession(filePath) {
  const normalizedPath = path.resolve(filePath || getDefaultSessionFile());
  if (fs.existsSync(normalizedPath)) {
    fs.unlinkSync(normalizedPath);
    return true;
  }
  return false;
}

async function requestJson(url, { method = 'GET', headers = {}, body, timeoutMs = 15000 } = {}) {
  // Warn if sending over plain HTTP with an Authorization header (tokens in transit)
  const hasAuthHeader = Object.keys(headers).some((k) => k.toLowerCase() === 'authorization');
  if (hasAuthHeader && String(url).startsWith('http://')) {
    const isLocal = /^http:\/\/(localhost|127\.0\.0\.1|\[?::1\]?)(:\d+)?(\/|$)/.test(url);
    if (!isLocal) {
      console.error('[SECURITY WARNING] Sending Authorization token over plain HTTP to a non-localhost host. Set GRC_API_BASE_URL to an https:// endpoint.');
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      signal: controller.signal,
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    const text = await response.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }

    if (!response.ok) {
      const message = parsed?.error || parsed?.message || `${response.status} ${response.statusText}`;
      throw new Error(message);
    }

    return parsed;
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function loginWithPassword({ apiBaseUrl, email, password, timeoutMs = 15000 }) {
  const base = normalizeApiBaseUrl(apiBaseUrl);
  const response = await requestJson(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { email, password },
    timeoutMs
  });

  if (response?.success !== true) {
    throw new Error(response?.error || 'Login failed');
  }

  const data = response?.data || {};
  const user = data.user || {};
  const organization = data.organization || {};
  const tokens = data.tokens || {};

  if (!tokens.accessToken || !tokens.refreshToken) {
    throw new Error('Login succeeded but tokens were not returned.');
  }

  return {
    apiBaseUrl: base,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    email: user.email || String(email || '').toLowerCase(),
    userId: user.id || null,
    organizationId: organization.id || user.organization_id || null,
    organizationName: organization.name || null,
    role: user.role || null,
    accessTokenExpiresAt: (() => {
      const expiry = getJwtExpiryMs(tokens.accessToken);
      return expiry ? new Date(expiry).toISOString() : null;
    })()
  };
}

async function refreshWithRefreshToken({ apiBaseUrl, refreshToken, timeoutMs = 15000 }) {
  const base = normalizeApiBaseUrl(apiBaseUrl);
  const response = await requestJson(`${base}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { refreshToken },
    timeoutMs
  });

  if (response?.success !== true || !response?.data?.accessToken) {
    throw new Error(response?.error || 'Token refresh failed');
  }

  return response.data.accessToken;
}

module.exports = {
  clearSession,
  getDefaultSessionFile,
  getJwtExpiryMs,
  getSessionFilePath,
  isJwtExpiring,
  loginWithPassword,
  normalizeApiBaseUrl,
  readSession,
  refreshWithRefreshToken,
  writeSession
};
