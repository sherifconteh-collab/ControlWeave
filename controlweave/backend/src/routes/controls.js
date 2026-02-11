const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const { validateBody, requireFields, isUuid } = require('../middleware/validate');
const { getConfigValue } = require('../services/dynamicConfigService');
const { enqueueWebhookEvent } = require('../services/webhookService');

router.use(authenticate);

// GET /controls/:id
router.get('/:id', requirePermission('controls.read'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT fc.id, fc.control_id,
             COALESCE(occ.title, fc.title) as title,
             COALESCE(occ.description, fc.description) as description,
             fc.control_type, fc.priority,
             f.id as framework_id, f.name as framework_name, f.code as framework_code,
             COALESCE(ci.status, 'not_started') as implementation_status,
             ci.implementation_notes, ci.evidence_location, ci.assigned_to, ci.notes, ci.implementation_date,
             u.first_name || ' ' || u.last_name as assigned_to_name, u.email as assigned_to_email
      FROM framework_controls fc
      JOIN frameworks f ON f.id = fc.framework_id
      LEFT JOIN organization_control_content_overrides occ
        ON occ.organization_id = $2
       AND occ.framework_control_id = fc.id
      LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $2
      LEFT JOIN users u ON u.id = ci.assigned_to
      WHERE fc.id = $1
    `, [req.params.id, req.user.organization_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Control not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get control error:', error);
    res.status(500).json({ success: false, error: 'Failed to load control' });
  }
});

// PUT /controls/:id/implementation
router.put('/:id/implementation', requirePermission('controls.write'), validateBody((body) => {
  const errors = requireFields(body, ['status']);
  const allowedStatuses = ['not_started', 'in_progress', 'implemented', 'needs_review', 'satisfied_via_crosswalk', 'verified', 'not_applicable'];
  if (body.status && !allowedStatuses.includes(body.status)) {
    errors.push(`status must be one of: ${allowedStatuses.join(', ')}`);
  }
  if (body.assignedTo && !isUuid(body.assignedTo)) {
    errors.push('assignedTo must be a valid UUID');
  }
  return errors;
}), async (req, res) => {
  try {
    const controlId = req.params.id;
    const orgId = req.user.organization_id;
    const { status, implementationDetails, evidenceUrl, assignedTo, notes } = req.body;

    // Upsert implementation
    const result = await pool.query(`
      INSERT INTO control_implementations (control_id, organization_id, status, implementation_notes, evidence_location, assigned_to, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (control_id, organization_id) DO UPDATE SET
        status = EXCLUDED.status,
        implementation_notes = COALESCE(EXCLUDED.implementation_notes, control_implementations.implementation_notes),
        evidence_location = COALESCE(EXCLUDED.evidence_location, control_implementations.evidence_location),
        assigned_to = COALESCE(EXCLUDED.assigned_to, control_implementations.assigned_to),
        notes = COALESCE(EXCLUDED.notes, control_implementations.notes),
        implementation_date = CASE WHEN EXCLUDED.status = 'implemented' THEN CURRENT_DATE ELSE control_implementations.implementation_date END
      RETURNING *
    `, [controlId, orgId, status, implementationDetails || null, evidenceUrl || null, assignedTo || null, notes || null]);

    // Auto-crosswalk: if implemented, find high-similarity mappings
    let crosswalkedControls = [];
    if (status === 'implemented') {
      const thresholdConfig = await getConfigValue(orgId, 'crosswalk', 'inheritance_min_similarity', { value: 90 });
      const similarityThreshold = Number(
        thresholdConfig && typeof thresholdConfig === 'object'
          ? thresholdConfig.value
          : thresholdConfig
      ) || 90;

      const mappings = await pool.query(`
        SELECT cm.id, cm.target_control_id, cm.source_control_id, cm.similarity_score,
               fc.control_id as mapped_control_code, fc.title as mapped_title,
               f.name as framework_name, f.code as framework_code
        FROM control_mappings cm
        JOIN framework_controls fc ON (
          CASE WHEN cm.source_control_id = $1 THEN fc.id = cm.target_control_id
               ELSE fc.id = cm.source_control_id END
        )
        JOIN frameworks f ON f.id = fc.framework_id
        WHERE (cm.source_control_id = $1 OR cm.target_control_id = $1)
          AND cm.similarity_score >= $2
          AND fc.id != $1
      `, [controlId, similarityThreshold]);

      for (const mapping of mappings.rows) {
        const mappedControlId = mapping.source_control_id === controlId
          ? mapping.target_control_id
          : mapping.source_control_id;

        await pool.query(`
          INSERT INTO control_implementations (control_id, organization_id, status, notes)
          VALUES ($1, $2, 'satisfied_via_crosswalk', $3)
          ON CONFLICT (control_id, organization_id) DO UPDATE SET
            status = CASE WHEN control_implementations.status = 'not_started' THEN 'satisfied_via_crosswalk' ELSE control_implementations.status END,
            notes = CASE WHEN control_implementations.status = 'not_started'
              THEN COALESCE(control_implementations.notes || E'\n', '') || $3
              ELSE control_implementations.notes END
        `, [mappedControlId, orgId, `Auto-satisfied via crosswalk (${mapping.similarity_score}% match)`]);

        crosswalkedControls.push({
          controlId: mapping.mapped_control_code,
          title: mapping.mapped_title,
          framework: mapping.framework_name,
          similarity: mapping.similarity_score
        });
      }
    }

    // Log audit
    await pool.query(
      `INSERT INTO audit_logs (organization_id, user_id, event_type, resource_type, resource_id, details)
       VALUES ($1, $2, 'control_status_changed', 'control', $3, $4)`,
      [orgId, req.user.id, controlId, JSON.stringify({ status, crosswalkedControls: crosswalkedControls.length })]
    );

    res.json({
      success: true,
      data: {
        implementation: result.rows[0],
        crosswalkedControls
      }
    });
  } catch (error) {
    console.error('Update implementation error:', error);
    res.status(500).json({ success: false, error: 'Failed to update implementation' });
  }
});

// POST /controls/:id/inherit
// Manually trigger inheritance to mapped controls with dynamic threshold support.
router.post('/:id/inherit', requirePermission('controls.write'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const sourceControlId = req.params.id;
    const {
      minSimilarity,
      inheritedStatus,
      includeAlreadyImplemented = false,
      dryRun = false
    } = req.body || {};

    const configThreshold = await getConfigValue(orgId, 'crosswalk', 'inheritance_min_similarity', { value: 90 });
    const resolvedThreshold = Math.max(
      1,
      Math.min(
        100,
        Number(minSimilarity || (configThreshold && typeof configThreshold === 'object' ? configThreshold.value : configThreshold) || 90)
      )
    );

    const sourceImpl = await pool.query(
      `SELECT status
       FROM control_implementations
       WHERE organization_id = $1
         AND control_id = $2
       LIMIT 1`,
      [orgId, sourceControlId]
    );
    const sourceStatus = sourceImpl.rows[0]?.status || 'in_progress';
    const nextStatus = inheritedStatus || (sourceStatus === 'implemented' ? 'satisfied_via_crosswalk' : sourceStatus);

    const mappings = await pool.query(
      `SELECT
         CASE
           WHEN cm.source_control_id = $1 THEN cm.target_control_id
           ELSE cm.source_control_id
         END AS target_control_id,
         cm.similarity_score,
         fc.control_id AS target_control_code,
         fc.title AS target_control_title
       FROM control_mappings cm
       JOIN framework_controls fc ON fc.id = (
         CASE
           WHEN cm.source_control_id = $1 THEN cm.target_control_id
           ELSE cm.source_control_id
         END
       )
       WHERE (cm.source_control_id = $1 OR cm.target_control_id = $1)
         AND cm.similarity_score >= $2
       ORDER BY cm.similarity_score DESC`,
      [sourceControlId, resolvedThreshold]
    );

    const processed = [];
    for (const mapRow of mappings.rows) {
      const current = await pool.query(
        `SELECT status
         FROM control_implementations
         WHERE organization_id = $1 AND control_id = $2
         LIMIT 1`,
        [orgId, mapRow.target_control_id]
      );
      const currentStatus = current.rows[0]?.status || 'not_started';
      const shouldSkip = !includeAlreadyImplemented && ['implemented', 'verified'].includes(currentStatus);
      processed.push({
        target_control_id: mapRow.target_control_id,
        target_control_code: mapRow.target_control_code,
        target_control_title: mapRow.target_control_title,
        similarity_score: mapRow.similarity_score,
        previous_status: currentStatus,
        next_status: shouldSkip ? currentStatus : nextStatus,
        skipped: shouldSkip
      });

      if (dryRun || shouldSkip) continue;

      await pool.query(
        `INSERT INTO control_implementations (control_id, organization_id, status, notes, implementation_date)
         VALUES ($1, $2, $3, $4, CASE WHEN $3 = 'implemented' THEN CURRENT_DATE ELSE NULL END)
         ON CONFLICT (control_id, organization_id) DO UPDATE SET
           status = EXCLUDED.status,
           notes = CASE
             WHEN COALESCE(control_implementations.notes, '') = '' THEN EXCLUDED.notes
             ELSE control_implementations.notes || E'\n' || EXCLUDED.notes
           END`,
        [
          mapRow.target_control_id,
          orgId,
          nextStatus,
          `Inherited from mapped control ${sourceControlId} (${mapRow.similarity_score}% similarity).`
        ]
      );

      await pool.query(
        `INSERT INTO control_inheritance_events (
           organization_id, source_control_id, target_control_id, source_status, inherited_status,
           similarity_score, event_notes, triggered_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          orgId,
          sourceControlId,
          mapRow.target_control_id,
          sourceStatus,
          nextStatus,
          mapRow.similarity_score,
          'Manual inheritance trigger',
          req.user.id
        ]
      );
    }

    if (!dryRun) {
      await pool.query(
        `INSERT INTO audit_logs (organization_id, user_id, event_type, resource_type, resource_id, details, success)
         VALUES ($1, $2, 'control_inheritance_triggered', 'control', $3, $4::jsonb, true)`,
        [
          orgId,
          req.user.id,
          sourceControlId,
          JSON.stringify({
            threshold: resolvedThreshold,
            inherited_status: nextStatus,
            processed: processed.length,
            updated: processed.filter((p) => !p.skipped).length
          })
        ]
      );

      await enqueueWebhookEvent({
        organizationId: orgId,
        eventType: 'control.inheritance.triggered',
        payload: {
          source_control_id: sourceControlId,
          threshold: resolvedThreshold,
          inherited_status: nextStatus,
          updated: processed.filter((p) => !p.skipped).length
        }
      }).catch(() => {});
    }

    res.json({
      success: true,
      data: {
        source_control_id: sourceControlId,
        threshold: resolvedThreshold,
        inherited_status: nextStatus,
        dry_run: Boolean(dryRun),
        processed
      }
    });
  } catch (error) {
    console.error('Control inherit error:', error);
    res.status(500).json({ success: false, error: 'Failed to run control inheritance' });
  }
});

