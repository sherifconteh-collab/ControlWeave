'use strict';

/**
 * Jira connector (Jira Cloud or Data Center).
 *
 * Sync reads remediation tickets with a JQL query and reports open, overdue
 * and recently resolved work as evidence of flaw remediation and POA&M
 * tracking. createIssue opens a ticket for a POA&M item.
 *
 * Config (Cloud):       { baseUrl: 'https://acme.atlassian.net', email, apiToken, projectKey, jql?, issueType? }
 * Config (Data Center): { baseUrl, personalAccessToken, projectKey, jql?, issueType? }
 */

const { requestJson, daysSince } = require('./http');

const FIELDS = 'summary,status,priority,created,updated,duedate,resolutiondate,issuetype';
const PRIORITY_SEVERITY = { highest: 'critical', blocker: 'critical', high: 'high', critical: 'high', medium: 'medium', low: 'low', lowest: 'low', minor: 'low', trivial: 'low' };

function client(config) {
  const base = String(config.baseUrl || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) throw new Error('Jira base URL is required (for example https://acme.atlassian.net)');
  const cloud = Boolean(config.email && config.apiToken);
  if (!cloud && !config.personalAccessToken) throw new Error('Jira credentials are required: email and API token (Cloud) or a personal access token (Data Center)');
  const auth = cloud
    ? `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')}`
    : `Bearer ${config.personalAccessToken}`;
  return { base, cloud, headers: { Authorization: auth } };
}

function defaultJql(config) {
  if (config.jql) return String(config.jql);
  if (!config.projectKey) throw new Error('Set a project key or a JQL query');
  return `project = "${String(config.projectKey).replace(/"/g, '')}" AND (labels = security OR labels = poam OR labels = controlweave) ORDER BY created DESC`;
}

async function search(jira, jql, max) {
  const issues = [];
  if (jira.cloud) {
    let token = null;
    do {
      const url = `${jira.base}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=${FIELDS}&maxResults=100${token ? `&nextPageToken=${encodeURIComponent(token)}` : ''}`;
      const { data } = await requestJson(url, { headers: jira.headers });
      issues.push(...(data.issues || []));
      token = data.isLast === false ? data.nextPageToken : null;
    } while (token && issues.length < max);
  } else {
    let startAt = 0;
    let total = Infinity;
    while (startAt < total && issues.length < max) {
      const url = `${jira.base}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=${FIELDS}&maxResults=100&startAt=${startAt}`;
      const { data } = await requestJson(url, { headers: jira.headers });
      issues.push(...(data.issues || []));
      total = data.total || 0;
      startAt += (data.issues || []).length || 100;
    }
  }
  return issues.slice(0, max);
}

function summarizeIssues(issues, { now = Date.now() } = {}) {
  const findings = [];
  let open = 0;
  let overdue = 0;
  let resolved30 = 0;
  const resolveDays = [];
  for (const issue of issues) {
    const f = issue.fields || {};
    const done = f.status && f.status.statusCategory && f.status.statusCategory.key === 'done';
    const priority = String((f.priority && f.priority.name) || 'medium').toLowerCase();
    if (done) {
      const age = daysSince(f.resolutiondate, now);
      if (age !== null && age <= 30) resolved30 += 1;
      const took = f.resolutiondate && f.created ? (new Date(f.resolutiondate) - new Date(f.created)) / 86400000 : null;
      if (took !== null && took >= 0) resolveDays.push(took);
      continue;
    }
    open += 1;
    const late = f.duedate && daysSince(f.duedate, now) > 0;
    if (late) overdue += 1;
    findings.push({
      severity: late && PRIORITY_SEVERITY[priority] !== 'critical' ? 'high' : (PRIORITY_SEVERITY[priority] || 'medium'),
      rule: late ? 'remediation_overdue' : 'remediation_open',
      resource: issue.key,
      title: `${f.summary || issue.key}${late ? ` (overdue since ${f.duedate})` : ''}`
    });
  }
  const mean = resolveDays.length ? Math.round((resolveDays.reduce((a, b) => a + b, 0) / resolveDays.length) * 10) / 10 : null;
  return {
    findings,
    metrics: { issues_retrieved: issues.length, open, overdue, resolved_last_30_days: resolved30, mean_days_to_resolve: mean }
  };
}

async function syncFindings(config) {
  const jira = client(config);
  const issues = await search(jira, defaultJql(config), Math.min(5000, Number(config.maxIssues) || 2000));
  return summarizeIssues(issues);
}

/** Current status of the given issue keys (for POA&M ticket status refresh). */
async function getStatuses(config, keys) {
  if (!keys.length) return new Map();
  const jira = client(config);
  const jql = `key in (${keys.map((k) => `"${String(k).replace(/"/g, '')}"`).join(',')})`;
  const issues = await search(jira, jql, keys.length);
  return new Map(issues.map((issue) => [issue.key, issue.fields && issue.fields.status ? issue.fields.status.name : null]));
}

function adf(text) {
  return {
    type: 'doc',
    version: 1,
    content: String(text || '').split(/\n{2,}/).filter(Boolean).map((para) => ({ type: 'paragraph', content: [{ type: 'text', text: para }] }))
  };
}

/** Open a ticket; returns { key, url }. */
async function createIssue(config, { summary, description, priority, dueDate, labels = [] }) {
  const jira = client(config);
  if (!config.projectKey) throw new Error('Set a project key on the Jira connector to create tickets');
  const fields = {
    project: { key: String(config.projectKey) },
    issuetype: { name: config.issueType || 'Task' },
    summary: String(summary).slice(0, 250),
    description: jira.cloud ? adf(description) : String(description || ''),
    labels: ['controlweave', ...labels]
  };
  if (dueDate) fields.duedate = dueDate;
  if (priority && config.mapPriority !== false) fields.priority = { name: priority };
  const path = jira.cloud ? '/rest/api/3/issue' : '/rest/api/2/issue';
  let response;
  try {
    response = await requestJson(`${jira.base}${path}`, { method: 'POST', headers: jira.headers, body: { fields } });
  } catch (error) {
    // Projects whose screens do not include priority reject it; retry without.
    if (error.status !== 400 || !fields.priority) throw error;
    delete fields.priority;
    response = await requestJson(`${jira.base}${path}`, { method: 'POST', headers: jira.headers, body: { fields } });
  }
  return { key: response.data.key, url: `${jira.base}/browse/${response.data.key}` };
}

module.exports = { syncFindings, createIssue, getStatuses, summarizeIssues };
