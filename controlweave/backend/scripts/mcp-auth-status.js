#!/usr/bin/env node
'use strict';

require('dotenv').config();

const {
  getJwtExpiryMs,
  getSessionFilePath,
  isJwtExpiring,
  normalizeApiBaseUrl,
  readSession,
  refreshWithRefreshToken,
  writeSession
} = require('./mcp-auth-session');

async function fetchMe(apiBaseUrl, accessToken, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${apiBaseUrl}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
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
      const error = new Error(message);
      error.status = response.status;
      throw error;
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

function formatRemaining(ms) {
  if (!Number.isFinite(ms)) return 'unknown';
  if (ms <= 0) return 'expired';

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

async function main() {
  const sessionFile = getSessionFilePath(process.env);
  const session = readSession(sessionFile);
  const apiBaseUrl = normalizeApiBaseUrl((session && session.apiBaseUrl) || process.env.GRC_API_BASE_URL || 'http://localhost:3001/api/v1');

  if (!session) {
    console.log('[mcp-status] Not logged in (no MCP session file found).');
    console.log(`[mcp-status] Expected session path: ${sessionFile}`);
    console.log('[mcp-status] Run: npm run mcp:login');
    process.exit(0);
  }

  let accessToken = session.accessToken || null;
  const refreshToken = session.refreshToken || null;

  if ((!accessToken || isJwtExpiring(accessToken, 60000)) && refreshToken) {
    try {
      accessToken = await refreshWithRefreshToken({
        apiBaseUrl,
        refreshToken
      });
      session.accessToken = accessToken;
      const expiryMs = getJwtExpiryMs(accessToken);
      session.accessTokenExpiresAt = expiryMs ? new Date(expiryMs).toISOString() : null;
      writeSession(sessionFile, session);
      console.log('[mcp-status] Access token refreshed.');
    } catch (error) {
      console.log(`[mcp-status] Token refresh failed: ${error.message}`);
    }
  }

  console.log('[mcp-status] MCP session found.');
  console.log(`[mcp-status] Session file: ${sessionFile}`);
  console.log(`[mcp-status] API base: ${apiBaseUrl}`);

  if (session.accessToken) {
    const expiryMs = getJwtExpiryMs(session.accessToken);
    const remaining = expiryMs ? (expiryMs - Date.now()) : NaN;
    console.log(`[mcp-status] Access token: ${remaining > 0 ? 'valid' : 'expired/unknown'} (${formatRemaining(remaining)})`);
  } else {
    console.log('[mcp-status] Access token: missing');
  }

  console.log(`[mcp-status] Refresh token: ${refreshToken ? 'present' : 'missing'}`);

  if (!session.accessToken) {
    console.log('[mcp-status] Identity verification skipped (no access token).');
    process.exit(0);
  }

  try {
    const me = await fetchMe(apiBaseUrl, session.accessToken);
    const user = me?.data || {};
    const org = user.organization || {};

    console.log(`[mcp-status] Authenticated as: ${user.email || session.email || 'unknown'}`);
    console.log(`[mcp-status] Role: ${user.role || session.role || 'unknown'}`);
    console.log(`[mcp-status] Organization: ${org.name || session.organizationName || org.id || session.organizationId || 'unknown'}`);
  } catch (error) {
    if (error.status === 401 && refreshToken) {
      try {
        const newAccessToken = await refreshWithRefreshToken({ apiBaseUrl, refreshToken });
        session.accessToken = newAccessToken;
        const expiryMs = getJwtExpiryMs(newAccessToken);
        session.accessTokenExpiresAt = expiryMs ? new Date(expiryMs).toISOString() : null;
        writeSession(sessionFile, session);

        const me = await fetchMe(apiBaseUrl, session.accessToken);
        const user = me?.data || {};
        const org = user.organization || {};
        console.log('[mcp-status] Access token refreshed after 401.');
        console.log(`[mcp-status] Authenticated as: ${user.email || session.email || 'unknown'}`);
        console.log(`[mcp-status] Role: ${user.role || session.role || 'unknown'}`);
        console.log(`[mcp-status] Organization: ${org.name || session.organizationName || org.id || session.organizationId || 'unknown'}`);
      } catch (retryError) {
        console.log(`[mcp-status] Identity verification failed after refresh: ${retryError.message}`);
      }
    } else {
      console.log(`[mcp-status] Identity verification failed: ${error.message}`);
    }
  }
}

main().catch((error) => {
  console.error(`[mcp-status] FAILED: ${error.message}`);
  process.exit(1);
});
