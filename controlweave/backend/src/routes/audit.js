const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const splunk = require('../services/splunkService');

router.use(authenticate);

const auditReadLimiter = createRateLimiter({ windowMs: 60000, max: 120, label: 'audit-read' });

// GET /audit/logs/oneline — compact one-line format inspired by git log --oneline
router.get('/logs/oneline', auditReadLimiter, requirePermission('audit.read'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { limit, offset, eventType } = req.query;

    let query = `
      SELECT al.id, al.event_type, al.success, al.created_at,
             u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.organization_id = $1
    `;
    const params = [orgId];
    let idx = 2;

    if (eventType) {
      query += ` AND al.event_type = $${idx}`;
      params.push(eventType);
      idx++;
    }

    query += ' ORDER BY al.created_at DESC';
    query += ` LIMIT $${idx}`;
    params.push(parseInt(limit) || 100);
    idx++;
    query += ` OFFSET $${idx}`;
    params.push(parseInt(offset) || 0);

    const result = await pool.query(query, params);

    const lines = result.rows.map((row) => {
      // IDs are UUIDs (32 hex chars after stripping hyphens); take first 7 for a short identifier
      const shortId = String(row.id).replace(/-/g, '').substring(0, 7);
      const ts = new Date(row.created_at).toISOString().replace('T', ' ').substring(0, 19);
      const status = row.success ? 'SUCCESS' : 'FAILED';
      const email = row.user_email || 'unknown';
      return `${shortId} ${ts} ${row.event_type} ${email} [${status}]`;
    });

    res.json({ success: true, data: lines });
  } catch (error) {
    console.error('Audit oneline error:', error);
    res.status(500).json({ success: false, error: 'Failed to load audit logs' });
  }
});

// GET /audit/logs
router.get('/logs', requirePermission('audit.read'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const {
      userId,
      eventType,
      resourceType,
      resourceId,
      startDate,
      endDate,
      findingKey,
      vulnerabilityId,
      source,
      limit,
      offset
    } = req.query;

    let query = `
      SELECT al.id, al.event_type, al.resource_type, al.resource_id, al.details,
             al.ip_address, al.user_agent, al.success, al.failure_reason, al.created_at,
             u.first_name || ' ' || u.last_name as user_name, u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.organization_id = $1
    `;
    const params = [orgId];
    let idx = 2;

    if (userId) {
      query += ` AND al.user_id = $${idx}`;
      params.push(userId);
      idx++;
    }
    if (eventType) {
      query += ` AND al.event_type = $${idx}`;
      params.push(eventType);
      idx++;
    }
    if (resourceType) {
      query += ` AND al.resource_type = $${idx}`;
      params.push(String(resourceType));
      idx++;
    }
    if (resourceId) {
      query += ` AND al.resource_id::text = $${idx}`;
      params.push(String(resourceId));
      idx++;
    }
    if (startDate) {
      query += ` AND al.created_at >= $${idx}`;
      params.push(startDate);
      idx++;
    }
    if (endDate) {
      query += ` AND al.created_at <= $${idx}`;
      params.push(endDate);
      idx++;
    }
    if (findingKey) {
      query += ` AND al.details->>'finding_key' = $${idx}`;
      params.push(String(findingKey));
      idx++;
    }
    if (vulnerabilityId) {
      query += ` AND al.details->>'vulnerability_id' = $${idx}`;
      params.push(String(vulnerabilityId));
      idx++;
    }
    if (source) {
      query += ` AND al.details->>'source' = $${idx}`;
      params.push(String(source));
      idx++;
    }

    query += ' ORDER BY al.created_at DESC';
    query += ` LIMIT $${idx}`;
    params.push(parseInt(limit) || 50);
    idx++;
    query += ` OFFSET $${idx}`;
    params.push(parseInt(offset) || 0);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM audit_logs al WHERE al.organization_id = $1';
    const countParams = [orgId];
    let countIdx = 2;

    if (userId) {
      countQuery += ` AND al.user_id = $${countIdx}`;
      countParams.push(userId);
      countIdx++;
    }
    if (eventType) {
      countQuery += ` AND al.event_type = $${countIdx}`;
      countParams.push(eventType);
      countIdx++;
    }
    if (resourceType) {
      countQuery += ` AND al.resource_type = $${countIdx}`;
      countParams.push(String(resourceType));
      countIdx++;
    }
    if (resourceId) {
      countQuery += ` AND al.resource_id::text = $${countIdx}`;
      countParams.push(String(resourceId));
      countIdx++;
    }
    if (startDate) {
      countQuery += ` AND al.created_at >= $${countIdx}`;
      countParams.push(startDate);
      countIdx++;
    }
    if (endDate) {
      countQuery += ` AND al.created_at <= $${countIdx}`;
      countParams.push(endDate);
      countIdx++;
    }
    if (findingKey) {
      countQuery += ` AND al.details->>'finding_key' = $${countIdx}`;
      countParams.push(String(findingKey));
      countIdx++;
    }
    if (vulnerabilityId) {
      countQuery += ` AND al.details->>'vulnerability_id' = $${countIdx}`;
      countParams.push(String(vulnerabilityId));
      countIdx++;
    }
    if (source) {
      countQuery += ` AND al.details->>'source' = $${countIdx}`;
      countParams.push(String(source));
      countIdx++;
    }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      success: true,
      data: result.rows,
      logs: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0
      }
    });
  } catch (error) {
    console.error('Audit logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to load audit logs' });
  }
});

