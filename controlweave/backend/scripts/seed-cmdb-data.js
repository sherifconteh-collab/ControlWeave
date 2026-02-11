require('dotenv').config();
const pool = require('../src/config/database');
const bcrypt = require('bcryptjs');

async function seedCMDBData() {
  const client = await pool.connect();

  try {
    console.log('\n🌱 Seeding CMDB dummy data...\n');

    // 1. Create test organizations with different tiers
    console.log('Creating organizations...');
    const orgResult = await client.query(`
      INSERT INTO organizations (name, tier) VALUES
        ('Acme Corp', 'free'),
        ('TechStart Inc', 'starter'),
        ('Enterprise Solutions Ltd', 'professional'),
        ('Global Systems Corp', 'enterprise')
      ON CONFLICT DO NOTHING
      RETURNING id, name, tier
    `);

    const orgs = orgResult.rows.length > 0 ? orgResult.rows : (await client.query('SELECT id, name, tier FROM organizations LIMIT 4')).rows;
    console.log(`✓ ${orgs.length} organizations`);

    // Get the professional tier org for our test data
    const professionalOrg = orgs.find(o => o.tier === 'professional') || orgs[2];
    const starterOrg = orgs.find(o => o.tier === 'starter') || orgs[1];

    // 2. Create test users
    console.log('\nCreating users...');
    const hashedPassword = await bcrypt.hash('Test1234!', 10);

    const usersResult = await client.query(`
      INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role)
      VALUES
        ($1, 'admin@professional.com', $2, 'Alice', 'Admin', 'admin'),
        ($1, 'john@professional.com', $2, 'John', 'Smith', 'user'),
        ($1, 'sarah@professional.com', $2, 'Sarah', 'Johnson', 'user'),
        ($3, 'bob@starter.com', $2, 'Bob', 'Wilson', 'admin')
      ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
      RETURNING id, email, first_name, last_name
    `, [professionalOrg.id, hashedPassword, starterOrg.id]);

    const users = usersResult.rows;
    console.log(`✓ ${users.length} users created`);
    console.log(`  📧 Login: admin@professional.com / Test1234!`);
    console.log(`  📧 Login: bob@starter.com / Test1234!`);

    // 3. Create environments
    console.log('\nCreating environments...');
    const envResult = await client.query(`
      INSERT INTO environments (
        organization_id, name, code, environment_type,
        contains_pii, contains_phi, data_classification,
        ip_addresses, network_zone, security_level, criticality,
        owner_id
      ) VALUES
        ($1, 'Production', 'prod', 'production', true, false, 'restricted',
         '["10.0.1.0/24", "10.0.2.0/24"]'::jsonb, 'secure', 'high', 'critical', $2),
        ($1, 'Staging', 'staging', 'staging', true, false, 'confidential',
         '["10.1.1.0/24"]'::jsonb, 'internal', 'moderate', 'high', $2),
        ($1, 'Development', 'dev', 'development', false, false, 'internal',
         '["192.168.1.0/24"]'::jsonb, 'internal', 'low', 'medium', $3),
        ($1, 'Disaster Recovery', 'dr', 'dr', true, false, 'restricted',
         '["10.2.1.0/24"]'::jsonb, 'isolated', 'high', 'critical', $2)
      ON CONFLICT (organization_id, code) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name, code
    `, [professionalOrg.id, users[0].id, users[1].id]);

    const environments = envResult.rows;
    console.log(`✓ ${environments.length} environments`);

    // 4. Create password vaults
    console.log('\nCreating password vaults...');
    const vaultResult = await client.query(`
      INSERT INTO password_vaults (organization_id, name, vault_type, vault_url, is_active)
      VALUES
        ($1, 'Production Vault', 'hashicorp_vault', 'https://vault.acme.com', true),
        ($1, 'AWS Secrets', 'aws_secrets_manager', 'https://secretsmanager.us-east-1.amazonaws.com', true),
        ($1, 'Azure Key Vault', 'azure_key_vault', 'https://acme-prod.vault.azure.net', true)
      ON CONFLICT (organization_id, name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name, vault_type
    `, [professionalOrg.id]);

    const vaults = vaultResult.rows;
    console.log(`✓ ${vaults.length} password vaults`);

    // 5. Get asset categories
    const categoriesResult = await client.query('SELECT id, code FROM asset_categories');
    const categories = {};
    categoriesResult.rows.forEach(cat => {
      categories[cat.code] = cat.id;
    });

    // 6. Create diverse assets
    console.log('\nCreating assets...');

    // Hardware assets
    await client.query(`
      INSERT INTO assets (
        organization_id, category_id, name, asset_tag, serial_number, model, manufacturer,
        owner_id, custodian_id, environment_id, status, location,
        ip_address, hostname, mac_address,
        security_classification, criticality,
        acquisition_date, deployment_date
      ) VALUES
        ($1, $2, 'Production Web Server 01', 'HW-001', 'SN-9876543210', 'PowerEdge R740', 'Dell',
         $3, $4, $5, 'active', 'Data Center - Rack A12',
         '10.0.1.10', 'web-prod-01', '00:1B:44:11:3A:B7',
         'restricted', 'critical', '2023-01-15', '2023-02-01'),

        ($1, $2, 'Database Server 01', 'HW-002', 'SN-1234567890', 'PowerEdge R640', 'Dell',
         $3, $4, $5, 'active', 'Data Center - Rack A13',
         '10.0.1.20', 'db-prod-01', '00:1B:44:11:3A:B8',
         'restricted', 'critical', '2023-01-20', '2023-02-05'),

        ($1, $2, 'Load Balancer', 'HW-003', 'SN-5555666677', 'F5 BIG-IP', 'F5 Networks',
         $3, $4, $5, 'active', 'Data Center - Rack A10',
         '10.0.1.5', 'lb-prod-01', '00:1B:44:11:3A:B9',
         'restricted', 'high', '2023-03-10', '2023-03-20')
    `, [professionalOrg.id, categories.hardware, users[0].id, users[1].id, environments[0].id]);

    // Software assets
    await client.query(`
      INSERT INTO assets (
        organization_id, category_id, name, version, manufacturer,
        owner_id, environment_id, status,
        license_key, license_expiry,
        security_classification, criticality,
        deployment_date
      ) VALUES
        ($1, $2, 'PostgreSQL Database', '15.2', 'PostgreSQL Global Development Group',
         $3, $4, 'active',
         'XXXX-XXXX-XXXX-XXXX', '2025-12-31',
         'restricted', 'critical', '2023-02-01'),

        ($1, $2, 'Microsoft Office 365', 'Enterprise E5', 'Microsoft',
         $3, $4, 'active',
         'XXXXX-XXXXX-XXXXX-XXXXX', '2026-06-30',
         'internal', 'medium', '2023-01-01'),

        ($1, $2, 'Splunk Enterprise', '9.0.4', 'Splunk Inc',
         $3, $4, 'active',
         'SPLUNK-XXXXXX', '2025-09-15',
         'confidential', 'high', '2023-04-01')
    `, [professionalOrg.id, categories.software, users[0].id, environments[0].id]);

    // Cloud resources
    await client.query(`
      INSERT INTO assets (
        organization_id, category_id, name, cloud_provider, cloud_region,
        owner_id, environment_id, status,
        ip_address, hostname,
        security_classification, criticality,
        deployment_date, notes
      ) VALUES
        ($1, $2, 'Production EKS Cluster', 'AWS', 'us-east-1',
         $3, $4, 'active',
         '10.0.1.50', 'eks-prod-cluster',
         'restricted', 'critical', '2023-05-01',
         'Kubernetes cluster for production workloads'),

        ($1, $2, 'S3 Backup Bucket', 'AWS', 'us-west-2',
         $3, $4, 'active',
         NULL, 's3://acme-prod-backups',
         'restricted', 'high', '2023-01-15',
         'Encrypted backup storage with versioning enabled'),

        ($1, $2, 'Azure SQL Database', 'Azure', 'East US',
         $3, $4, 'active',
         NULL, 'acme-prod-sql.database.windows.net',
         'restricted', 'critical', '2023-03-20',
         'Managed SQL database for customer data')
    `, [professionalOrg.id, categories.cloud, users[0].id, environments[0].id]);

    // Network devices
    await client.query(`
      INSERT INTO assets (
        organization_id, category_id, name, model, manufacturer,
        owner_id, environment_id, status, location,
        ip_address, hostname, mac_address,
        security_classification, criticality,
        deployment_date
      ) VALUES
        ($1, $2, 'Core Router', 'Catalyst 9500', 'Cisco',
         $3, $4, 'active', 'Data Center - Network Room',
         '10.0.0.1', 'rtr-core-01', '00:1E:BD:88:33:FF',
         'restricted', 'critical', '2023-01-10'),

        ($1, $2, 'Firewall - Primary', 'FortiGate 600E', 'Fortinet',
         $3, $4, 'active', 'Data Center - Perimeter',
         '10.0.0.2', 'fw-prod-01', '00:1E:BD:88:34:00',
         'restricted', 'critical', '2023-01-12')
    `, [professionalOrg.id, categories.network, users[0].id, environments[0].id]);

    // Database assets
    await client.query(`
      INSERT INTO assets (
        organization_id, category_id, name, version, manufacturer,
        owner_id, environment_id, status,
        ip_address, hostname,
        security_classification, criticality,
        deployment_date, notes
      ) VALUES
        ($1, $2, 'Customer Database - Primary', '15.2', 'PostgreSQL',
         $3, $4, 'active',
         '10.0.1.20', 'db-customers-prod',
         'restricted', 'critical', '2023-02-01',
         'Contains PII and payment information'),

        ($1, $2, 'Analytics Database', '8.0', 'MongoDB',
         $3, $5, 'active',
         '10.1.1.30', 'db-analytics-staging',
         'confidential', 'medium', '2023-03-15',
         'Aggregated analytics data, no PII')
    `, [professionalOrg.id, categories.database, users[0].id, environments[0].id, environments[1].id]);

    // AI Agents (Professional+ tier)
    await client.query(`
      INSERT INTO assets (
        organization_id, category_id, name, version,
        owner_id, environment_id, status,
        ai_model_type, ai_risk_level, ai_training_data_source,
        ai_bias_testing_completed, ai_bias_testing_date,
        ai_human_oversight_required, ai_transparency_score,
        security_classification, criticality,
        deployment_date, notes
      ) VALUES
        ($1, $2, 'Customer Support Chatbot', 'GPT-4-turbo',
         $3, $4, 'active',
         'llm', 'limited', 'Internal customer support transcripts (anonymized)',
         true, '2023-11-15', false, 75,
         'confidential', 'medium', '2023-12-01',
         'Handles tier-1 customer inquiries, escalates complex issues'),

        ($1, $2, 'Fraud Detection AI', 'Custom CNN v2.1',
         $3, $4, 'active',
         'predictive', 'high', 'Historical transaction data with fraud labels',
         true, '2023-10-20', true, 82,
         'restricted', 'critical', '2023-11-01',
         'Real-time fraud detection, requires human review for blocks over $10k'),

        ($1, $2, 'Document Classification Agent', 'DistilBERT-base',
         $3, $5, 'active',
         'nlp', 'limited', 'Public document corpus + internal templates',
         true, '2023-09-10', false, 68,
         'internal', 'low', '2023-09-25',
         'Automatically categorizes uploaded documents')
    `, [professionalOrg.id, categories.ai_agent, users[0].id, environments[0].id, environments[1].id]);

    console.log(`✓ 20+ assets created across all categories`);

    // 7. Create service accounts
    console.log('\nCreating service accounts...');
    const today = new Date();
    const nextRotation = new Date(today);
    nextRotation.setDate(nextRotation.getDate() + 90);

    await client.query(`
      INSERT INTO service_accounts (
        organization_id, account_name, account_type, description,
        owner_id, business_justification,
        vault_id, vault_path,
        credential_type, rotation_frequency_days, next_rotation_date,
        privilege_level, scope,
        review_frequency_days, next_review_date, reviewer_id,
        status, is_active
      ) VALUES
        ($1, 'prod-db-app-user', 'system_user', 'Application database connection',
         $2, 'Required for production application to access customer database',
         $3, '/prod/database/app-user',
         'password', 90, $4,
         'write', 'customers, orders, products tables',
         90, $4, $2, 'active', true),

        ($1, 'aws-s3-backup-service', 'service_principal', 'AWS service account for S3 backups',
         $2, 'Automated backup jobs to S3',
         $5, '/aws/s3-backup',
         'api_key', 90, $4,
         'write', 'S3 bucket: acme-prod-backups',
         90, $4, $2, 'active', true),

        ($1, 'github-actions-deploy', 'oauth_client', 'CI/CD deployment credentials',
         $6, 'Automated deployments via GitHub Actions',
         $3, '/cicd/github-actions',
         'oauth_token', 60, $4,
         'admin', 'EKS cluster, S3 static assets',
         90, $4, $2, 'active', true),

        ($1, 'monitoring-api-key', 'api_key', 'Datadog monitoring integration',
         $6, 'System monitoring and alerting',
         $5, '/monitoring/datadog',
         'api_key', 180, $4,
         'read', 'All production infrastructure metrics',
         90, $4, $2, 'active', true)
    `, [
      professionalOrg.id,
      users[0].id,
      vaults[0].id,
      nextRotation.toISOString().split('T')[0],
      vaults[1].id,
      users[1].id
    ]);

    console.log(`✓ 4 service accounts created`);

    // 8. Create some asset dependencies
    console.log('\nCreating asset dependencies...');
    const assetsForDeps = await client.query(`
      SELECT id, name FROM assets
      WHERE organization_id = $1
      ORDER BY name
      LIMIT 5
    `, [professionalOrg.id]);

    if (assetsForDeps.rows.length >= 3) {
      await client.query(`
        INSERT INTO asset_dependencies (asset_id, depends_on_asset_id, dependency_type, criticality)
        VALUES
          ($1, $2, 'hosted_on', 'high'),
          ($1, $3, 'uses', 'medium')
        ON CONFLICT DO NOTHING
      `, [assetsForDeps.rows[0].id, assetsForDeps.rows[1].id, assetsForDeps.rows[2].id]);

      console.log(`✓ Asset dependencies created`);
    }

    console.log('\n✅ CMDB seed data completed!\n');
    console.log('📋 Summary:');
    console.log(`   • Organizations: ${orgs.length} (all tiers)`);
    console.log(`   • Users: ${users.length}`);
    console.log(`   • Environments: ${environments.length}`);
    console.log(`   • Password Vaults: ${vaults.length}`);
    console.log(`   • Assets: 20+ (hardware, software, cloud, AI agents, etc.)`);
    console.log(`   • Service Accounts: 4`);
    console.log('\n🔐 Test Login Credentials:');
    console.log('   Professional Tier: admin@professional.com / Test1234!');
    console.log('   Starter Tier: bob@starter.com / Test1234!\n');

  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedCMDBData();
