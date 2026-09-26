// @tier: community
/**
 * Crosswalk credit ledger and reversal.
 *
 * ControlWeave already credits mapped controls forward: `routes/controls.js`
 * flips `not_started` targets to `satisfied_via_crosswalk` when a source control
 * is implemented, at the org's configured similarity threshold. This module is
 * the half that was missing — recording *which* source justified each credit, so
 * the credit can be explained to an assessor and withdrawn when the source stops
 * being implemented.
 *
 * Guarantees this module keeps, because it writes compliance status without a
 * human in the loop:
 *
 *   - It never touches human work. Withdrawal only rewrites controls still
 *     sitting at `satisfied_via_crosswalk`. If someone has since implemented the
 *     control themselves, their status stands.
 *   - It is reversible per source. A target justified by two sources keeps its
 *     credit until the last of them stops being implemented.
 *   - It restores what was there. Withdrawal writes back the status recorded at
 *     credit time rather than assuming `not_started`.
 *   - It never credits across tenants. Every query is organization-scoped.
 */
const pool = require('../config/database');
const { log, serializeError } = require('../utils/logger');
const { getConfigValue } = require('./dynamicConfigService');

// Mapping types strict enough to justify crediting a target automatically.
const STRICT_CROSSWALK_MAPPING_TYPES = ['equivalent', 'exact'];

// Source statuses that justify crediting mapped controls. A source that leaves
// this set has its credits withdrawn.
const CREDITING_STATUSES = ['implemented', 'verified'];

/**
 * Records credits for targets the caller just credited.
 *
 * `credits` entries are `{ targetControlId, similarityScore, mappingType,
 * previousStatus }`. `previousStatus` is the target's status *before* any
 * crosswalk credit — when the target was already `satisfied_via_crosswalk` from
 * another source, the earlier credit's `previous_status` is reused instead, so
 * withdrawing the last source cannot restore a control to a status that was
 * itself only ever crosswalk credit.
 */
async function recordCredits(executor, { organizationId, sourceControlId, credits, actorUserId }) {
  if (!Array.isArray(credits) || credits.length === 0) return 0;

  const targetIds = credits.map((credit) => credit.targetControlId);
  const priorCredits = await executor.query(
    `SELECT DISTINCT ON (target_control_id) target_control_id, previous_status
     FROM control_crosswalk_credits
     WHERE organization_id = $1 AND target_control_id = ANY($2::uuid[])
     ORDER BY target_control_id, created_at ASC`,
    [organizationId, targetIds]
  );
  const priorByTarget = new Map(
    priorCredits.rows.map((row) => [row.target_control_id, row.previous_status])
  );

  const resolvedPrevious = credits.map((credit) => {
    const observed = credit.previousStatus || 'not_started';
    if (observed !== 'satisfied_via_crosswalk') return observed;
    return priorByTarget.get(credit.targetControlId) || 'not_started';
  });

  const result = await executor.query(
    `INSERT INTO control_crosswalk_credits
       (organization_id, target_control_id, source_control_id, similarity_score,
        mapping_type, previous_status, created_by)
     SELECT $1, t.target_id, $2, t.score, t.mapping_type, t.previous_status, $3
     FROM UNNEST($4::uuid[], $5::int[], $6::text[], $7::text[])
       AS t(target_id, score, mapping_type, previous_status)
     ON CONFLICT (organization_id, target_control_id, source_control_id) DO UPDATE
       SET similarity_score = EXCLUDED.similarity_score,
           mapping_type = EXCLUDED.mapping_type,
           created_at = NOW()`,
    [
      organizationId,
      sourceControlId,
      actorUserId || null,
      targetIds,
      credits.map((credit) => Number(credit.similarityScore) || 0),
      credits.map((credit) => credit.mappingType || null),
      resolvedPrevious
    ]
  );

  return result.rowCount || 0;
}

/**
 * Withdraws this source's credits, restoring only the targets no other
 * still-crediting source justifies.
 */
async function withdrawCredits(executor, { organizationId, sourceControlId }) {
  const credits = await executor.query(
    `DELETE FROM control_crosswalk_credits
     WHERE organization_id = $1 AND source_control_id = $2
     RETURNING target_control_id, previous_status`,
    [organizationId, sourceControlId]
  );

  let restored = 0;
  for (const credit of credits.rows) {
    const stillCredited = await executor.query(
      `SELECT 1
       FROM control_crosswalk_credits ccc
       JOIN control_implementations ci
         ON ci.control_id = ccc.source_control_id
        AND ci.organization_id = ccc.organization_id
       WHERE ccc.organization_id = $1
         AND ccc.target_control_id = $2
         AND ci.status = ANY($3::text[])
       LIMIT 1`,
      [organizationId, credit.target_control_id, CREDITING_STATUSES]
    );

    if (stillCredited.rows.length > 0) continue;

    // Only rewrite a control still sitting on crosswalk credit. If someone has
    // since done the work themselves, leave their status alone.
    const updated = await executor.query(
      `UPDATE control_implementations
       SET status = $3, updated_at = NOW()
       WHERE control_id = $1
         AND organization_id = $2
         AND status = 'satisfied_via_crosswalk'`,
      [credit.target_control_id, organizationId, credit.previous_status || 'not_started']
    );
    restored += updated.rowCount || 0;
  }

  return restored;
}

