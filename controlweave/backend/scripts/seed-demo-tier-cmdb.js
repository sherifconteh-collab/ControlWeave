// @tier: exclude
/**
 * seed-demo-tier-cmdb.js
 *
 * Creates a realistic CMDB footprint for all demo tier accounts:
 * community, pro, enterprise, govcloud.
 *
 * Idempotent — uses upsert semantics.
 *
 * Run:
 *   npm run seed:demo:cmdb-tiered
 */
require('dotenv').config();
const pool = require('../src/config/database');

const DEMO_ACCOUNTS = Object.freeze([
  { email: 'admin@community.com', expectedTier: 'community' },
  { email: 'admin@pro.com', expectedTier: 'pro' },
  { email: 'admin@enterprise.com', expectedTier: 'enterprise' },
  { email: 'admin@govcloud.com', expectedTier: 'govcloud' }
]);

const TIER_LEVELS = Object.freeze({
  community: 0,
  pro: 1,
  enterprise: 2,
  govcloud: 3
});

const ENVIRONMENT_TEMPLATES = Object.freeze([
  {
    code: 'prod',
    name: 'Production',
    environmentType: 'production',
    containsPii: true,
    dataClassification: 'restricted',
    securityLevel: 'high',
    criticality: 'critical'
  },
  {
    code: 'stg',
    name: 'Staging',
    environmentType: 'staging',
    containsPii: true,
    dataClassification: 'confidential',
    securityLevel: 'moderate',
    criticality: 'high'
  },
  {
    code: 'dev',
    name: 'Development',
    environmentType: 'development',
    containsPii: false,
    dataClassification: 'internal',
    securityLevel: 'low',
    criticality: 'medium'
  }
]);

