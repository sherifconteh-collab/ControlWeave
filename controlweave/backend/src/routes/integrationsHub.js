// @tier: pro
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const auditService = require('../services/auditService');
const { authenticate, requirePermission } = require('../middleware/auth');
const { enqueueWebhookEvent } = require('../services/webhookService');
const { enqueueJob } = require('../services/jobService');
const { getConfigValue } = require('../services/dynamicConfigService');
const connectors = require('../services/connectors');
const { requireFeature } = require('../services/entitlementService');
const { isUuid } = require('../middleware/validate');

router.use(authenticate);
router.use(requirePermission('settings.manage'));

// Connector types without a sync client yet. They can be saved (so settings
// are ready) but report "sync coming soon" instead of running.
const PLANNED_CONNECTOR_TEMPLATES = [
  { type: 'splunk', label: 'Splunk', category: 'SIEM', required: ['baseUrl', 'token'], supports_realtime: true },
  { type: 'acas', label: 'ACAS/Nessus', category: 'Vulnerability Scanner', required: ['baseUrl', 'apiKey'], supports_realtime: false },
  { type: 'sbom_repo', label: 'SBOM Repository', category: 'Software Supply Chain', required: ['baseUrl'], supports_realtime: false },
  { type: 'stig_repo', label: 'STIG Content Source', category: 'Hardening Baselines', required: ['sourcePath'], supports_realtime: false },
  { type: 'siem_generic', label: 'Generic SIEM', category: 'SIEM', required: ['endpoint', 'authType'], supports_realtime: false },
  { type: 'scanner_generic', label: 'Generic Scanner', category: 'Vulnerability Scanner', required: ['endpoint'], supports_realtime: false },
  { type: 'nvd', label: 'NIST NVD', category: 'Threat Intelligence', required: [], optional: ['apiKey'], supports_realtime: true, description: 'National Vulnerability Database CVE feed' },
  { type: 'cisa_kev', label: 'CISA KEV', category: 'Threat Intelligence', required: [], supports_realtime: true, description: 'Known Exploited Vulnerabilities catalog' },
  { type: 'mitre_attack', label: 'MITRE ATT&CK', category: 'Threat Intelligence', required: [], supports_realtime: false, description: 'Adversary tactics and techniques' },
  { type: 'alienvault_otx', label: 'AlienVault OTX', category: 'Threat Intelligence', required: ['apiKey'], supports_realtime: true, description: 'Open Threat Exchange' },
  { type: 'securityscorecard', label: 'SecurityScorecard', category: 'Vendor Security', required: ['apiKey'], supports_realtime: false, description: 'Third-party security ratings' },
  { type: 'bitsight', label: 'BitSight', category: 'Vendor Security', required: ['apiKey'], supports_realtime: false, description: 'Continuous security ratings' }
];

function defaultTemplates() {
  const real = connectors.listTemplates();
  const known = new Set(real.map((t) => t.type));
  const planned = PLANNED_CONNECTOR_TEMPLATES
    .filter((t) => !known.has(t.type))
    .map((t) => ({ optional: [], ...t, secrets: [...(t.required || []), ...(t.optional || [])].filter((k) => /token|key|secret|password/i.test(k)), sync_available: false }));
  return [...real, ...planned];
}

function knownType(type) {
  return defaultTemplates().some((t) => t.type === type);
}

function normalizeStatus(value) {
  const v = String(value || '').toLowerCase();
  return ['inactive', 'active', 'error'].includes(v) ? v : 'inactive';
}

async function emitConnectorEvent(orgId, userId, eventType, payload) {
  await enqueueWebhookEvent({
    organizationId: orgId,
    eventType,
    payload
  }).catch(() => {});

  await enqueueJob({
    organizationId: orgId,
    jobType: 'webhook_flush',
    payload: { limit: 50 },
    createdBy: userId
  }).catch(() => {});
}

// GET /api/v1/integrations-hub/templates
router.get('/templates', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const override = await getConfigValue(orgId, 'integrations', 'connector_templates', null);
    const templates = Array.isArray(override) ? override : defaultTemplates();
    res.json({ success: true, data: templates });
  } catch (error) {
    console.error('Integration template error:', error);
    res.status(500).json({ success: false, error: 'Failed to load integration templates' });
  }
});