/**
 * Called when a control's status changes to something that no longer justifies
 * crediting. Runs in its own transaction and never throws into the caller: the
 * user's own status update has already succeeded and must not be rolled back
 * because bookkeeping failed.
 */
async function handleSourceStatusChange({ organizationId, controlId, newStatus, actorUserId }) {
  if (CREDITING_STATUSES.includes(newStatus)) return { withdrawn: 0 };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const withdrawn = await withdrawCredits(client, { organizationId, sourceControlId: controlId });

    // AU-2: removing credit changes the organization's compliance posture, so it
    // belongs in the audit log rather than only the application log.
    if (withdrawn > 0) {
      await client.query(
        `INSERT INTO audit_logs (organization_id, user_id, event_type, resource_type, resource_id, details)
         VALUES ($1, $2, 'crosswalk_credit_withdrawn', 'control', $3, $4)`,
        [
          organizationId,
          actorUserId || null,
          controlId,
          JSON.stringify({ new_status: newStatus, controls_restored: withdrawn })
        ]
      );
    }

    await client.query('COMMIT');

    if (withdrawn > 0) {
      log('info', 'crosswalk.credit_withdrawn', {
        organizationId, controlId, newStatus, withdrawn
      });
    }

    return { withdrawn };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    log('error', 'crosswalk.withdraw_failed', {
      organizationId, controlId, newStatus, error: serializeError(error)
    });
    return { withdrawn: 0, error: true };
  } finally {
    client.release();
  }
}

/**
 * Why is this control credited? Used by the control detail view so the
 * provenance is visible rather than implied by a bare status.
 */
async function getCreditsForControl(organizationId, controlId) {
  const result = await pool.query(
    `SELECT ccc.similarity_score,
            ccc.mapping_type,
            ccc.created_at,
            src.control_id AS source_control_ref,
            src.title      AS source_control_title,
            f.code         AS source_framework_code,
            f.name         AS source_framework_name,
            ci.status      AS source_status
     FROM control_crosswalk_credits ccc
     JOIN framework_controls src ON src.id = ccc.source_control_id
     JOIN frameworks f ON f.id = src.framework_id
     LEFT JOIN control_implementations ci
       ON ci.control_id = ccc.source_control_id
      AND ci.organization_id = ccc.organization_id
     WHERE ccc.organization_id = $1 AND ccc.target_control_id = $2
     ORDER BY ccc.similarity_score DESC`,
    [organizationId, controlId]
  );
  return result.rows;
}

/**
 * Credits mapped controls when a source control becomes implemented: every
 * not_started control in a framework the organization pursues that maps to the
 * source as "equivalent"/"exact" (or at 100% similarity) at or above the
 * organization's threshold becomes satisfied_via_crosswalk, with the credit
 * recorded so it can be explained and withdrawn later. Optionally propagates
 * the source's evidence links to strictly-mapped targets.
 *
 * Shared by every endpoint that can mark a control implemented. Crediting used
 * to live only in PUT /controls/:id, so marking a control implemented from the
 * control page (PATCH /implementations/:id/status) never granted credit.
 */