const ASSET_TEMPLATES = Object.freeze([
  // ── Hardware (free+) ────────────────────────────────────────────────────
  {
    minTier: 'community',
    categoryCode: 'hardware',
    name: 'Primary App Server',
    model: 'PowerEdge R650',
    manufacturer: 'Dell',
    envCode: 'prod',
    hostnameSuffix: 'app-01',
    ipSuffix: 10,
    classification: 'restricted',
    criticality: 'high'
  },
  {
    minTier: 'community',
    categoryCode: 'hardware',
    name: 'Worker Node',
    model: 'ProLiant DL360',
    manufacturer: 'HPE',
    envCode: 'stg',
    hostnameSuffix: 'worker-01',
    ipSuffix: 20,
    classification: 'confidential',
    criticality: 'medium'
  },
  {
    minTier: 'pro',
    categoryCode: 'hardware',
    name: 'Backup Server',
    model: 'PowerEdge R540',
    manufacturer: 'Dell',
    envCode: 'prod',
    hostnameSuffix: 'bkp-01',
    ipSuffix: 22,
    classification: 'restricted',
    criticality: 'high'
  },
  {
    minTier: 'pro',
    categoryCode: 'hardware',
    name: 'Management Workstation',
    model: 'Precision 5570',
    manufacturer: 'Dell',
    envCode: 'dev',
    hostnameSuffix: 'ws-01',
    ipSuffix: 90,
    classification: 'internal',
    criticality: 'low'
  },
  {
    minTier: 'enterprise',
    categoryCode: 'hardware',
    name: 'Load Balancer Appliance',
    model: 'BIG-IP 2000s',
    manufacturer: 'F5',
    envCode: 'prod',
    hostnameSuffix: 'lb-01',
    ipSuffix: 5,
    classification: 'restricted',
    criticality: 'critical'
  },
  {
    minTier: 'enterprise',
    categoryCode: 'hardware',
    name: 'Core Network Switch',
    model: 'Catalyst 9500',
    manufacturer: 'Cisco',
    envCode: 'prod',
    hostnameSuffix: 'sw-01',
    ipSuffix: 2,
    classification: 'restricted',
    criticality: 'critical'
  },
  {
    minTier: 'enterprise',
    categoryCode: 'hardware',
    name: 'Disaster Recovery Node',
    model: 'PowerEdge R660',
    manufacturer: 'Dell',
    envCode: 'dev',
    hostnameSuffix: 'dr-01',
    ipSuffix: 70,
    classification: 'restricted',
    criticality: 'high'
  },
  {
    minTier: 'enterprise',
    categoryCode: 'hardware',
    name: 'HSM Appliance',
    model: 'Luna Network HSM 7',
    manufacturer: 'Thales',
    envCode: 'prod',
    hostnameSuffix: 'hsm-01',
    ipSuffix: 3,
    classification: 'restricted',
    criticality: 'critical'
  },

  // ── Software (free+) ────────────────────────────────────────────────────
  {
    minTier: 'community',
    categoryCode: 'software',
    name: 'Core API Service',
    model: 'Node.js API',
    manufacturer: 'Internal',
    envCode: 'prod',
    hostnameSuffix: 'api-01',
    ipSuffix: 11,
    version: '2.4.0',
    classification: 'restricted',
    criticality: 'critical'
  },
  {
    minTier: 'community',
    categoryCode: 'software',
    name: 'Compliance Dashboard',
    model: 'Next.js Frontend',
    manufacturer: 'Internal',
    envCode: 'stg',
    hostnameSuffix: 'ui-01',
    ipSuffix: 21,
    version: '2.4.0',
    classification: 'confidential',
    criticality: 'high'
  },
  {
    minTier: 'pro',
    categoryCode: 'software',
    name: 'PostgreSQL Database Engine',
    model: 'PostgreSQL',
    manufacturer: 'PostgreSQL Global Development Group',
    envCode: 'prod',
    hostnameSuffix: 'pg-01',
    ipSuffix: 41,
    version: '16.3',
    classification: 'restricted',
    criticality: 'critical'
  },
  {
    minTier: 'pro',
    categoryCode: 'software',
    name: 'Nginx Web Server',
    model: 'Nginx',
    manufacturer: 'F5/Nginx',
    envCode: 'prod',
    hostnameSuffix: 'nginx-01',
    ipSuffix: 12,
    version: '1.25.3',
    classification: 'restricted',
    criticality: 'high'
  },
  {
    minTier: 'pro',
    categoryCode: 'software',
    name: 'Redis Cache',
    model: 'Redis',
    manufacturer: 'Redis Ltd',
    envCode: 'prod',
    hostnameSuffix: 'redis-01',
    ipSuffix: 42,
    version: '7.2',
    classification: 'confidential',
    criticality: 'high'
  },
  {
    minTier: 'enterprise',
    categoryCode: 'software',
    name: 'SIEM Collector',
    model: 'Security Telemetry Collector',
    manufacturer: 'Internal',
    envCode: 'prod',
    hostnameSuffix: 'siem-01',
    ipSuffix: 60,
    version: '1.8.2',
    classification: 'confidential',
    criticality: 'high'
  },
  {
    minTier: 'enterprise',
    categoryCode: 'software',
    name: 'Vault Agent',
    model: 'HashiCorp Vault Agent',
    manufacturer: 'HashiCorp',
    envCode: 'prod',
    hostnameSuffix: 'vault-agent-01',
    ipSuffix: 43,
    version: '1.15.4',
    classification: 'restricted',
    criticality: 'critical'
  },
  {
    minTier: 'enterprise',
    categoryCode: 'software',
    name: 'Analytics Warehouse',
    model: 'Columnar Warehouse',
    manufacturer: 'Internal',
    envCode: 'prod',
    hostnameSuffix: 'analytics-01',
    ipSuffix: 80,
    version: '5.4.1',
    classification: 'confidential',
    criticality: 'high'
  },
  {
    minTier: 'enterprise',
    categoryCode: 'software',
    name: 'Enterprise SIEM Platform',
    model: 'Splunk Enterprise',
    manufacturer: 'Splunk',
    envCode: 'prod',
    hostnameSuffix: 'splunk-01',
    ipSuffix: 61,
    version: '9.2.1',
    classification: 'confidential',
    criticality: 'high'
  },

  // ── AI Agents (pro+) ────────────────────────────────────────────────
  {
    minTier: 'pro',
    categoryCode: 'ai_agent',
    name: 'Compliance Gap Analyser',
    model: 'GPT-4o',
    manufacturer: 'OpenAI',
    envCode: 'prod',
    hostnameSuffix: 'ai-gap-01',
    ipSuffix: 51,
    aiModelType: 'llm',
    aiRiskLevel: 'limited',
    aiHumanOversightRequired: true,
    aiBiasTestingCompleted: true,
    classification: 'confidential',
    criticality: 'high'
  },
  {
    minTier: 'enterprise',
    categoryCode: 'ai_agent',
    name: 'Policy Evidence Classifier',
    model: 'Transformer Classifier',
    manufacturer: 'Internal',
    envCode: 'prod',
    hostnameSuffix: 'ai-01',
    ipSuffix: 50,
    aiModelType: 'nlp',
    aiRiskLevel: 'limited',
    aiHumanOversightRequired: false,
    aiBiasTestingCompleted: true,
    classification: 'confidential',
    criticality: 'high'
  },
  {
    minTier: 'enterprise',
    categoryCode: 'ai_agent',
    name: 'Fraud Detection Model',
    model: 'Custom CNN v2.1',
    manufacturer: 'Internal',
    envCode: 'prod',
    hostnameSuffix: 'ai-fraud-01',
    ipSuffix: 52,
    aiModelType: 'predictive',
    aiRiskLevel: 'high',
    aiHumanOversightRequired: true,
    aiBiasTestingCompleted: true,
    classification: 'restricted',
    criticality: 'critical'
  },
  {
    minTier: 'enterprise',
    categoryCode: 'ai_agent',
    name: 'Risk Scoring Engine',
    model: 'XGBoost Ensemble',
    manufacturer: 'Internal',
    envCode: 'prod',
    hostnameSuffix: 'ai-risk-01',
    ipSuffix: 53,
    aiModelType: 'predictive',
    aiRiskLevel: 'high',
    aiHumanOversightRequired: true,
    aiBiasTestingCompleted: false,
    classification: 'restricted',
    criticality: 'critical'
  },
  {
    minTier: 'enterprise',
    categoryCode: 'ai_agent',
    name: 'Document Extraction Agent',
    model: 'Claude 3.5 Sonnet',
    manufacturer: 'Anthropic',
    envCode: 'prod',
    hostnameSuffix: 'ai-doc-01',
    ipSuffix: 54,
    aiModelType: 'llm',
    aiRiskLevel: 'limited',
    aiHumanOversightRequired: false,
    aiBiasTestingCompleted: true,
    classification: 'confidential',
    criticality: 'medium'
  },

  // ── Other categories (unchanged) ────────────────────────────────────────
  {
    minTier: 'pro',
    categoryCode: 'cloud',
    name: 'Object Storage Bucket',
    model: 'S3-Compatible Storage',
    manufacturer: 'AWS',
    envCode: 'prod',
    hostnameSuffix: 'storage-01',
    ipSuffix: 30,
    cloudProvider: 'AWS',
    cloudRegion: 'us-east-1',
    classification: 'restricted',
    criticality: 'high'
  },
  {
    minTier: 'pro',
    categoryCode: 'network',
    name: 'Perimeter Firewall',
    model: 'FortiGate 600F',
    manufacturer: 'Fortinet',
    envCode: 'prod',
    hostnameSuffix: 'fw-01',
    ipSuffix: 1,
    classification: 'restricted',
    criticality: 'critical'
  },
  {
    minTier: 'pro',
    categoryCode: 'database',
    name: 'Primary Compliance Database',
    model: 'PostgreSQL Cluster',
    manufacturer: 'PostgreSQL',
    envCode: 'prod',
    hostnameSuffix: 'db-01',
    ipSuffix: 40,
    version: '16.3',
    classification: 'restricted',
    criticality: 'critical'
  }
]);

