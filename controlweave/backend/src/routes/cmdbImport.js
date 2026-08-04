// @tier: community
/**
 * Bulk asset import and inventory export.
 *
 * Mounted at /api/v1/cmdb/import so the endpoints match the paths CMDB.md has
 * described all along -- analyze and commit -- which until now did not exist.
 * Kept out of routes/cmdb.js because that file is already past 700 lines and
 * the 800-line target in .claude/rules/code-review.md.
 *
 * Access control mirrors routes/cmdb.js exactly: authenticate, then
 * assets.read for the template and export, assets.write to commit an import.
 * A dry-run analyze is a read of the caller's own file plus org lookups, so it
 * sits at read.
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { validateBody, requireFields } = require('../middleware/validate');
const rateLimit = require('express-rate-limit');
const assetImport = require('../services/assetImportService');
const auditService = require('../services/auditService');

// express-rate-limit applied router-wide ahead of authenticate, so a cheap
// IP-based bound is in place before any DB work. This has to be the literal
// express-rate-limit package rather than middleware/rateLimit's
// createRateLimiter: CodeQL's js/missing-rate-limiting only recognizes the
// former, and TEVV enforces that for new route files. An import can create
// thousands of rows per call, so the ceiling is low.
router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 60 }));

router.use(authenticate);

function permitted(req, permission) {
  const permissions = req.user?.permissions || [];
  return permissions.includes('*') || permissions.includes(permission);
}

function requireAssets(permission) {
  return (req, res, next) => {
    if (!permitted(req, permission)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    next();
  };
}

const CATEGORY_CODES = { hardware: 'hardware', software: 'software', 'ai-agents': 'ai_agent' };

async function resolveCategoryId(categoryParam) {
  const code = CATEGORY_CODES[categoryParam];
  if (!code) return null;
  const { rows } = await pool.query('SELECT id FROM asset_categories WHERE code = $1', [code]);
  return rows.length > 0 ? rows[0].id : null;
}

// GET /api/v1/cmdb/import/template — the exact columns the importer accepts.
router.get('/template', requireAssets('assets.read'), (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="controlweave-asset-import-template.csv"');
  res.send(assetImport.templateCsv());
});

// GET /api/v1/cmdb/import/export?category=hardware — inventory as CSV.
// Emits the importer's own columns so an export can be edited and fed back in.
router.get('/export', requireAssets('assets.read'), async (req, res) => {
  try {
    let categoryId = null;
    if (req.query.category) {
      categoryId = await resolveCategoryId(req.query.category);
      if (!categoryId) {
        return res.status(400).json({
          success: false,
          error: `category must be one of: ${Object.keys(CATEGORY_CODES).join(', ')}`
        });
      }
    }

    const csv = await assetImport.exportCsv({ orgId: req.user.organization_id, categoryId });

    auditService.logFromRequest(req, {
      eventType: 'cmdb.inventory_exported',
      resourceType: 'asset',
      details: { category: req.query.category || 'all' },
      success: true
    }).catch(() => {});

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="controlweave-asset-inventory.csv"');
    res.send(csv);
  } catch (error) {
    console.error('CMDB import error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/v1/cmdb/import/analyze — dry run. Writes nothing.
router.post('/analyze',
  requireAssets('assets.read'),
  validateBody((body) => requireFields(body, ['csv'])),
  async (req, res) => {
    try {
      const result = await assetImport.analyze({
        orgId: req.user.organization_id,
        csv: req.body.csv
      });
      if (!result.ok) return res.status(400).json({ success: false, error: result.error, data: result });
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('CMDB import error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

// POST /api/v1/cmdb/import/commit — insert every valid row, in one transaction.
router.post('/commit',
  requireAssets('assets.write'),
  validateBody((body) => requireFields(body, ['csv', 'category'])),
  async (req, res) => {
    try {
      const categoryId = await resolveCategoryId(req.body.category);
      if (!categoryId) {
        return res.status(400).json({
          success: false,
          error: `category must be one of: ${Object.keys(CATEGORY_CODES).join(', ')}`
        });
      }

      const result = await assetImport.commit({
        orgId: req.user.organization_id,
        categoryId,
        csv: req.body.csv
      });
      if (!result.ok) return res.status(400).json({ success: false, error: result.error });

      auditService.logFromRequest(req, {
        eventType: 'cmdb.assets_imported',
        resourceType: 'asset',
        details: {
          category: req.body.category,
          imported: result.imported,
          skipped: result.skipped
        },
        success: true
      }).catch(() => {});

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      console.error('CMDB import error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

module.exports = router;
