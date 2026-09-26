'use strict';

/**
 * Workday: Report-as-a-Service (RaaS). An integration system user (ISU) runs
 * custom reports that Workday exposes as REST endpoints, read here as JSON
 * (?format=json returns { Report_Entry: [...] }).
 *
 * Build the reports with these column aliases (Column Heading Override XML
 * Alias):
 *   users report (required): username, full_name, email, department, manager,
 *     status (Active/Inactive or true/false), last_login_at, end_date, and
 *     optionally roles (the user's security groups, multi-instance)
 *   assignments report (optional, instead of a roles column): username, role_name
 *   permissions report (optional): role_name, permission (for example the
 *     domain security policies a security group has Modify or Put access to),
 *     mapped to business functions through the system's function map
 *
 * Settings: usersReportUrl, assignmentsReportUrl?, permissionsReportUrl?,
 * username, password (the ISU).
 */

const { requestJson } = require('../../connectors/http');
const { text, list, status, basicAuth, requireSettings } = require('./shared');

function jsonUrl(raw) {
  // https is enforced by the outbound guard in requestJson.
  const url = new URL(String(raw).trim());
  url.searchParams.set('format', 'json');
  return url.toString();
}

async function report(config, url) {
  const { data } = await requestJson(jsonUrl(url), { headers: { Authorization: basicAuth(config.username, config.password) }, timeoutMs: 120000 });
  if (!data || !Array.isArray(data.Report_Entry)) throw new Error('The Workday report did not return Report_Entry rows; check the report URL and that it is web-service enabled');
  return data.Report_Entry;
}

async function fetchExtract(config) {
  requireSettings(config, ['usersReportUrl', 'username', 'password']);
  const entries = await report(config, config.usersReportUrl);
  const users = [];
  const assignments = [];
  for (const entry of entries) {
    const username = text(entry.username);
    if (!username) continue;
    users.push({
      username,
      full_name: text(entry.full_name),
      email: text(entry.email),
      department: text(entry.department),
      manager: text(entry.manager),
      status: status(entry.status),
      last_login_at: text(entry.last_login_at),
      end_date: text(entry.end_date)
    });
    for (const role of list(entry.roles)) assignments.push({ username, role_name: role });
  }
  if (config.assignmentsReportUrl) {
    for (const entry of await report(config, config.assignmentsReportUrl)) {
      const username = text(entry.username);
      const role = text(entry.role_name);
      if (username && role) assignments.push({ username, role_name: role });
    }
  }
  const extract = { users, assignments };
  if (config.permissionsReportUrl) {
    extract.role_permissions = (await report(config, config.permissionsReportUrl))
      .map((entry) => ({ role_name: text(entry.role_name), permission: text(entry.permission) }))
      .filter((row) => row.role_name && row.permission);
  }
  // A RaaS report returns every row in one response; there is no paging to
  // cut it short. An empty role set is caught by the sync's completeness check.
  return { ...extract, complete: true, total: { users: users.length }, incompleteReason: null };
}

module.exports = { fetchExtract, jsonUrl };
