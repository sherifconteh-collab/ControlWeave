const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createHash } = require('crypto');
const pool = require('../config/database');
const { authenticate, requireTier, requirePermission } = require('../middleware/auth');

router.use(authenticate);
router.use(requireTier('starter'));

// Configure multer for file uploads
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const resolvedUploadsDir = path.resolve(uploadsDir);

const ALLOWED_UPLOAD_TYPES = new Map([
  ['.pdf', ['application/pdf']],
  ['.doc', ['application/msword', 'application/octet-stream']],
  ['.docx', ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'application/octet-stream']],
  ['.xls', ['application/vnd.ms-excel', 'application/octet-stream']],
  ['.xlsx', ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip', 'application/octet-stream']],
  ['.csv', ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain']],
  ['.txt', ['text/plain']],
  ['.png', ['image/png']],
  ['.jpg', ['image/jpeg']],
  ['.jpeg', ['image/jpeg']],
  ['.gif', ['image/gif']],
  ['.zip', ['application/zip', 'application/x-zip-compressed', 'multipart/x-zip', 'application/octet-stream']]
]);

function isAllowedUpload(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const allowedMimeTypes = ALLOWED_UPLOAD_TYPES.get(ext);
  if (!allowedMimeTypes) return false;
  const mimeType = String(file.mimetype || '').toLowerCase();
  return allowedMimeTypes.includes(mimeType);
}

function isSafeUploadPath(filePath) {
  if (!filePath) return false;
  const resolvedPath = path.resolve(filePath);
  return resolvedPath.startsWith(`${resolvedUploadsDir}${path.sep}`);
}

function sanitizeDownloadName(input) {
  const safe = String(input || 'evidence')
    .replace(/[\r\n]/g, ' ')
    .replace(/"/g, '')
    .replace(/[^a-zA-Z0-9._() -]/g, '_')
    .trim();
  return (safe || 'evidence').slice(0, 200);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (!isAllowedUpload(file)) {
      return cb(new Error('Unsupported file type'));
    }
    return cb(null, true);
  }
});

function computeFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function getDefaultRetentionDate() {
  const retentionDays = Number(process.env.EVIDENCE_DEFAULT_RETENTION_DAYS || 365);
  const dt = new Date();
  dt.setDate(dt.getDate() + Math.max(1, retentionDays));
  return dt.toISOString().split('T')[0];
}

function normalizeRetentionDate(input) {
  if (!input) return getDefaultRetentionDate();
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return getDefaultRetentionDate();
  return parsed.toISOString().split('T')[0];
}

// GET /evidence
router.get('/', requirePermission('evidence.read'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { search, tags, limit, offset } = req.query;

    let query = `
      SELECT e.id, e.file_name, e.file_size, e.mime_type, e.description, e.tags,
             e.created_at, e.updated_at, e.evidence_version, e.retention_until, e.integrity_verified_at,
             u.first_name || ' ' || u.last_name as uploaded_by_name,
             (SELECT COUNT(*) FROM evidence_control_links ecl WHERE ecl.evidence_id = e.id) as linked_controls
      FROM evidence e
      LEFT JOIN users u ON u.id = e.uploaded_by
      WHERE e.organization_id = $1
    `;
    const params = [orgId];
    let idx = 2;

    if (search) {
      query += ` AND (e.file_name ILIKE $${idx} OR e.description ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    if (tags) {
      query += ` AND e.tags && $${idx}::text[]`;
      params.push(`{${tags}}`);
      idx++;
    }

    query += ' ORDER BY e.created_at DESC';

    if (limit) {
      query += ` LIMIT $${idx}`;
      params.push(parseInt(limit));
      idx++;
    }
    if (offset) {
      query += ` OFFSET $${idx}`;
      params.push(parseInt(offset));
      idx++;
    }

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Evidence list error:', error);
    res.status(500).json({ success: false, error: 'Failed to load evidence' });
  }
});

// POST /evidence/upload
router.post('/upload', requirePermission('evidence.write'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }

    const { description, tags } = req.body;
    const tagsArray = tags ? (typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags) : [];
    const integrityHash = await computeFileSha256(req.file.path);
    const retentionUntil = normalizeRetentionDate(req.body.retention_until || req.body.retentionUntil);
    const safeOriginalName = path.basename(String(req.file.originalname || 'evidence'));

    const result = await pool.query(`
      INSERT INTO evidence (
        organization_id, uploaded_by, file_name, file_path, file_size, mime_type, description, tags,
        integrity_hash_sha256, evidence_version, retention_until, integrity_verified_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $10, NOW())
      RETURNING *
    `, [
      req.user.organization_id, req.user.id,
      safeOriginalName, req.file.path, req.file.size, req.file.mimetype,
      description || null, tagsArray, integrityHash, retentionUntil
    ]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload evidence' });
  }
});

// GET /evidence/:id/integrity-check
router.get('/:id/integrity-check', requirePermission('evidence.read'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, file_name, file_path, integrity_hash_sha256, integrity_verified_at
       FROM evidence
       WHERE id = $1 AND organization_id = $2`,
      [req.params.id, req.user.organization_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Evidence not found' });
    }

    const evidence = result.rows[0];
    if (!isSafeUploadPath(evidence.file_path)) {
      return res.status(400).json({ success: false, error: 'Stored file path is outside allowed uploads directory' });
    }
    if (!evidence.file_path || !fs.existsSync(evidence.file_path)) {
      return res.status(404).json({ success: false, error: 'File not found on disk' });
    }

    const currentHash = await computeFileSha256(evidence.file_path);
    const matches = Boolean(evidence.integrity_hash_sha256) && currentHash === evidence.integrity_hash_sha256;

    await pool.query(
      'UPDATE evidence SET integrity_verified_at = NOW() WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.user.organization_id]
    );

    res.json({
      success: true,
      data: {
        id: evidence.id,
        file_name: evidence.file_name,
        matches,
        expected_hash: evidence.integrity_hash_sha256,
        current_hash: currentHash,
        previous_verified_at: evidence.integrity_verified_at
      }
    });
  } catch (error) {
    console.error('Integrity check error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify evidence integrity' });
  }
});

