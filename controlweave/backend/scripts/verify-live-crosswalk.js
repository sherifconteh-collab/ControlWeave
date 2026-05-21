// @tier: exclude
/**
 * verify-live-crosswalk.js
 *
 * Verifies auto-crosswalk end-to-end against a deployed API.
 *
 * Usage:
 *   node scripts/verify-live-crosswalk.js
 *
 * Optional env vars:
 *   API_BASE_URL   (default: https://controlweaver-pro-production.up.railway.app)
 *   ADMIN_EMAIL    (default: admin@enterprise.com)
 *   ADMIN_PASSWORD (default: ControlWeave!2026)
 */

const http = require('http');
const https = require('https');

const BASE = (process.env.API_BASE_URL || 'https://controlweaver-pro-production.up.railway.app').replace(/\/+$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@enterprise.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ControlWeave!2026';

function request(method, path, body = null, token = null) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE);
    const payload = body ? JSON.stringify(body) : null;
    const transport = url.protocol === 'https:' ? https : http;

    const options = {
      method,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (payload) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) {
      options.headers.Authorization = `Bearer ${token}`;
    }

    const req = transport.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = null;
        }
        resolve({
          status: res.statusCode,
          body: json,
          text
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        status: 0,
        body: { error: error.message },
        text: error.message
      });
    });

    if (payload) req.write(payload);
    req.end();
  });
}

function asArray(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.data?.controls)) return payload.data.controls;
  if (Array.isArray(payload.data?.items)) return payload.data.items;
  return [];
}

const STRICT_MAPPING_TYPES = new Set(['equivalent', 'exact']);

function isStrictCrosswalkMapping(mapping) {
  const mappingType = String(mapping?.mapping_type || mapping?.mappingType || '').toLowerCase();
  const similarity = Number(mapping?.similarity_score || mapping?.similarity || 0);
  return STRICT_MAPPING_TYPES.has(mappingType) || similarity === 100;
}

function normalizeMappings(mappings) {
  return mappings
    .filter((mapping) => isStrictCrosswalkMapping(mapping) && mapping?.id)
    .map((mapping) => ({
      mappedControlId: mapping.id,
      mappedControlCode: mapping.control_id || null,
      mappedTitle: mapping.title || null,
      frameworkCode: mapping.framework_code || null,
      frameworkName: mapping.framework_name || null,
      similarity: Number(mapping.similarity_score || 0),
      mappingType: String(mapping.mapping_type || '').toLowerCase(),
      statusBefore: String(mapping.implementation_status || 'not_started')
    }));
}

async function loadControl(token, controlId) {
  const detail = await request('GET', `/api/v1/controls/${controlId}`, null, token);
  return {
    response: detail,
    control: detail.body?.data || null
  };
}

async function restoreControlStatus(token, controlId, status, note) {
  return setStatus(token, controlId, status, note);
}

async function setStatus(token, controlId, status, note) {
  const body = { status, notes: note };
  if (['implemented', 'verified', 'satisfied_via_crosswalk'].includes(status)) {
    body.poam_justification = 'Crosswalk verification: control remediation completed and documented.';
  }
  return request(
    'PUT',
    `/api/v1/controls/${controlId}/implementation`,
    body,
    token
  );
}

