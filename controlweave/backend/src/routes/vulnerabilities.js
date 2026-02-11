const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, requirePermission, requireTier } = require('../middleware/auth');
const { getConfigValue } = require('../services/dynamicConfigService');

router.use(authenticate);
router.use(requireTier('starter'));

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
const STATUS_ORDER = ['open', 'in_progress', 'remediated', 'risk_accepted', 'false_positive'];
const ACTION_TYPE_ORDER = ['poam', 'close_control_gap', 'risk_acceptance', 'false_positive_review'];
const ACTION_STATUS_ORDER = ['open', 'in_progress', 'resolved', 'accepted', 'closed'];
const CONTROL_EFFECT_ORDER = ['non_compliant', 'partial', 'compliant'];

const CONTROL_IMPACT_BY_FRAMEWORK = {
  nist_800_53: ['RA-5', 'SI-2', 'CA-7', 'CA-5'],
  'nist_csf_2.0': ['ID.RA-01', 'DE.CM-01', 'PR.PS-02'],
  iso_27001: ['A.8.8', 'A.8.9', 'A.5.7'],
  soc2: ['CC7.1', 'CC7.2', 'CC7.3', 'CC8.1'],
  hipaa: ['164.308(a)(1)(ii)(A)', '164.308(a)(8)'],
  nist_ai_rmf: ['MEASURE', 'MANAGE']
};

const FALLBACK_CONTROL_KEYWORDS = ['vulnerab', 'patch', 'remedi', 'scan', 'hardening', 'configuration'];

const FRAMEWORK_ALIGNED_STANDARDS = [
  { key: 'cve_nvd', label: 'CVE / NVD', aligns_with: ['NIST CSF 2.0', 'NIST 800-53 RA-5', 'ISO 27001 A.8.8', 'SOC 2 CC7'] },
  { key: 'cvss', label: 'CVSS', aligns_with: ['NIST RMF', 'ISO 27001 risk treatment', 'HIPAA risk analysis'] },
  { key: 'cwe', label: 'CWE', aligns_with: ['Secure SDLC controls', 'SOC 2 CC8'] },
  { key: 'disa_stig', label: 'DISA STIG', aligns_with: ['DoD/NIST control hardening', 'NERC CIP baseline hardening'] },
  { key: 'scap', label: 'SCAP', aligns_with: ['Automated vulnerability/compliance checks', 'NIST 800-53 RA-5'] },
  { key: 'spdx_cyclonedx', label: 'SBOM (SPDX / CycloneDX)', aligns_with: ['Supply chain controls', 'NIST SSDF', 'EU AI Act transparency'] },
  { key: 'cisa_kev', label: 'CISA KEV', aligns_with: ['Threat-informed prioritization', 'NIST CSF Detect/Respond'] },
  { key: 'cis_benchmarks', label: 'CIS Benchmarks', aligns_with: ['Configuration hardening', 'ISO 27001 A.8.9'] },
  { key: 'owasp', label: 'OWASP (Top 10 / ASVS)', aligns_with: ['Application security controls', 'SOC 2 CC7/CC8'] },
  { key: 'pci_asv', label: 'PCI DSS ASV / Pen Test Artifacts', aligns_with: ['PCI DSS v4 Req. 11'] },
  { key: 'fedramp_sar_poam', label: 'FedRAMP SAR / POA&M', aligns_with: ['FedRAMP continuous monitoring', 'NIST 800-53 RA/CA families'] },
  { key: 'hitrust', label: 'HITRUST Vulnerability Evidence', aligns_with: ['HITRUST 09.x vulnerability management'] },
  { key: 'iso_42001', label: 'AI Vulnerability & Model Security Evidence', aligns_with: ['ISO/IEC 42001 AI management controls', 'ISO/IEC 42005 impact assessments', 'NIST AI RMF'] },
];