async function applyCreditsForSource({ organizationId, sourceControlId, actorUserId, propagateEvidence, executor = pool }) {
  const crosswalkedControls = [];
  let propagatedEvidenceLinks = 0;
  const appliedCredits = [];
  const thresholdConfig = await getConfigValue(organizationId, 'crosswalk', 'inheritance_min_similarity', { value: 90 });
  const similarityThreshold = Number(
    thresholdConfig && typeof thresholdConfig === 'object'
      ? thresholdConfig.value
      : thresholdConfig
  ) || 90;

  const evidencePropagationConfig = await getConfigValue(organizationId, 'crosswalk', 'auto_propagate_evidence_exact', { value: false });
  const shouldPropagateEvidence = typeof propagateEvidence === 'boolean'
    ? propagateEvidence
    : Boolean(
      evidencePropagationConfig && typeof evidencePropagationConfig === 'object'
        ? evidencePropagationConfig.value
        : evidencePropagationConfig
    );

  const mappings = await executor.query(`
    SELECT 
      cm.id,
      cm.source_control_id,
      cm.target_control_id,
      cm.similarity_score,
      cm.mapping_type,
      CASE 
        WHEN cm.source_control_id = $1 THEN cm.target_control_id
        ELSE cm.source_control_id
      END AS mapped_control_id,
      fc.control_id as mapped_control_code,
      fc.title as mapped_title,
      f.name as framework_name,
      f.code as framework_code
    FROM control_mappings cm
    JOIN framework_controls fc ON fc.id = CASE 
      WHEN cm.source_control_id = $1 THEN cm.target_control_id
      ELSE cm.source_control_id
    END
    JOIN frameworks f ON f.id = fc.framework_id
    WHERE (cm.source_control_id = $1 OR cm.target_control_id = $1)
      AND cm.similarity_score >= $2
      AND (
        COALESCE(LOWER(cm.mapping_type), '') = ANY($3::text[])
        OR cm.similarity_score = 100
      )
      AND cm.source_control_id != cm.target_control_id
      -- Credit only frameworks the organization is actually pursuing;
      -- satisfying controls in a framework they have not adopted inflates
      -- the posture the dashboards report. Organizations that have never
      -- populated organization_frameworks have declared no scope, so the
      -- original unrestricted behavior stands for them.
      AND (
        NOT EXISTS (SELECT 1 FROM organization_frameworks scope WHERE scope.organization_id = $4)
        OR EXISTS (
          SELECT 1 FROM organization_frameworks scope
          WHERE scope.organization_id = $4 AND scope.framework_id = fc.framework_id
        )
      )
  `, [sourceControlId, similarityThreshold, STRICT_CROSSWALK_MAPPING_TYPES, organizationId]);

  for (const mapping of mappings.rows) {
    const mappedControlId = mapping.mapped_control_id;

    // The CTE reads the target's status before the upsert rewrites it, so
    // the ledger can record what to restore on withdrawal and so a target
    // that was already satisfied by someone's own work is not logged as
    // crosswalk credit.
    const credited = await executor.query(`
      WITH prior AS (
        SELECT status FROM control_implementations
        WHERE control_id = $1 AND organization_id = $2
      ),
      upserted AS (
        INSERT INTO control_implementations (control_id, organization_id, status, notes)
        VALUES ($1, $2, 'satisfied_via_crosswalk', $3)
        ON CONFLICT (control_id, organization_id) DO UPDATE SET
          status = CASE WHEN control_implementations.status = 'not_started' THEN 'satisfied_via_crosswalk' ELSE control_implementations.status END,
          notes = CASE WHEN control_implementations.status = 'not_started'
            THEN COALESCE(control_implementations.notes || E'\n', '') || $3
            ELSE control_implementations.notes END
        RETURNING status
      )
      SELECT COALESCE((SELECT status FROM prior), 'not_started') AS previous_status,
             (SELECT status FROM upserted) AS new_status
    `, [mappedControlId, organizationId, `Auto-satisfied via crosswalk (${mapping.similarity_score}% ${mapping.mapping_type || 'mapped'} match)`]);

    const creditApplied = credited.rows[0]?.new_status === 'satisfied_via_crosswalk';
    if (creditApplied) {
      appliedCredits.push({
        targetControlId: mappedControlId,
        similarityScore: mapping.similarity_score,
        mappingType: mapping.mapping_type,
        previousStatus: credited.rows[0].previous_status
      });
    }

    if (shouldPropagateEvidence) {
      const propagated = await executor.query(
        `INSERT INTO evidence_control_links (evidence_id, control_id, notes, organization_id)
         SELECT DISTINCT ecl.evidence_id, $2::uuid, $3, e.organization_id
         FROM evidence_control_links ecl
         JOIN evidence e ON e.id = ecl.evidence_id
         WHERE ecl.control_id = $4::uuid
           AND e.organization_id = $1
         ON CONFLICT (evidence_id, control_id) DO NOTHING`,
        [
          organizationId,
          mappedControlId,
          `Auto-propagated via strict crosswalk from control ${sourceControlId}`,
          sourceControlId
        ]
      );
      propagatedEvidenceLinks += propagated.rowCount || 0;
    }

    crosswalkedControls.push({
      controlId: mapping.mapped_control_code,
      title: mapping.mapped_title,
      framework: mapping.framework_name,
      similarity: mapping.similarity_score,
      mappingType: mapping.mapping_type || null,
      // False when the target was already implemented, verified, or
      // otherwise claimed by human work — the mapping matched, but no
      // credit was applied and nothing was recorded in the ledger.
      credited: creditApplied
    });
  }

  // Record provenance for every credit applied, so it can be explained to
  // an assessor and withdrawn if this source stops being implemented.
  // Bookkeeping must never fail the status change the user asked for.
  try {
    await recordCredits(executor, {
      organizationId,
      sourceControlId,
      credits: appliedCredits,
      actorUserId
    });
  } catch (creditError) {
    log('error', 'crosswalk.record_credits_failed', {
      organizationId, sourceControlId, error: creditError?.message || String(creditError)
    });
  }

  return { crosswalkedControls, appliedCredits, propagatedEvidenceLinks };
}

module.exports = {
  CREDITING_STATUSES,
  STRICT_CROSSWALK_MAPPING_TYPES,
  applyCreditsForSource,
  recordCredits,
  withdrawCredits,
  handleSourceStatusChange,
  getCreditsForControl
};
