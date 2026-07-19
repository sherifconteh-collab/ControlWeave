// @tier: pro
const express = require('express');
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const pool = require('../config/database');
const { authenticate, requireTier, requirePermission } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const github = require('../services/githubService');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// express-rate-limit applied router-wide, ahead of authenticate, so a cheap
// IP-based bound is in place before authenticate's own DB/JWT work runs, and
// so static analysis (CodeQL) can trace a recognized rate-limiting
// middleware covering these routes -- see audit.js / auditorWorkspace.js.
router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

router.use(authenticate);
router.use(requireTier('pro'));

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function parseTags(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((tag) => String(tag).trim()).filter(Boolean);
  return String(input).split(',').map((tag) => tag.trim()).filter(Boolean);
}

function getDefaultRetentionDate() {
  const retentionDays = Number(process.env.EVIDENCE_DEFAULT_RETENTION_DAYS || 365);
  const dt = new Date();
  dt.setDate(dt.getDate() + Math.max(1, retentionDays));
  return dt.toISOString().split('T')[0];
}

function sanitizeFileName(input) {
  const base = String(input || 'github-evidence').replace(/[^a-zA-Z0-9-_ ]/g, '').trim();
  return (base || 'github-evidence').substring(0, 80);
}

function formatSettingsResponse(settings) {
  return {
    configured: Boolean(settings.apiToken),
    token_masked: github.maskToken(settings.apiToken),
    updated_at: settings.updatedAt || null
  };
}

// GET /api/v1/integrations/github
router.get('/github', requirePermission('settings.manage'), async (req, res) => {
  try {
    const settings = await github.getOrgGithubSettings(req.user.organization_id);
    res.json({ success: true, data: formatSettingsResponse(settings) });
  } catch (error) {
    console.error('Get GitHub settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch GitHub settings' });
  }
});

// PUT /api/v1/integrations/github
router.put('/github', requirePermission('settings.manage'), validateBody((body) => {
  const errors = [];
  if (!body || typeof body !== 'object') errors.push('Request body is required');
  if (body.api_token !== undefined && body.api_token !== null && typeof body.api_token !== 'string') {
    errors.push('api_token must be a string');
  }
  return errors;
}), async (req, res) => {
  try {
    const saved = await github.saveOrgGithubSettings(req.user.organization_id, {
      apiToken: req.body.api_token
    });
    res.json({ success: true, message: 'GitHub settings updated', data: formatSettingsResponse(saved) });
  } catch (error) {
    console.error('Update GitHub settings error:', error);
    res.status(400).json({ success: false, error: 'Failed to update GitHub settings' });
  }
});

// DELETE /api/v1/integrations/github
router.delete('/github', requirePermission('settings.manage'), async (req, res) => {
  try {
    await github.saveOrgGithubSettings(req.user.organization_id, { apiToken: null });
    res.json({ success: true, message: 'GitHub settings removed' });
  } catch (error) {
    console.error('Delete GitHub settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove GitHub settings' });
  }
});

// POST /api/v1/integrations/github/test
router.post('/github/test', requirePermission('settings.manage'), validateBody((body) => {
  const errors = [];
  if (!body || typeof body !== 'object') errors.push('Request body is required');
  if (body.api_token !== undefined && body.api_token !== null && typeof body.api_token !== 'string') {
    errors.push('api_token must be a string');
  }
  return errors;
}), async (req, res) => {
  try {
    const saved = await github.getOrgGithubSettings(req.user.organization_id);
    const config = { apiToken: req.body.api_token || saved.apiToken };
    const info = await github.testConnection(config);
    res.json({ success: true, message: 'GitHub connection successful', data: info });
  } catch (error) {
    console.error('GitHub connection test error:', error);
    res.status(400).json({ success: false, error: 'GitHub connection failed' });
  }
});