const FRAMEWORK_REQUIRED_ARTIFACTS = [
  {
    framework: 'NIST 800-53 / RMF',
    controls: ['RA-5', 'SI-2', 'CA-7'],
    required_artifacts: ['Authenticated scan reports (ACAS/Nessus/etc.)', 'POA&M with due dates', 'STIG/SCAP hardening evidence', 'Remediation/patch closure evidence']
  },
  {
    framework: 'NIST CSF 2.0',
    controls: ['DE.CM', 'ID.RA', 'PR.PS'],
    required_artifacts: ['Risk-prioritized vulnerability backlog', 'KEV exposure tracking', 'Asset-to-finding mapping', 'Trend metrics and executive reporting']
  },
  {
    framework: 'ISO 27001:2022',
    controls: ['A.8.8', 'A.8.9', 'A.5.7'],
    required_artifacts: ['Vulnerability assessment records', 'Patch/change records', 'Supplier/component vulnerability evidence (SBOM)', 'Risk treatment decisions']
  },
  {
    framework: 'SOC 2',
    controls: ['CC7.1', 'CC7.2', 'CC7.3', 'CC8.1'],
    required_artifacts: ['Detection monitoring outputs', 'Ticketed remediation workflow', 'Exception/risk acceptance approvals', 'Evidence of secure change validation']
  },
  {
    framework: 'HIPAA Security Rule',
    controls: ['164.308(a)(1)(ii)(A)', '164.308(a)(8)'],
    required_artifacts: ['Risk analysis including technical vulnerabilities', 'Risk management plan', 'Periodic technical evaluation evidence', 'Corrective action documentation']
  },
  {
    framework: 'PCI DSS v4',
    controls: ['11.3', '11.5', '6.3'],
    required_artifacts: ['External/internal scan evidence', 'Pen test and retest evidence', 'Change-driven vulnerability assessment', 'Remediation timelines for critical findings']
  },
  {
    framework: 'FedRAMP',
    controls: ['RA-5', 'CA-7', 'SI-2'],
    required_artifacts: ['Monthly scan data', 'System Assessment Report deltas', 'POA&M updates', 'Continuous monitoring submissions']
  },
  {
    framework: 'AI Governance (NIST AI RMF / ISO 42001 / ISO 42005)',
    controls: ['MAP', 'MEASURE', 'MANAGE'],
    required_artifacts: ['AI system impact assessment record(s)', 'Model/software bill of materials', 'Dependency and model vulnerability scans', 'Adversarial/test findings', 'Risk response and approval records']
  }
];

async function getVulnerabilityDynamicConfig(orgId) {
  const config = {
    controlImpactByFramework: CONTROL_IMPACT_BY_FRAMEWORK,
    fallbackControlKeywords: FALLBACK_CONTROL_KEYWORDS,
    frameworkAlignedStandards: FRAMEWORK_ALIGNED_STANDARDS,
    frameworkRequiredArtifacts: FRAMEWORK_REQUIRED_ARTIFACTS
  };

  const controlImpactByFramework = await getConfigValue(orgId, 'vulnerability', 'control_impact_by_framework', null);
  if (controlImpactByFramework && typeof controlImpactByFramework === 'object' && !Array.isArray(controlImpactByFramework)) {
    config.controlImpactByFramework = controlImpactByFramework;
  }

  const fallbackControlKeywords = await getConfigValue(orgId, 'vulnerability', 'fallback_control_keywords', null);
  if (Array.isArray(fallbackControlKeywords) && fallbackControlKeywords.length > 0) {
    config.fallbackControlKeywords = fallbackControlKeywords.map((item) => String(item).toLowerCase());
  }

  const frameworkAlignedStandards = await getConfigValue(orgId, 'vulnerability', 'framework_aligned_standards', null);
  if (Array.isArray(frameworkAlignedStandards) && frameworkAlignedStandards.length > 0) {
    config.frameworkAlignedStandards = frameworkAlignedStandards;
  }

  const frameworkRequiredArtifacts = await getConfigValue(orgId, 'vulnerability', 'framework_required_artifacts', null);
  if (Array.isArray(frameworkRequiredArtifacts) && frameworkRequiredArtifacts.length > 0) {
    config.frameworkRequiredArtifacts = frameworkRequiredArtifacts;
  }

  return config;
}

