'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, requireTier, authorizePermission } = require('../middleware/auth');
const { validateBody, requireFields } = require('../middleware/validate');
const siem = require('../services/siemService');

// All SIEM routes require authentication, settings.manage permission, and professional+
router.use(authenticate);
router.use(requireTier('professional'));
router.use(authorizePermission('settings.manage'));

const VALID_PROVIDERS = new Set(['splunk', 'elastic', 'webhook', 'syslog']);

// GET /siem — list all SIEM configurations
router.get('/', async (req, res) => {
  try {
    const configs = await siem.listSiemConfigs(req.user.organization_id);
    return res.json({ data: configs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /siem — create a new SIEM config
router.post(
  '/',
  validateBody((body) => requireFields(body, ['name', 'provider'])),
  async (req, res) => {
    try {
      if (!VALID_PROVIDERS.has(req.body.provider)) {
        return res.status(400).json({ error: 'Invalid provider. Must be one of: splunk, elastic, webhook, syslog' });
      }
      const id = await siem.saveSiemConfig(req.user.organization_id, req.body);
      return res.status(201).json({ data: { id } });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

// PUT /siem/:id — update an existing SIEM config
router.put(
  '/:id',
  validateBody((body) => requireFields(body, ['name', 'provider'])),
  async (req, res) => {
    try {
      if (!VALID_PROVIDERS.has(req.body.provider)) {
        return res.status(400).json({ error: 'Invalid provider.' });
      }
      await siem.saveSiemConfig(req.user.organization_id, { ...req.body, id: req.params.id });
      return res.json({ data: { updated: true } });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

// DELETE /siem/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await siem.deleteSiemConfig(req.user.organization_id, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'SIEM config not found.' });
    return res.json({ data: { deleted: true } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /siem/:id/test — send a test event
router.post('/:id/test', async (req, res) => {
  try {
    const result = await siem.testSiemConfig(req.user.organization_id, req.params.id);
    return res.json({ data: { ok: true, detail: result } });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// POST /siem/forward — manually forward an event (for testing/manual flush)
router.post('/forward', async (req, res) => {
  try {
    const { event_type, payload } = req.body;
    if (!event_type) return res.status(400).json({ error: 'event_type required.' });
    const results = await siem.forwardEvent(req.user.organization_id, event_type, payload || {});
    return res.json({ data: results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
