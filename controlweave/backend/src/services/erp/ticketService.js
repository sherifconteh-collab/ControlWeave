'use strict';

/**
 * Revocation tickets for access review decisions.
 *
 * When a reviewer decides that access must be removed, the removal happens in
 * the ERP, usually by a security administrator working from a ticket. A system
 * linked to a ticketing connector (Jira, or the ITSM connector) opens one
 * ticket per revoked user, records its key on the review item and keeps its
 * status current; the removal itself is still verified from the next
 * entitlement import, not from the ticket being closed.
 */

const pool = require('../../config/database');
const connectors = require('../connectors');
const jira = require('../connectors/jira');
const { requestJson, mapLimit } = require('../connectors/http');
const { log, serializeError } = require('../../utils/logger');

const ITSM = 'servicenow'; // ip-hygiene:ignore -- connector type key
const TICKET_CONNECTOR_TYPES = Object.freeze(['jira', ITSM]);
const MAX_TICKETS_PER_CALL = 500;

// ---------------------------------------------------------------- ITSM table API

function itsmClient(config) {
  const base = String(config.instanceUrl || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) throw new Error('The ITSM instance URL must start with https://');
  if (!config.username || !config.password) throw new Error('The ITSM connector needs a username and password');
  const table = String(config.revocationTableName || 'incident');
  if (!/^[a-z][a-z0-9_]{1,79}$/.test(table)) throw new Error('Invalid ITSM table name');
  return { base, table, headers: { Authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}` } };
}

async function itsmCreate(config, { summary, description }) {
  const itsm = itsmClient(config);
  const { data } = await requestJson(`${itsm.base}/api/now/table/${itsm.table}`, {
    method: 'POST', headers: itsm.headers, body: { short_description: summary.slice(0, 160), description }
  });
  const record = (data && data.result) || {};
  if (!record.number) throw new Error('The ITSM instance did not return a record number');
  return { key: record.number, url: `${itsm.base}/nav_to.do?uri=${encodeURIComponent(`${itsm.table}.do?sys_id=${record.sys_id}`)}` };
}

async function itsmStatuses(config, keys) {
  const itsm = itsmClient(config);
  const query = new URLSearchParams({
    sysparm_query: `numberIN${keys.map((k) => String(k).replace(/[^A-Za-z0-9]/g, '')).join(',')}`,
    sysparm_fields: 'number,state',
    sysparm_display_value: 'true',
    sysparm_limit: String(keys.length)
  });
  const { data } = await requestJson(`${itsm.base}/api/now/table/${itsm.table}?${query}`, { headers: itsm.headers });
  return new Map(((data && data.result) || []).map((r) => [r.number, typeof r.state === 'object' ? r.state.display_value : r.state]));
}

// ---------------------------------------------------------------- dispatch

async function ticketConnector(organizationId, connectorId) {
  const { rows: [row] } = await pool.query(
    'SELECT * FROM integration_connectors WHERE id = $1 AND organization_id = $2 AND connector_type = ANY($3::text[])',
    [connectorId, organizationId, TICKET_CONNECTOR_TYPES]
  );
  return row ? { row, config: connectors.runtimeConfig(row) } : null;
}

function describe(item, review) {
  const roles = item.roles_to_revoke && item.roles_to_revoke.length ? item.roles_to_revoke.join(', ') : 'all access (see notes)';
  const decided = item.decided_at ? new Date(item.decided_at).toISOString().slice(0, 10) : 'recently';
  return {
    summary: `Remove ${review.system_name} access for ${item.username}`,
    description: [
      `Access review "${review.name}" decided on ${decided} that ${item.username}${item.snapshot && item.snapshot.full_name ? ` (${item.snapshot.full_name})` : ''} should lose access in ${review.system_name}.`,
      `Roles to remove: ${roles}.`,
      item.notes ? `Reviewer notes: ${item.notes}` : '',
      'ControlWeave confirms the removal from the next entitlement import of this system; closing this ticket alone does not verify it.'
    ].filter(Boolean).join('\n\n')
  };
}

async function openTicket(connector, text) {
  if (connector.row.connector_type === 'jira') return jira.createIssue(connector.config, { ...text, labels: ['access-revocation'] });
  return itsmCreate(connector.config, text);
}

/**
 * Open tickets for revoked items of a review that have none yet. Returns
 * { created, failed, skipped }.
 */
async function createForReview(organizationId, reviewId) {
  const { rows: [review] } = await pool.query(
    `SELECT rv.*, s.name AS system_name, s.ticket_connector_id
       FROM erp_access_reviews rv JOIN erp_systems s ON s.id = rv.system_id
      WHERE rv.id = $1 AND rv.organization_id = $2`,
    [reviewId, organizationId]
  );
  if (!review) return null;
  if (!review.ticket_connector_id) return { created: 0, failed: 0, skipped: 0, reason: 'No ticketing connector is linked to this system' };
  const connector = await ticketConnector(organizationId, review.ticket_connector_id);
  if (!connector) return { created: 0, failed: 0, skipped: 0, reason: 'The linked ticketing connector no longer exists' };
  // One ticket run per review at a time: completing a review while someone
  // clicks "Open revocation tickets" must not open two tickets per user.
  const lockClient = await pool.connect();
  try {
    const { rows: [lock] } = await lockClient.query('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [`erp-tickets:${reviewId}`]);
    if (!lock.ok) return { created: 0, failed: 0, skipped: 0, reason: 'Tickets for this review are already being opened' };
    return await openTickets(organizationId, review, connector);
  } finally {
    await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [`erp-tickets:${reviewId}`]).catch(() => {});
    lockClient.release();
  }
}

async function openTickets(organizationId, review, connector) {
  const { rows: items } = await pool.query(
    `SELECT * FROM erp_access_review_items
      WHERE review_id = $1 AND organization_id = $2 AND decision = 'revoke' AND ticket_key IS NULL AND revocation_verified_at IS NULL
      ORDER BY username LIMIT ${MAX_TICKETS_PER_CALL}`,
    [review.id, organizationId]
  );
  const results = await mapLimit(items, 4, async (item) => {
    try {
      const ticket = await openTicket(connector, describe(item, review));
      await pool.query(
        `UPDATE erp_access_review_items
            SET ticket_connector_id = $3, ticket_key = $4, ticket_url = $5, ticket_status = 'open',
                ticket_created_at = NOW(), ticket_synced_at = NOW(), ticket_error = NULL
          WHERE id = $1 AND organization_id = $2`,
        [item.id, organizationId, connector.row.id, String(ticket.key).slice(0, 100), String(ticket.url).slice(0, 1000)]
      );
      return true;
    } catch (error) {
      await pool.query('UPDATE erp_access_review_items SET ticket_error = $3 WHERE id = $1 AND organization_id = $2',
        [item.id, organizationId, String(error.message || 'Ticket creation failed').slice(0, 500)]);
      return false;
    }
  });
  const created = results.filter(Boolean).length;
  return { created, failed: results.length - created, skipped: 0 };
}

/** Refresh the status of open revocation tickets for a system. Returns how many were updated. */
async function refreshStatuses(organizationId, systemId) {
  const { rows } = await pool.query(
    `SELECT i.id, i.ticket_key, i.ticket_connector_id
       FROM erp_access_review_items i JOIN erp_access_reviews rv ON rv.id = i.review_id
      WHERE rv.system_id = $1 AND i.organization_id = $2 AND i.ticket_key IS NOT NULL
        AND i.ticket_connector_id IS NOT NULL
        -- Keep following a ticket for a while after the removal is verified,
        -- so its closure is recorded too.
        AND (i.revocation_verified_at IS NULL OR i.revocation_verified_at > NOW() - INTERVAL '30 days')
      LIMIT 1000`,
    [systemId, organizationId]
  );
  let updated = 0;
  const byConnector = new Map();
  for (const row of rows) byConnector.set(row.ticket_connector_id, [...(byConnector.get(row.ticket_connector_id) || []), row]);
  for (const [connectorId, items] of byConnector) {
    try {
      const connector = await ticketConnector(organizationId, connectorId);
      if (!connector) continue;
      const keys = items.map((i) => i.ticket_key);
      const statuses = connector.row.connector_type === 'jira' ? await jira.getStatuses(connector.config, keys) : await itsmStatuses(connector.config, keys);
      for (const item of items) {
        if (!statuses.has(item.ticket_key)) continue;
        await pool.query(
          'UPDATE erp_access_review_items SET ticket_status = $3, ticket_synced_at = NOW() WHERE id = $1 AND organization_id = $2',
          [item.id, organizationId, String(statuses.get(item.ticket_key) || '').slice(0, 100)]
        );
        updated += 1;
      }
    } catch (error) {
      log('warn', 'erp.ticket_refresh_failed', { systemId, connectorId, error: serializeError(error) });
    }
  }
  return updated;
}

module.exports = { TICKET_CONNECTOR_TYPES, createForReview, refreshStatuses, describe, itsmClient };
