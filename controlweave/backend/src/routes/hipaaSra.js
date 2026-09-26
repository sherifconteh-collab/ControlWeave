'use strict';

/**
 * HIPAA Security Risk Assessment routes (services/hipaaSraService.js).
 *
 *   GET    /hipaa-sra                        list assessments
 *   POST   /hipaa-sra                        start an assessment
 *   GET    /hipaa-sra/:id                    assessment, questionnaire and summary
 *   PUT    /hipaa-sra/:id/responses/:controlId  save one answer
 *   POST   /hipaa-sra/:id/complete           finalize and promote risks
 *   GET    /hipaa-sra/:id/export             CSV of every answer
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const pool = require('../config/database');
const { authenticate, requirePermission } = require('../middleware/auth');
const { createOrgRateLimiter } = require('../middleware/rateLimit');
const { isUuid, sanitizeText } = require('../middleware/validate');
const auditService = require('../services/auditService');
const sra = require('../services/hipaaSraService');
const { requireFeature } = require('../services/entitlementService');
const { log, serializeError } = require('../utils/logger');

router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 600 }));
router.use(authenticate);
router.use(createOrgRateLimiter({ label: 'hipaa-sra', windowMs: 15 * 60 * 1000, max: 500 }));

const TEXT_LIMIT = 4000;

function cleanText(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  return sanitizeText(value).slice(0, TEXT_LIMIT);
}

function cleanScale(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : undefined;
}

async function loadAssessment(organizationId, id) {
  const { rows } = await pool.query(
    `SELECT a.*, TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS started_by_name
       FROM hipaa_risk_assessments a
       LEFT JOIN users u ON u.id = a.started_by
      WHERE a.organization_id = $1 AND a.id = $2`,
    [organizationId, id]
  );
  return rows[0] || null;
}

function failed(res, error, event) {
  log('error', event, { error: serializeError(error) });
  return res.status(500).json({ success: false, error: 'Internal server error' });
}

router.get('/', requirePermission('risks.read'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.name, a.status, a.scope, a.summary, a.created_at, a.completed_at,
              TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS started_by_name,
              (SELECT COUNT(*)::int FROM hipaa_risk_assessment_responses r
                WHERE r.assessment_id = a.id AND r.answer IS NOT NULL) AS answered
         FROM hipaa_risk_assessments a
         LEFT JOIN users u ON u.id = a.started_by
        WHERE a.organization_id = $1
        ORDER BY a.created_at DESC
        LIMIT 100`,
      [req.user.organization_id]
    );
    const frameworkId = await sra.getHipaaFrameworkId();
    res.json({ success: true, data: { assessments: rows, hipaa_available: Boolean(frameworkId) } });
  } catch (error) {
    return failed(res, error, 'hipaa_sra.list_failed');
  }
});

router.post('/', requirePermission('risks.write'), requireFeature('hipaa_sra'), async (req, res) => {
  try {
    const name = cleanText(req.body && req.body.name);
    if (!name || name.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'Name is required (at least 3 characters)' });
    }
    if (!(await sra.getHipaaFrameworkId())) {
      return res.status(409).json({ success: false, error: 'The HIPAA Security Rule framework is not installed on this deployment' });
    }
    const scopeInput = (req.body && typeof req.body.scope === 'object' && req.body.scope) || {};
    const scope = {
      entity_type: ['covered_entity', 'business_associate', 'hybrid'].includes(scopeInput.entity_type) ? scopeInput.entity_type : null,
      locations: cleanText(scopeInput.locations) || null,
      ephi_systems: cleanText(scopeInput.ephi_systems) || null,
      assessor: cleanText(scopeInput.assessor) || null
    };
    const { rows } = await pool.query(
      `INSERT INTO hipaa_risk_assessments (organization_id, name, scope, started_by)
       VALUES ($1, $2, $3::jsonb, $4) RETURNING *`,
      [req.user.organization_id, name.trim(), JSON.stringify(scope), req.user.id]
    );
    await auditService.logFromRequest(req, {
      eventType: 'hipaa_sra.created', resourceType: 'hipaa_sra', resourceId: rows[0].id, details: { name: rows[0].name }
    });
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    return failed(res, error, 'hipaa_sra.create_failed');
  }
});

router.get('/:id', requirePermission('risks.read'), async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid assessment id' });
    const assessment = await loadAssessment(req.user.organization_id, req.params.id);
    if (!assessment) return res.status(404).json({ success: false, error: 'Assessment not found' });
    const safeguards = await sra.getQuestionnaire(req.user.organization_id, assessment.id);
    res.json({ success: true, data: { assessment, safeguards, summary: sra.summarize(safeguards) } });
  } catch (error) {
    return failed(res, error, 'hipaa_sra.get_failed');
  }
});

function parseResponse(body) {
  const input = body || {};
  const fields = {
    answer: input.answer === undefined || input.answer === null || input.answer === '' ? null : input.answer,
    addressable_decision: input.addressable_decision || null,
    threat: cleanText(input.threat),
    vulnerability: cleanText(input.vulnerability),
    likelihood: cleanScale(input.likelihood),
    impact: cleanScale(input.impact),
    notes: cleanText(input.notes)
  };
  if (fields.answer !== null && !sra.ANSWERS.includes(fields.answer)) return { error: `answer must be one of: ${sra.ANSWERS.join(', ')}` };
  if (fields.addressable_decision !== null && !sra.ADDRESSABLE_DECISIONS.includes(fields.addressable_decision)) {
    return { error: `addressable_decision must be one of: ${sra.ADDRESSABLE_DECISIONS.join(', ')}` };
  }
  if (fields.likelihood === undefined || fields.impact === undefined) return { error: 'likelihood and impact must be whole numbers from 1 to 5' };
  if ([fields.threat, fields.vulnerability, fields.notes].includes(undefined)) return { error: 'threat, vulnerability and notes must be text' };
  return { fields };
}

router.put('/:id/responses/:controlId', requirePermission('risks.write'), async (req, res) => {
  try {
    if (!isUuid(req.params.id) || !isUuid(req.params.controlId)) {
      return res.status(400).json({ success: false, error: 'Invalid id' });
    }
    const assessment = await loadAssessment(req.user.organization_id, req.params.id);
    if (!assessment) return res.status(404).json({ success: false, error: 'Assessment not found' });
    if (assessment.status !== 'in_progress') {
      return res.status(409).json({ success: false, error: 'Completed assessments are read-only. Start a new assessment to reassess.' });
    }
    const frameworkId = await sra.getHipaaFrameworkId();
    const control = await pool.query(
      'SELECT id FROM framework_controls WHERE id = $1 AND framework_id = $2',
      [req.params.controlId, frameworkId]
    );
    if (control.rows.length === 0) return res.status(404).json({ success: false, error: 'Not a HIPAA Security Rule requirement' });
    const { fields, error } = parseResponse(req.body);
    if (error) return res.status(400).json({ success: false, error });
    const { rows } = await pool.query(
      `INSERT INTO hipaa_risk_assessment_responses
         (organization_id, assessment_id, control_id, answer, addressable_decision, threat,
          vulnerability, likelihood, impact, notes, responded_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       ON CONFLICT ON CONSTRAINT hipaa_sra_response_unique DO UPDATE SET
         answer = EXCLUDED.answer, addressable_decision = EXCLUDED.addressable_decision,
         threat = EXCLUDED.threat, vulnerability = EXCLUDED.vulnerability,
         likelihood = EXCLUDED.likelihood, impact = EXCLUDED.impact, notes = EXCLUDED.notes,
         responded_by = EXCLUDED.responded_by, updated_at = NOW()
       RETURNING *`,
      [
        req.user.organization_id, assessment.id, req.params.controlId, fields.answer, fields.addressable_decision,
        fields.threat, fields.vulnerability, fields.likelihood, fields.impact, fields.notes, req.user.id
      ]
    );
    await pool.query('UPDATE hipaa_risk_assessments SET updated_at = NOW() WHERE id = $1', [assessment.id]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    return failed(res, error, 'hipaa_sra.response_failed');
  }
});

router.post('/:id/complete', requirePermission('risks.write'), async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid assessment id' });
  const client = await pool.connect();
  try {
    const orgId = req.user.organization_id;
    const assessment = await loadAssessment(orgId, req.params.id);
    if (!assessment) return res.status(404).json({ success: false, error: 'Assessment not found' });
    if (assessment.status !== 'in_progress') return res.status(409).json({ success: false, error: 'Assessment is already completed' });
    const safeguards = await sra.getQuestionnaire(orgId, assessment.id);
    const summary = sra.summarize(safeguards);
    if (summary.answered < summary.total) {
      return res.status(400).json({ success: false, error: `Answer every requirement before completing (${summary.total - summary.answered} remaining)` });
    }
    const promote = !(req.body && req.body.promote_risks === false);
    await client.query('BEGIN');
    const risksCreated = promote
      ? await sra.promoteRisks(client, { organizationId: orgId, userId: req.user.id, assessment, questions: sra.answerableQuestions(safeguards) })
      : 0;
    const finalSummary = { ...summary, risks_created: risksCreated };
    const { rows } = await client.query(
      `UPDATE hipaa_risk_assessments
          SET status = 'completed', completed_by = $3, completed_at = NOW(), summary = $4::jsonb, updated_at = NOW()
        WHERE organization_id = $1 AND id = $2 RETURNING *`,
      [orgId, assessment.id, req.user.id, JSON.stringify(finalSummary)]
    );
    await client.query('COMMIT');
    await auditService.logFromRequest(req, {
      eventType: 'hipaa_sra.completed', resourceType: 'hipaa_sra', resourceId: assessment.id,
      details: { gaps: summary.gaps, required_gaps: summary.required_gaps, risks_created: risksCreated }
    });
    res.json({ success: true, data: { assessment: rows[0], summary: finalSummary } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    return failed(res, error, 'hipaa_sra.complete_failed');
  } finally {
    client.release();
  }
});

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

router.get('/:id/export', requirePermission('risks.read'), async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid assessment id' });
    const assessment = await loadAssessment(req.user.organization_id, req.params.id);
    if (!assessment) return res.status(404).json({ success: false, error: 'Assessment not found' });
    const safeguards = await sra.getQuestionnaire(req.user.organization_id, assessment.id);
    const header = ['Safeguard', 'Citation', 'Requirement', 'Level', 'Answer', 'Addressable decision', 'Threat', 'Vulnerability', 'Likelihood', 'Impact', 'Risk score', 'Severity', 'Notes'];
    const rows = safeguards.flatMap((s) => sra.answerableQuestions([s]).map((q) => [
      s.label, q.control_id.replace(/^HIPAA-/, ''), q.title, q.level, q.answer, q.addressable_decision,
      q.threat, q.vulnerability, q.likelihood, q.impact, q.risk_score, q.severity, q.notes
    ]));
    await auditService.logFromRequest(req, {
      eventType: 'hipaa_sra.exported', resourceType: 'hipaa_sra', resourceId: assessment.id, details: { format: 'csv' }
    }).catch(() => {});
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="hipaa-sra-${assessment.id}.csv"`);
    res.send([header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n'));
  } catch (error) {
    return failed(res, error, 'hipaa_sra.export_failed');
  }
});

module.exports = router;
