const pool = require('../config/database');

/**
 * Builds a rich, personalized organization context string to inject into
 * every AI system prompt. This makes every AI response org-aware rather
 * than generic.
 *
 * @param {string} organizationId
 * @returns {Promise<string>} context block to append to system prompt
 */
async function buildOrgContext(organizationId) {
  try {
    // 1. Org profile (onboarding data)
    const profileResult = await pool.query(
      `SELECT op.company_legal_name, op.industry, op.employee_count_range,
              op.confidentiality_impact, op.integrity_impact, op.availability_impact,
              op.deployment_model, op.cloud_providers, op.data_sensitivity_types,
              op.environment_types, op.rmf_stage, op.system_name, op.system_description,
              o.tier
       FROM organizations o
       LEFT JOIN organization_profiles op ON op.organization_id = o.id
       WHERE o.id = $1 LIMIT 1`,
      [organizationId]
    );
    const profile = profileResult.rows[0] || {};

    // 2. Active frameworks + compliance %
    const frameworksResult = await pool.query(
      `SELECT f.code, f.name,
              COUNT(fc.id) AS total,
              COUNT(ci.id) FILTER (WHERE ci.status = 'implemented') AS implemented,
              ROUND(
                COUNT(ci.id) FILTER (WHERE ci.status = 'implemented')::numeric
                / NULLIF(COUNT(fc.id), 0) * 100, 1
              ) AS pct
       FROM organization_frameworks of2
       JOIN frameworks f ON f.id = of2.framework_id
       JOIN framework_controls fc ON fc.framework_id = f.id
       LEFT JOIN control_implementations ci
         ON ci.control_id = fc.id AND ci.organization_id = $1
       WHERE of2.organization_id = $1
       GROUP BY f.code, f.name
       ORDER BY f.name`,
      [organizationId]
    );

    // 3. Asset summary
    const assetResult = await pool.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE a.criticality = 'critical') AS critical,
              COUNT(*) FILTER (WHERE ac.code = 'ai_agent') AS ai_agents
       FROM assets a
       JOIN asset_categories ac ON ac.id = a.category_id
       WHERE a.organization_id = $1`,
      [organizationId]
    );
    const assets = assetResult.rows[0] || {};

    // 4. Open vulnerability count
    const vulnResult = await pool.query(
      `SELECT COUNT(*) AS open_critical
       FROM vulnerability_findings
       WHERE organization_id = $1 AND status = 'open' AND severity = 'critical'`,
      [organizationId]
    );
    const openCritical = vulnResult.rows[0]?.open_critical || 0;

    // 5. Assemble context string
    const lines = [];
    lines.push('--- ORGANIZATION CONTEXT ---');

    if (profile.company_legal_name) lines.push(`Organization: ${profile.company_legal_name}`);
    if (profile.system_name)        lines.push(`System: ${profile.system_name}`);
    if (profile.industry)           lines.push(`Industry: ${profile.industry}`);
    if (profile.employee_count_range) lines.push(`Size: ${profile.employee_count_range} employees`);
    if (profile.tier)               lines.push(`Platform Tier: ${profile.tier}`);

    if (profile.confidentiality_impact || profile.integrity_impact || profile.availability_impact) {
      lines.push(`CIA Baseline: Confidentiality=${profile.confidentiality_impact || 'unknown'}, Integrity=${profile.integrity_impact || 'unknown'}, Availability=${profile.availability_impact || 'unknown'}`);
    }

    if (profile.deployment_model)   lines.push(`Deployment: ${profile.deployment_model}`);
    if (Array.isArray(profile.cloud_providers) && profile.cloud_providers.length > 0) {
      lines.push(`Cloud: ${profile.cloud_providers.join(', ')}`);
    }
    if (Array.isArray(profile.data_sensitivity_types) && profile.data_sensitivity_types.length > 0) {
      lines.push(`Data Types: ${profile.data_sensitivity_types.join(', ')}`);
    }
    if (profile.rmf_stage)          lines.push(`RMF Stage: ${profile.rmf_stage}`);

    if (frameworksResult.rows.length > 0) {
      lines.push('Active Frameworks:');
      for (const fw of frameworksResult.rows) {
        lines.push(`  - ${fw.name}: ${fw.pct || 0}% complete (${fw.implemented}/${fw.total} controls)`);
      }
    }

    lines.push(`Assets: ${assets.total || 0} total, ${assets.critical || 0} critical, ${assets.ai_agents || 0} AI agents`);
    if (openCritical > 0) lines.push(`Open Critical Vulnerabilities: ${openCritical}`);

    lines.push('--- END CONTEXT ---');
    return lines.join('\n');
  } catch (err) {
    // Non-fatal — return empty string so AI still works without context
    console.error('orgContextService error (non-fatal):', err.message);
    return '';
  }
}

module.exports = { buildOrgContext };