// POST /api/v1/integrations/github/import-evidence
router.post('/github/import-evidence', requirePermission('evidence.write'), validateBody((body) => {
  const errors = [];
  if (!body.repository || typeof body.repository !== 'string' || !body.repository.trim()) {
    errors.push('repository is required');
  }
  if (body.max_results !== undefined && (!Number.isInteger(Number(body.max_results)) || Number(body.max_results) <= 0)) {
    errors.push('max_results must be a positive integer');
  }
  if (body.control_ids !== undefined && !Array.isArray(body.control_ids)) {
    errors.push('control_ids must be an array of control UUIDs');
  }
  return errors;
}), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const saved = await github.getOrgGithubSettings(orgId);
    if (!saved.apiToken) {
      return res.status(400).json({ success: false, error: 'GitHub is not configured. Go to Settings and add a GitHub token first.' });
    }
    const config = { apiToken: saved.apiToken };

    const evidenceResult = await github.fetchEvidence(config, {
      repository: req.body.repository,
      event_type: req.body.event_type,
      time_range: req.body.time_range,
      max_results: req.body.max_results
    });

    const importedAt = new Date().toISOString();
    const evidencePayload = {
      source: 'github',
      imported_at: importedAt,
      query: {
        repository: req.body.repository,
        event_type: evidenceResult.event_type,
        time_range: req.body.time_range || '-7d'
      },
      summary: { result_count: evidenceResult.results.length },
      results: evidenceResult.results
    };

    const fileBody = Buffer.from(JSON.stringify(evidencePayload, null, 2), 'utf8');
    const fileHash = createHash('sha256').update(fileBody).digest('hex');
    const fileNameRoot = sanitizeFileName(req.body.title || `github-${Date.now()}`);
    const fileName = `${fileNameRoot}.json`;
    const diskName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-github.json`;
    const filePath = path.join(uploadsDir, diskName);
    await fs.promises.writeFile(filePath, fileBody);

    const description = req.body.description
      || `Imported from GitHub (${evidenceResult.event_type}, ${evidenceResult.results.length} result${evidenceResult.results.length === 1 ? '' : 's'})`;
    const tags = parseTags(req.body.tags);
    const retentionUntil = req.body.retention_until || getDefaultRetentionDate();

    const evidenceInsert = await pool.query(
      `INSERT INTO evidence (
        organization_id, uploaded_by, file_name, file_path, file_size, mime_type, description, tags,
        integrity_hash_sha256, evidence_version, retention_until, integrity_verified_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $10, NOW())
      RETURNING id, file_name, file_size, created_at`,
      [
        orgId,
        req.user.id,
        fileName,
        filePath,
        fileBody.length,
        'application/json',
        description,
        tags,
        fileHash,
        retentionUntil
      ]
    );

    const evidenceRecord = evidenceInsert.rows[0];
    const requestedControlIds = Array.isArray(req.body.control_ids) ? req.body.control_ids : [];
    let linkedControls = 0;

    if (requestedControlIds.length > 0) {
      const validControlRows = await pool.query(
        'SELECT id FROM framework_controls WHERE id = ANY($1::uuid[])',
        [requestedControlIds]
      );
      const validControlIds = validControlRows.rows.map((row) => row.id);
      if (validControlIds.length > 0) {
        await pool.query(
          `INSERT INTO evidence_control_links (evidence_id, control_id, notes)
           SELECT $1, unnest($2::uuid[]), $3
           ON CONFLICT DO NOTHING`,
          [evidenceRecord.id, validControlIds, 'Imported from GitHub']
        );
      }
      linkedControls = validControlIds.length;
    }

    res.status(201).json({
      success: true,
      message: 'GitHub results imported to Evidence',
      data: {
        evidence_id: evidenceRecord.id,
        file_name: evidenceRecord.file_name,
        file_size: evidenceRecord.file_size,
        result_count: evidenceResult.results.length,
        event_type: evidenceResult.event_type,
        linked_controls: linkedControls
      }
    });
  } catch (error) {
    console.error('GitHub evidence import error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to import GitHub evidence'
    });
  }
});

module.exports = router;
