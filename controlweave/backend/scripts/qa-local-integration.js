// @tier: exclude
/**
 * Local integration harness with DB-backed assertions.
 *
 * This suite is intended for local or staging environments where the API and
 * PostgreSQL database are both available. Unlike the smoke-style QA scripts,
 * it verifies exact persisted state after API mutations.
 *
 * Usage:
 *   QA_BASE_URL=http://localhost:3001 node scripts/qa-local-integration.js
 */

const http = require('http');
const https = require('https');
const { createHash } = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

const BASE = (process.env.QA_BASE_URL || process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/+$/, '');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'grc_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || ''
});

let passed = 0;
let failed = 0;
const failures = [];

function hashRefreshToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

function req(method, urlPath, body, token, extraHeaders = {}) {
  return new Promise((resolve) => {
    const url = new URL(urlPath, BASE);
    const transport = url.protocol === 'https:' ? https : http;
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...extraHeaders
      }
    };

    if (token) {
      options.headers.Authorization = `Bearer ${token}`;
    }
    if (payload) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const request = transport.request(options, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = text;
        }

        resolve({
          status: response.statusCode,
          body: json,
          headers: response.headers
        });
      });
    });

    request.on('error', (error) => resolve({ status: 0, body: { error: error.message } }));
    if (payload) request.write(payload);
    request.end();
  });
}

async function dbQuery(sql, params = []) {
  return pool.query(sql, params);
}

function pass(label) {
  passed += 1;
  console.log(`  PASS ${label}`);
}

function fail(label, detail) {
  failed += 1;
  const message = detail ? `${label} (${detail})` : label;
  failures.push(message);
  console.log(`  FAIL ${message}`);
}

