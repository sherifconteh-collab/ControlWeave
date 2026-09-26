'use strict';

/**
 * ERP access recertification and emergency (firefighter) access review.
 *
 * A review snapshots every active, present user of a system with their roles,
 * functions and open SoD conflicts, so the decision is recorded against what
 * the reviewer actually saw. Revocations are verified by later imports
 * (importService.verifyRevocations). Completing a review files an evidence
 * record summarizing the decisions and, when the system is linked to a
 * ticketing connector, opens a revocation ticket per revoked user
 * (ticketService).
 *
 * Routing: every item goes to the review's reviewer, or (routing 'manager')
 * to the ControlWeave user who is the ERP user's manager. The manager is
 * matched by email: the manager field is either an email address or the
 * username of another user in the same ERP system whose email is known. Items
 * whose manager cannot be matched, or who would review themselves, fall back
 * to the review's reviewer.
 */

const pool = require('../../config/database');
const { toCsvDocument } = require('../../utils/csv');
const { roleFunctionsSql } = require('./roleFunctions');
const { hashForLookup } = require('../../utils/encrypt');

class ReviewError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const normalizeEmail = (value) => {
  const text = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : null;
};

/**
 * Assign each item of a new review to the reviewed user's manager where the
 * manager is a ControlWeave user in this organization. Returns counts.
 */
async function routeToManagers(client, organizationId, reviewId) {
  const { rows } = await client.query(
    `SELECT i.id, u.email AS user_email, u.manager, mu.email AS manager_user_email
       FROM erp_access_review_items i
       JOIN erp_users u ON u.id = i.erp_user_id
       LEFT JOIN erp_users mu ON mu.system_id = u.system_id AND LOWER(mu.username) = LOWER(u.manager)
      WHERE i.review_id = $1 AND i.organization_id = $2`,
    [reviewId, organizationId]
  );
  const wanted = new Map();
  for (const row of rows) {
    const email = normalizeEmail(row.manager_user_email) || normalizeEmail(row.manager);
    if (email && email !== normalizeEmail(row.user_email)) wanted.set(row.id, email);
  }
  const emails = [...new Set(wanted.values())];
  if (!emails.length) return { routed_to_manager: 0, default_reviewer: rows.length };
  const { rows: people } = await client.query(
    `SELECT id, email_hash, LOWER(email) AS email FROM users
      WHERE organization_id = $1 AND is_active = true AND (email_hash = ANY($2::text[]) OR LOWER(email) = ANY($3::text[]))`,
    [organizationId, emails.map((e) => hashForLookup(e)), emails]
  );
  const byEmail = new Map();
  for (const email of emails) {
    const hash = hashForLookup(email);
    const person = people.find((p) => p.email_hash === hash || p.email === email);
    if (person) byEmail.set(email, person.id);
  }
  const itemIds = [];
  const reviewerIds = [];
  for (const [itemId, email] of wanted) {
    if (byEmail.has(email)) {
      itemIds.push(itemId);
      reviewerIds.push(byEmail.get(email));
    }
  }
  if (itemIds.length) {
    await client.query(
      `UPDATE erp_access_review_items i SET reviewer_id = m.reviewer_id, routed_by = 'manager'
         FROM UNNEST($2::uuid[], $3::uuid[]) AS m(item_id, reviewer_id)
        WHERE i.id = m.item_id AND i.organization_id = $1`,
      [organizationId, itemIds, reviewerIds]
    );
  }
  await client.query(
    "UPDATE erp_access_review_items SET routed_by = 'default' WHERE review_id = $1 AND organization_id = $2 AND routed_by IS NULL",
    [reviewId, organizationId]
  );
  return { routed_to_manager: itemIds.length, default_reviewer: rows.length - itemIds.length };
}

