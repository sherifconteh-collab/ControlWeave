'use strict';

const pool = require('../../../config/database');

const pass = (detail, extra = {}) => ({ status: 'pass', detail, ...extra });
const fail = (detail, remediation, extra = {}) => ({ status: 'fail', detail, remediation, ...extra });

// Every record these checks create is named with this prefix and removed (or
// archived, where the product has no delete) before the check returns.
const QA_TAG = '[QA self-test]';

class StepError extends Error {}

function expectStatus(step, response, allowed = [200, 201]) {
  if (!allowed.includes(response.status)) {
    const message = response.data && (response.data.error || response.data.message);
    throw new StepError(`${step} failed: HTTP ${response.status}${message ? ` (${String(message).slice(0, 160)})` : ''}`);
  }
  return response;
}

async function runSteps(steps) {
  const timings = [];
  for (const [name, fn] of steps) {
    const started = Date.now();
    await fn();
    timings.push(`${name} ${Date.now() - started}ms`);
  }
  return timings;
}

async function sampleControlId(orgId) {
  const result = await pool.query(
    `SELECT fc.id
       FROM organization_frameworks of2
       JOIN framework_controls fc ON fc.framework_id = of2.framework_id
      WHERE of2.organization_id = $1
      ORDER BY fc.id
      LIMIT 1`,
    [orgId]
  );
  return result.rows[0] ? result.rows[0].id : null;
}

function asResult(label, promise) {
  return promise
    .then((timings) => pass(`${label}: ${timings.join(', ')}.`))
    .catch((error) => {
      if (error instanceof StepError) return fail(error.message, 'Re-run with the browser developer tools open to capture the failing request, and send the run export to support.');
      throw error;
    });
}

