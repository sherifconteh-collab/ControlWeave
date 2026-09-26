'use strict';

const fs = require('fs');
const crypto = require('crypto');
const pool = require('../../../config/database');
const { BASELINE_SCOPE_PREDICATE, baselineScopeJoin } = require('../../baselineScope');
const { complianceAggregateSql } = require('../../complianceMetrics');
const storageService = require('../../storageService');

const pass = (detail, extra = {}) => ({ status: 'pass', detail, ...extra });
const warn = (detail, remediation, extra = {}) => ({ status: 'warn', detail, remediation, ...extra });
const fail = (detail, remediation, extra = {}) => ({ status: 'fail', detail, remediation, ...extra });

const AGG = complianceAggregateSql({ precision: 1 });
// Tolerance for comparing percentages rounded to different precisions.
const PCT_TOLERANCE = 0.11;

async function referenceCompliance(orgId) {
  const result = await pool.query(
    `SELECT f.id, f.code, f.name,
            ${AGG.total}::int AS total,
            ${AGG.compliant}::int AS compliant,
            ${AGG.notApplicable}::int AS not_applicable,
            ${AGG.percentage}::float AS pct
       FROM organization_frameworks of2
       JOIN frameworks f ON f.id = of2.framework_id
       JOIN framework_controls fc ON fc.framework_id = f.id
       ${baselineScopeJoin('$1')}
       LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $1
      WHERE of2.organization_id = $1
      ${BASELINE_SCOPE_PREDICATE}
      GROUP BY f.id, f.code, f.name
      ORDER BY f.name`,
    [orgId]
  );
  return result.rows;
}

