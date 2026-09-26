'use strict';

const pool = require('../../../config/database');
const { createAuditLog } = require('../../auditService');

const pass = (detail, extra = {}) => ({ status: 'pass', detail, ...extra });
const warn = (detail, remediation, extra = {}) => ({ status: 'warn', detail, remediation, ...extra });
const fail = (detail, remediation, extra = {}) => ({ status: 'fail', detail, remediation, ...extra });

module.exports = [
  {
    id: 'audit.write_readback',
    suite: 'audit',
    title: 'Audit events are recorded',
    description: 'Writes a self-test audit event and reads it back through the audit API.',
    async run(ctx) {
      const marker = `qa-${ctx.runId}`;
      await createAuditLog({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        eventType: 'qa.self_test_probe',
        resourceType: 'qa_run',
        resourceId: ctx.runId,
        details: { marker },
        success: true,
        sourceSystem: 'controlweave-qa'
      });
      const response = await ctx.api.get('/audit/logs?limit=25&eventType=qa.self_test_probe');
      if (response.status !== 200) return fail(`Audit log API returned HTTP ${response.status}.`, null);
      const rows = response.data?.data?.logs || response.data?.data || [];
      const found = rows.some((row) => row.resource_id === ctx.runId || JSON.stringify(row.details || {}).includes(marker));
      if (!found) return fail('The audit event was written but is not returned by the audit log API.', 'Check audit log filtering and permissions.');
      return pass('Audit event written and returned by the audit log API.');
    }
  },
  {
    id: 'audit.hash_chain',
    suite: 'audit',
    title: 'Audit hash chain intact',
    description: 'Recomputes the SHA-384 hash of every chained audit record and checks each link to its predecessor (AU-9(3)).',
    async run(ctx) {
      const result = await pool.query(
        `WITH chain AS (
           SELECT record_hash, prev_hash,
                  lag(record_hash) OVER (ORDER BY created_at, id) AS expected_prev,
                  encode(digest(audit_log_canonical_payload(a) || '|' || COALESCE(a.prev_hash, 'GENESIS'), 'sha384'), 'hex') AS recomputed
             FROM audit_logs a
            WHERE a.organization_id = $1 AND a.record_hash IS NOT NULL
         )
         SELECT COUNT(*)::int AS rows_checked,
                COUNT(*) FILTER (WHERE recomputed <> record_hash)::int AS altered,
                COUNT(*) FILTER (WHERE expected_prev IS NOT NULL AND prev_hash IS DISTINCT FROM expected_prev)::int AS broken_links
           FROM chain`,
        [ctx.organizationId]
      );
      const { rows_checked: checked, altered, broken_links: broken } = result.rows[0];
      const metrics = { checked, altered, brokenLinks: broken };
      if (checked === 0) return { status: 'skip', detail: 'No chained audit records yet.' };
      if (altered > 0) {
        return fail(`${altered} audit record(s) no longer match their hash: the records were modified after being written.`,
          'Treat as a security incident. Export the audit log and run scripts/verify-audit-chain.js for details.', { metrics });
      }
      if (broken > 0) {
        return warn(`${checked} records verified; ${broken} link(s) do not follow the recorded order. Records written before the chain-ordering fix (migration 153) can show this; new records cannot.`,
          'Run scripts/verify-audit-chain.js to list them. If they postdate migration 153, investigate.', { metrics });
      }
      return pass(`All ${checked} chained audit records verify and link correctly.`, { metrics });
    }
  },
  {
    id: 'audit.append_only',
    suite: 'audit',
    title: 'Audit records cannot be edited or deleted',
    description: 'Attempts to update and delete an audit record inside a rolled-back transaction; both must be refused.',
    async run(ctx) {
      const target = await pool.query(
        'SELECT id FROM audit_logs WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1',
        [ctx.organizationId]
      );
      if (target.rows.length === 0) return { status: 'skip', detail: 'No audit records to test against.' };
      const id = target.rows[0].id;
      const client = await pool.connect();
      const attempt = async (sql) => {
        await client.query('BEGIN');
        try {
          await client.query(sql, [id]);
          return 'allowed';
        } catch {
          return 'refused';
        } finally {
          await client.query('ROLLBACK').catch(() => {});
        }
      };
      try {
        const update = await attempt("UPDATE audit_logs SET event_type = event_type || '-tampered' WHERE id = $1");
        const del = await attempt('DELETE FROM audit_logs WHERE id = $1');
        if (update === 'allowed' || del === 'allowed') {
          return fail(`Audit records can be ${[update === 'allowed' && 'updated', del === 'allowed' && 'deleted'].filter(Boolean).join(' and ')} (the attempt was rolled back).`,
            'Re-apply migration 121 (audit log immutability triggers).');
        }
        return pass('Update and delete of audit records are both refused by the database.');
      } finally {
        client.release();
      }
    }
  },
  {
    id: 'audit.export',
    suite: 'audit',
    title: 'Audit log export works',
    description: 'Exports the audit log as CSV through the API.',
    async run(ctx) {
      const response = await ctx.api.get('/audit/export?format=csv', { raw: true });
      if (response.status !== 200) return fail(`Audit export returned HTTP ${response.status}.`, null);
      const lines = response.data.toString('utf8').split('\n').filter(Boolean).length;
      if (lines < 2) return warn('Audit export returned no records.', null);
      return pass(`Audit export returned ${lines - 1} record(s) in ${response.ms}ms.`, { metrics: { rows: lines - 1, ms: response.ms } });
    }
  },
  {
    id: 'audit.activity',
    suite: 'audit',
    title: 'Audit coverage of recent activity',
    description: 'Summarizes which kinds of activity were audited in the last 7 days.',
    async run(ctx) {
      const result = await pool.query(
        `SELECT split_part(event_type, '.', 1) AS category, COUNT(*)::int AS n
           FROM audit_logs
          WHERE organization_id = $1 AND created_at > NOW() - INTERVAL '7 days'
          GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
        [ctx.organizationId]
      );
      const total = result.rows.reduce((s, r) => s + r.n, 0);
      if (total === 0) return warn('No audit events in the last 7 days.', 'Expected if the organization has been idle; otherwise investigate audit logging.');
      return pass(`${total} audit events in the last 7 days across ${result.rows.length} categories (${result.rows.slice(0, 6).map((r) => `${r.category}: ${r.n}`).join(', ')}).`,
        { metrics: { total, categories: result.rows } });
    }
  }
];