// GET /controls/:id/mappings
router.get('/:id/mappings', requirePermission('controls.read'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        fc2.id, fc2.control_id, COALESCE(occ.title, fc2.title) as title,
        f2.code as framework_code, f2.name as framework_name,
        cm.similarity_score, cm.mapping_type, cm.notes,
        COALESCE(ci.status, 'not_started') as implementation_status
      FROM control_mappings cm
      JOIN framework_controls fc2 ON (
        CASE WHEN cm.source_control_id = $1 THEN fc2.id = cm.target_control_id
             ELSE fc2.id = cm.source_control_id END
      )
      JOIN frameworks f2 ON f2.id = fc2.framework_id
      LEFT JOIN organization_control_content_overrides occ
        ON occ.organization_id = $2
       AND occ.framework_control_id = fc2.id
      LEFT JOIN control_implementations ci ON ci.control_id = fc2.id AND ci.organization_id = $2
      WHERE (cm.source_control_id = $1 OR cm.target_control_id = $1)
        AND fc2.id != $1
      ORDER BY cm.similarity_score DESC
    `, [req.params.id, req.user.organization_id]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get mappings error:', error);
    res.status(500).json({ success: false, error: 'Failed to load mappings' });
  }
});

// GET /controls/:id/history
router.get('/:id/history', requirePermission('controls.read'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT al.id, al.event_type, al.details, al.created_at,
             u.first_name || ' ' || u.last_name as changed_by
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.resource_id = $1
        AND al.resource_type = 'control'
        AND al.organization_id = $2
      ORDER BY al.created_at DESC
      LIMIT 50
    `, [req.params.id, req.user.organization_id]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Control history error:', error);
    res.status(500).json({ success: false, error: 'Failed to load control history' });
  }
});

module.exports = router;
