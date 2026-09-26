'use strict';

/**
 * HIPAA Security Risk Assessment (45 CFR 164.308(a)(1)(ii)(A)).
 *
 * An assessment walks every HIPAA Security Rule standard and implementation
 * specification loaded in the `hipaa` framework (migration 157). Standards
 * that have implementation specifications are shown as headings; the
 * specifications, and standards without any, are the questions answered.
 * Scores use the risk register's 1-5 likelihood and impact scale and
 * severity bands, so promoted risks line up with everything else.
 */

const pool = require('../config/database');
const riskService = require('./riskRegisterService');

const SAFEGUARDS = [
  { id: 'administrative', label: 'Administrative safeguards', section: '164.308' },
  { id: 'physical', label: 'Physical safeguards', section: '164.310' },
  { id: 'technical', label: 'Technical safeguards', section: '164.312' },
  { id: 'organizational', label: 'Organizational requirements', section: '164.314' },
  { id: 'documentation', label: 'Policies, procedures and documentation', section: '164.316' }
];

const ANSWERS = ['implemented', 'partially_implemented', 'not_implemented', 'not_applicable'];
const ADDRESSABLE_DECISIONS = ['implemented', 'alternative_measure', 'not_reasonable'];

function safeguardFor(controlCode) {
  const match = SAFEGUARDS.find((s) => String(controlCode).includes(s.section));
  return match ? match.id : 'administrative';
}

function levelFor(title) {
  if (/\(Addressable\)\s*$/.test(title)) return 'addressable';
  if (/\(Required\)\s*$/.test(title)) return 'required';
  return 'standard';
}

// Natural sort of "HIPAA-164.308(a)(1)(ii)(A)" style identifiers.
function sortKey(code) {
  return String(code).replace(/\d+/g, (n) => n.padStart(4, '0'));
}

/** HIPAA framework id, or null when the framework is not installed. */
async function getHipaaFrameworkId(executor = pool) {
  const { rows } = await executor.query("SELECT id FROM frameworks WHERE code = 'hipaa' LIMIT 1");
  return rows[0] ? rows[0].id : null;
}

/**
 * Every question for an assessment, grouped by safeguard, with the saved
 * response merged in. Standards with implementation specifications carry them
 * in `specifications` and are not answered themselves.
 */
async function getQuestionnaire(organizationId, assessmentId) {
  const frameworkId = await getHipaaFrameworkId();
  if (!frameworkId) return [];
  const { rows } = await pool.query(
    `SELECT fc.id, fc.control_id, fc.title, fc.description, fc.parent_control_id,
            r.answer, r.addressable_decision, r.threat, r.vulnerability,
            r.likelihood, r.impact, r.risk_score, r.notes, r.risk_id, r.updated_at
       FROM framework_controls fc
       LEFT JOIN hipaa_risk_assessment_responses r
         ON r.control_id = fc.id AND r.assessment_id = $2 AND r.organization_id = $3
      WHERE fc.framework_id = $1`,
    [frameworkId, assessmentId, organizationId]
  );
  const byParent = new Map();
  rows.filter((row) => row.parent_control_id).forEach((row) => {
    const list = byParent.get(row.parent_control_id) || [];
    byParent.set(row.parent_control_id, [...list, decorate(row)]);
  });
  const standards = rows
    .filter((row) => !row.parent_control_id)
    .map((row) => {
      const specifications = (byParent.get(row.id) || []).sort((a, b) => sortKey(a.control_id).localeCompare(sortKey(b.control_id)));
      return { ...decorate(row), answerable: specifications.length === 0, specifications };
    })
    .sort((a, b) => sortKey(a.control_id).localeCompare(sortKey(b.control_id)));
  return SAFEGUARDS.map((safeguard) => ({
    ...safeguard,
    standards: standards.filter((s) => safeguardFor(s.control_id) === safeguard.id)
  }));
}

function decorate(row) {
  return {
    ...row,
    level: levelFor(row.title),
    severity: riskService.severityBand(row.risk_score)
  };
}

/** Flat list of the questions that take an answer. */
function answerableQuestions(safeguards) {
  return safeguards.flatMap((s) => s.standards.flatMap((std) => (std.answerable ? [std] : std.specifications)));
}