function parseListParam(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function buildWhereClause(orgId, queryParams) {
  const where = ['vf.organization_id = $1'];
  const params = [orgId];
  let idx = 2;

  const sourceList = parseListParam(queryParams.source).filter((v) => v.toLowerCase() !== 'all');
  if (sourceList.length > 0) {
    where.push(`vf.source = ANY($${idx}::text[])`);
    params.push(sourceList);
    idx++;
  }

  const standardList = parseListParam(queryParams.standard).filter((v) => v.toLowerCase() !== 'all');
  if (standardList.length > 0) {
    where.push(`vf.standard = ANY($${idx}::text[])`);
    params.push(standardList);
    idx++;
  }

  const severityList = parseListParam(queryParams.severity).filter((v) => v.toLowerCase() !== 'all');
  if (severityList.length > 0) {
    where.push(`vf.severity = ANY($${idx}::text[])`);
    params.push(severityList);
    idx++;
  }

  const statusList = parseListParam(queryParams.status).filter((v) => v.toLowerCase() !== 'all');
  if (statusList.length > 0) {
    where.push(`vf.status = ANY($${idx}::text[])`);
    params.push(statusList);
    idx++;
  }

  if (queryParams.assetId) {
    where.push(`vf.asset_id = $${idx}`);
    params.push(queryParams.assetId);
    idx++;
  }

  if (queryParams.minCvss) {
    where.push(`COALESCE(vf.cvss_score, 0) >= $${idx}`);
    params.push(Number(queryParams.minCvss));
    idx++;
  }

  if (queryParams.maxCvss) {
    where.push(`COALESCE(vf.cvss_score, 0) <= $${idx}`);
    params.push(Number(queryParams.maxCvss));
    idx++;
  }

  if (queryParams.search) {
    where.push(`(
      vf.vulnerability_id ILIKE $${idx}
      OR vf.title ILIKE $${idx}
      OR vf.finding_key ILIKE $${idx}
      OR COALESCE(vf.package_name, '') ILIKE $${idx}
      OR COALESCE(vf.component_name, '') ILIKE $${idx}
      OR COALESCE(a.name, '') ILIKE $${idx}
      OR COALESCE(a.hostname, '') ILIKE $${idx}
    )`);
    params.push(`%${queryParams.search}%`);
    idx++;
  }

  return { whereClause: where.join(' AND '), params };
}

function normalizeControlId(value) {
  return String(value || '').trim().toUpperCase();
}

function parseDateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function inferActionType(finding) {
  if (finding.status === 'risk_accepted') return 'risk_acceptance';
  if (finding.status === 'false_positive') return 'false_positive_review';
  return 'poam';
}

function inferActionStatus(finding) {
  if (finding.status === 'remediated') return 'resolved';
  if (finding.status === 'risk_accepted') return 'accepted';
  if (finding.status === 'false_positive') return 'closed';
  return 'open';
}

function inferControlEffect(finding) {
  if (finding.status === 'remediated' || finding.status === 'false_positive') return 'compliant';
  if (finding.status === 'risk_accepted') return 'partial';
  if (String(finding.severity || '').toLowerCase() === 'critical' || String(finding.severity || '').toLowerCase() === 'high') {
    return 'non_compliant';
  }
  return 'partial';
}

function defaultDueDate(finding) {
  const provided = parseDateOnly(finding.due_date);
  if (provided) return provided;
  const days = String(finding.severity || '').toLowerCase() === 'critical' ? 14 : 30;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildWorkflowSummary(finding, control) {
  return `Control ${control.control_id} requires vulnerability response for ${finding.vulnerability_id} (${finding.severity}).`;
}

async function resolveControlImpacts(client, orgId, controlImpactByFramework, fallbackControlKeywords) {
  const controlRows = await client.query(
    `SELECT
       fc.id AS framework_control_id,
       fc.control_id,
       fc.title,
       f.code AS framework_code,
       f.name AS framework_name
     FROM organization_frameworks ofw
     JOIN frameworks f ON f.id = ofw.framework_id
     JOIN framework_controls fc ON fc.framework_id = f.id
     WHERE ofw.organization_id = $1`,
    [orgId]
  );

  const byFramework = new Map();
  for (const row of controlRows.rows) {
    const code = row.framework_code || 'unknown';
    if (!byFramework.has(code)) byFramework.set(code, []);
    byFramework.get(code).push(row);
  }

  const selected = [];
  for (const [frameworkCode, controls] of byFramework.entries()) {
    const mappedControlIds = ((controlImpactByFramework && controlImpactByFramework[frameworkCode]) || []).map(normalizeControlId);
    let candidates = controls.filter((control) => mappedControlIds.includes(normalizeControlId(control.control_id)));

    if (candidates.length === 0) {
      candidates = controls.filter((control) => {
        const haystack = `${control.control_id || ''} ${control.title || ''}`.toLowerCase();
        return fallbackControlKeywords.some((keyword) => haystack.includes(keyword));
      }).slice(0, 3);
    }

    selected.push(...candidates);
  }

  const deduped = new Map();
  for (const control of selected) {
    deduped.set(control.framework_control_id, control);
  }
  return Array.from(deduped.values());
}

async function upsertControlImplementationImpact(client, orgId, userId, finding, control) {
  const noteLine = `Vulnerability impact flagged: ${finding.vulnerability_id} (${finding.finding_key}).`;
  const shouldFlagNeedsReview = ['open', 'in_progress', 'risk_accepted'].includes(String(finding.status || '').toLowerCase());

  const existing = await client.query(
    `SELECT id, status, notes
     FROM control_implementations
     WHERE organization_id = $1 AND control_id = $2
     LIMIT 1`,
    [orgId, control.framework_control_id]
  );

  if (existing.rows.length === 0) {
    if (!shouldFlagNeedsReview) return { implementationId: null, statusChanged: false };
    const inserted = await client.query(
      `INSERT INTO control_implementations (control_id, organization_id, status, notes, created_at)
       VALUES ($1, $2, 'needs_review', $3, NOW())
       ON CONFLICT (control_id, organization_id) DO NOTHING
       RETURNING id, status`,
      [control.framework_control_id, orgId, noteLine]
    );
    return {
      implementationId: inserted.rows[0]?.id || null,
      statusChanged: inserted.rows.length > 0
    };
  }

  const current = existing.rows[0];
  let statusChanged = false;

  if (shouldFlagNeedsReview && !['needs_review', 'in_progress'].includes(current.status)) {
    await client.query(
      `UPDATE control_implementations
       SET status = 'needs_review',
           notes = CASE
             WHEN COALESCE(notes, '') ILIKE $3 THEN notes
             WHEN COALESCE(notes, '') = '' THEN $2
             ELSE notes || E'\n' || $2
           END
       WHERE id = $1`,
      [current.id, noteLine, `%${finding.finding_key}%`]
    );
    statusChanged = true;
  }

  if (statusChanged) {
    await client.query(
      `INSERT INTO audit_logs (
         organization_id, user_id, event_type, resource_type, resource_id, details, success
       )
       VALUES ($1, $2, 'control_impact_flagged', 'control', $3, $4::jsonb, true)`,
      [
        orgId,
        userId,
        control.framework_control_id,
        JSON.stringify({
          vulnerability_id: finding.id,
          vulnerability_key: finding.finding_key,
          control_id: control.control_id,
          framework_code: control.framework_code
        })
      ]
    );
  }

  return { implementationId: current.id, statusChanged };
}

async function ensureControlImpactWorkflowForFinding(orgId, userId, finding, vulnerabilityConfig) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const controlImpacts = await resolveControlImpacts(
      client,
      orgId,
      vulnerabilityConfig.controlImpactByFramework || CONTROL_IMPACT_BY_FRAMEWORK,
      vulnerabilityConfig.fallbackControlKeywords || FALLBACK_CONTROL_KEYWORDS
    );
    const createdOrUpdated = [];
    const actionType = inferActionType(finding);
    const actionStatus = inferActionStatus(finding);
    const controlEffect = inferControlEffect(finding);
    const dueDate = defaultDueDate(finding);

    for (const control of controlImpacts) {
      const workflowResult = await client.query(
        `INSERT INTO vulnerability_control_work_items (
           organization_id, vulnerability_id, framework_control_id, action_type, action_status,
           control_effect, response_summary, due_date, created_by, updated_by, metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10::jsonb)
         ON CONFLICT (organization_id, vulnerability_id, framework_control_id)
         DO UPDATE SET
           action_type = EXCLUDED.action_type,
           action_status = CASE
             WHEN vulnerability_control_work_items.action_status IN ('resolved', 'accepted', 'closed')
               THEN vulnerability_control_work_items.action_status
             ELSE EXCLUDED.action_status
           END,
           control_effect = CASE
             WHEN vulnerability_control_work_items.action_status IN ('resolved', 'accepted', 'closed')
               THEN vulnerability_control_work_items.control_effect
             ELSE EXCLUDED.control_effect
           END,
           response_summary = COALESCE(vulnerability_control_work_items.response_summary, EXCLUDED.response_summary),
           due_date = COALESCE(vulnerability_control_work_items.due_date, EXCLUDED.due_date),
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()
         RETURNING id, implementation_id`,
        [
          orgId,
          finding.id,
          control.framework_control_id,
          actionType,
          actionStatus,
          controlEffect,
          buildWorkflowSummary(finding, control),
          dueDate,
          userId,
          JSON.stringify({
            source: finding.source,
            standard: finding.standard,
            finding_key: finding.finding_key,
            vulnerability_id: finding.vulnerability_id
          })
        ]
      );

      const workflowItem = workflowResult.rows[0];
      const implementationImpact = await upsertControlImplementationImpact(client, orgId, userId, finding, control);
      if (implementationImpact.implementationId && !workflowItem.implementation_id) {
        await client.query(
          `UPDATE vulnerability_control_work_items
           SET implementation_id = $1, updated_at = NOW(), updated_by = $2
           WHERE id = $3`,
          [implementationImpact.implementationId, userId, workflowItem.id]
        );
      }
      createdOrUpdated.push(workflowItem.id);
    }

    await client.query('COMMIT');
    return createdOrUpdated.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getWorkflowItems(orgId, vulnerabilityId) {
  const workflowResult = await pool.query(
    `SELECT
       vw.id,
       vw.vulnerability_id,
       vw.framework_control_id,
       vw.implementation_id,
       vw.action_type,
       vw.action_status,
       vw.control_effect,
       vw.response_summary,
       vw.response_details,
       vw.due_date,
       vw.closed_at,
       vw.created_at,
       vw.updated_at,
       fc.control_id AS control_code,
       fc.title AS control_title,
       f.code AS framework_code,
       f.name AS framework_name,
       COALESCE(ci.status, 'not_started') AS implementation_status,
       owner.email AS owner_email,
       owner.first_name || ' ' || owner.last_name AS owner_name
     FROM vulnerability_control_work_items vw
     JOIN framework_controls fc ON fc.id = vw.framework_control_id
     JOIN frameworks f ON f.id = fc.framework_id
     LEFT JOIN control_implementations ci ON ci.id = vw.implementation_id
     LEFT JOIN users owner ON owner.id = vw.owner_id
     WHERE vw.organization_id = $1
       AND vw.vulnerability_id = $2
     ORDER BY
       CASE vw.action_status
         WHEN 'open' THEN 1
         WHEN 'in_progress' THEN 2
         WHEN 'accepted' THEN 3
         WHEN 'resolved' THEN 4
         WHEN 'closed' THEN 5
         ELSE 6
       END,
       f.code,
       fc.control_id`,
    [orgId, vulnerabilityId]
  );

  const rows = workflowResult.rows;
  const summary = {
    total: rows.length,
    open: rows.filter((row) => row.action_status === 'open').length,
    in_progress: rows.filter((row) => row.action_status === 'in_progress').length,
    resolved: rows.filter((row) => row.action_status === 'resolved').length,
    accepted: rows.filter((row) => row.action_status === 'accepted').length,
    closed: rows.filter((row) => row.action_status === 'closed').length
  };

  return { items: rows, summary };
}

router.get('/', requirePermission('assets.read'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const vulnerabilityConfig = await getVulnerabilityDynamicConfig(orgId);
    const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 100));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const { whereClause, params } = buildWhereClause(orgId, req.query);
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const findingsQuery = `
      SELECT
        vf.*,
        a.name AS asset_name,
        a.hostname AS asset_hostname,
        ac.code AS asset_category_code,
        e.name AS environment_name,
        (
          SELECT COUNT(*)
          FROM vulnerability_control_work_items vw
          WHERE vw.organization_id = vf.organization_id
            AND vw.vulnerability_id = vf.id
        )::int AS control_work_items_total,
        (
          SELECT COUNT(*)
          FROM vulnerability_control_work_items vw
          WHERE vw.organization_id = vf.organization_id
            AND vw.vulnerability_id = vf.id
            AND vw.action_status IN ('open', 'in_progress')
        )::int AS control_work_items_open,
        (
          SELECT COUNT(*)
          FROM audit_logs al
          WHERE al.organization_id = vf.organization_id
            AND (
              (al.resource_type = 'vulnerability' AND al.resource_id::text = vf.id::text)
              OR (al.details->>'finding_key') = vf.finding_key
              OR (al.details->>'vulnerability_id') = vf.vulnerability_id
            )
        )::int AS linked_audit_events
      FROM vulnerability_findings vf
      LEFT JOIN assets a ON a.id = vf.asset_id
      LEFT JOIN asset_categories ac ON ac.id = a.category_id
      LEFT JOIN environments e ON e.id = a.environment_id
      WHERE ${whereClause}
      ORDER BY
        CASE vf.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          WHEN 'info' THEN 5
          ELSE 6
        END,
        COALESCE(vf.cvss_score, 0) DESC,
        COALESCE(vf.last_seen_at, vf.detected_at, vf.created_at) DESC
      LIMIT $${limitIdx}
      OFFSET $${offsetIdx}
    `;

    const findingsResult = await pool.query(findingsQuery, [...params, limit, offset]);

    for (const finding of findingsResult.rows) {
      if (!['open', 'in_progress', 'risk_accepted'].includes(String(finding.status || '').toLowerCase())) continue;
      try {
        await ensureControlImpactWorkflowForFinding(orgId, req.user.id, finding, vulnerabilityConfig);
      } catch (workflowError) {
        console.error('Ensure control impact workflow error:', workflowError.message);
      }
    }

    const refreshedFindingsResult = await pool.query(findingsQuery, [...params, limit, offset]);

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM vulnerability_findings vf
       LEFT JOIN assets a ON a.id = vf.asset_id
       WHERE ${whereClause}`,
      params
    );

    const summaryResult = await pool.query(
      `SELECT
         COUNT(*)::int AS total_findings,
         COUNT(*) FILTER (WHERE vf.status IN ('open', 'in_progress'))::int AS active_findings,
         COUNT(*) FILTER (WHERE vf.severity = 'critical' AND vf.status IN ('open', 'in_progress'))::int AS critical_open,
         COUNT(DISTINCT vf.asset_id)::int AS affected_assets,
         COUNT(*) FILTER (WHERE vf.kev_listed = true)::int AS kev_listed_count,
         ROUND(AVG(vf.cvss_score)::numeric, 1) AS avg_cvss
       FROM vulnerability_findings vf
       LEFT JOIN assets a ON a.id = vf.asset_id
       WHERE ${whereClause}`,
      params
    );

    const bySourceResult = await pool.query(
      `SELECT vf.source, COUNT(*)::int AS count
       FROM vulnerability_findings vf
       LEFT JOIN assets a ON a.id = vf.asset_id
       WHERE ${whereClause}
       GROUP BY vf.source
       ORDER BY count DESC, vf.source ASC`,
      params
    );

    const bySeverityResult = await pool.query(
      `SELECT vf.severity, COUNT(*)::int AS count
       FROM vulnerability_findings vf
       LEFT JOIN assets a ON a.id = vf.asset_id
       WHERE ${whereClause}
       GROUP BY vf.severity
       ORDER BY count DESC`,
      params
    );

    const byStatusResult = await pool.query(
      `SELECT vf.status, COUNT(*)::int AS count
       FROM vulnerability_findings vf
       LEFT JOIN assets a ON a.id = vf.asset_id
       WHERE ${whereClause}
       GROUP BY vf.status
       ORDER BY count DESC`,
      params
    );

    const trendResult = await pool.query(
      `SELECT
         DATE_TRUNC('day', COALESCE(vf.detected_at, vf.created_at))::date AS day,
         COUNT(*)::int AS count
       FROM vulnerability_findings vf
       LEFT JOIN assets a ON a.id = vf.asset_id
       WHERE ${whereClause}
         AND COALESCE(vf.detected_at, vf.created_at) >= NOW() - INTERVAL '30 days'
       GROUP BY day
       ORDER BY day`,
      params
    );

    res.json({
      success: true,
      data: {
        findings: refreshedFindingsResult.rows,
        summary: summaryResult.rows[0] || {
          total_findings: 0,
          active_findings: 0,
          critical_open: 0,
          affected_assets: 0,
          kev_listed_count: 0,
          avg_cvss: null
        },
        charts: {
          bySource: bySourceResult.rows,
          bySeverity: bySeverityResult.rows,
          byStatus: byStatusResult.rows,
          trend30d: trendResult.rows
        },
        enums: {
          severityOrder: SEVERITY_ORDER,
          statusOrder: STATUS_ORDER,
          frameworkRequiredArtifacts: vulnerabilityConfig.frameworkRequiredArtifacts
        },
        pagination: {
          total: countResult.rows[0]?.total || 0,
          limit,
          offset
        }
      }
    });
  } catch (error) {
    console.error('Get vulnerabilities error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch vulnerabilities' });
  }
});

router.get('/sources', requirePermission('assets.read'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const vulnerabilityConfig = await getVulnerabilityDynamicConfig(orgId);

    const sourceResult = await pool.query(
      `SELECT source, COUNT(*)::int AS count
       FROM vulnerability_findings
       WHERE organization_id = $1
       GROUP BY source
       ORDER BY count DESC, source ASC`,
      [orgId]
    );

    const standardResult = await pool.query(
      `SELECT standard, COUNT(*)::int AS count
       FROM vulnerability_findings
       WHERE organization_id = $1 AND standard IS NOT NULL AND standard <> ''
       GROUP BY standard
       ORDER BY count DESC, standard ASC`,
      [orgId]
    );

    res.json({
      success: true,
      data: {
        sources: sourceResult.rows,
        standards: standardResult.rows,
        frameworkAlignedStandards: vulnerabilityConfig.frameworkAlignedStandards,
        frameworkRequiredArtifacts: vulnerabilityConfig.frameworkRequiredArtifacts
      }
    });
  } catch (error) {
    console.error('Get vulnerability sources error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch vulnerability source metadata' });
  }
});

router.get('/:id/workflow', requirePermission('assets.read'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const vulnerabilityConfig = await getVulnerabilityDynamicConfig(orgId);
    const { id } = req.params;

    const findingResult = await pool.query(
      `SELECT id, finding_key, vulnerability_id, source, standard, severity, status, due_date
       FROM vulnerability_findings
       WHERE organization_id = $1 AND id = $2`,
      [orgId, id]
    );

    if (findingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Vulnerability finding not found' });
    }

    const finding = findingResult.rows[0];
    if (['open', 'in_progress', 'risk_accepted'].includes(String(finding.status || '').toLowerCase())) {
      await ensureControlImpactWorkflowForFinding(orgId, req.user.id, finding, vulnerabilityConfig);
    }

    const workflow = await getWorkflowItems(orgId, id);
    res.json({ success: true, data: workflow });
  } catch (error) {
    console.error('Get vulnerability workflow error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch vulnerability workflow' });
  }
});

router.patch('/:id/workflow/:workItemId', requirePermission('controls.write'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const { id, workItemId } = req.params;
    const {
      actionType,
      actionStatus,
      controlEffect,
      responseSummary,
      responseDetails,
      dueDate,
      ownerId
    } = req.body || {};

    if (actionType !== undefined && !ACTION_TYPE_ORDER.includes(actionType)) {
      return res.status(400).json({ success: false, error: `actionType must be one of: ${ACTION_TYPE_ORDER.join(', ')}` });
    }
    if (actionStatus !== undefined && !ACTION_STATUS_ORDER.includes(actionStatus)) {
      return res.status(400).json({ success: false, error: `actionStatus must be one of: ${ACTION_STATUS_ORDER.join(', ')}` });
    }
    if (controlEffect !== undefined && !CONTROL_EFFECT_ORDER.includes(controlEffect)) {
      return res.status(400).json({ success: false, error: `controlEffect must be one of: ${CONTROL_EFFECT_ORDER.join(', ')}` });
    }

    const existingResult = await pool.query(
      `SELECT
         vw.*,
         vf.finding_key,
         vf.vulnerability_id,
         vf.source,
         vf.standard
       FROM vulnerability_control_work_items vw
       JOIN vulnerability_findings vf ON vf.id = vw.vulnerability_id
       WHERE vw.organization_id = $1
         AND vw.vulnerability_id = $2
         AND vw.id = $3`,
      [orgId, id, workItemId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Workflow item not found' });
    }

    const existing = existingResult.rows[0];
    const nextActionStatus = actionStatus || existing.action_status;
    const nextControlEffect = controlEffect || existing.control_effect;
    const nextDueDate = dueDate === undefined ? undefined : parseDateOnly(dueDate);

    if (dueDate !== undefined && !nextDueDate) {
      return res.status(400).json({ success: false, error: 'dueDate must be a valid date' });
    }

    const updates = [];
    const params = [];
    let idx = 1;

    if (actionType !== undefined) {
      updates.push(`action_type = $${idx}`);
      params.push(actionType);
      idx++;
    }
    if (actionStatus !== undefined) {
      updates.push(`action_status = $${idx}`);
      params.push(actionStatus);
      idx++;
    }
    if (controlEffect !== undefined) {
      updates.push(`control_effect = $${idx}`);
      params.push(controlEffect);
      idx++;
    }
    if (responseSummary !== undefined) {
      updates.push(`response_summary = $${idx}`);
      params.push(responseSummary || null);
      idx++;
    }
    if (responseDetails !== undefined) {
      updates.push(`response_details = $${idx}`);
      params.push(responseDetails || null);
      idx++;
    }
    if (dueDate !== undefined) {
      updates.push(`due_date = $${idx}`);
      params.push(nextDueDate);
      idx++;
    }
    if (ownerId !== undefined) {
      updates.push(`owner_id = $${idx}`);
      params.push(ownerId || null);
      idx++;
    }

    updates.push(`closed_at = CASE WHEN $${idx} IN ('resolved', 'accepted', 'closed') THEN COALESCE(closed_at, NOW()) ELSE NULL END`);
    params.push(nextActionStatus);
    idx++;

    updates.push(`updated_by = $${idx}`);
    params.push(req.user.id);
    idx++;

    updates.push('updated_at = NOW()');
    params.push(orgId, id, workItemId);

    const updateQuery = `
      UPDATE vulnerability_control_work_items
      SET ${updates.join(', ')}
      WHERE organization_id = $${idx}
        AND vulnerability_id = $${idx + 1}
        AND id = $${idx + 2}
      RETURNING *`;

    const updatedResult = await pool.query(updateQuery, params);
    const updated = updatedResult.rows[0];

    const currentImplementation = await pool.query(
      `SELECT id, status
       FROM control_implementations
       WHERE organization_id = $1 AND control_id = $2
       LIMIT 1`,
      [orgId, updated.framework_control_id]
    );

    let targetControlStatus = null;
    if (['open', 'in_progress'].includes(nextActionStatus) && ['non_compliant', 'partial'].includes(nextControlEffect)) {
      targetControlStatus = 'needs_review';
    } else if (nextActionStatus === 'accepted') {
      targetControlStatus = 'needs_review';
    } else if (['resolved', 'closed'].includes(nextActionStatus) && nextControlEffect === 'compliant') {
      targetControlStatus = 'implemented';
    }

    if (targetControlStatus) {
      if (currentImplementation.rows.length === 0) {
        const insertedImplementation = await pool.query(
          `INSERT INTO control_implementations (
             control_id, organization_id, status, notes, implementation_date, created_at
           )
           VALUES (
             $1, $2, $3, $4,
             CASE WHEN $3 = 'implemented' THEN CURRENT_DATE ELSE NULL END,
             NOW()
           )
           ON CONFLICT (control_id, organization_id) DO NOTHING
           RETURNING id`,
          [
            updated.framework_control_id,
            orgId,
            targetControlStatus,
            `Control impact workflow update for finding ${existing.finding_key}.`
          ]
        );
        if (insertedImplementation.rows[0]?.id) {
          await pool.query(
            `UPDATE vulnerability_control_work_items
             SET implementation_id = $1, updated_at = NOW(), updated_by = $2
             WHERE id = $3`,
            [insertedImplementation.rows[0].id, req.user.id, updated.id]
          );
        }
      } else if (currentImplementation.rows[0].status !== targetControlStatus) {
        await pool.query(
          `UPDATE control_implementations
           SET status = $1,
               implementation_date = CASE WHEN $1 = 'implemented' THEN CURRENT_DATE ELSE implementation_date END,
               notes = CASE
                 WHEN COALESCE(notes, '') = '' THEN $2
                 ELSE notes || E'\n' || $2
               END
           WHERE id = $3`,
          [
            targetControlStatus,
            `Control impact workflow update for finding ${existing.finding_key}.`,
            currentImplementation.rows[0].id
          ]
        );
      }
    }

    await pool.query(
      `INSERT INTO audit_logs (
         organization_id, user_id, event_type, resource_type, resource_id, details, success
       )
       VALUES ($1, $2, 'vulnerability_workflow_updated', 'vulnerability_workflow', $3, $4::jsonb, true)`,
      [
        orgId,
        req.user.id,
        updated.id,
        JSON.stringify({
          vulnerability_id: id,
          finding_key: existing.finding_key,
          old: {
            action_type: existing.action_type,
            action_status: existing.action_status,
            control_effect: existing.control_effect
          },
          new: {
            action_type: updated.action_type,
            action_status: updated.action_status,
            control_effect: updated.control_effect
          }
        })
      ]
    );

    const workflow = await getWorkflowItems(orgId, id);
    res.json({ success: true, data: { updatedItem: updated, workflow } });
  } catch (error) {
    console.error('Update vulnerability workflow item error:', error);
    res.status(500).json({ success: false, error: 'Failed to update vulnerability workflow item' });
  }
});

router.get('/:id', requirePermission('assets.read'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const vulnerabilityConfig = await getVulnerabilityDynamicConfig(orgId);
    const { id } = req.params;

    const findingResult = await pool.query(
      `SELECT
         vf.*,
         a.name AS asset_name,
         a.hostname AS asset_hostname,
         ac.code AS asset_category_code,
         e.name AS environment_name
       FROM vulnerability_findings vf
       LEFT JOIN assets a ON a.id = vf.asset_id
       LEFT JOIN asset_categories ac ON ac.id = a.category_id
       LEFT JOIN environments e ON e.id = a.environment_id
       WHERE vf.organization_id = $1 AND vf.id = $2`,
      [orgId, id]
    );

    if (findingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Vulnerability finding not found' });
    }

    const finding = findingResult.rows[0];

    if (['open', 'in_progress', 'risk_accepted'].includes(String(finding.status || '').toLowerCase())) {
      try {
        await ensureControlImpactWorkflowForFinding(orgId, req.user.id, finding, vulnerabilityConfig);
      } catch (workflowError) {
        console.error('Ensure control impact workflow for detail error:', workflowError.message);
      }
    }

    const auditResult = await pool.query(
      `SELECT
         al.id,
         al.event_type,
         al.resource_type,
         al.resource_id,
         al.details,
         al.ip_address,
         al.success,
         al.failure_reason,
         al.created_at,
         u.first_name || ' ' || u.last_name AS user_name,
         u.email AS user_email
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE al.organization_id = $1
         AND (
           (al.resource_type = 'vulnerability' AND al.resource_id::text = $2)
           OR (al.details->>'finding_key') = $3
           OR (al.details->>'vulnerability_id') = $4
           OR (al.details->>'source') = $5
         )
       ORDER BY al.created_at DESC
       LIMIT 50`,
      [orgId, String(id), finding.finding_key, finding.vulnerability_id, finding.source]
    );

    const controlImpactWorkflow = await getWorkflowItems(orgId, id);

    res.json({
      success: true,
      data: {
        finding,
        relatedAuditEvents: auditResult.rows,
        controlImpactWorkflow
      }
    });
  } catch (error) {
    console.error('Get vulnerability detail error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch vulnerability detail' });
  }
});

module.exports = router;