module.exports = [
  {
    id: 'functional.risk_lifecycle',
    suite: 'functional',
    title: 'Risk register workflow',
    description: 'Creates a risk, links a control, updates it, reads it back and deletes it.',
    run(ctx) {
      let riskId = null;
      const flow = runSteps([
        ['create', async () => {
          const r = expectStatus('Create risk', await ctx.api.post('/risks', { title: `${QA_TAG} risk`, inherentLikelihood: 3, inherentImpact: 4 }));
          riskId = r.data?.data?.id;
          if (!riskId) throw new StepError('Create risk returned no id');
        }],
        ['link control', async () => {
          const controlId = await sampleControlId(ctx.organizationId);
          if (controlId) expectStatus('Link control to risk', await ctx.api.post(`/risks/${riskId}/controls`, { controlId }));
        }],
        ['update', async () => {
          expectStatus('Update risk', await ctx.api.put(`/risks/${riskId}`, { title: `${QA_TAG} risk (updated)` }));
        }],
        ['read', async () => {
          const r = expectStatus('Read risk', await ctx.api.get(`/risks/${riskId}`));
          if (!String(JSON.stringify(r.data)).includes('(updated)')) throw new StepError('Updated risk title not returned on read');
        }]
      ]).finally(async () => {
        if (riskId) await ctx.api.delete(`/risks/${riskId}`).catch(() => {});
      });
      return asResult('Risk created, linked, updated, read back and deleted', flow);
    }
  },
  {
    id: 'functional.evidence_lifecycle',
    suite: 'functional',
    title: 'Evidence workflow',
    description: 'Uploads a file, verifies its integrity hash and download, links it to a control, confirms the link appears on the control, then removes it.',
    run(ctx) {
      let evidenceId = null;
      let controlId = null;
      const content = `${QA_TAG} evidence file for run ${ctx.runId}\n`;
      const flow = runSteps([
        ['upload', async () => {
          const form = new FormData();
          form.append('file', new Blob([content], { type: 'text/plain' }), 'qa-self-test.txt');
          form.append('description', `${QA_TAG} evidence`);
          form.append('pii_classification', 'none');
          form.append('data_sensitivity', 'internal');
          const r = expectStatus('Upload evidence', await ctx.api.postForm('/evidence/upload', form));
          evidenceId = r.data?.data?.id;
          if (!evidenceId) throw new StepError('Evidence upload returned no id');
        }],
        ['integrity', async () => {
          const r = expectStatus('Evidence integrity check', await ctx.api.get(`/evidence/${evidenceId}/integrity-check`));
          if (r.data?.data?.matches !== true) throw new StepError('Uploaded evidence failed its own integrity check');
        }],
        ['download', async () => {
          const r = expectStatus('Download evidence', await ctx.api.get(`/evidence/${evidenceId}/download`, { raw: true }));
          if (r.data.toString('utf8') !== content) throw new StepError('Downloaded evidence does not match the uploaded file');
        }],
        ['link', async () => {
          controlId = await sampleControlId(ctx.organizationId);
          if (!controlId) return;
          expectStatus('Link evidence to control', await ctx.api.post(`/evidence/${evidenceId}/link`, { controlIds: [controlId], notes: QA_TAG }));
          const linked = await pool.query(
            'SELECT 1 FROM evidence_control_links WHERE evidence_id = $1 AND control_id = $2 AND organization_id = $3',
            [evidenceId, controlId, ctx.organizationId]
          );
          if (linked.rows.length === 0) throw new StepError('Evidence link was acknowledged but not stored');
        }],
        ['unlink', async () => {
          if (controlId) expectStatus('Unlink evidence', await ctx.api.delete(`/evidence/${evidenceId}/unlink/${controlId}`));
        }]
      ]).finally(async () => {
        if (evidenceId) await ctx.api.delete(`/evidence/${evidenceId}`).catch(() => {});
      });
      return asResult('Evidence uploaded, verified, downloaded, linked, unlinked and deleted', flow);
    }
  },
  {
    id: 'functional.assessment_lifecycle',
    suite: 'functional',
    title: 'Audit engagement workflow',
    description: 'Creates an engagement with a PBC request, finding, workpaper and sign-off, then archives it.',
    run(ctx) {
      let engagementId = null;
      const flow = runSteps([
        ['engagement', async () => {
          const r = expectStatus('Create engagement', await ctx.api.post('/assessments/engagements', { name: `${QA_TAG} engagement`, engagement_type: 'internal_audit' }));
          engagementId = r.data?.data?.id;
          if (!engagementId) throw new StepError('Create engagement returned no id');
        }],
        ['PBC', async () => {
          expectStatus('Create PBC request', await ctx.api.post(`/assessments/engagements/${engagementId}/pbc`, { title: `${QA_TAG} PBC`, request_details: 'Self-test request', priority: 'low' }));
        }],
        ['finding', async () => {
          expectStatus('Create finding', await ctx.api.post(`/assessments/engagements/${engagementId}/findings`, { title: `${QA_TAG} finding`, description: 'Self-test finding', severity: 'low' }));
        }],
        ['workpaper', async () => {
          expectStatus('Create workpaper', await ctx.api.post(`/assessments/engagements/${engagementId}/workpapers`, { title: `${QA_TAG} workpaper`, objective: 'Self-test', procedure_performed: 'Self-test' }));
        }],
        ['sign-off', async () => {
          expectStatus('Record sign-off', await ctx.api.post(`/assessments/engagements/${engagementId}/signoffs`, { signoff_type: 'auditor', status: 'approved', comments: QA_TAG }));
        }]
      ]).finally(async () => {
        if (engagementId) await ctx.api.patch(`/assessments/engagements/${engagementId}`, { status: 'archived' }).catch(() => {});
      });
      return asResult('Engagement, PBC, finding, workpaper and sign-off created; engagement archived', flow);
    }
  },
  {
    id: 'functional.vendor_lifecycle',
    suite: 'functional',
    title: 'Third-party vendor workflow',
    description: 'Creates a vendor, reads it back and deletes it.',
    run(ctx) {
      let vendorId = null;
      const flow = runSteps([
        ['create', async () => {
          const r = expectStatus('Create vendor', await ctx.api.post('/tprm/vendors', { vendor_name: `${QA_TAG} vendor ${Date.now()}`, vendor_type: 'software', risk_tier: 'low', data_access_level: 'none' }));
          vendorId = r.data?.data?.id;
          if (!vendorId) throw new StepError('Create vendor returned no id');
        }],
        ['read', async () => {
          expectStatus('Read vendor', await ctx.api.get(`/tprm/vendors/${vendorId}`));
        }]
      ]).finally(async () => {
        if (vendorId) await ctx.api.delete(`/tprm/vendors/${vendorId}`).catch(() => {});
      });
      return asResult('Vendor created, read back and deleted', flow);
    }
  },
  {
    id: 'functional.reports',
    suite: 'functional',
    title: 'Compliance reports generate',
    description: 'Generates the PDF and Excel compliance reports.',
    async run(ctx) {
      const pdf = await ctx.api.get('/reports/compliance/pdf', { raw: true });
      const xlsx = await ctx.api.get('/reports/compliance/excel', { raw: true });
      const problems = [];
      if (pdf.status !== 200 || pdf.data.subarray(0, 4).toString() !== '%PDF') problems.push(`PDF report (HTTP ${pdf.status})`);
      if (xlsx.status !== 200 || xlsx.data.subarray(0, 2).toString() !== 'PK') problems.push(`Excel report (HTTP ${xlsx.status})`);
      if (problems.length) return fail(`Report generation failed: ${problems.join(', ')}.`, null);
      return pass(`PDF (${Math.round(pdf.data.length / 1024)} KB, ${pdf.ms}ms) and Excel (${Math.round(xlsx.data.length / 1024)} KB, ${xlsx.ms}ms) reports generated.`);
    }
  }
];