const VAULT_TEMPLATES = Object.freeze([
  {
    minTier: 'pro',
    name: 'Demo Security Vault',
    vaultType: 'hashicorp_vault',
    vaultUrl: 'https://vault.demo.internal'
  },
  {
    minTier: 'enterprise',
    name: 'AWS Secrets Manager',
    vaultType: 'aws_secrets_manager',
    vaultUrl: 'https://secretsmanager.us-east-1.amazonaws.com'
  },
  {
    minTier: 'enterprise',
    name: 'Azure Key Vault',
    vaultType: 'azure_key_vault',
    vaultUrl: 'https://demo-prod.vault.azure.net'
  }
]);

const SERVICE_ACCOUNT_TEMPLATES = Object.freeze([
  {
    minTier: 'pro',
    accountName: 'svc-backup-agent',
    accountType: 'system_user',
    description: 'Automated backup agent for data retention',
    credentialType: 'password',
    privilegeLevel: 'read',
    scope: 'Backup targets and storage APIs',
    rotationFrequencyDays: 90
  },
  {
    minTier: 'enterprise',
    accountName: 'svc-compliance-ingest',
    accountType: 'service_principal',
    description: 'Ingests compliance evidence and scanner telemetry',
    credentialType: 'oauth_token',
    privilegeLevel: 'write',
    scope: 'Evidence and vulnerability ingestion APIs',
    rotationFrequencyDays: 90
  },
  {
    minTier: 'enterprise',
    accountName: 'svc-vuln-correlator',
    accountType: 'system_user',
    description: 'Correlates scanner findings with CMDB assets',
    credentialType: 'password',
    privilegeLevel: 'write',
    scope: 'Asset correlation and vulnerability workflows',
    rotationFrequencyDays: 90
  },
  {
    minTier: 'enterprise',
    accountName: 'svc-cicd-deploy',
    accountType: 'oauth_client',
    description: 'CI/CD pipeline deployment credentials',
    credentialType: 'oauth_token',
    privilegeLevel: 'admin',
    scope: 'Kubernetes cluster, container registry',
    rotationFrequencyDays: 60
  },
  {
    minTier: 'enterprise',
    accountName: 'svc-enterprise-reporting',
    accountType: 'api_key',
    description: 'Publishes executive vulnerability scorecards',
    credentialType: 'api_key',
    privilegeLevel: 'read',
    scope: 'Cross-framework reporting and export APIs',
    rotationFrequencyDays: 120
  },
  {
    minTier: 'enterprise',
    accountName: 'svc-ai-platform',
    accountType: 'service_principal',
    description: 'AI platform service account for model inference',
    credentialType: 'api_key',
    privilegeLevel: 'write',
    scope: 'AI model endpoints and training pipelines',
    rotationFrequencyDays: 60
  }
]);

