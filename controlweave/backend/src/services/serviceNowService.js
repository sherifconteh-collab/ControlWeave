// ITSM connector — queries incidents and change requests. // ip-hygiene:ignore
'use strict';

const { requestJson } = require('./connectors/http');

const PRIORITY_MAP = { '1': 'critical', '2': 'high', '3': 'medium', '4': 'low', '5': 'low' };

function severityFromPriority(priority) {
  return PRIORITY_MAP[String(priority)] || 'medium';
}

// Table API read through the shared connector client: SSRF guard on the
// tenant-supplied instance URL, a timeout, and an error (never an empty
// result) for a non-2xx status or a body that is not JSON.
async function snowRequest(config, table, params) {
  const base = String(config.instanceUrl || '').trim().replace(/\/+$/, '');
  if (!/^[a-z][a-z0-9_]{1,79}$/.test(String(table))) throw new Error('Invalid table name');
  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
  const qs = new URLSearchParams({ sysparm_limit: '200', sysparm_display_value: 'true', ...params }).toString();
  const { data } = await requestJson(`${base}/api/now/table/${table}?${qs}`, { headers: { Authorization: `Basic ${auth}` } });
  if (!data || !Array.isArray(data.result)) throw new Error('The ITSM instance returned an unexpected response');
  return data;
}

async function syncFindings(connectorConfig) {
  try {
    const changeTable = connectorConfig.changeTableName || 'change_request';
    const incidentTable = connectorConfig.incidentTableName || 'incident';
    const findings = [];

    const changes = await snowRequest(connectorConfig, changeTable, {
      sysparm_query: 'stateIN-1^ORstate=3',
      sysparm_fields: 'sys_id,number,short_description,priority,state,opened_at,closed_at'
    });
    for (const c of changes.result || []) {
      findings.push({
        external_id: `change-${c.sys_id}`,
        title: c.short_description || c.number || 'Change Request',
        severity: severityFromPriority(c.priority?.value || c.priority),
        status: String(c.state?.value || c.state) === '3' ? 'resolved' : 'open',
        raw_data: { type: 'change_request', ...c }
      });
    }

    const incidents = await snowRequest(connectorConfig, incidentTable, {
      sysparm_query: 'active=true',
      sysparm_fields: 'sys_id,number,short_description,priority,state,opened_at,resolved_at'
    });
    for (const inc of incidents.result || []) {
      findings.push({
        external_id: `incident-${inc.sys_id}`,
        title: inc.short_description || inc.number || 'Incident',
        severity: severityFromPriority(inc.priority?.value || inc.priority),
        status: String(inc.state?.value || inc.state) === 'Resolved' ? 'resolved' : 'open',
        raw_data: { type: 'incident', ...inc }
      });
    }

    return { findings };
  } catch (error) {
    return { error: error.message, findings: [] };
  }
}

module.exports = { syncFindings };