async function createReview(organizationId, userId, input) {
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 200) : '';
  if (!name) throw new ReviewError(400, 'name is required');
  const routing = input.routing === undefined ? 'reviewer' : input.routing;
  if (!['reviewer', 'manager'].includes(routing)) throw new ReviewError(400, 'routing must be reviewer or manager');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [system] } = await client.query('SELECT id FROM erp_systems WHERE id = $1 AND organization_id = $2', [input.system_id, organizationId]);
    if (!system) throw new ReviewError(404, 'ERP system not found');
    if (input.reviewer_id) {
      const { rows } = await client.query('SELECT 1 FROM users WHERE id = $1 AND organization_id = $2 AND is_active = true', [input.reviewer_id, organizationId]);
      if (!rows.length) throw new ReviewError(400, 'Reviewer not found in this organization');
    }
    const { rows: [review] } = await client.query(
      `INSERT INTO erp_access_reviews (organization_id, system_id, name, due_date, reviewer_id, created_by, routing)
       VALUES ($1, $2, $3, $4::date, $5, $6, $7) RETURNING *`,
      [organizationId, system.id, name, input.due_date || null, input.reviewer_id || null, userId, routing]
    );
    const { rowCount } = await client.query(
      `WITH role_functions AS (${roleFunctionsSql('$2')}),
       user_roles AS (
         SELECT ur.user_id,
                jsonb_agg(r.role_name ORDER BY r.role_name) AS roles,
                COALESCE(jsonb_agg(r.role_name ORDER BY r.role_name) FILTER (WHERE r.is_privileged), '[]'::jsonb) AS privileged_roles
           FROM erp_user_roles ur JOIN erp_roles r ON r.id = ur.role_id
          WHERE ur.system_id = $2
          GROUP BY ur.user_id
       ),
       user_functions AS (
         SELECT ur.user_id, jsonb_agg(DISTINCT rf.function_code) AS functions
           FROM erp_user_roles ur JOIN role_functions rf ON rf.role_id = ur.role_id
          WHERE ur.system_id = $2
          GROUP BY ur.user_id
       ),
       user_conflicts AS (
         SELECT c.user_id, COUNT(*) AS open_conflicts
           FROM erp_sod_conflicts c
          WHERE c.system_id = $2 AND c.level = 'user' AND c.status = 'open'
          GROUP BY c.user_id
       )
       INSERT INTO erp_access_review_items (organization_id, review_id, erp_user_id, username, reviewer_id, snapshot)
       SELECT $1, $3, u.id, u.username, $4,
              jsonb_build_object(
                'full_name', u.full_name, 'department', u.department, 'manager', u.manager,
                'last_login_at', u.last_login_at,
                'roles', COALESCE(ro.roles, '[]'::jsonb),
                'privileged_roles', COALESCE(ro.privileged_roles, '[]'::jsonb),
                'functions', COALESCE(fn.functions, '[]'::jsonb),
                'open_conflicts', COALESCE(uc.open_conflicts, 0)
              )
         FROM erp_users u
         LEFT JOIN user_roles ro ON ro.user_id = u.id
         LEFT JOIN user_functions fn ON fn.user_id = u.id
         LEFT JOIN user_conflicts uc ON uc.user_id = u.id
        WHERE u.system_id = $2 AND u.is_present AND u.status = 'active'`,
      [organizationId, system.id, review.id, input.reviewer_id || null]
    );
    if (!rowCount) throw new ReviewError(409, 'The system has no active users to review; import users and assignments first');
    const routingResult = routing === 'manager' ? await routeToManagers(client, organizationId, review.id) : null;
    await client.query('COMMIT');
    return { ...review, item_count: rowCount, routing_result: routingResult };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '22007' || error.code === '22008') throw new ReviewError(400, 'Invalid due date');
    throw error;
  } finally {
    client.release();
  }
}

async function listReviews(organizationId) {
  const { rows } = await pool.query(
    `SELECT rv.*, s.name AS system_name,
            COUNT(i.id)::int AS items,
            COUNT(i.id) FILTER (WHERE i.decision = 'pending')::int AS pending,
            COUNT(i.id) FILTER (WHERE i.decision = 'revoke')::int AS revoked,
            COUNT(i.id) FILTER (WHERE i.decision = 'revoke' AND i.revocation_verified_at IS NOT NULL)::int AS revocations_verified
       FROM erp_access_reviews rv
       JOIN erp_systems s ON s.id = rv.system_id
       LEFT JOIN erp_access_review_items i ON i.review_id = rv.id
      WHERE rv.organization_id = $1
      GROUP BY rv.id, s.name
      ORDER BY rv.created_at DESC
      LIMIT 200`,
    [organizationId]
  );
  return rows;
}

