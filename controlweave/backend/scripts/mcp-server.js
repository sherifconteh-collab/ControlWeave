#!/usr/bin/env node
require('dotenv').config();

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const z = require('zod/v4');

const API_BASE = (process.env.GRC_API_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/+$/, '');
const API_TOKEN = process.env.GRC_API_TOKEN || '';
const HEALTH_URL = process.env.GRC_HEALTH_URL || `${API_BASE.replace(/\/api\/v1$/, '')}/health`;

function toJsonText(payload) {
  return JSON.stringify(payload, null, 2);
}

function ok(payload) {
  return {
    content: [{ type: 'text', text: toJsonText(payload) }]
  };
}

function fail(error) {
  return {
    content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
    isError: true
  };
}

async function apiRequest(method, path, { query, body, auth = true } = {}) {
  const url = new URL(path, `${API_BASE}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }

  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    if (!API_TOKEN) {
      throw new Error('Missing GRC_API_TOKEN. Set it in MCP server environment.');
    }
    headers.Authorization = `Bearer ${API_TOKEN}`;
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const responseText = await response.text();
  let parsed = null;
  try {
    parsed = responseText ? JSON.parse(responseText) : null;
  } catch (error) {
    parsed = { raw: responseText };
  }

  if (!response.ok) {
    const message = parsed?.error || parsed?.message || `${response.status} ${response.statusText}`;
    throw new Error(`API request failed: ${message}`);
  }

  return parsed;
}

async function resolveOrganizationId(providedId) {
  if (providedId) return providedId;
  const me = await apiRequest('GET', '/auth/me');
  const orgId = me?.data?.organization?.id;
  if (!orgId) {
    throw new Error('Could not resolve organization id from /auth/me');
  }
  return orgId;
}

const server = new McpServer({
  name: 'controlweave-mcp',
  version: '1.0.0'
});

server.registerTool('grc_health', {
  description: 'Check AI GRC backend health and database connectivity.',
  inputSchema: {}
}, async () => {
  try {
    const response = await fetch(HEALTH_URL);
    const body = await response.json();
    return ok(body);
  } catch (error) {
    return fail(error);
  }
});

server.registerTool('grc_whoami', {
  description: 'Return current authenticated user, org, roles, and permissions.',
  inputSchema: {}
}, async () => {
  try {
    return ok(await apiRequest('GET', '/auth/me'));
  } catch (error) {
    return fail(error);
  }
});

server.registerTool('grc_list_frameworks', {
  description: 'List available compliance frameworks in the platform catalog.',
  inputSchema: {}
}, async () => {
  try {
    return ok(await apiRequest('GET', '/frameworks'));
  } catch (error) {
    return fail(error);
  }
});

server.registerTool('grc_get_dashboard_stats', {
  description: 'Get dashboard compliance and activity summary stats for the current user org.',
  inputSchema: {}
}, async () => {
  try {
    return ok(await apiRequest('GET', '/dashboard/stats'));
  } catch (error) {
    return fail(error);
  }
});

server.registerTool('grc_list_controls', {
  description: 'List controls for an organization with optional framework/status filtering.',
  inputSchema: {
    organization_id: z.string().uuid().optional().describe('Organization UUID. If omitted, uses current user organization.'),
    framework_id: z.string().uuid().optional().describe('Framework UUID filter.'),
    status: z.string().optional().describe('Implementation status filter (e.g., implemented, in_progress, not_started).')
  }
}, async ({ organization_id, framework_id, status }) => {
  try {
    const orgId = await resolveOrganizationId(organization_id);
    const query = {
      frameworkId: framework_id,
      status
    };
    return ok(await apiRequest('GET', `/organizations/${orgId}/controls`, { query }));
  } catch (error) {
    return fail(error);
  }
});

server.registerTool('grc_update_control_implementation', {
  description: 'Update implementation details for a specific control.',
  inputSchema: {
    control_id: z.string().uuid().describe('Framework control UUID to update.'),
    status: z.string().describe('New status (implemented, in_progress, not_started, planned, etc.).'),
    implementation_details: z.string().optional().describe('Implementation details text.'),
    evidence_url: z.string().optional().describe('Evidence URL or reference.'),
    assigned_to: z.string().optional().describe('Assignee user UUID.'),
    notes: z.string().optional().describe('Additional implementation notes.')
  }
}, async ({ control_id, status, implementation_details, evidence_url, assigned_to, notes }) => {
  try {
    const body = {
      status,
      ...(implementation_details ? { implementationDetails: implementation_details } : {}),
      ...(evidence_url ? { evidenceUrl: evidence_url } : {}),
      ...(assigned_to ? { assignedTo: assigned_to } : {}),
      ...(notes ? { notes } : {})
    };

    return ok(await apiRequest('PUT', `/controls/${control_id}/implementation`, { body }));
  } catch (error) {
    return fail(error);
  }
});

server.registerTool('grc_ai_query', {
  description: 'Run natural-language compliance Q&A against the organization data.',
  inputSchema: {
    question: z.string().min(3).describe('Compliance question to ask.'),
    provider: z.enum(['claude', 'openai', 'gemini', 'grok']).optional().describe('Optional LLM provider override.'),
    model: z.string().optional().describe('Optional model override.')
  }
}, async ({ question, provider, model }) => {
  try {
    const body = {
      question,
      ...(provider ? { provider } : {}),
      ...(model ? { model } : {})
    };
    return ok(await apiRequest('POST', '/ai/query', { body }));
  } catch (error) {
    return fail(error);
  }
});

server.registerTool('grc_list_assessment_procedures', {
  description: 'List assessment procedures with optional filters.',
  inputSchema: {
    framework_code: z.string().optional().describe('Framework code filter.'),
    control_id: z.string().optional().describe('Framework control id filter.'),
    procedure_type: z.string().optional().describe('Procedure type filter.'),
    depth: z.string().optional().describe('Assessment depth filter.'),
    search: z.string().optional().describe('Full-text search term.'),
    limit: z.number().int().min(1).max(200).optional().describe('Max results to return.'),
    offset: z.number().int().min(0).optional().describe('Pagination offset.')
  }
}, async (args) => {
  try {
    return ok(await apiRequest('GET', '/assessments/procedures', { query: args }));
  } catch (error) {
    return fail(error);
  }
});

server.registerTool('grc_list_notifications', {
  description: 'List notifications for the current user.',
  inputSchema: {
    unread: z.boolean().optional().describe('If true, return only unread notifications.'),
    limit: z.number().int().min(1).max(200).optional().describe('Max number of notifications.')
  }
}, async ({ unread, limit }) => {
  try {
    const query = {
      unread: unread ? 'true' : undefined,
      limit
    };
    return ok(await apiRequest('GET', '/notifications', { query }));
  } catch (error) {
    return fail(error);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`AI GRC MCP server running on stdio (API: ${API_BASE})`);
}

main().catch((error) => {
  console.error('MCP server startup failed:', error);
  process.exit(1);
});
