#!/usr/bin/env node
// @tier: exclude
'use strict';

require('dotenv').config();

const path = require('node:path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

function log(message) {
  console.log(`[mcp-test] ${message}`);
}

function getApiBaseUrl() {
  const configured = (process.env.MCP_TEST_API_BASE_URL || process.env.GRC_API_BASE_URL || 'http://localhost:3001/api/v1').trim();
  const normalized = configured.replace(/\/+$/, '');
  return normalized.endsWith('/api/v1') ? normalized : `${normalized}/api/v1`;
}

function getHealthUrl(apiBaseUrl) {
  if (process.env.GRC_HEALTH_URL && process.env.GRC_HEALTH_URL.trim()) {
    return process.env.GRC_HEALTH_URL.trim();
  }
  return `${apiBaseUrl.replace(/\/api\/v1$/, '')}/health`;
}

function extractAccessToken(loginResponse) {
  return loginResponse?.data?.tokens?.accessToken
    || loginResponse?.data?.accessToken
    || null;
}

function extractText(result) {
  if (!result || !Array.isArray(result.content)) return '';
  const textPart = result.content.find((item) => item && item.type === 'text');
  return textPart && typeof textPart.text === 'string' ? textPart.text : '';
}

function parseToolJson(result) {
  const text = extractText(result);
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function loginForToken(apiBaseUrl, email, password) {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const bodyText = await response.text();
  let parsed;

  try {
    parsed = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    parsed = { raw: bodyText };
  }

  if (!response.ok || parsed?.success !== true) {
    const reason = parsed?.error || `${response.status} ${response.statusText}`;
    throw new Error(`Login failed for ${email}: ${reason}`);
  }

  const token = extractAccessToken(parsed);
  if (!token) {
    throw new Error('Login succeeded but no access token was returned.');
  }

  return {
    token,
    userEmail: parsed?.data?.user?.email || email,
    organization: parsed?.data?.organization || null
  };
}

async function closeQuietly(client, transport) {
  try {
    if (client && typeof client.close === 'function') {
      await client.close();
    }
  } catch {
    // no-op
  }

  try {
    if (transport && typeof transport.close === 'function') {
      await transport.close();
    }
  } catch {
    // no-op
  }
}

async function main() {
  const apiBaseUrl = getApiBaseUrl();
  const healthUrl = getHealthUrl(apiBaseUrl);
  const email = (process.env.MCP_TEST_EMAIL || 'admin@enterprise.com').trim().toLowerCase();
  const password = process.env.MCP_TEST_PASSWORD || '';

  if (!password) {
    throw new Error('MCP_TEST_PASSWORD is required. Set it before running this test.');
  }

  log(`API base: ${apiBaseUrl}`);
  log(`Login account: ${email}`);

  const login = await loginForToken(apiBaseUrl, email, password);
  log(`Login succeeded for ${login.userEmail}`);

  const serverScript = path.join(__dirname, 'mcp-server-secure.js');
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverScript],
    env: {
      ...process.env,
      GRC_API_BASE_URL: apiBaseUrl,
      GRC_HEALTH_URL: healthUrl,
      GRC_API_TOKEN: login.token,
      MCP_CLIENT_NAME: process.env.MCP_CLIENT_NAME || 'ControlWeave MCP Smoke Test',
      MCP_CLIENT_VERSION: process.env.MCP_CLIENT_VERSION || '1.0.0'
    },
    stderr: 'pipe',
    cwd: path.join(__dirname, '..')
  });

  if (transport.stderr) {
    transport.stderr.on('data', (chunk) => {
      const line = String(chunk).trim();
      if (!line) return;
      console.error(`[mcp-server] ${line}`);
    });
  }

  const client = new Client({
    name: 'controlweave-mcp-smoke-test',
    version: '1.0.0'
  });

  try {
    await client.connect(transport);
    log('Connected to MCP server over stdio');

    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name);
    log(`Server reported ${toolNames.length} tool(s)`);

    if (!toolNames.includes('grc_whoami')) {
      throw new Error('Expected tool grc_whoami was not registered by the MCP server.');
    }

    const healthResult = await client.callTool({
      name: 'grc_health',
      arguments: {}
    });
    const healthJson = parseToolJson(healthResult);
    log(`grc_health status: ${healthJson?.status || 'unknown'}`);

    const whoamiResult = await client.callTool({
      name: 'grc_whoami',
      arguments: {}
    });
    const whoamiJson = parseToolJson(whoamiResult);
    const mcpEmail = whoamiJson?.data?.email || null;

    if (!mcpEmail) {
      throw new Error('grc_whoami returned no user email.');
    }

    if (mcpEmail.toLowerCase() !== login.userEmail.toLowerCase()) {
      throw new Error(`MCP identity mismatch: expected ${login.userEmail}, got ${mcpEmail}`);
    }

    log(`grc_whoami identity confirmed: ${mcpEmail}`);
    log('MCP connection smoke test passed');
  } finally {
    await closeQuietly(client, transport);
  }
}

main().catch((error) => {
  console.error(`[mcp-test] FAILED: ${error.message}`);
  process.exit(1);
});