async function run() {
  console.log(`Using API base: ${BASE}`);
  console.log(`Login user: ${ADMIN_EMAIL}`);

  let sourceControl = null;
  let sourceBeforeStatus = null;
  let mappedSample = [];

  const login = await request('POST', '/api/v1/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  });
  if (login.status !== 200) {
    console.error(`Login failed (${login.status})`);
    process.exit(1);
  }

  const token = login.body?.data?.tokens?.accessToken || login.body?.data?.accessToken;
  if (!token) {
    console.error('No access token returned from login');
    process.exit(1);
  }

  const me = await request('GET', '/api/v1/auth/me', null, token);
  if (me.status !== 200) {
    console.error(`GET /auth/me failed (${me.status})`);
    process.exit(1);
  }
  const orgId = me.body?.data?.organization?.id || me.body?.data?.organizationId || me.body?.data?.organization_id;
  if (!orgId) {
    console.error('No organization id found in /auth/me response');
    process.exit(1);
  }

  const controlsRes = await request('GET', `/api/v1/organizations/${orgId}/controls`, null, token);
  if (controlsRes.status !== 200) {
    console.error(`GET controls failed (${controlsRes.status})`);
    process.exit(1);
  }
  const controls = asArray(controlsRes.body);
  if (!controls.length) {
    console.error('Organization has no controls to test');
    process.exit(1);
  }

  for (const control of controls.slice(0, 200)) {
    const mappingsRes = await request('GET', `/api/v1/controls/${control.id}/mappings`, null, token);
    if (mappingsRes.status !== 200) continue;
    const normalized = normalizeMappings(asArray(mappingsRes.body));
    const eligibleMappings = normalized.filter((mapping) => mapping.statusBefore === 'not_started');
    if (!eligibleMappings.length) continue;

    const sourceDetail = await loadControl(token, control.id);
    if (sourceDetail.response.status !== 200 || !sourceDetail.control) continue;

    sourceControl = {
      id: control.id,
      control_id: sourceDetail.control.control_id || control.control_id,
      title: sourceDetail.control.title || control.title
    };
    sourceBeforeStatus = String(sourceDetail.control.implementation_status || 'not_started');
    mappedSample = eligibleMappings.slice(0, 3);
    break;
  }

  if (!sourceControl) {
    console.error('No control with mappings found. Auto-crosswalk cannot run without control_mappings data.');
    process.exit(2);
  }

  try {
    for (const mapping of mappedSample) {
      await setStatus(
        token,
        mapping.mappedControlId,
        'not_started',
        'Crosswalk verification precondition reset'
      );
    }

    const implemented = await setStatus(
      token,
      sourceControl.id,
      'implemented',
      'Crosswalk verification trigger'
    );

    if (implemented.status !== 200) {
      console.error(`Failed to mark source control implemented (${implemented.status})`);
      process.exit(1);
    }

    const crosswalked = implemented.body?.data?.crosswalkedControls || implemented.body?.data?.autoCrosswalked || [];
    const sourceAfter = await loadControl(token, sourceControl.id);
    const historyRes = await request('GET', `/api/v1/controls/${sourceControl.id}/history`, null, token);
    const historyItems = asArray(historyRes.body);

    const mappedAfter = [];
    for (const mapping of mappedSample) {
      const detail = await loadControl(token, mapping.mappedControlId);
      mappedAfter.push({
        id: mapping.mappedControlId,
        control_id: detail.control?.control_id || mapping.mappedControlCode,
        title: detail.control?.title || mapping.mappedTitle,
        status_before: mapping.statusBefore,
        status_after: detail.control?.implementation_status || null,
        similarity: mapping.similarity,
        mapping_type: mapping.mappingType,
        framework: mapping.frameworkName || mapping.frameworkCode || null
      });
    }

    const propagatedTargets = mappedAfter.filter((mapping) => mapping.status_after === 'satisfied_via_crosswalk');
    const latestHistory = historyItems[0] || null;

    console.log('\nCrosswalk verification summary');
    console.log('------------------------------');
    console.log(`Source control: ${sourceControl.control_id} (${sourceControl.id})`);
    console.log(`Source status before: ${sourceBeforeStatus}`);
    console.log(`Source status after: ${sourceAfter.control?.implementation_status || 'unknown'}`);
    console.log(`Strict mappings tested: ${mappedSample.length}`);
    console.log(`Crosswalked controls returned by API: ${Array.isArray(crosswalked) ? crosswalked.length : 0}`);
    console.log('Mapped control statuses after trigger:');
    for (const row of mappedAfter) {
      console.log(`  - ${row.control_id || row.id}: ${row.status_before} -> ${row.status_after} (${row.mapping_type || 'mapped'}, ${row.similarity}%)`);
    }
    if (latestHistory?.details) {
      console.log(`Latest history event: ${latestHistory.event_type || 'unknown'} (${latestHistory.created_at || 'no timestamp'})`);
    }

    if (!Array.isArray(crosswalked) || crosswalked.length === 0) {
      console.error('\nAuto-crosswalk call succeeded but returned zero crosswalked controls.');
      process.exit(3);
    }

    if (propagatedTargets.length !== mappedSample.length) {
      console.error('\nMapped controls did not all transition to satisfied_via_crosswalk.');
      process.exit(4);
    }

    if (sourceAfter.control?.implementation_status !== 'implemented') {
      console.error('\nSource control did not persist the implemented status.');
      process.exit(5);
    }

    console.log('\nAuto-crosswalk verified successfully.');
  } finally {
    for (const mapping of mappedSample) {
      await restoreControlStatus(
        token,
        mapping.mappedControlId,
        mapping.statusBefore,
        'Crosswalk verification cleanup restore'
      ).catch(() => {});
    }

    if (sourceControl && sourceBeforeStatus) {
      await restoreControlStatus(
        token,
        sourceControl.id,
        sourceBeforeStatus,
        'Crosswalk verification cleanup restore'
      ).catch(() => {});
    }
  }
}

run().catch((error) => {
  console.error('Unexpected error during crosswalk verification:', error.message);
  process.exit(1);
});