function tierAtLeast(currentTier, requiredTier) {
  const current = TIER_LEVELS[String(currentTier || '').toLowerCase()] ?? 0;
  const required = TIER_LEVELS[String(requiredTier || '').toLowerCase()] ?? 0;
  return current >= required;
}

function orgPrefix(tier) {
  return String(tier || 'community').toLowerCase();
}

function ipBaseForTier(tier) {
  switch (String(tier || '').toLowerCase()) {
    case 'pro':
      return 20;
    case 'enterprise':
      return 30;
    case 'govcloud':
      return 40;
    default:
      return 10;
  }
}

async function getDemoAccountContext(client, email) {
  const result = await client.query(
    `SELECT
       u.id AS user_id,
       u.email,
       o.id AS organization_id,
       o.name AS organization_name,
       o.tier
     FROM users u
     JOIN organizations o ON o.id = u.organization_id
     WHERE u.email = $1
     LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
}

async function loadCategoryMap(client) {
  const result = await client.query(`SELECT id, code FROM asset_categories`);
  const map = new Map();
  for (const row of result.rows) {
    map.set(row.code, row.id);
  }
  return map;
}

async function ensureEnvironment(client, orgId, ownerId, envDef) {
  const result = await client.query(
    `INSERT INTO environments (
       organization_id, name, code, environment_type,
       contains_pii, data_classification, security_level, criticality, owner_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (organization_id, code)
     DO UPDATE SET
       name = EXCLUDED.name,
       environment_type = EXCLUDED.environment_type,
       contains_pii = EXCLUDED.contains_pii,
       data_classification = EXCLUDED.data_classification,
       security_level = EXCLUDED.security_level,
       criticality = EXCLUDED.criticality,
       owner_id = EXCLUDED.owner_id,
       updated_at = NOW()
     RETURNING id`,
    [
      orgId,
      envDef.name,
      envDef.code,
      envDef.environmentType,
      envDef.containsPii,
      envDef.dataClassification,
      envDef.securityLevel,
      envDef.criticality,
      ownerId
    ]
  );
  return result.rows[0].id;
}

async function upsertAsset(client, payload) {
  const existing = await client.query(
    `SELECT id
     FROM assets
     WHERE organization_id = $1 AND name = $2
     LIMIT 1`,
    [payload.organizationId, payload.name]
  );

  if (existing.rows.length > 0) {
    await client.query(
      `UPDATE assets
       SET category_id = $3,
           model = $4,
           manufacturer = $5,
           owner_id = $6,
           environment_id = $7,
           status = 'active',
           hostname = $8,
           ip_address = $9,
           version = $10,
           cloud_provider = $11,
           cloud_region = $12,
           ai_model_type = $13,
           ai_risk_level = $14,
           security_classification = $15,
           criticality = $16,
           notes = $17,
           metadata = $18::jsonb,
           updated_at = NOW()
       WHERE id = $1 AND organization_id = $2`,
      [
        existing.rows[0].id,
        payload.organizationId,
        payload.categoryId,
        payload.model || null,
        payload.manufacturer || null,
        payload.ownerId,
        payload.environmentId,
        payload.hostname || null,
        payload.ipAddress || null,
        payload.version || null,
        payload.cloudProvider || null,
        payload.cloudRegion || null,
        payload.aiModelType || null,
        payload.aiRiskLevel || null,
        payload.securityClassification,
        payload.criticality,
        payload.notes || null,
        JSON.stringify(payload.metadata || {})
      ]
    );
    return { id: existing.rows[0].id, created: false };
  }

  const inserted = await client.query(
    `INSERT INTO assets (
       organization_id, category_id, name, model, manufacturer, owner_id, environment_id,
       status, hostname, ip_address, version, cloud_provider, cloud_region,
       ai_model_type, ai_risk_level, security_classification, criticality, notes, metadata
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       'active', $8, $9, $10, $11, $12,
       $13, $14, $15, $16, $17, $18::jsonb
     )
     RETURNING id`,
    [
      payload.organizationId,
      payload.categoryId,
      payload.name,
      payload.model || null,
      payload.manufacturer || null,
      payload.ownerId,
      payload.environmentId,
      payload.hostname || null,
      payload.ipAddress || null,
      payload.version || null,
      payload.cloudProvider || null,
      payload.cloudRegion || null,
      payload.aiModelType || null,
      payload.aiRiskLevel || null,
      payload.securityClassification,
      payload.criticality,
      payload.notes || null,
      JSON.stringify(payload.metadata || {})
    ]
  );
  return { id: inserted.rows[0].id, created: true };
}

async function ensureVaults(client, orgId, tier) {
  const vaultIds = [];
  for (const v of VAULT_TEMPLATES) {
    if (!tierAtLeast(tier, v.minTier)) continue;
    const result = await client.query(
      `INSERT INTO password_vaults (organization_id, name, vault_type, vault_url, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (organization_id, name)
       DO UPDATE SET
         vault_type = EXCLUDED.vault_type,
         vault_url = EXCLUDED.vault_url,
         is_active = true
       RETURNING id`,
      [orgId, v.name, v.vaultType, v.vaultUrl]
    );
    vaultIds.push(result.rows[0].id);
  }
  return vaultIds;
}

async function ensureServiceAccount(client, payload) {
  await client.query(
    `INSERT INTO service_accounts (
       organization_id, account_name, account_type, description,
       owner_id, business_justification,
       vault_id, vault_path,
       credential_type, rotation_frequency_days, next_rotation_date,
       privilege_level, scope,
       review_frequency_days, next_review_date, reviewer_id,
       status, is_active
     )
     VALUES (
       $1, $2, $3, $4,
       $5, $6,
       $7, $8,
       $9, $10::int, CURRENT_DATE + ($10::int * INTERVAL '1 day'),
       $11, $12,
       90, CURRENT_DATE + INTERVAL '90 day', $5,
       'active', true
     )
     ON CONFLICT (organization_id, account_name)
     DO UPDATE SET
       account_type = EXCLUDED.account_type,
       description = EXCLUDED.description,
       owner_id = EXCLUDED.owner_id,
       business_justification = EXCLUDED.business_justification,
       vault_id = EXCLUDED.vault_id,
       vault_path = EXCLUDED.vault_path,
       credential_type = EXCLUDED.credential_type,
       rotation_frequency_days = EXCLUDED.rotation_frequency_days,
       next_rotation_date = EXCLUDED.next_rotation_date,
       privilege_level = EXCLUDED.privilege_level,
       scope = EXCLUDED.scope,
       status = 'active',
       is_active = true,
       updated_at = NOW()`,
    [
      payload.organizationId,
      payload.accountName,
      payload.accountType,
      payload.description,
      payload.ownerId,
      payload.businessJustification,
      payload.vaultId,
      payload.vaultPath,
      payload.credentialType,
      payload.rotationFrequencyDays,
      payload.privilegeLevel,
      payload.scope
    ]
  );
}

async function linkDependencies(client, organizationId, assetIdsByName, tier) {
  const p = orgPrefix(tier).toUpperCase();

  // Pairs: [dependent asset name, host/dependency asset name, type, criticality, notes]
  const LINK_PAIRS = [
    [`${p} Core API Service`,         `${p} Primary App Server`,      'hosted_on',        'high',   'API runs on app server'],
    [`${p} Core API Service`,         `${p} Primary Compliance Database`, 'uses',          'high',   'API reads/writes to compliance DB'],
    [`${p} Core API Service`,         `${p} PostgreSQL Database Engine`,  'uses',          'high',   'Application DB dependency'],
    [`${p} Nginx Web Server`,         `${p} Primary App Server`,      'hosted_on',        'high',   'Web server runs on app server'],
    [`${p} Nginx Web Server`,         `${p} Core API Service`,        'communicates_with','medium', 'Reverse proxy to API'],
    [`${p} Compliance Dashboard`,     `${p} Nginx Web Server`,        'requires',         'high',   'Frontend served via Nginx'],
    [`${p} Compliance Dashboard`,     `${p} Core API Service`,        'communicates_with','high',   'Dashboard calls API'],
    [`${p} Redis Cache`,              `${p} Primary App Server`,      'hosted_on',        'medium', 'Cache layer on app server'],
    [`${p} Core API Service`,         `${p} Redis Cache`,             'uses',             'medium', 'Session and response caching'],
    [`${p} Policy Evidence Classifier`, `${p} Core API Service`,      'communicates_with','medium', 'AI classifier calls core API'],
    [`${p} Policy Evidence Classifier`, `${p} Primary App Server`,    'hosted_on',        'high',   'AI model runs on app server'],
    [`${p} Compliance Gap Analyser`,  `${p} Primary App Server`,      'hosted_on',        'high',   'Gap analyser hosted on app server'],
    [`${p} Fraud Detection Model`,    `${p} Primary App Server`,      'hosted_on',        'high',   'Fraud model runs on primary server'],
    [`${p} Fraud Detection Model`,    `${p} Primary Compliance Database`, 'uses',          'high',   'Reads transaction records'],
    [`${p} SIEM Collector`,           `${p} Primary App Server`,      'hosted_on',        'medium', 'SIEM collector on app server'],
    [`${p} Vault Agent`,              `${p} Primary App Server`,      'hosted_on',        'critical','Vault agent runs on app server'],
    [`${p} Risk Scoring Engine`,      `${p} Primary App Server`,      'hosted_on',        'high',   'Risk engine on primary server'],
    [`${p} Document Extraction Agent`, `${p} Core API Service`,       'communicates_with','low',    'Doc agent calls internal API'],
    [`${p} Enterprise SIEM Platform`, `${p} Primary App Server`,      'hosted_on',        'high',   'SIEM platform on app server'],
    [`${p} Analytics Warehouse`,      `${p} Primary App Server`,      'hosted_on',        'high',   'Analytics warehouse on app server'],
    [`${p} Analytics Warehouse`,      `${p} Primary Compliance Database`, 'uses',          'medium', 'Analytics reads from compliance DB'],
  ];

  for (const [assetName, depName, depType, crit, notes] of LINK_PAIRS) {
    const assetId = assetIdsByName.get(assetName);
    const depId = assetIdsByName.get(depName);
    if (!assetId || !depId) continue;
    await client.query(
      `INSERT INTO asset_dependencies (asset_id, depends_on_asset_id, dependency_type, criticality, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (asset_id, depends_on_asset_id, dependency_type) DO NOTHING`,
      [assetId, depId, depType, crit, notes]
    );
  }
}

async function seedTierCmdbForAccount(client, accountContext, categoryMap, expectedTier) {
  const tier = String(expectedTier || accountContext.tier || 'community').toLowerCase();
  const prefix = orgPrefix(tier);
  const tierIpBase = ipBaseForTier(tier);
  const billingStatus = tier === 'community' ? 'community' : 'active_paid';

  await client.query(
    `UPDATE organizations
     SET tier = $2,
         billing_status = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [accountContext.organization_id, tier, billingStatus]
  );

  const envByCode = new Map();
  for (const envDef of ENVIRONMENT_TEMPLATES) {
    const envId = await ensureEnvironment(client, accountContext.organization_id, accountContext.user_id, envDef);
    envByCode.set(envDef.code, envId);
  }

  let createdAssets = 0;
  const assetIdsByName = new Map();

  for (const assetTemplate of ASSET_TEMPLATES) {
    if (!tierAtLeast(tier, assetTemplate.minTier)) continue;
    if (!categoryMap.has(assetTemplate.categoryCode)) continue;

    const name = `${prefix.toUpperCase()} ${assetTemplate.name}`;
    const hostname = `${prefix}-${assetTemplate.hostnameSuffix}`;
    const ipAddress = `10.${tierIpBase}.0.${assetTemplate.ipSuffix}`;
    const upserted = await upsertAsset(client, {
      organizationId: accountContext.organization_id,
      categoryId: categoryMap.get(assetTemplate.categoryCode),
      name,
      model: assetTemplate.model,
      manufacturer: assetTemplate.manufacturer,
      ownerId: accountContext.user_id,
      environmentId: envByCode.get(assetTemplate.envCode) || null,
      hostname,
      ipAddress,
      version: assetTemplate.version || null,
      cloudProvider: assetTemplate.cloudProvider || null,
      cloudRegion: assetTemplate.cloudRegion || null,
      aiModelType: assetTemplate.aiModelType || null,
      aiRiskLevel: assetTemplate.aiRiskLevel || null,
      securityClassification: assetTemplate.classification || 'confidential',
      criticality: assetTemplate.criticality || 'medium',
      notes: `Demo CMDB seed (${expectedTier} tier)`,
      metadata: {
        seed_tag: 'tier_cmdb_demo',
        tier: expectedTier,
        category: assetTemplate.categoryCode
      }
    });
    if (upserted.created) createdAssets += 1;
    assetIdsByName.set(name, upserted.id);
  }

  await linkDependencies(client, accountContext.organization_id, assetIdsByName, tier);

  // Seed password vaults for pro+ (service accounts need a vault)
  const vaultIds = tierAtLeast(tier, 'pro')
    ? await ensureVaults(client, accountContext.organization_id, tier)
    : [];
  const primaryVaultId = vaultIds[0] || null;

  let serviceAccountsSeeded = 0;
  if (tierAtLeast(tier, 'pro') && primaryVaultId) {
    for (const sa of SERVICE_ACCOUNT_TEMPLATES) {
      if (!tierAtLeast(tier, sa.minTier)) continue;
      await ensureServiceAccount(client, {
        organizationId: accountContext.organization_id,
        ownerId: accountContext.user_id,
        vaultId: primaryVaultId,
        accountName: sa.accountName,
        accountType: sa.accountType,
        description: sa.description,
        businessJustification: `Demo ${expectedTier} workflow automation`,
        vaultPath: `/demo/${expectedTier}/${sa.accountName}`,
        credentialType: sa.credentialType,
        rotationFrequencyDays: sa.rotationFrequencyDays,
        privilegeLevel: sa.privilegeLevel,
        scope: sa.scope
      });
      serviceAccountsSeeded += 1;
    }
  }

  await client.query(
    `INSERT INTO notifications (organization_id, user_id, type, title, message, link, is_read, created_at)
     VALUES ($1, $2, 'system', 'Demo: Tier CMDB Dataset Ready', $3, '/dashboard/assets', false, NOW())`,
    [
      accountContext.organization_id,
      accountContext.user_id,
      `CMDB seeded for ${expectedTier} tier with hardware/software/AI-agent inventory, environments, password vaults, service accounts, and cross-asset dependency links.`
    ]
  );

  await client.query(
    `INSERT INTO audit_logs (organization_id, user_id, event_type, resource_type, details, success)
     VALUES ($1, $2, 'demo_tier_cmdb_seeded', 'asset', $3::jsonb, true)`,
    [
      accountContext.organization_id,
      accountContext.user_id,
      JSON.stringify({
        seed_tag: 'tier_cmdb_demo',
        tier: expectedTier,
        assets_created: createdAssets,
        service_accounts_seeded: serviceAccountsSeeded
      })
    ]
  );

  return {
    tier: expectedTier,
    organizationName: accountContext.organization_name,
    createdAssets,
    serviceAccountsSeeded
  };
}

async function run() {
  const client = await pool.connect();
  try {
    console.log('\nSeeding tiered CMDB demo data...\n');
    const categoryMap = await loadCategoryMap(client);
    const results = [];

    for (const account of DEMO_ACCOUNTS) {
      const context = await getDemoAccountContext(client, account.email);
      if (!context) {
        console.log(`  - Skipped ${account.email}: account not found`);
        continue;
      }

      await client.query('BEGIN');
      try {
        const summary = await seedTierCmdbForAccount(client, context, categoryMap, account.expectedTier);
        await client.query('COMMIT');
        results.push(summary);
        console.log(
          `  ✓ ${summary.tier.padEnd(12)} ${summary.organizationName} -> ${summary.createdAssets} assets created, ${summary.serviceAccountsSeeded} service accounts seeded`
        );
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`  ✗ Failed for ${account.email}: ${error.message}`);
      }
    }

    const totalAssets = results.reduce((sum, row) => sum + row.createdAssets, 0);
    const totalServiceAccounts = results.reduce((sum, row) => sum + row.serviceAccountsSeeded, 0);
    console.log('\n✅ Tiered CMDB seed complete.\n');
    console.log(`  Assets created this run: ${totalAssets}`);
    console.log(`  Service accounts seeded: ${totalServiceAccounts}\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error('\n❌ Tiered CMDB seed failed:', error.message);
  process.exit(1);
});
