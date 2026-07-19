// @tier: pro
const pool = require('../config/database');
const { encrypt, decrypt } = require('../utils/encrypt');

const GITHUB_SETTING_KEYS = {
  apiToken: 'github_api_token'
};

const GITHUB_API_BASE = 'https://api.github.com';
const EVENT_TYPES = ['code_scanning_alerts', 'dependabot_alerts', 'audit_log', 'pull_requests'];

async function getOrgGithubSettings(organizationId) {
  const result = await pool.query(
    `SELECT setting_value, updated_at
     FROM organization_settings
     WHERE organization_id = $1 AND setting_key = $2`,
    [organizationId, GITHUB_SETTING_KEYS.apiToken]
  );
  if (result.rows.length === 0) return { apiToken: null, updatedAt: null };
  return { apiToken: decrypt(result.rows[0].setting_value), updatedAt: result.rows[0].updated_at };
}

async function saveOrgGithubSettings(organizationId, { apiToken }) {
  if (apiToken === null || apiToken === '') {
    await pool.query(
      'DELETE FROM organization_settings WHERE organization_id = $1 AND setting_key = $2',
      [organizationId, GITHUB_SETTING_KEYS.apiToken]
    );
  } else if (apiToken !== undefined) {
    await pool.query(
      `INSERT INTO organization_settings (organization_id, setting_key, setting_value, is_encrypted, updated_at)
       VALUES ($1, $2, $3, true, NOW())
       ON CONFLICT (organization_id, setting_key)
       DO UPDATE SET setting_value = $3, is_encrypted = true, updated_at = NOW()`,
      [organizationId, GITHUB_SETTING_KEYS.apiToken, encrypt(apiToken)]
    );
  }
  return getOrgGithubSettings(organizationId);
}

function maskToken(token) {
  if (!token) return null;
  const suffix = token.length > 4 ? token.slice(-4) : token;
  return `****${suffix}`;
}

async function githubRequest(config, path, { query } = {}) {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.GITHUB_REQUEST_TIMEOUT_MS || 15000);
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));

  try {
    const url = new URL(path, `${GITHUB_API_BASE}/`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === '') continue;
        url.searchParams.set(key, String(value));
      }
    }

    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (config.apiToken) headers.Authorization = `Bearer ${config.apiToken}`;

    const response = await fetch(url.toString(), { headers, signal: controller.signal });
    const raw = await response.text();
    let parsed;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch (error) {
      throw new Error(`GitHub returned a non-JSON response (${response.status}): ${raw.slice(0, 200)}`);
    }

    if (!response.ok) {
      throw new Error(parsed?.message || `GitHub request failed (${response.status})`);
    }
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

// Unauthenticated calls still work against /rate_limit, so this reports whether
// a token is actually being used rather than requiring one to prove connectivity.
async function testConnection(config) {
  if (!config.apiToken) {
    const info = await githubRequest(config, '/rate_limit');
    return { authenticated: false, rate_limit: info?.rate || null };
  }
  const user = await githubRequest(config, '/user');
  return { authenticated: true, login: user?.login || null, id: user?.id || null };
}

// Splunk-style relative time window ("-24h", "-7d", "-4w"); defaults to 7 days.
function parseRelativeTime(timeRange) {
  const match = /^-?(\d+)([hdw])$/.exec(String(timeRange || '').trim());
  const now = Date.now();
  if (!match) return new Date(now - 7 * 24 * 60 * 60 * 1000);
  const unitMs = { h: 3600000, d: 86400000, w: 604800000 }[match[2]];
  return new Date(now - Number(match[1]) * unitMs);
}

async function fetchEvidence(config, { repository, event_type, time_range, max_results = 30 }) {
  if (!repository || typeof repository !== 'string' || !repository.trim()) {
    throw new Error('repository is required (owner/repo, or an org login for audit_log)');
  }
  const type = EVENT_TYPES.includes(event_type) ? event_type : 'pull_requests';
  const trimmedRepository = repository.trim();
  if (type === 'audit_log') {
    if (!/^[a-zA-Z0-9-_]+$/.test(trimmedRepository)) {
      throw new Error('Invalid organization login format for audit_log (expected a plain GitHub org login)');
    }
  } else if (!/^[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+$/.test(trimmedRepository)) {
    throw new Error('Invalid repository format. Expected "owner/repo"');
  }
  const perPage = Math.max(1, Math.min(100, Number(max_results) || 30));
  const cutoff = parseRelativeTime(time_range);

  if (type === 'code_scanning_alerts') {
    const alerts = await githubRequest(config, `/repos/${trimmedRepository}/code-scanning/alerts`, {
      query: { state: 'open', per_page: perPage }
    });
    const list = Array.isArray(alerts) ? alerts : [];
    return {
      event_type: type,
      results: list
        .filter((a) => !a.created_at || new Date(a.created_at) >= cutoff)
        .map((a) => ({
          number: a.number,
          rule_id: a.rule?.id,
          severity: a.rule?.security_severity_level || a.rule?.severity,
          state: a.state,
          description: a.rule?.description,
          html_url: a.html_url,
          created_at: a.created_at
        }))
    };
  }

  if (type === 'dependabot_alerts') {
    const alerts = await githubRequest(config, `/repos/${trimmedRepository}/dependabot/alerts`, {
      query: { state: 'open', per_page: perPage }
    });
    const list = Array.isArray(alerts) ? alerts : [];
    return {
      event_type: type,
      results: list
        .filter((a) => !a.created_at || new Date(a.created_at) >= cutoff)
        .map((a) => ({
          number: a.number,
          package: a.dependency?.package?.name,
          severity: a.security_advisory?.severity,
          summary: a.security_advisory?.summary,
          state: a.state,
          html_url: a.html_url,
          created_at: a.created_at
        }))
    };
  }

  if (type === 'audit_log') {
    // Audit log is org-scoped, not repo-scoped -- repository is treated as an org login here.
    const events = await githubRequest(config, `/orgs/${trimmedRepository}/audit-log`, {
      query: { per_page: perPage }
    });
    const list = Array.isArray(events) ? events : [];
    return {
      event_type: type,
      results: list
        .filter((e) => !e['@timestamp'] || new Date(e['@timestamp']) >= cutoff)
        .map((e) => ({
          action: e.action,
          actor: e.actor,
          org: e.org,
          repo: e.repo,
          created_at: e['@timestamp'] && !isNaN(Date.parse(e['@timestamp'])) ? new Date(e['@timestamp']).toISOString() : null
        }))
    };
  }

  // pull_requests (default) -- code review / approval evidence
  const prs = await githubRequest(config, `/repos/${trimmedRepository}/pulls`, {
    query: { state: 'all', sort: 'updated', direction: 'desc', per_page: perPage }
  });
  const list = Array.isArray(prs) ? prs : [];
  return {
    event_type: type,
    results: list
      .filter((pr) => !pr.updated_at || new Date(pr.updated_at) >= cutoff)
      .map((pr) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        merged_at: pr.merged_at,
        user: pr.user?.login,
        html_url: pr.html_url,
        updated_at: pr.updated_at
      }))
  };
}

module.exports = {
  GITHUB_SETTING_KEYS,
  EVENT_TYPES,
  getOrgGithubSettings,
  saveOrgGithubSettings,
  maskToken,
  testConnection,
  fetchEvidence
};