// GET /api/v1/integrations-hub/connectors
router.get('/connectors', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const result = await pool.query(
      `SELECT c.*, lr.status AS last_run_status, lr.finished_at AS last_run_at,
              lr.result_summary AS last_run_summary, lr.error_message AS last_run_error
       FROM integration_connectors c
       LEFT JOIN LATERAL (
         SELECT r.status, r.finished_at, r.result_summary, r.error_message
           FROM integration_connector_runs r
          WHERE r.connector_id = c.id AND r.organization_id = c.organization_id
          ORDER BY r.created_at DESC
          LIMIT 1
       ) lr ON true
       WHERE c.organization_id = $1
       ORDER BY c.updated_at DESC`,
      [orgId]
    );
    res.json({ success: true, data: result.rows.map(connectors.redact) });
  } catch (error) {
    console.error('List connectors error:', error);
    res.status(500).json({ success: false, error: 'Failed to load integration connectors' });
  }
});

// POST /api/v1/integrations-hub/connectors
router.post('/connectors', requireFeature('connectors'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { name, connector_type, status, auth_config = {}, connector_config = {} } = req.body || {};
    if (!name || !connector_type) {
      return res.status(400).json({ success: false, error: 'name and connector_type are required' });
    }
    if (!knownType(connector_type)) {
      return res.status(400).json({ success: false, error: `Unknown connector type: ${String(connector_type).slice(0, 50)}` });
    }
    const { auth, settings } = connectors.prepareConfig(connector_type, { authConfig: auth_config, connectorConfig: connector_config });
    const missing = connectors.missingRequired(connector_type, auth, settings);
    if (missing.length) {
      return res.status(400).json({ success: false, error: `Missing required settings: ${missing.join(', ')}` });
    }
    const urlError = await connectors.validateUrlSettings(settings);
    if (urlError) return res.status(400).json({ success: false, error: urlError });

    const inserted = await pool.query(
      `INSERT INTO integration_connectors (
         organization_id, name, connector_type, status, auth_config, connector_config, created_by
       )
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
       RETURNING *`,
      [
        orgId,
        String(name).slice(0, 200),
        connector_type,
        normalizeStatus(status),
        JSON.stringify(auth),
        JSON.stringify(settings),
        req.user.id
      ]
    );

    await auditService.logFromRequest(req, {
      eventType: 'integration_connector_created',
      resourceType: 'integration_connector',
      resourceId: inserted.rows[0].id,
      details: { connector_type, name }
    });

    await emitConnectorEvent(orgId, req.user.id, 'integration.connector.created', {
      id: inserted.rows[0].id,
      connector_type,
      name
    });

    res.status(201).json({ success: true, data: connectors.redact(inserted.rows[0]) });
  } catch (error) {
    console.error('Create connector error:', error);
    res.status(500).json({ success: false, error: 'Failed to create integration connector' });
  }
});

// PATCH /api/v1/integrations-hub/connectors/:id
router.patch('/connectors/:id', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const id = req.params.id;
    const patch = req.body || {};

    const existing = await pool.query(
      `SELECT *
       FROM integration_connectors
       WHERE organization_id = $1 AND id = $2
       LIMIT 1`,
      [orgId, id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Integration connector not found' });
    }

    const current = existing.rows[0];
    let nextAuth = null;
    let nextSettings = null;
    if (patch.auth_config !== undefined || patch.connector_config !== undefined) {
      const prepared = connectors.prepareConfig(
        current.connector_type,
        { authConfig: patch.auth_config || {}, connectorConfig: patch.connector_config || {} },
        current.auth_config || {}
      );
      nextAuth = prepared.auth;
      nextSettings = patch.connector_config === undefined ? current.connector_config : prepared.settings;
    }
    if (nextSettings) {
      const urlError = await connectors.validateUrlSettings(nextSettings);
      if (urlError) return res.status(400).json({ success: false, error: urlError });
    }

    const updated = await pool.query(
      `UPDATE integration_connectors
       SET name = COALESCE($3, name),
           status = COALESCE($4, status),
           auth_config = COALESCE($5::jsonb, auth_config),
           connector_config = COALESCE($6::jsonb, connector_config),
           updated_at = NOW()
       WHERE organization_id = $1 AND id = $2
       RETURNING *`,
      [
        orgId,
        id,
        patch.name ? String(patch.name).slice(0, 200) : null,
        patch.status === undefined ? null : normalizeStatus(patch.status),
        nextAuth === null ? null : JSON.stringify(nextAuth),
        nextSettings === null ? null : JSON.stringify(nextSettings)
      ]
    );

    await auditService.logFromRequest(req, {
      eventType: 'integration_connector_updated',
      resourceType: 'integration_connector',
      resourceId: id,
      details: { status: updated.rows[0].status, name: updated.rows[0].name }
    });

    await emitConnectorEvent(orgId, req.user.id, 'integration.connector.updated', {
      id,
      status: updated.rows[0].status
    });

    res.json({ success: true, data: connectors.redact(updated.rows[0]) });
  } catch (error) {
    console.error('Update connector error:', error);
    res.status(500).json({ success: false, error: 'Failed to update integration connector' });
  }
});