async function check(label, fn) {
  try {
    await fn();
    pass(label);
  } catch (error) {
    fail(label, error.message);
  }
}

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const ts = Date.now();
  const adminEmail = `qa-local-admin-${ts}@test.com`;
  const secondEmail = `qa-local-user-${ts}@test.com`;
  const password = 'LocalQaPass123!';
  const organizationName = `QA Local Org ${ts}`;

  let adminToken = null;
  let adminRefreshToken = null;
  let adminUserId = null;
  let orgId = null;
  let secondToken = null;
  let secondOrgId = null;
  let controlId = null;
  let controlFrameworkId = null;
  let notificationId = null;
  let contactId = null;
  let policyId = null;
  let policySectionId = null;
  let policyReviewId = null;
  let connectorId = null;
  let externalApiKeyId = null;
  let vendorId = null;
  let questionnaireId = null;
  let documentId = null;
  let switchedAccessToken = null;
  let switchedRefreshToken = null;
  const passkeyCredentialId = `qa-local-passkey-${ts}`;
  const externalApiKey = `cw_live_localqa${ts}`;

  console.log('\n================================================');
  console.log(' Local Integration QA Harness');
  console.log('================================================');
  console.log(` Base URL: ${BASE}`);

  await check('0.1 health endpoint is healthy', async () => {
    const health = await req('GET', '/health');
    expect(health.status === 200, `expected 200, got ${health.status}`);
    expect(health.body?.status === 'healthy', `expected healthy, got ${health.body?.status}`);
  });

  await check('1.1 register isolated local QA org', async () => {
    const register = await req('POST', '/api/v1/auth/register', {
      email: adminEmail,
      password,
      full_name: 'Local QA Admin',
      organization_name: organizationName
    });

    expect(register.status === 201, `expected 201, got ${register.status}`);
    adminToken = register.body?.data?.tokens?.accessToken || null;
    adminRefreshToken = register.body?.data?.tokens?.refreshToken || null;
    adminUserId = register.body?.data?.user?.id || null;
    orgId = register.body?.data?.organization?.id || register.body?.data?.user?.organization_id || null;
    expect(Boolean(adminToken), 'missing access token');
    expect(Boolean(adminRefreshToken), 'missing refresh token');
    expect(Boolean(adminUserId), 'missing user id');
    expect(Boolean(orgId), 'missing organization id');
  });

  await check('1.1a passkey auth options resolve registered credentials by email lookup', async () => {
    await dbQuery(
      `INSERT INTO user_passkeys (user_id, credential_id, public_key, counter, device_type, backed_up, transports, name)
       VALUES ($1, $2, $3, 0, 'singleDevice', false, ARRAY['internal'], 'Local QA Passkey')
       ON CONFLICT (credential_id) DO NOTHING`,
      [adminUserId, passkeyCredentialId, 'cHVibGljLWtleS1xYS1sb2NhbA']
    );

    const options = await req('POST', '/api/v1/auth/passkey/auth/options', {
      email: adminEmail
    });

    expect(options.status === 200, `expected 200, got ${options.status}`);
    expect(Boolean(options.body?.data?.challengeId), 'missing challengeId');
    expect(
      Array.isArray(options.body?.data?.options?.allowCredentials)
        && options.body.data.options.allowCredentials.some((credential) => credential.id === passkeyCredentialId),
      'passkey allowCredentials missing seeded credential'
    );
  });

  let frameworks = [];

  await check('1.2 add two frameworks and verify DB state', async () => {
    const frameworkList = await req('GET', '/api/v1/frameworks', null, adminToken);
    expect(frameworkList.status === 200, `expected 200, got ${frameworkList.status}`);
    frameworks = (frameworkList.body?.data || []).slice(0, 2);
    expect(frameworks.length === 2, `expected 2 frameworks, got ${frameworks.length}`);

    const addFrameworks = await req('POST', `/api/v1/organizations/${orgId}/frameworks`, {
      frameworkIds: frameworks.map((framework) => framework.id)
    }, adminToken);
    expect(addFrameworks.status === 200, `expected 200, got ${addFrameworks.status}`);

    const organizationFrameworks = await dbQuery(
      `SELECT framework_id::text AS framework_id
       FROM organization_frameworks
       WHERE organization_id = $1
       ORDER BY framework_id`,
      [orgId]
    );

    expect(organizationFrameworks.rows.length === 2, `expected 2 org frameworks, got ${organizationFrameworks.rows.length}`);
    expect(
      frameworks.every((framework) => organizationFrameworks.rows.some((row) => row.framework_id === framework.id)),
      'framework selection not persisted in organization_frameworks'
    );
  });

  await check('1.3 dashboard stats reflect selected controls', async () => {
    const controls = await req('GET', `/api/v1/organizations/${orgId}/controls`, null, adminToken);
    expect(controls.status === 200, `expected 200, got ${controls.status}`);
    expect(Array.isArray(controls.body?.data) && controls.body.data.length > 0, 'expected organization controls');
    controlId = controls.body.data[0].id;

    const controlResult = await dbQuery(
      `SELECT framework_id::text AS framework_id
       FROM framework_controls
       WHERE id = $1
       LIMIT 1`,
      [controlId]
    );
    controlFrameworkId = controlResult.rows[0]?.framework_id || controls.body.data[0].framework_id || frameworks[0]?.id || null;
    expect(Boolean(controlFrameworkId), 'missing control framework id');

    const stats = await req('GET', '/api/v1/dashboard/stats', null, adminToken);
    expect(stats.status === 200, `expected 200, got ${stats.status}`);
    expect(stats.body?.data?.overall?.totalControls === controls.body.data.length, `dashboard totalControls mismatch: ${stats.body?.data?.overall?.totalControls} vs ${controls.body.data.length}`);
    expect(stats.body?.data?.frameworks?.length === frameworks.length, `dashboard frameworks mismatch: ${stats.body?.data?.frameworks?.length} vs ${frameworks.length}`);
  });

  await check('2.1 implementation transition persists in DB', async () => {
    const inProgress = await req('PUT', `/api/v1/controls/${controlId}/implementation`, {
      status: 'in_progress',
      notes: 'Local integration QA in progress'
    }, adminToken);
    expect(inProgress.status === 200, `expected 200, got ${inProgress.status}`);

    const implementation = await dbQuery(
      `SELECT status, notes
       FROM control_implementations
       WHERE organization_id = $1 AND control_id = $2
       LIMIT 1`,
      [orgId, controlId]
    );

    expect(implementation.rows.length === 1, 'missing control_implementations row');
    expect(implementation.rows[0].status === 'in_progress', `expected in_progress, got ${implementation.rows[0].status}`);
  });

  await check('2.2 compliant transition creates audit and POA&M approval state', async () => {
    const implemented = await req('PUT', `/api/v1/controls/${controlId}/implementation`, {
      status: 'implemented',
      notes: 'Local integration QA complete',
      poam_justification: 'Local integration harness validated remediation evidence.'
    }, adminToken);
    expect(implemented.status === 200, `expected 200, got ${implemented.status}`);
    expect(implemented.body?.data?.implementation?.status === 'implemented', 'API response did not persist implemented status');

    const implementation = await dbQuery(
      `SELECT status
       FROM control_implementations
       WHERE organization_id = $1 AND control_id = $2
       LIMIT 1`,
      [orgId, controlId]
    );
    expect(implementation.rows[0]?.status === 'implemented', `expected implemented, got ${implementation.rows[0]?.status}`);

    const auditLog = await dbQuery(
      `SELECT event_type, details
       FROM audit_logs
       WHERE organization_id = $1
         AND resource_type = 'control'
         AND resource_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [orgId, controlId]
    );
    expect(auditLog.rows.length === 1, 'missing control audit log');
    expect(auditLog.rows[0].event_type === 'control_status_changed', `unexpected audit event ${auditLog.rows[0].event_type}`);
    expect(auditLog.rows[0].details?.new_status === 'implemented', `expected audit new_status implemented, got ${auditLog.rows[0].details?.new_status}`);

    const poamRequest = await dbQuery(
      `SELECT new_control_status, justification
       FROM poam_approval_requests
       WHERE organization_id = $1 AND control_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [orgId, controlId]
    );
    expect(poamRequest.rows.length === 1, 'missing poam_approval_requests row');
    expect(poamRequest.rows[0].new_control_status === 'implemented', `expected implemented POA&M request, got ${poamRequest.rows[0].new_control_status}`);
  });

  await check('3.1 notification create and mark-read persist in DB', async () => {
    const createNotification = await req('POST', '/api/v1/notifications', {
      type: 'system',
      title: 'Local QA notification',
      message: 'Created by qa-local-integration.js'
    }, adminToken);
    expect(createNotification.status === 201, `expected 201, got ${createNotification.status}`);
    notificationId = createNotification.body?.data?.id || null;
    expect(Boolean(notificationId), 'missing notification id');

    const unreadNotifications = await req('GET', '/api/v1/notifications?unread=true', null, adminToken);
    expect(unreadNotifications.status === 200, `expected 200, got ${unreadNotifications.status}`);
    expect(unreadNotifications.body?.data?.notifications?.some((row) => row.id === notificationId), 'notification missing from unread list');

    const notificationRow = await dbQuery(
      `SELECT is_read
       FROM notifications
       WHERE id = $1 AND organization_id = $2
       LIMIT 1`,
      [notificationId, orgId]
    );
    expect(notificationRow.rows[0]?.is_read === false, 'notification should start unread');

    const markRead = await req('PATCH', `/api/v1/notifications/${notificationId}/read`, null, adminToken);
    expect(markRead.status === 200, `expected 200, got ${markRead.status}`);

    const notificationAfter = await dbQuery(
      `SELECT is_read
       FROM notifications
       WHERE id = $1 AND organization_id = $2
       LIMIT 1`,
      [notificationId, orgId]
    );
    expect(notificationAfter.rows[0]?.is_read === true, 'notification should be marked read');
  });

  await check('4.1 org LLM settings are encrypted and removable', async () => {
    const putSettings = await req('PUT', '/api/v1/settings/llm', {
      default_provider: 'openai',
      default_model: 'gpt-4o-mini',
      openai_api_key: 'sk-local-integration-test-key'
    }, adminToken);
    expect(putSettings.status === 200, `expected 200, got ${putSettings.status}`);

    const settingsRows = await dbQuery(
      `SELECT setting_key, is_encrypted
       FROM organization_settings
       WHERE organization_id = $1
         AND setting_key IN ('default_provider', 'openai_api_key')`,
      [orgId]
    );
    expect(settingsRows.rows.length === 2, `expected 2 setting rows, got ${settingsRows.rows.length}`);
    expect(settingsRows.rows.some((row) => row.setting_key === 'openai_api_key' && row.is_encrypted === true), 'openai_api_key should be stored encrypted');
    expect(settingsRows.rows.some((row) => row.setting_key === 'default_provider'), 'default_provider should be stored');

    const getSettings = await req('GET', '/api/v1/settings/llm', null, adminToken);
    expect(getSettings.status === 200, `expected 200, got ${getSettings.status}`);
    expect(getSettings.body?.data?.defaultProvider === 'openai', `expected openai, got ${getSettings.body?.data?.defaultProvider}`);
    expect(getSettings.body?.data?.hasOpenAIKey === true, 'expected hasOpenAIKey true');

    const deleteKey = await req('DELETE', '/api/v1/settings/llm/openai', null, adminToken);
    expect(deleteKey.status === 200, `expected 200, got ${deleteKey.status}`);

    const deletedRow = await dbQuery(
      `SELECT 1
       FROM organization_settings
       WHERE organization_id = $1 AND setting_key = 'openai_api_key'`,
      [orgId]
    );
    expect(deletedRow.rows.length === 0, 'openai_api_key row should be removed');
  });

  await check('4.2 contacts lifecycle persists soft-delete state', async () => {
    const createContact = await req('POST', '/api/v1/contacts', {
      full_name: 'Local QA Contact',
      email: `local-contact-${ts}@example.com`,
      title: 'Compliance Lead',
      team: 'GRC',
      notes: 'Created by the local integration harness'
    }, adminToken);
    expect(createContact.status === 201, `expected 201, got ${createContact.status}`);
    contactId = createContact.body?.data?.id || null;
    expect(Boolean(contactId), 'missing contact id');

    const updateContact = await req('PATCH', `/api/v1/contacts/${contactId}`, {
      title: 'Senior Compliance Lead',
      notes: 'Updated by the local integration harness'
    }, adminToken);
    expect(updateContact.status === 200, `expected 200, got ${updateContact.status}`);
    expect(updateContact.body?.data?.title === 'Senior Compliance Lead', 'contact title did not update');

    const deleteContact = await req('DELETE', `/api/v1/contacts/${contactId}`, null, adminToken);
    expect(deleteContact.status === 200, `expected 200, got ${deleteContact.status}`);

    const contactRow = await dbQuery(
      `SELECT is_active, title, notes
       FROM organization_contacts
       WHERE id = $1 AND organization_id = $2
       LIMIT 1`,
      [contactId, orgId]
    );
    expect(contactRow.rows.length === 1, 'missing organization_contacts row');
    expect(contactRow.rows[0].is_active === false, 'contact should be inactive after soft delete');
    expect(contactRow.rows[0].title === 'Senior Compliance Lead', 'contact update should persist before delete');

    const contactsList = await req('GET', '/api/v1/contacts', null, adminToken);
    expect(contactsList.status === 200, `expected 200, got ${contactsList.status}`);
    expect(contactsList.body?.data?.some((row) => row.id === contactId && row.is_active === false), 'soft-deleted contact missing from list response');
  });

  await check('4.3 policy section updates are idempotent and policy emails are decrypted', async () => {
    const createPolicy = await req('POST', '/api/v1/policies', {
      policy_name: 'Local QA Access Control Policy',
      policy_type: 'access_control',
      description: 'Created by qa-local-integration.js',
      effective_date: new Date().toISOString().slice(0, 10)
    }, adminToken);
    expect(createPolicy.status === 201, `expected 201, got ${createPolicy.status}`);
    policyId = createPolicy.body?.data?.id || null;
    expect(Boolean(policyId), 'missing policy id');

    const listPolicies = await req('GET', '/api/v1/policies', null, adminToken);
    expect(listPolicies.status === 200, `expected 200, got ${listPolicies.status}`);
    const listedPolicy = listPolicies.body?.data?.policies?.find((row) => row.id === policyId);
    expect(Boolean(listedPolicy), 'created policy missing from list response');
    expect(listedPolicy.created_by_email === adminEmail, `expected decrypted created_by_email ${adminEmail}, got ${listedPolicy?.created_by_email}`);

    const createSection = await req('POST', `/api/v1/policies/${policyId}/sections`, {
      section_number: '1.1',
      section_title: 'Purpose',
      section_content: 'Initial policy section content',
      framework_family_code: 'AC',
      framework_family_name: 'Access Control',
      display_order: 1,
      control_mappings: [
        {
          control_id: controlId,
          framework_id: controlFrameworkId,
          mapping_notes: 'Initial control mapping'
        }
      ]
    }, adminToken);
    expect(createSection.status === 201, `expected 201, got ${createSection.status}`);
    policySectionId = createSection.body?.data?.id || null;
    expect(Boolean(policySectionId), 'missing policy section id');

    const updateSection = await req('POST', `/api/v1/policies/${policyId}/sections`, {
      section_number: '1.1',
      section_title: 'Purpose and Scope',
      section_content: 'Updated policy section content',
      framework_family_code: 'AC',
      framework_family_name: 'Access Control',
      display_order: 1,
      control_mappings: [
        {
          control_id: controlId,
          framework_id: controlFrameworkId,
          mapping_notes: 'Updated control mapping'
        }
      ]
    }, adminToken);
    expect(updateSection.status === 200, `expected 200, got ${updateSection.status}`);
    expect(updateSection.body?.data?.id === policySectionId, 'section update should reuse the existing section row');

    const sectionRows = await dbQuery(
      `SELECT id, section_title, section_content
       FROM policy_sections
       WHERE organization_id = $1 AND policy_id = $2 AND section_number = $3`,
      [orgId, policyId, '1.1']
    );
    expect(sectionRows.rows.length === 1, `expected 1 policy section row, got ${sectionRows.rows.length}`);
    expect(sectionRows.rows[0].section_title === 'Purpose and Scope', `expected updated section title, got ${sectionRows.rows[0].section_title}`);
    expect(sectionRows.rows[0].section_content === 'Updated policy section content', 'policy section content did not update');

    const mappingRows = await dbQuery(
      `SELECT mapping_notes
       FROM policy_control_mappings
       WHERE policy_section_id = $1 AND control_id = $2`,
      [policySectionId, controlId]
    );
    expect(mappingRows.rows.length === 1, `expected 1 policy control mapping, got ${mappingRows.rows.length}`);
    expect(mappingRows.rows[0].mapping_notes === 'Updated control mapping', 'control mapping notes did not update');

    const sectionControls = await req('GET', `/api/v1/policies/${policyId}/sections/${policySectionId}/controls`, null, adminToken);
    expect(sectionControls.status === 200, `expected 200, got ${sectionControls.status}`);
    expect(sectionControls.body?.data?.some((row) => row.control_id === controlId), 'policy section controls response missing mapped control');

    const createReview = await req('POST', `/api/v1/policies/${policyId}/reviews`, {
      review_type: 'annual',
      review_status: 'completed',
      review_notes: 'Local integration review',
      changes_made: true,
      requires_user_acknowledgment: true
    }, adminToken);
    expect(createReview.status === 201, `expected 201, got ${createReview.status}`);
    policyReviewId = createReview.body?.data?.id || null;
    expect(Boolean(policyReviewId), 'missing policy review id');

    const policyDetail = await req('GET', `/api/v1/policies/${policyId}`, null, adminToken);
    expect(policyDetail.status === 200, `expected 200, got ${policyDetail.status}`);
    expect(policyDetail.body?.data?.policy?.created_by_email === adminEmail, `expected decrypted policy email ${adminEmail}, got ${policyDetail.body?.data?.policy?.created_by_email}`);
    const recentReview = (policyDetail.body?.data?.recent_reviews || []).find((row) => row.id === policyReviewId);
    expect(recentReview?.reviewed_by_email === adminEmail, `expected decrypted review email ${adminEmail}, got ${recentReview?.reviewed_by_email}`);

    const monitoringAlerts = await req('GET', `/api/v1/policies/${policyId}/monitoring-alerts`, null, adminToken);
    expect(monitoringAlerts.status === 200, `expected 200, got ${monitoringAlerts.status}`);
    expect(monitoringAlerts.body?.data?.some((row) => row.alert_type === 'acknowledgment_required'), 'expected acknowledgment_required monitoring alert');

    const acknowledgePolicy = await req('POST', `/api/v1/policies/${policyId}/acknowledge`, {
      policy_review_id: policyReviewId,
      acknowledgment_notes: 'Acknowledged by local integration harness'
    }, adminToken);
    expect(acknowledgePolicy.status === 201, `expected 201, got ${acknowledgePolicy.status}`);

    const acknowledgments = await dbQuery(
      `SELECT acknowledgment_notes
       FROM policy_user_acknowledgments
       WHERE organization_id = $1 AND policy_id = $2 AND policy_review_id = $3 AND user_id = $4`,
      [orgId, policyId, policyReviewId, adminUserId]
    );
    expect(acknowledgments.rows.length === 1, 'expected policy acknowledgment row');
    expect(acknowledgments.rows[0].acknowledgment_notes === 'Acknowledged by local integration harness', 'policy acknowledgment notes did not persist');
  });

  await check('4.4 upgrade local QA org to enterprise for advanced feature coverage', async () => {
    await dbQuery(
      `UPDATE organizations
       SET tier = 'enterprise',
           paid_tier = 'enterprise',
           billing_status = 'active_paid',
           updated_at = NOW()
       WHERE id = $1`,
      [orgId]
    );

    const me = await req('GET', '/api/v1/auth/me', null, adminToken);
    expect(me.status === 200, `expected 200, got ${me.status}`);
    expect(me.body?.data?.organization?.tier === 'enterprise', `expected enterprise tier, got ${me.body?.data?.organization?.tier}`);
  });

  await check('4.5 integrations hub connector lifecycle persists run history', async () => {
    const templates = await req('GET', '/api/v1/integrations-hub/templates', null, adminToken);
    expect(templates.status === 200, `expected 200, got ${templates.status}`);
    expect(Array.isArray(templates.body?.data) && templates.body.data.length > 0, 'expected integration templates');

    const createConnector = await req('POST', '/api/v1/integrations-hub/connectors', {
      name: 'Local QA Splunk Connector',
      connector_type: 'splunk',
      status: 'inactive',
      auth_config: { token: 'local-test-token' },
      connector_config: { baseUrl: 'https://splunk.example.test' }
    }, adminToken);
    expect(createConnector.status === 201, `expected 201, got ${createConnector.status}`);
    connectorId = createConnector.body?.data?.id || null;
    expect(Boolean(connectorId), 'missing connector id');

    const updateConnector = await req('PATCH', `/api/v1/integrations-hub/connectors/${connectorId}`, {
      status: 'active',
      connector_config: { baseUrl: 'https://splunk.example.test', index: 'main' }
    }, adminToken);
    expect(updateConnector.status === 200, `expected 200, got ${updateConnector.status}`);
    expect(updateConnector.body?.data?.status === 'active', 'connector status did not update');

    const runConnector = await req('POST', `/api/v1/integrations-hub/connectors/${connectorId}/run`, null, adminToken);
    expect(runConnector.status === 200, `expected 200, got ${runConnector.status}`);
    expect(runConnector.body?.data?.status === 'success', 'connector run should finish successfully');

    const connectorRuns = await req('GET', `/api/v1/integrations-hub/connectors/${connectorId}/runs`, null, adminToken);
    expect(connectorRuns.status === 200, `expected 200, got ${connectorRuns.status}`);
    expect(connectorRuns.body?.data?.some((row) => row.status === 'success'), 'connector run history missing successful run');

    const connectorRow = await dbQuery(
      `SELECT status, last_sync_at IS NOT NULL AS has_last_sync
       FROM integration_connectors
       WHERE id = $1 AND organization_id = $2
       LIMIT 1`,
      [connectorId, orgId]
    );
    expect(connectorRow.rows.length === 1, 'missing integration_connectors row');
    expect(connectorRow.rows[0].status === 'active', `expected active connector, got ${connectorRow.rows[0].status}`);
    expect(connectorRow.rows[0].has_last_sync === true, 'connector last_sync_at should be populated after a run');

    const deleteConnector = await req('DELETE', `/api/v1/integrations-hub/connectors/${connectorId}`, null, adminToken);
    expect(deleteConnector.status === 200, `expected 200, got ${deleteConnector.status}`);

    const deletedConnector = await dbQuery(
      `SELECT 1
       FROM integration_connectors
       WHERE id = $1 AND organization_id = $2`,
      [connectorId, orgId]
    );
    expect(deletedConnector.rows.length === 0, 'connector row should be deleted');
  });

  await check('4.6 external AI decision ingestion persists attribution', async () => {
    const keyHash = createHash('sha256').update(externalApiKey).digest('hex');
    const externalApiKeyResult = await dbQuery(
      `INSERT INTO external_api_keys (
         organization_id, name, key_prefix, key_hash, scopes, rate_limit_per_minute, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [orgId, 'Local QA External AI Key', externalApiKey, keyHash, ['ai:log'], 30, adminUserId]
    );
    externalApiKeyId = externalApiKeyResult.rows[0]?.id || null;
    expect(Boolean(externalApiKeyId), 'missing external API key id');

    const ingestDecision = await req('POST', '/api/v1/external-ai/decisions', {
      input_data: { prompt: 'Assess access request risk' },
      output_data: { decision: 'allow' },
      confidence_score: 0.91,
      reasoning: 'Local integration coverage for external AI logging',
      key_factors: ['risk-low', 'policy-aligned'],
      correlation_id: `local-external-${ts}`,
      session_id: `local-session-${ts}`,
      regulatory_framework: 'SOC 2',
      risk_assessment: 'Low residual risk',
      compliance_notes: 'Captured by qa-local-integration.js',
      feature: 'access_decision',
      risk_level: 'low',
      external_provider: 'local-provider',
      external_model: 'local-model-v1',
      external_decision_id: `decision-${ts}`
    }, null, { 'x-api-key': externalApiKey });
    expect(ingestDecision.status === 201, `expected 201, got ${ingestDecision.status}`);
    const decisionId = ingestDecision.body?.data?.id;
    expect(Boolean(decisionId), 'missing ai_decision_log id');

    const decisionRow = await dbQuery(
      `SELECT decision_source, external_provider, external_model, external_decision_id, risk_level,
              external_api_key_id::text AS external_api_key_id
       FROM ai_decision_log
       WHERE id = $1
       LIMIT 1`,
      [decisionId]
    );
    expect(decisionRow.rows.length === 1, 'missing ai_decision_log row');
    expect(decisionRow.rows[0].decision_source === 'external', `expected external decision source, got ${decisionRow.rows[0].decision_source}`);
    expect(decisionRow.rows[0].external_provider === 'local-provider', 'external provider did not persist');
    expect(decisionRow.rows[0].external_model === 'local-model-v1', 'external model did not persist');
    expect(decisionRow.rows[0].external_decision_id === `decision-${ts}`, 'external decision id did not persist');
    expect(decisionRow.rows[0].external_api_key_id === externalApiKeyId, 'decision should reference the inserted external API key');

    const externalKeyRow = await dbQuery(
      `SELECT last_used_at IS NOT NULL AS has_last_used_at
       FROM external_api_keys
       WHERE id = $1
       LIMIT 1`,
      [externalApiKeyId]
    );
    expect(externalKeyRow.rows[0]?.has_last_used_at === true, 'external API key last_used_at should be populated after ingestion');
  });

  await check('4.7 TPRM vendor, questionnaire, document, and summary flows persist', async () => {
    const createVendor = await req('POST', '/api/v1/tprm/vendors', {
      vendor_name: 'Local QA Vendor',
      vendor_type: 'software',
      risk_tier: 'high',
      data_access_level: 'limited',
      services_provided: 'Identity and access management',
      notes: 'Created by the local integration harness'
    }, adminToken);
    expect(createVendor.status === 201, `expected 201, got ${createVendor.status}`);
    vendorId = createVendor.body?.data?.id || null;
    expect(Boolean(vendorId), 'missing vendor id');

    const updateVendor = await req('PATCH', `/api/v1/tprm/vendors/${vendorId}`, {
      review_status: 'approved',
      last_review_date: new Date().toISOString().slice(0, 10),
      notes: 'Updated by the local integration harness'
    }, adminToken);
    expect(updateVendor.status === 200, `expected 200, got ${updateVendor.status}`);
    expect(updateVendor.body?.data?.review_status === 'approved', 'vendor review status did not update');

    const storeAiAssessment = await req('POST', `/api/v1/tprm/vendors/${vendorId}/store-ai-assessment`, {
      ai_risk_summary: 'High inherent risk with approved mitigations',
      ai_risk_score: 74
    }, adminToken);
    expect(storeAiAssessment.status === 200, `expected 200, got ${storeAiAssessment.status}`);
    expect(storeAiAssessment.body?.data?.ai_risk_score === 74, 'vendor AI risk score did not update');

    const createQuestionnaire = await req('POST', '/api/v1/tprm/questionnaires', {
      vendor_id: vendorId,
      title: 'Local QA Questionnaire',
      description: 'Created by qa-local-integration.js',
      questions: [
        { question: 'Do you encrypt customer data at rest?', category: 'security' }
      ]
    }, adminToken);
    expect(createQuestionnaire.status === 201, `expected 201, got ${createQuestionnaire.status}`);
    questionnaireId = createQuestionnaire.body?.data?.id || null;
    expect(Boolean(questionnaireId), 'missing questionnaire id');

    const updateQuestionnaire = await req('PATCH', `/api/v1/tprm/questionnaires/${questionnaireId}`, {
      status: 'sent',
      responses: { q1: 'yes' },
      overall_score: 88,
      ai_analysis: 'Meets baseline expectations'
    }, adminToken);
    expect(updateQuestionnaire.status === 200, `expected 200, got ${updateQuestionnaire.status}`);
    expect(updateQuestionnaire.body?.data?.status === 'sent', 'questionnaire status did not update');

    const createDocument = await req('POST', '/api/v1/tprm/documents', {
      vendor_id: vendorId,
      document_type: 'soc2_report',
      document_name: 'Local QA SOC 2 Report'
    }, adminToken);
    expect(createDocument.status === 201, `expected 201, got ${createDocument.status}`);
    documentId = createDocument.body?.data?.id || null;
    expect(Boolean(documentId), 'missing document id');

    const updateDocument = await req('PATCH', `/api/v1/tprm/documents/${documentId}`, {
      request_status: 'received',
      notes: 'Received by the local integration harness',
      file_url: 'https://example.test/local-qa-soc2.pdf'
    }, adminToken);
    expect(updateDocument.status === 200, `expected 200, got ${updateDocument.status}`);
    expect(updateDocument.body?.data?.request_status === 'received', 'document status did not update');

    const vendorDetail = await req('GET', `/api/v1/tprm/vendors/${vendorId}`, null, adminToken);
    expect(vendorDetail.status === 200, `expected 200, got ${vendorDetail.status}`);
    expect(vendorDetail.body?.data?.questionnaires?.some((row) => row.id === questionnaireId), 'vendor detail missing questionnaire');
    expect(vendorDetail.body?.data?.documents?.some((row) => row.id === documentId), 'vendor detail missing document');

    const summary = await req('GET', '/api/v1/tprm/summary', null, adminToken);
    expect(summary.status === 200, `expected 200, got ${summary.status}`);
    expect(Number(summary.body?.data?.vendors?.total_count) >= 1, 'TPRM summary vendor count should be at least 1');
    expect(Number(summary.body?.data?.questionnaires?.open_count) >= 1, 'TPRM summary questionnaire open_count should be at least 1');
    expect(Number(summary.body?.data?.documents?.total_count) >= 1, 'TPRM summary document count should be at least 1');

    const deleteDocument = await req('DELETE', `/api/v1/tprm/documents/${documentId}`, null, adminToken);
    expect(deleteDocument.status === 200, `expected 200, got ${deleteDocument.status}`);

    const deleteQuestionnaire = await req('DELETE', `/api/v1/tprm/questionnaires/${questionnaireId}`, null, adminToken);
    expect(deleteQuestionnaire.status === 200, `expected 200, got ${deleteQuestionnaire.status}`);

    const deleteVendor = await req('DELETE', `/api/v1/tprm/vendors/${vendorId}`, null, adminToken);
    expect(deleteVendor.status === 200, `expected 200, got ${deleteVendor.status}`);

    const vendorRows = await dbQuery(
      `SELECT 1
       FROM tprm_vendors
       WHERE id = $1 AND organization_id = $2`,
      [vendorId, orgId]
    );
    expect(vendorRows.rows.length === 0, 'vendor row should be deleted');
  });

  await check('5.1 audit write endpoint persists exact event', async () => {
    const createAuditLog = await req('POST', '/api/v1/audit/logs', {
      event_type: 'qa.local.integration',
      resource_type: 'organization',
      resource_id: orgId,
      details: { source: 'qa-local-integration', synthetic: true },
      outcome: 'success',
      source_system: 'qa-local-integration'
    }, adminToken);

    expect(createAuditLog.status === 201, `expected 201, got ${createAuditLog.status}`);

    const createdAudit = await dbQuery(
      `SELECT event_type, source_system, details
       FROM audit_logs
       WHERE organization_id = $1 AND event_type = 'qa.local.integration'
       ORDER BY created_at DESC
       LIMIT 1`,
      [orgId]
    );

    expect(createdAudit.rows.length === 1, 'missing created audit log');
    expect(createdAudit.rows[0].source_system === 'qa-local-integration', `unexpected source_system ${createdAudit.rows[0].source_system}`);
    expect(createdAudit.rows[0].details?.source === 'qa-local-integration', 'expected details.source to persist');
  });

  await check('5.2 audit logs return decrypted user email for rendered entries', async () => {
    const auditLogs = await req('GET', '/api/v1/audit/logs?eventType=qa.local.integration&limit=5', null, adminToken);
    expect(auditLogs.status === 200, `expected 200, got ${auditLogs.status}`);
    const matchingLog = (auditLogs.body?.data || []).find((row) => row.event_type === 'qa.local.integration');
    expect(Boolean(matchingLog), 'expected qa.local.integration audit log in API response');
    expect(matchingLog.user_email === adminEmail, `expected ${adminEmail}, got ${matchingLog?.user_email}`);
  });

  await check('6.1 cross-org controls access is denied', async () => {
    const secondRegistration = await req('POST', '/api/v1/auth/register', {
      email: secondEmail,
      password,
      full_name: 'Local QA Other Org',
      organization_name: `QA Local Other Org ${ts}`
    });

    expect(secondRegistration.status === 201, `expected 201, got ${secondRegistration.status}`);
    secondToken = secondRegistration.body?.data?.tokens?.accessToken || null;
    secondOrgId = secondRegistration.body?.data?.organization?.id || secondRegistration.body?.data?.user?.organization_id || null;
    expect(Boolean(secondToken), 'missing second org token');
    expect(Boolean(secondOrgId), 'missing second org id');

    const crossOrgControls = await req('GET', `/api/v1/organizations/${orgId}/controls`, null, secondToken);
    expect(crossOrgControls.status === 403, `expected 403, got ${crossOrgControls.status}`);
  });

  await check('6.1a billing downgrade-to-free resets a non-Stripe org cleanly', async () => {
    await dbQuery(
      `UPDATE organizations
       SET tier = 'pro',
           paid_tier = 'pro',
           billing_status = 'trial',
           stripe_subscription_id = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [secondOrgId]
    );

    const subscription = await req('GET', '/api/v1/billing/subscription', null, secondToken);
    expect(subscription.status === 200, `expected 200, got ${subscription.status}`);
    expect(subscription.body?.data?.tier === 'pro', `expected pro tier before downgrade, got ${subscription.body?.data?.tier}`);

    const downgrade = await req('POST', '/api/v1/billing/downgrade-to-free', null, secondToken);
    expect(downgrade.status === 200, `expected 200, got ${downgrade.status}`);
    expect(downgrade.body?.data?.newTier === 'community', `expected community downgrade, got ${downgrade.body?.data?.newTier}`);

    const downgradedOrg = await dbQuery(
      `SELECT tier, billing_status, paid_tier
       FROM organizations
       WHERE id = $1
       LIMIT 1`,
      [secondOrgId]
    );
    expect(downgradedOrg.rows.length === 1, 'missing downgraded organization row');
    expect(downgradedOrg.rows[0].tier === 'community', `expected community tier after downgrade, got ${downgradedOrg.rows[0].tier}`);
    expect(downgradedOrg.rows[0].billing_status === 'community', `expected community billing status, got ${downgradedOrg.rows[0].billing_status}`);
    expect(downgradedOrg.rows[0].paid_tier === null, 'paid_tier should be cleared on downgrade');

    const downgradeAudit = await dbQuery(
      `SELECT event_type
       FROM audit_logs
       WHERE organization_id = $1 AND event_type = 'billing_downgraded_to_free'
       ORDER BY created_at DESC
       LIMIT 1`,
      [secondOrgId]
    );
    expect(downgradeAudit.rows.length === 1, 'missing billing_downgraded_to_free audit log');
  });

  await check('6.2 multi-org membership listing shows active organization state', async () => {
    await dbQuery(
      `INSERT INTO user_organizations (user_id, organization_id, role)
       VALUES ($1, $2, 'admin')
       ON CONFLICT (user_id, organization_id) DO NOTHING`,
      [adminUserId, secondOrgId]
    );

    const myOrganizations = await req('GET', '/api/v1/auth/my-organizations', null, adminToken);
    expect(myOrganizations.status === 200, `expected 200, got ${myOrganizations.status}`);
    const memberships = myOrganizations.body?.data || [];
    expect(memberships.some((row) => row.id === orgId && row.is_active === true), 'expected primary org to be active before switch');
    expect(memberships.some((row) => row.id === secondOrgId && row.role === 'admin'), 'expected secondary org membership to be listed');
  });

  await check('6.3 org switch rotates session and updates active organization', async () => {
    const switched = await req('POST', `/api/v1/auth/switch-organization/${secondOrgId}`, {
      refreshToken: adminRefreshToken
    }, adminToken);

    expect(switched.status === 200, `expected 200, got ${switched.status}`);
    switchedAccessToken = switched.body?.data?.tokens?.accessToken || null;
    switchedRefreshToken = switched.body?.data?.tokens?.refreshToken || null;
    expect(Boolean(switchedAccessToken), 'missing switched access token');
    expect(Boolean(switchedRefreshToken), 'missing switched refresh token');
    expect(switched.body?.data?.organization?.id === secondOrgId, 'switch response organization mismatch');

    const me = await req('GET', '/api/v1/auth/me', null, switchedAccessToken);
    expect(me.status === 200, `expected 200, got ${me.status}`);
    expect(me.body?.data?.organization?.id === secondOrgId, `expected active org ${secondOrgId}, got ${me.body?.data?.organization?.id}`);

    const userRow = await dbQuery(
      'SELECT organization_id::text AS organization_id FROM users WHERE id = $1 LIMIT 1',
      [adminUserId]
    );
    expect(userRow.rows[0]?.organization_id === secondOrgId, `expected DB org ${secondOrgId}, got ${userRow.rows[0]?.organization_id}`);

    const sessionRows = await dbQuery(
      'SELECT refresh_token FROM sessions WHERE user_id = $1 ORDER BY expires_at DESC',
      [adminUserId]
    );
    expect(sessionRows.rows.length === 1, `expected 1 active session row, got ${sessionRows.rows.length}`);
    expect(sessionRows.rows[0]?.refresh_token === hashRefreshToken(switchedRefreshToken), 'expected session row to store the new refresh token hash');
  });

  await check('6.4 old refresh token is invalid after organization switch', async () => {
    const oldRefresh = await req('POST', '/api/v1/auth/refresh', {
      refreshToken: adminRefreshToken
    });
    expect(oldRefresh.status === 401, `expected 401, got ${oldRefresh.status}`);
  });

  await check('6.5 new refresh token works after organization switch', async () => {
    const newRefresh = await req('POST', '/api/v1/auth/refresh', {
      refreshToken: switchedRefreshToken
    });
    expect(newRefresh.status === 200, `expected 200, got ${newRefresh.status}`);
    expect(Boolean(newRefresh.body?.data?.accessToken), 'missing refreshed access token after org switch');
  });

  console.log('\n================================================');
  console.log(` Results: ${passed} passed, ${failed} failed`);
  console.log('================================================\n');

  if (failures.length > 0) {
    console.log('Failures:');
    failures.forEach((failure) => console.log(`  - ${failure}`));
  }

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(async (error) => {
  console.error('qa-local-integration error:', error);
  await pool.end();
  process.exit(1);
});