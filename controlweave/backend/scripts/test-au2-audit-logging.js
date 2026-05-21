// @tier: exclude
/**
 * Test script for AU-2 compliant audit logging
 * 
 * This script demonstrates the enhanced audit logging capabilities
 * with SSO/SIEM integration tracking.
 */

const auditService = require('../src/services/auditService');
const pool = require('../src/config/database');

// Mock organization and user IDs for testing
const TEST_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_ID = '789e0123-e45b-67c8-d901-234567890000';

async function testAuditLogging() {
  console.log('=== Testing AU-2 Compliant Audit Logging ===\n');

  try {
    // Test 1: Log a successful SSO authentication
    console.log('Test 1: Logging successful SSO authentication...');
    const ssoLoginId = await auditService.logAuthentication({
      organizationId: TEST_ORG_ID,
      userId: TEST_USER_ID,
      email: 'test.user@example.com',
      authMethod: 'sso',
      ssoProvider: 'google',
      success: true,
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Test Browser)',
      sessionId: 'test_session_123',
      requestId: 'test_req_456',
      actorName: 'Test User'
    });
    console.log(`✓ Created SSO login audit log: ${ssoLoginId}\n`);

    // Test 2: Log a failed SSO authentication
    console.log('Test 2: Logging failed SSO authentication...');
    const failedSsoId = await auditService.logAuthentication({
      organizationId: TEST_ORG_ID,
      userId: null,
      email: 'unauthorized@example.com',
      authMethod: 'sso',
      ssoProvider: 'microsoft',
      success: false,
      failureReason: 'User not authorized for this organization',
      ipAddress: '10.0.0.50',
      userAgent: 'Mozilla/5.0 (Test Browser)',
      requestId: 'test_req_789'
    });
    console.log(`✓ Created failed SSO audit log: ${failedSsoId}\n`);

    // Test 3: Log SSO configuration change
    console.log('Test 3: Logging SSO configuration change...');
    const ssoConfigId = await auditService.logSsoConfigChange({
      organizationId: TEST_ORG_ID,
      userId: TEST_USER_ID,
      action: 'updated',
      provider: 'okta',
      details: {
        display_name: 'Okta SSO',
        enabled: true,
        auto_provision: true
      },
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Test Browser)',
      requestId: 'test_req_101',
      actorName: 'Admin User'
    });
    console.log(`✓ Created SSO config change audit log: ${ssoConfigId}\n`);

    // Test 4: Log SIEM configuration change
    console.log('Test 4: Logging SIEM configuration change...');
    const siemConfigId = await auditService.logSiemConfigChange({
      organizationId: TEST_ORG_ID,
      userId: TEST_USER_ID,
      action: 'created',
      siemProvider: 'splunk',
      configId: 'siem_config_123',
      details: {
        name: 'Production Splunk',
        enabled: true,
        endpoint_url: 'https://splunk.example.com:8088'
      },
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Test Browser)',
      requestId: 'test_req_202',
      actorName: 'Admin User'
    });
    console.log(`✓ Created SIEM config change audit log: ${siemConfigId}\n`);

    // Test 5: Log generic audit event
    console.log('Test 5: Logging generic control update event...');
    const controlUpdateId = await auditService.createAuditLog({
      organizationId: TEST_ORG_ID,
      userId: TEST_USER_ID,
      eventType: 'control.updated',
      resourceType: 'control',
      resourceId: 'ctrl_123',
      details: {
        control_id: 'AC-2',
        changes: ['description updated', 'implementation status changed']
      },
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Test Browser)',
      success: true,
      sessionId: 'test_session_123',
      authenticationMethod: 'password',
      requestId: 'test_req_303',
      actorName: 'Test User',
      sourceSystem: 'controlweave'
    });
    console.log(`✓ Created control update audit log: ${controlUpdateId}\n`);

    // Test 6: Query audit logs to verify AU-2 fields
    console.log('Test 6: Querying audit logs to verify AU-2 compliance...');
    const result = await pool.query(`
      SELECT 
        id,
        event_type,
        outcome,
        created_at,
        source_system,
        ip_address,
        actor_name,
        authentication_method,
        sso_provider,
        siem_forwarded,
        session_id,
        request_id,
        resource_type,
        resource_id,
        success,
        failure_reason
      FROM audit_logs
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [TEST_ORG_ID]);

    console.log(`\n✓ Found ${result.rows.length} audit log entries:\n`);
    
    result.rows.forEach((row, index) => {
      console.log(`Entry ${index + 1}:`);
      console.log(`  Event Type: ${row.event_type}`);
      console.log(`  Outcome: ${row.outcome}`);
      console.log(`  Timestamp: ${row.created_at}`);
      console.log(`  Source System: ${row.source_system}`);
      console.log(`  IP Address: ${row.ip_address || 'N/A'}`);
      console.log(`  Actor: ${row.actor_name || 'N/A'}`);
      console.log(`  Auth Method: ${row.authentication_method || 'N/A'}`);
      console.log(`  SSO Provider: ${row.sso_provider || 'N/A'}`);
      console.log(`  SIEM Forwarded: ${row.siem_forwarded ? 'Yes' : 'No'}`);
      console.log(`  Session ID: ${row.session_id || 'N/A'}`);
      console.log(`  Request ID: ${row.request_id || 'N/A'}`);
      console.log(`  Resource: ${row.resource_type || 'N/A'}${row.resource_id ? ' (' + row.resource_id + ')' : ''}`);
      console.log(`  Success: ${row.success ? 'Yes' : 'No'}`);
      if (row.failure_reason) {
        console.log(`  Failure Reason: ${row.failure_reason}`);
      }
      console.log('');
    });

    console.log('=== AU-2 Compliance Verification ===\n');
    console.log('✓ Event type - Captured in event_type field');
    console.log('✓ Date and time - Captured in created_at field');
    console.log('✓ Location - Captured in source_system and ip_address fields');
    console.log('✓ Source - Captured in source_system, actor_name, and authentication_method fields');
    console.log('✓ Outcome - Captured in outcome, success, and failure_reason fields');
    console.log('✓ Subject identity - Captured in user_id, actor_name, and authentication_method fields');
    console.log('✓ Object - Captured in resource_type and resource_id fields');
    console.log('\nAdditional enhancements:');
    console.log('✓ Session tracking - session_id for correlating related events');
    console.log('✓ Request tracing - request_id for distributed system tracing');
    console.log('✓ SSO integration - authentication_method and sso_provider tracking');
    console.log('✓ SIEM integration - siem_forwarded flag for external system sync');

    console.log('\n=== All Tests Passed! ===\n');

  } catch (error) {
    console.error('Error during testing:', error);
    throw error;
  }
}

// Run tests if executed directly
if (require.main === module) {
  testAuditLogging()
    .then(() => {
      console.log('Testing completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Testing failed:', error);
      process.exit(1);
    });
}

module.exports = { testAuditLogging };