// DELETE /api/v1/integrations-hub/connectors/:id
router.delete('/connectors/:id', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const id = req.params.id;
    const deleted = await pool.query(
      `DELETE FROM integration_connectors
       WHERE organization_id = $1 AND id = $2
       RETURNING id, connector_type, name`,
      [orgId, id]
    );
    if (deleted.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Integration connector not found' });
    }

    await auditService.logFromRequest(req, {
      eventType: 'integration_connector_deleted',
      resourceType: 'integration_connector',
      resourceId: id,
      details: { connector_type: deleted.rows[0].connector_type, name: deleted.rows[0].name }
    });

    await emitConnectorEvent(orgId, req.user.id, 'integration.connector.deleted', { id });

    res.json({ success: true, message: 'Integration connector deleted' });
  } catch (error) {
    console.error('Delete connector error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete integration connector' });
  }
});

// POST /api/v1/integrations-hub/connectors/:id/run
// Every result recorded here comes from the external system. A connector type
// without a sync client is reported as unavailable, never given simulated
// counts (which previously appeared in run history and audit logs as real).
router.post('/connectors/:id/run', requireFeature('connectors'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ success: false, error: 'Invalid connector id' });

    const connector = await pool.query(
      'SELECT * FROM integration_connectors WHERE organization_id = $1 AND id = $2 LIMIT 1',
      [orgId, id]
    );
    if (connector.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Integration connector not found' });
    }
    const row = connector.rows[0];
    if (!connectors.templateFor(row.connector_type)) {
      return res.status(422).json({
        success: false,
        error: `On-demand sync is not available yet for ${row.connector_type} connectors.`,
        code: 'connector_sync_unavailable'
      });
    }

    const runStart = await pool.query(
      `INSERT INTO integration_connector_runs (organization_id, connector_id, run_type, status, started_at, created_by)
       VALUES ($1, $2, 'manual', 'running', NOW(), $3)
       RETURNING *`,
      [orgId, id, req.user.id]
    );
    const outcome = await connectors.runSync(row, req.user.id);
    if (outcome.busy) {
      await pool.query(
        `UPDATE integration_connector_runs SET status = 'failed', error_message = $2, finished_at = NOW() WHERE id = $1`,
        [runStart.rows[0].id, 'Another sync of this connector is already running']
      );
      return res.status(409).json({ success: false, error: 'This connector is already syncing. Try again when it finishes.' });
    }
    const failed = outcome.failed;
    const runFinish = await pool.query(
      `UPDATE integration_connector_runs
       SET status = $2, result_summary = $3::jsonb, error_message = $4, finished_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [runStart.rows[0].id, failed ? 'failed' : 'success', JSON.stringify(outcome.summary), failed ? outcome.error : null]
    );
    await pool.query(
      `UPDATE integration_connectors
       SET status = $2::text,
           last_sync_at = CASE WHEN $2::text = 'active' THEN NOW() ELSE last_sync_at END,
           updated_at = NOW()
       WHERE id = $1 AND organization_id = $3`,
      [id, failed ? 'error' : 'active', orgId]
    );

    await auditService.logFromRequest(req, {
      eventType: 'integration_connector_run',
      resourceType: 'integration_connector',
      resourceId: id,
      details: { ...outcome.summary, status: failed ? 'failed' : 'success' },
      success: !failed
    });
    await emitConnectorEvent(orgId, req.user.id, 'integration.connector.run', {
      connector_id: id,
      run_id: runFinish.rows[0].id,
      result: outcome.summary
    });

    if (failed) {
      return res.status(502).json({
        success: false,
        error: `Sync failed: ${outcome.error}`,
        data: runFinish.rows[0]
      });
    }
    res.json({ success: true, data: runFinish.rows[0] });
  } catch (error) {
    console.error('Run connector error:', error);
    res.status(500).json({ success: false, error: 'Failed to run integration connector' });
  }
});

// POST /api/v1/integrations-hub/connectors/:id/poam/:poamId/ticket
// Open a Jira ticket for a POA&M item and link it. The ticket's status is
// refreshed on every sync of the connector.
router.post('/connectors/:id/poam/:poamId/ticket', requireFeature('connectors'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    if (!isUuid(req.params.id) || !isUuid(req.params.poamId)) {
      return res.status(400).json({ success: false, error: 'Invalid id' });
    }
    const [connector, poam] = await Promise.all([
      pool.query('SELECT * FROM integration_connectors WHERE organization_id = $1 AND id = $2', [orgId, req.params.id]),
      pool.query(
        `SELECT p.*, fc.control_id AS control_code
           FROM poam_items p LEFT JOIN framework_controls fc ON fc.id = p.control_id
          WHERE p.organization_id = $1 AND p.id = $2`,
        [orgId, req.params.poamId]
      )
    ]);
    if (!connector.rows.length || connector.rows[0].connector_type !== 'jira') {
      return res.status(404).json({ success: false, error: 'Jira connector not found' });
    }
    if (!poam.rows.length) return res.status(404).json({ success: false, error: 'POA&M item not found' });
    const item = poam.rows[0];
    if (item.external_ticket_key) {
      return res.status(409).json({ success: false, error: `Already linked to ${item.external_ticket_key}` });
    }
    const priorityMap = { critical: 'Highest', high: 'High', medium: 'Medium', low: 'Low' };
    const ticket = await require('../services/connectors/jira').createIssue(connectors.runtimeConfig(connector.rows[0]), {
      summary: `[POA&M] ${item.title}`,
      description: [
        item.description,
        item.control_code ? `Control: ${item.control_code}` : null,
        item.remediation_plan ? `Remediation plan: ${item.remediation_plan}` : null,
        `Tracked in ControlWeave POA&M ${item.id}.`
      ].filter(Boolean).join('\n\n'),
      priority: priorityMap[item.priority],
      dueDate: item.due_date ? new Date(item.due_date).toISOString().slice(0, 10) : undefined,
      labels: ['poam']
    });
    const updated = await pool.query(
      `UPDATE poam_items
          SET external_ticket_system = 'jira', external_ticket_key = $3, external_ticket_url = $4,
              external_ticket_status = 'Created', external_ticket_synced_at = NOW(),
              external_ticket_connector_id = $5, updated_at = NOW()
        WHERE organization_id = $1 AND id = $2
        RETURNING id, external_ticket_key, external_ticket_url, external_ticket_status`,
      [orgId, item.id, ticket.key, ticket.url, req.params.id]
    );
    await auditService.logFromRequest(req, {
      eventType: 'poam.ticket_created',
      resourceType: 'poam_item',
      resourceId: item.id,
      details: { system: 'jira', ticket: ticket.key, connector_id: req.params.id }
    });
    res.status(201).json({ success: true, data: updated.rows[0] });
  } catch (error) {
    if (error && error.name === 'ConnectorHttpError') {
      return res.status(502).json({ success: false, error: `Jira: ${error.message}` });
    }
    console.error('Create POA&M ticket error:', error);
    res.status(500).json({ success: false, error: 'Failed to create the ticket' });
  }
});

// GET /api/v1/integrations-hub/connectors/:id/runs
router.get('/connectors/:id/runs', async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const id = req.params.id;
    const runs = await pool.query(
      `SELECT *
       FROM integration_connector_runs
       WHERE organization_id = $1 AND connector_id = $2
       ORDER BY created_at DESC
       LIMIT 100`,
      [orgId, id]
    );
    res.json({ success: true, data: runs.rows });
  } catch (error) {
    console.error('Connector runs error:', error);
    res.status(500).json({ success: false, error: 'Failed to load integration run history' });
  }
});

module.exports = router;