module.exports = [
  {
    id: 'frameworks.selected',
    suite: 'frameworks',
    title: 'Frameworks selected and populated',
    description: 'The organization tracks at least one framework and every selected framework has controls.',
    async run(ctx) {
      const result = await pool.query(
        `SELECT f.code, f.name, COUNT(fc.id)::int AS controls
           FROM organization_frameworks of2
           JOIN frameworks f ON f.id = of2.framework_id
           LEFT JOIN framework_controls fc ON fc.framework_id = f.id
          WHERE of2.organization_id = $1
          GROUP BY f.code, f.name ORDER BY f.name`,
        [ctx.organizationId]
      );
      if (result.rows.length === 0) {
        return fail('No frameworks are selected, so there is nothing to measure compliance against.', 'Select frameworks under Frameworks or during onboarding.');
      }
      const empty = result.rows.filter((r) => r.controls === 0);
      const metrics = { frameworks: result.rows.map((r) => ({ code: r.code, controls: r.controls })) };
      if (empty.length) {
        return fail(`Selected framework(s) with no controls: ${empty.map((r) => r.name).join(', ')}.`, 'Re-run the framework seed (npm run seed:frameworks) or deselect the framework.', { metrics });
      }
      return pass(`${result.rows.length} framework(s) selected: ${result.rows.map((r) => `${r.name} (${r.controls})`).join(', ')}.`, { metrics });
    }
  },
  {
    id: 'compliance.consistent',
    suite: 'frameworks',
    title: 'Compliance numbers agree across screens',
    description: 'Recomputes each framework\'s compliance from raw data and compares it with the dashboard, compliance summary and compliance gate.',
    async run(ctx) {
      const reference = await referenceCompliance(ctx.organizationId);
      if (reference.length === 0) return { status: 'skip', detail: 'No frameworks selected.' };
      const byId = new Map(reference.map((r) => [r.id, r]));
      const [summary, stats, gate] = await Promise.all([
        ctx.api.get('/dashboard/compliance-summary'),
        ctx.api.get('/dashboard/stats'),
        ctx.api.get('/compliance/gate?min_pct=0')
      ]);
      const mismatches = [];
      const compare = (source, frameworkId, value, cached) => {
        const ref = byId.get(frameworkId);
        if (!ref) return;
        if (Math.abs(Number(value) - ref.pct) > PCT_TOLERANCE) {
          mismatches.push(`${source} shows ${value}% for ${ref.name}, expected ${ref.pct}%${cached ? ' (served from cache)' : ''}`);
        }
      };
      for (const fw of summary.data?.data?.frameworks || []) compare('Compliance summary', fw.frameworkId, fw.compliancePercentage, summary.data?.cached);
      for (const fw of stats.data?.data?.frameworks || []) compare('Dashboard', fw.id, fw.compliancePercentage, stats.data?.cached);
      for (const fw of gate.data?.data?.frameworks || []) compare('Compliance gate', fw.framework_id, fw.compliance_pct, false);
      const metrics = { frameworks: reference.map((r) => ({ code: r.code, pct: r.pct, compliant: r.compliant, applicable: r.total - r.not_applicable })) };
      const failedRequests = [['compliance summary', summary], ['dashboard', stats], ['compliance gate', gate]].filter(([, r]) => r.status !== 200);
      if (failedRequests.length) {
        return fail(`Could not load: ${failedRequests.map(([n, r]) => `${n} (HTTP ${r.status})`).join(', ')}.`, null, { metrics });
      }
      if (mismatches.length) {
        const onlyCached = mismatches.every((m) => m.includes('served from cache'));
        return (onlyCached ? warn : fail)(mismatches.slice(0, 6).join('; '),
          onlyCached ? 'A recent change has not reached the dashboard cache yet (30s TTL); run again shortly.' : 'Report this to support with the run export.', { metrics });
      }
      return pass(`All ${reference.length} framework score(s) agree across the dashboard, compliance summary and compliance gate.`, { metrics });
    }
  },
  {
    id: 'frameworks.implementation_records',
    suite: 'frameworks',
    title: 'Every in-scope control has an implementation record',
    description: 'Controls without an implementation record cannot be assigned, evidenced or assessed.',
    async run(ctx) {
      const result = await pool.query(
        `SELECT f.name, COUNT(*)::int AS missing
           FROM organization_frameworks of2
           JOIN frameworks f ON f.id = of2.framework_id
           JOIN framework_controls fc ON fc.framework_id = f.id
           LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $1
          WHERE of2.organization_id = $1 AND ci.id IS NULL
          GROUP BY f.name`,
        [ctx.organizationId]
      );
      if (result.rows.length === 0) return pass('Every control of every selected framework has an implementation record.');
      const total = result.rows.reduce((s, r) => s + r.missing, 0);
      return warn(`${total} control(s) have no implementation record yet (${result.rows.map((r) => `${r.name}: ${r.missing}`).join(', ')}). They count as not started.`,
        'Open the control to create its record, or use bulk assignment on the Controls page.', { metrics: { missing: total } });
    }
  },
  {
    id: 'crosswalk.credits_consistent',
    suite: 'frameworks',
    title: 'Crosswalk credits are backed by a satisfied source',
    description: 'Every control marked "satisfied via crosswalk" has a credit from a source control that is still implemented or verified.',
    async run(ctx) {
      const result = await pool.query(
        `SELECT fc.control_id AS control_code, f.name AS framework
           FROM control_implementations ci
           JOIN framework_controls fc ON fc.id = ci.control_id
           JOIN frameworks f ON f.id = fc.framework_id
          WHERE ci.organization_id = $1
            AND ci.status = 'satisfied_via_crosswalk'
            AND NOT EXISTS (
              SELECT 1
                FROM control_crosswalk_credits cc
                JOIN control_implementations src
                  ON src.control_id = cc.source_control_id AND src.organization_id = cc.organization_id
               WHERE cc.organization_id = ci.organization_id
                 AND cc.target_control_id = ci.control_id
                 AND src.status IN ('implemented', 'verified')
            )
          LIMIT 50`,
        [ctx.organizationId]
      );
      const credited = await pool.query(
        "SELECT COUNT(*)::int AS n FROM control_implementations WHERE organization_id = $1 AND status = 'satisfied_via_crosswalk'",
        [ctx.organizationId]
      );
      const metrics = { crosswalked: credited.rows[0].n, unbacked: result.rows.length };
      if (result.rows.length) {
        return fail(`${result.rows.length} control(s) claim crosswalk credit with no satisfied source: ${result.rows.slice(0, 5).map((r) => `${r.framework} ${r.control_code}`).join(', ')}.`,
          'Re-assess these controls directly; their crosswalk source is no longer implemented.', { metrics });
      }
      return pass(`${credited.rows[0].n} crosswalk-satisfied control(s), all backed by a satisfied source control.`, { metrics });
    }
  },
  {
    id: 'evidence.integrity_sample',
    suite: 'frameworks',
    title: 'Evidence files match their recorded hashes',
    description: 'Re-hashes the 25 most recent evidence files and compares them with the SHA-256 recorded at upload.',
    async run(ctx) {
      const result = await pool.query(
        `SELECT id, file_name, file_path, integrity_hash_sha256
           FROM evidence
          WHERE organization_id = $1 AND integrity_hash_sha256 IS NOT NULL AND file_path IS NOT NULL
          ORDER BY created_at DESC LIMIT 25`,
        [ctx.organizationId]
      );
      if (result.rows.length === 0) return { status: 'skip', detail: 'No evidence files with recorded hashes yet.' };
      const missing = [];
      const altered = [];
      for (const row of result.rows) {
        const localPath = await storageService.ensureLocal(row.file_path).catch(() => null);
        if (!localPath) { missing.push(row.file_name); continue; }
        const digest = crypto.createHash('sha256').update(await fs.promises.readFile(localPath)).digest('hex');
        if (digest !== row.integrity_hash_sha256) altered.push(row.file_name);
      }
      const metrics = { checked: result.rows.length, missing: missing.length, altered: altered.length };
      if (altered.length) {
        return fail(`${altered.length} file(s) no longer match their recorded hash: ${altered.slice(0, 5).join(', ')}.`, 'Treat as a possible integrity incident; restore from backup and review access.', { metrics });
      }
      if (missing.length) {
        return fail(`${missing.length} of ${result.rows.length} evidence file(s) are missing from storage: ${missing.slice(0, 5).join(', ')}.`,
          'Evidence storage is not persistent (for example a container filesystem that resets on deploy). Configure object storage (S3_BUCKET) or a volume at UPLOADS_DIR, then re-upload the missing files.', { metrics });
      }
      return pass(`All ${result.rows.length} sampled evidence files are present and match their recorded hashes.`, { metrics });
    }
  }
];
