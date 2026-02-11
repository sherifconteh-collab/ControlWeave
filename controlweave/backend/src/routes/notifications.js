const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const { validateBody, requireFields } = require('../middleware/validate');

router.use(authenticate);

// GET /notifications
router.get('/', requirePermission('notifications.read'), async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId = req.user.organization_id;
    const limit = parseInt(req.query.limit) || 20;
    const unreadOnly = req.query.unread === 'true';

    let query = `
      SELECT id, type, title, message, link, is_read, created_at
      FROM notifications
      WHERE organization_id = $1 AND (user_id = $2 OR user_id IS NULL)
    `;
    const params = [orgId, userId];

    if (unreadOnly) {
      query += ' AND is_read = false';
    }

    query += ' ORDER BY created_at DESC LIMIT $3';
    params.push(limit);

    const result = await pool.query(query, params);

    // Get unread count
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE organization_id = $1 AND (user_id = $2 OR user_id IS NULL) AND is_read = false',
      [orgId, userId]
    );

    res.json({
      success: true,
      data: {
        notifications: result.rows,
        unreadCount: parseInt(countResult.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Notifications error:', error);
    res.status(500).json({ success: false, error: 'Failed to load notifications' });
  }
});

// PATCH /notifications/:id/read
router.patch('/:id/read', requirePermission('notifications.write'), async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND (user_id = $2 OR user_id IS NULL) AND organization_id = $3',
      [req.params.id, req.user.id, req.user.organization_id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
  }
});

// POST /notifications/read-all
router.post('/read-all', requirePermission('notifications.write'), async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE organization_id = $1 AND (user_id = $2 OR user_id IS NULL)',
      [req.user.organization_id, req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Read all error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark all as read' });
  }
});

// POST /notifications (create notification — internal use, admin only)
router.post('/', requirePermission('notifications.write'), validateBody((body) => {
  const errors = requireFields(body, ['type', 'title', 'message']);
  return errors;
}), async (req, res) => {
  try {
    const { type, title, message, link, userId } = req.body;

    if (userId) {
      const userResult = await pool.query(
        'SELECT id FROM users WHERE id = $1 AND organization_id = $2',
        [userId, req.user.organization_id]
      );
      if (userResult.rows.length === 0) {
        return res.status(400).json({ success: false, error: 'userId is not in your organization' });
      }
    }

    const result = await pool.query(`
      INSERT INTO notifications (organization_id, user_id, type, title, message, link)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [req.user.organization_id, userId || null, type, title, message, link || null]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ success: false, error: 'Failed to create notification' });
  }
});

module.exports = router;