/** Progress, answer counts and risk bands for an assessment. */
function summarize(safeguards) {
  const questions = answerableQuestions(safeguards);
  const answered = questions.filter((q) => q.answer);
  const counts = Object.fromEntries(ANSWERS.map((a) => [a, answered.filter((q) => q.answer === a).length]));
  const bands = { low: 0, medium: 0, high: 0, critical: 0 };
  questions.forEach((q) => { if (q.severity) bands[q.severity] += 1; });
  const gaps = questions.filter((q) => q.answer === 'not_implemented' || q.answer === 'partially_implemented');
  const requiredGaps = gaps.filter((q) => q.level !== 'addressable').length;
  const undecidedAddressable = questions.filter((q) =>
    q.level === 'addressable' && q.answer && q.answer !== 'implemented' && !q.addressable_decision
  ).length;
  return {
    total: questions.length,
    answered: answered.length,
    percent_complete: questions.length ? Math.round((answered.length / questions.length) * 100) : 0,
    answers: counts,
    risk_bands: bands,
    gaps: gaps.length,
    required_gaps: requiredGaps,
    undecided_addressable: undecidedAddressable,
    by_safeguard: safeguards.map((s) => {
      const qs = answerableQuestions([s]);
      return {
        id: s.id,
        label: s.label,
        total: qs.length,
        answered: qs.filter((q) => q.answer).length,
        implemented: qs.filter((q) => q.answer === 'implemented' || q.answer === 'not_applicable').length
      };
    })
  };
}

/**
 * Create risk register entries for scored gaps that do not have one yet.
 * Runs in the caller's transaction. Returns the number of risks created.
 */
async function promoteRisks(client, { organizationId, userId, assessment, questions }) {
  const candidates = questions.filter((q) =>
    !q.risk_id && q.likelihood && q.impact &&
    (q.answer === 'not_implemented' || q.answer === 'partially_implemented')
  );
  let created = 0;
  for (const q of candidates) {
    const reference = await riskService.resolveReference(client, organizationId, null);
    const title = `HIPAA: ${q.title.replace(/\s*\((Required|Addressable)\)\s*$/, '')} ${q.answer === 'partially_implemented' ? 'partially implemented' : 'not implemented'}`; // ip-hygiene:ignore -- our own risk title, not quoted standard text
    const { rows } = await client.query(
      `INSERT INTO risks
         (organization_id, reference, title, description, category, threat_source, vulnerability,
          inherent_likelihood, inherent_impact, residual_likelihood, residual_impact,
          status, tags, metadata, created_by)
       VALUES ($1, $2, $3, $4, 'compliance', $5, $6, $7, $8, $7, $8, 'assessed', $9, $10::jsonb, $11)
       RETURNING id`,
      [
        organizationId, reference, title.slice(0, 250),
        `${q.control_id.replace(/^HIPAA-/, '45 CFR ')}: identified in HIPAA security risk assessment "${assessment.name}".${q.notes ? `\n\n${q.notes}` : ''}`, // ip-hygiene:ignore -- our own description text
        q.threat || null, q.vulnerability || null, q.likelihood, q.impact,
        ['hipaa', 'sra'],
        JSON.stringify({ source: 'hipaa_sra', assessment_id: assessment.id, control_id: q.id }),
        userId
      ]
    );
    await client.query(
      `INSERT INTO risk_control_links (organization_id, risk_id, control_id, effectiveness, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT ON CONSTRAINT risk_control_links_unique DO NOTHING`,
      [organizationId, rows[0].id, q.id, q.answer === 'partially_implemented' ? 'partially_effective' : 'ineffective', userId]
    );
    await client.query(
      `UPDATE hipaa_risk_assessment_responses SET risk_id = $1
        WHERE assessment_id = $2 AND control_id = $3 AND organization_id = $4`,
      [rows[0].id, assessment.id, q.id, organizationId]
    );
    created += 1;
  }
  return created;
}

module.exports = {
  SAFEGUARDS,
  ANSWERS,
  ADDRESSABLE_DECISIONS,
  getHipaaFrameworkId,
  getQuestionnaire,
  answerableQuestions,
  summarize,
  promoteRisks,
  levelFor,
  safeguardFor
};