// GET /evidence/:id
router.get('/:id', requirePermission('evidence.read'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, u.first_name || ' ' || u.last_name as uploaded_by_name
      FROM evidence e
      LEFT JOIN users u ON u.id = e.uploaded_by
      WHERE e.id = $1 AND e.organization_id = $2
    `, [req.params.id, req.user.organization_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Evidence not found' });
    }

    // Get linked controls
    const links = await pool.query(`
      SELECT ecl.control_id, ecl.notes, fc.control_id as control_code, fc.title,
             f.name as framework_name
      FROM evidence_control_links ecl
      JOIN framework_controls fc ON fc.id = ecl.control_id
      JOIN frameworks f ON f.id = fc.framework_id
      WHERE ecl.evidence_id = $1
    `, [req.params.id]);

    res.json({ success: true, data: { ...result.rows[0], linked_controls: links.rows } });
  } catch (error) {
    console.error('Get evidence error:', error);
    res.status(500).json({ success: false, error: 'Failed to load evidence' });
  }
});

// GET /evidence/:id/download
router.get('/:id/download', requirePermission('evidence.read'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT file_name, file_path, mime_type FROM evidence WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.user.organization_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Evidence not found' });
    }

    const file = result.rows[0];
    if (!isSafeUploadPath(file.file_path)) {
      return res.status(400).json({ success: false, error: 'Stored file path is outside allowed uploads directory' });
    }
    if (!fs.existsSync(file.file_path)) {
      return res.status(404).json({ success: false, error: 'File not found on disk' });
    }

    const safeFileName = sanitizeDownloadName(file.file_name);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
    res.setHeader('Content-Type', file.mime_type);
    fs.createReadStream(file.file_path).pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ success: false, error: 'Failed to download evidence' });
  }
});

// PUT /evidence/:id
router.put('/:id', requirePermission('evidence.write'), async (req, res) => {
  try {
    const { description, tags, retention_until } = req.body;

    const result = await pool.query(`
      UPDATE evidence SET
        description = COALESCE($1, description),
        tags = COALESCE($2, tags),
        retention_until = COALESCE($3, retention_until),
        evidence_version = evidence_version + 1,
        updated_at = NOW()
      WHERE id = $4 AND organization_id = $5
      RETURNING *
    `, [description, tags || null, retention_until || null, req.params.id, req.user.organization_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Evidence not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Update evidence error:', error);
    res.status(500).json({ success: false, error: 'Failed to update evidence' });
  }
});

// DELETE /evidence/:id
router.delete('/:id', requirePermission('evidence.write'), async (req, res) => {
  try {
    const hold = await pool.query(
      `SELECT id, hold_name
       FROM legal_holds
       WHERE organization_id = $1
         AND active = true
         AND resource_type = 'evidence'
         AND (resource_id IS NULL OR resource_id = $2)
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user.organization_id, req.params.id]
    );

    if (hold.rows.length > 0) {
      return res.status(423).json({
        success: false,
        error: 'Evidence is under active legal hold and cannot be deleted',
        hold: hold.rows[0]
      });
    }

    const result = await pool.query(
      'DELETE FROM evidence WHERE id = $1 AND organization_id = $2 RETURNING file_path',
      [req.params.id, req.user.organization_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Evidence not found' });
    }

    // Clean up file from disk
    const filePath = result.rows[0].file_path;
    if (isSafeUploadPath(filePath) && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ success: true, message: 'Evidence deleted' });
  } catch (error) {
    console.error('Delete evidence error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete evidence' });
  }
});

// POST /evidence/:id/link
router.post('/:id/link', requirePermission('evidence.write'), async (req, res) => {
  try {
    const { controlIds, notes } = req.body;

    if (!controlIds || !Array.isArray(controlIds)) {
      return res.status(400).json({ success: false, error: 'controlIds array required' });
    }

    // Verify evidence belongs to org
    const ev = await pool.query('SELECT id FROM evidence WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.user.organization_id]);
    if (ev.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Evidence not found' });
    }

    for (const cid of controlIds) {
      await pool.query(
        'INSERT INTO evidence_control_links (evidence_id, control_id, notes) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [req.params.id, cid, notes || null]
      );
    }

    res.json({ success: true, message: 'Controls linked' });
  } catch (error) {
    console.error('Link error:', error);
    res.status(500).json({ success: false, error: 'Failed to link controls' });
  }
});

// DELETE /evidence/:evidenceId/unlink/:controlId
router.delete('/:evidenceId/unlink/:controlId', requirePermission('evidence.write'), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM evidence_control_links WHERE evidence_id = $1 AND control_id = $2',
      [req.params.evidenceId, req.params.controlId]
    );
    res.json({ success: true, message: 'Control unlinked' });
  } catch (error) {
    console.error('Unlink error:', error);
    res.status(500).json({ success: false, error: 'Failed to unlink control' });
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'File exceeds 50MB upload limit' });
    }
    return res.status(400).json({ success: false, error: err.message || 'Invalid upload request' });
  }

  if (err?.message === 'Unsupported file type') {
    return res.status(400).json({ success: false, error: 'Unsupported file type' });
  }

  return next(err);
});

module.exports = router;