async function getReview(organizationId, reviewId, { decision, reviewerId, limit = 200, offset = 0 }) {
  const { rows: [review] } = await pool.query(
    `SELECT rv.*, s.name AS system_name FROM erp_access_reviews rv JOIN erp_systems s ON s.id = rv.system_id
      WHERE rv.id = $1 AND rv.organization_id = $2`,
    [reviewId, organizationId]
  );
  if (!review) return null;
  const params = [reviewId, organizationId];
  let filter = '';
  if (decision) { params.push(decision); filter = `AND i.decision = $${params.length}`; }
  if (reviewerId) {
    params.push(reviewerId);
    filter += ` AND COALESCE(i.reviewer_id, (SELECT reviewer_id FROM erp_access_reviews WHERE id = $1)) = $${params.length}`;
  }
  params.push(limit, offset);
  const { rows: items } = await pool.query(
    `SELECT i.*, TRIM(COALESCE(ru.first_name, '') || ' ' || COALESCE(ru.last_name, '')) AS reviewer_name, COUNT(*) OVER () AS total_count
       FROM erp_access_review_items i
       LEFT JOIN users ru ON ru.id = i.reviewer_id AND ru.organization_id = i.organization_id
      WHERE i.review_id = $1 AND i.organization_id = $2 ${filter}
      ORDER BY (i.snapshot->>'open_conflicts')::int DESC, i.username
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { ...review, items: items.map(({ total_count, ...rest }) => rest), total_items: items.length ? Number(items[0].total_count) : 0 };
}

/**
 * Record a decision. Anyone with erp.manage can decide any item; other users
 * can decide only items assigned to them (or, when unassigned, only if they are
 * the review's default reviewer).
 */
async function decideItem(organizationId, user, reviewId, itemId, input, { canManage }) {
  if (!['certified', 'revoke', 'pending'].includes(input.decision)) throw new ReviewError(400, 'decision must be certified, revoke or pending');
  const { rows: [item] } = await pool.query(
    `SELECT i.*, rv.status AS review_status, rv.reviewer_id AS default_reviewer
       FROM erp_access_review_items i JOIN erp_access_reviews rv ON rv.id = i.review_id
      WHERE i.id = $1 AND i.review_id = $2 AND i.organization_id = $3`,
    [itemId, reviewId, organizationId]
  );
  if (!item) throw new ReviewError(404, 'Review item not found');
  if (item.review_status !== 'active') throw new ReviewError(409, 'The review is closed');
  const assignee = item.reviewer_id || item.default_reviewer;
  if (!canManage && assignee !== user.id) throw new ReviewError(403, 'This item is assigned to another reviewer');
  const snapshotRoles = Array.isArray(item.snapshot.roles) ? item.snapshot.roles : [];
  const roles = Array.isArray(input.roles_to_revoke) ? input.roles_to_revoke.map(String).filter((r) => snapshotRoles.includes(r)) : [];
  const notes = typeof input.notes === 'string' ? input.notes.trim().slice(0, 4000) : null;
  if (input.decision === 'revoke' && !roles.length && !notes) throw new ReviewError(400, 'Choose the roles to revoke, or explain in notes that all access should be removed');
  const { rows: [updated] } = await pool.query(
    `UPDATE erp_access_review_items
        SET decision = $3, roles_to_revoke = $4::text[], notes = $5,
            decided_by = CASE WHEN $3 = 'pending' THEN NULL ELSE $6::uuid END,
            decided_at = CASE WHEN $3 = 'pending' THEN NULL ELSE NOW() END,
            revocation_verified_at = NULL
      WHERE id = $1 AND organization_id = $2 RETURNING *`,
    [itemId, organizationId, input.decision, input.decision === 'revoke' ? roles : [], notes, user.id]
  );
  return updated;
}

async function completeReview(organizationId, userId, reviewId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [review] } = await client.query(
      `SELECT rv.*, s.name AS system_name FROM erp_access_reviews rv JOIN erp_systems s ON s.id = rv.system_id
        WHERE rv.id = $1 AND rv.organization_id = $2 FOR UPDATE OF rv`,
      [reviewId, organizationId]
    );
    if (!review) throw new ReviewError(404, 'Review not found');
    if (review.status !== 'active') throw new ReviewError(409, 'The review is not active');
    const { rows: [counts] } = await client.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE decision = 'pending')::int AS pending,
              COUNT(*) FILTER (WHERE decision = 'certified')::int AS certified,
              COUNT(*) FILTER (WHERE decision = 'revoke')::int AS revoked
         FROM erp_access_review_items WHERE review_id = $1 AND organization_id = $2`,
      [reviewId, organizationId]
    );
    if (counts.pending) throw new ReviewError(409, `${counts.pending} user(s) still need a decision`);
    const description = `ERP access review "${review.name}" for ${review.system_name} completed: ${counts.total} user(s) reviewed, ${counts.certified} certified, ${counts.revoked} with access to revoke. Revocations are verified against later entitlement imports.`;
    const { rows: [evidence] } = await client.query(
      `INSERT INTO evidence (organization_id, uploaded_by, description, tags)
       VALUES ($1, $2, $3, ARRAY['erp-access-review', 'ac-2', 'user-access-review']) RETURNING id`,
      [organizationId, userId, description]
    );
    const { rows: [completed] } = await client.query(
      `UPDATE erp_access_reviews SET status = 'completed', completed_at = NOW(), evidence_id = $3
        WHERE id = $1 AND organization_id = $2 RETURNING *`,
      [reviewId, organizationId, evidence.id]
    );
    await client.query('COMMIT');
    return { ...completed, counts };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function exportReview(organizationId, reviewId) {
  const review = await getReview(organizationId, reviewId, { limit: 100000 });
  if (!review) return null;
  const header = ['username', 'full_name', 'department', 'roles', 'functions', 'open_conflicts', 'decision', 'roles_to_revoke', 'notes', 'decided_at', 'revocation_verified_at'];
  return toCsvDocument(header, review.items.map((i) => ({
    username: i.username,
    full_name: i.snapshot.full_name,
    department: i.snapshot.department,
    roles: (i.snapshot.roles || []).join(';'),
    functions: (i.snapshot.functions || []).join(';'),
    open_conflicts: i.snapshot.open_conflicts,
    decision: i.decision,
    roles_to_revoke: (i.roles_to_revoke || []).join(';'),
    notes: i.notes,
    decided_at: i.decided_at ? new Date(i.decided_at).toISOString() : '',
    revocation_verified_at: i.revocation_verified_at ? new Date(i.revocation_verified_at).toISOString() : ''
  })));
}

async function listEmergencySessions(organizationId, { status, systemId, limit = 200 }) {
  const params = [organizationId];
  const where = ['e.organization_id = $1'];
  if (status) { params.push(status); where.push(`e.review_status = $${params.length}`); }
  if (systemId) { params.push(systemId); where.push(`e.system_id = $${params.length}`); }
  params.push(limit);
  const { rows } = await pool.query(
    `SELECT e.*, s.name AS system_name,
            TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS reviewer_name
       FROM erp_emergency_sessions e
       JOIN erp_systems s ON s.id = e.system_id
       LEFT JOIN users u ON u.id = e.reviewer_id
      WHERE ${where.join(' AND ')}
      ORDER BY (e.review_status = 'pending') DESC, e.started_at DESC
      LIMIT $${params.length}`,
    params
  );
  return rows;
}

async function reviewEmergencySession(organizationId, userId, sessionId, input) {
  if (!['approved', 'escalated'].includes(input.review_status)) throw new ReviewError(400, 'review_status must be approved or escalated');
  const notes = typeof input.review_notes === 'string' ? input.review_notes.trim().slice(0, 4000) : '';
  if (!notes) throw new ReviewError(400, 'Record what was reviewed in review_notes');
  const { rows: [session] } = await pool.query('SELECT * FROM erp_emergency_sessions WHERE id = $1 AND organization_id = $2', [sessionId, organizationId]);
  if (!session) throw new ReviewError(404, 'Emergency session not found');
  if (session.review_status !== 'pending') throw new ReviewError(409, 'The session has already been reviewed');
  const { rows: [updated] } = await pool.query(
    `UPDATE erp_emergency_sessions SET review_status = $3, review_notes = $4, reviewer_id = $5, reviewed_at = NOW()
      WHERE id = $1 AND organization_id = $2 RETURNING *`,
    [sessionId, organizationId, input.review_status, notes, userId]
  );
  return updated;
}

module.exports = {
  ReviewError,
  createReview,
  listReviews,
  getReview,
  decideItem,
  completeReview,
  exportReview,
  listEmergencySessions,
  reviewEmergencySession
};