// GET /audit/stats
router.get('/stats', requirePermission('audit.read'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { startDate, endDate } = req.query;

    let dateFilter = '';
    const params = [orgId];
    let idx = 2;

    if (startDate) {
      dateFilter += ` AND created_at >= $${idx}`;
      params.push(startDate);
      idx++;
    }
    if (endDate) {
      dateFilter += ` AND created_at <= $${idx}`;
      params.push(endDate);
      idx++;
    }

    const result = await pool.query(`
      SELECT event_type, COUNT(*) as count
      FROM audit_logs
      WHERE organization_id = $1 ${dateFilter}
      GROUP BY event_type
      ORDER BY count DESC
    `, params);

    const totalResult = await pool.query(
      `SELECT COUNT(*) as total FROM audit_logs WHERE organization_id = $1 ${dateFilter}`,
      params
    );

    res.json({
      success: true,
      data: {
        eventBreakdown: result.rows,
        totalEvents: parseInt(totalResult.rows[0].total)
      }
    });
  } catch (error) {
    console.error('Audit stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to load audit stats' });
  }
});

// GET /audit/splunk/live
router.get('/splunk/live', requirePermission('audit.read'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const settings = await splunk.getOrgSplunkSettings(orgId);
    const configured = Boolean(settings.baseUrl && settings.apiToken);

    if (!configured) {
      return res.json({
        success: true,
        data: {
          configured: false,
          message: 'Splunk integration is not configured for this organization.',
          results: [],
          result_count: 0
        }
      });
    }

    const maxEvents = Math.max(1, Math.min(200, Number(req.query.maxEvents) || 50));
    const search = String(req.query.search || process.env.SPLUNK_AUDIT_LIVE_DEFAULT_SEARCH || 'index=_audit OR sourcetype=audit OR tag=audit').trim();
    const earliestTime = req.query.earliestTime || '-24h@h';
    const latestTime = req.query.latestTime || 'now';

    const result = await splunk.runSearch({
      baseUrl: settings.baseUrl,
      apiToken: settings.apiToken,
      defaultIndex: settings.defaultIndex
    }, {
      search,
      earliestTime,
      latestTime,
      maxEvents
    });

    res.json({
      success: true,
      data: {
        configured: true,
        sid: result.sid,
        search: result.search,
        earliest_time: earliestTime,
        latest_time: latestTime,
        result_count: result.results.length,
        results: result.results
      }
    });
  } catch (error) {
    console.error('Splunk live audit error:', error);
    res.status(502).json({
      success: false,
      error: 'Failed to fetch live Splunk audit events',
      details: error.message
    });
  }
});

// GET /audit/event-types
router.get('/event-types', requirePermission('audit.read'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT event_type FROM audit_logs WHERE organization_id = $1 ORDER BY event_type',
      [req.user.organization_id]
    );
    const eventTypes = result.rows.map(r => r.event_type);
    res.json({ success: true, data: eventTypes, eventTypes });
  } catch (error) {
    console.error('Event types error:', error);
    res.status(500).json({ success: false, error: 'Failed to load event types' });
  }
});

// GET /audit/user/:userId
router.get('/user/:userId', requirePermission('audit.read'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT al.id, al.event_type, al.resource_type, al.details, al.created_at, al.success
      FROM audit_logs al
      WHERE al.user_id = $1 AND al.organization_id = $2
      ORDER BY al.created_at DESC
      LIMIT 100
    `, [req.params.userId, req.user.organization_id]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('User audit error:', error);
    res.status(500).json({ success: false, error: 'Failed to load user audit logs' });
  }
});

module.exports = router;
