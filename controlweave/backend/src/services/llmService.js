const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const pool = require('../config/database');
const { getAiUsageLimit } = require('../config/tierPolicy');

// Default clients (platform keys from .env)
let defaultAnthropicClient = null;
let defaultOpenAIClient = null;
let defaultXAIClient = null;
const defaultGeminiApiKey = process.env.GEMINI_API_KEY || null;
const GEMINI_API_BASE = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta';
const XAI_API_BASE = process.env.XAI_API_BASE || 'https://api.x.ai/v1';

if (process.env.ANTHROPIC_API_KEY) {
  defaultAnthropicClient = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
}
if (process.env.OPENAI_API_KEY) {
  defaultOpenAIClient = new OpenAI.default({ apiKey: process.env.OPENAI_API_KEY });
}
if (process.env.XAI_API_KEY) {
  defaultXAIClient = new OpenAI.default({ apiKey: process.env.XAI_API_KEY, baseURL: XAI_API_BASE });
}

const PROVIDERS = {
  claude: { name: 'Claude (Anthropic)', models: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'] },
  openai: { name: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini'] },
  gemini: { name: 'Google Gemini', models: ['gemini-2.5-pro', 'gemini-2.5-flash'] },
  grok: { name: 'xAI Grok', models: ['grok-3-latest', 'grok-4-latest'] }
};

// ---------- BYOK: Fetch user-provided keys from org settings ----------
async function getOrgApiKey(organizationId, provider) {
  const keyMap = { claude: 'anthropic_api_key', openai: 'openai_api_key', gemini: 'gemini_api_key', grok: 'xai_api_key' };
  const settingKey = keyMap[provider];
  if (!settingKey) return null;

  const result = await pool.query(
    'SELECT setting_value FROM organization_settings WHERE organization_id = $1 AND setting_key = $2',
    [organizationId, settingKey]
  );
  return result.rows.length > 0 ? result.rows[0].setting_value : null;
}

function getClient(provider, orgApiKey) {
  if (provider === 'claude') {
    if (orgApiKey) return new Anthropic.default({ apiKey: orgApiKey });
    return defaultAnthropicClient;
  }
  if (provider === 'openai') {
    if (orgApiKey) return new OpenAI.default({ apiKey: orgApiKey });
    return defaultOpenAIClient;
  }
  if (provider === 'grok') {
    if (orgApiKey) return new OpenAI.default({ apiKey: orgApiKey, baseURL: XAI_API_BASE });
    return defaultXAIClient;
  }
  if (provider === 'gemini') {
    return { apiKey: orgApiKey || defaultGeminiApiKey };
  }
  return null;
}

// ---------- Core chat function ----------
async function chat({ provider = 'claude', model, messages, systemPrompt, organizationId, maxTokens = 4096 }) {
  const orgKey = organizationId ? await getOrgApiKey(organizationId, provider) : null;
  const client = getClient(provider, orgKey);

  if (!client || (provider === 'gemini' && !client.apiKey)) {
    throw new Error(`No API key configured for ${provider}. Add one in Settings > LLM Configuration.`);
  }

  if (provider === 'claude') {
    const resp = await client.messages.create({
      model: model || 'claude-sonnet-4-5-20250929',
      max_tokens: maxTokens,
      system: systemPrompt || 'You are an expert GRC (Governance, Risk, and Compliance) analyst.',
      messages
    });
    return resp.content[0].text;
  }

  if (provider === 'openai') {
    const oaiMessages = [];
    if (systemPrompt) oaiMessages.push({ role: 'system', content: systemPrompt });
    oaiMessages.push(...messages);
    const resp = await client.chat.completions.create({
      model: model || 'gpt-4o',
      max_tokens: maxTokens,
      messages: oaiMessages
    });
    return resp.choices[0].message.content;
  }

  if (provider === 'grok') {
    const grokMessages = [];
    if (systemPrompt) grokMessages.push({ role: 'system', content: systemPrompt });
    grokMessages.push(...messages);
    const resp = await client.chat.completions.create({
      model: model || 'grok-3-latest',
      max_tokens: maxTokens,
      messages: grokMessages
    });
    return resp.choices[0].message.content;
  }

  if (provider === 'gemini') {
    const chosenModel = model || 'gemini-2.5-flash';
    const contents = messages.map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(message.content || '') }]
    }));

    const payload = {
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens
      }
    };

    if (systemPrompt) {
      payload.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    const response = await fetch(
      `${GEMINI_API_BASE}/models/${encodeURIComponent(chosenModel)}:generateContent?key=${client.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      let errorText = `Gemini request failed with status ${response.status}`;
      try {
        const errorBody = await response.json();
        if (errorBody?.error?.message) {
          errorText = errorBody.error.message;
        }
      } catch (parseError) {
        // Keep fallback message if JSON parse fails.
      }
      throw new Error(errorText);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join('\n')
      .trim();

    if (!text) {
      throw new Error('Gemini returned an empty response');
    }

    return text;
  }

  throw new Error('Unsupported provider');
}

// ---------- GRC System Prompt ----------
const GRC_SYSTEM = `You are an expert GRC (Governance, Risk, and Compliance) analyst with deep knowledge of:
- NIST CSF 2.0, NIST 800-53 rev5, NIST 800-171, NIST Privacy Framework, NIST AI RMF
- ISO 27001:2022, ISO/IEC 42001:2023, ISO/IEC 42005:2025
- SOC 2 Type II, HIPAA, GDPR, FFIEC, FISCAM
- EU AI Act, prEN 18286, NERC CIP
- Asset management (CMDB), risk assessment, audit readiness
Always provide actionable, specific recommendations. Use framework control IDs when referencing requirements.
Format responses with clear sections using markdown headers.`;

// =====================================================================
// 1. AUTOMATED GAP ANALYSIS
// =====================================================================
async function generateGapAnalysis({ organizationId, provider, model }) {
  const frameworks = await pool.query(`
    SELECT f.code, f.name, COUNT(fc.id) as total,
      COUNT(ci.id) FILTER (WHERE ci.status = 'implemented') as implemented,
      COUNT(ci.id) FILTER (WHERE ci.status = 'in_progress') as in_progress,
      COUNT(ci.id) FILTER (WHERE ci.status IS NULL OR ci.status = 'not_started') as not_started
    FROM organization_frameworks of2
    JOIN frameworks f ON f.id = of2.framework_id
    JOIN framework_controls fc ON fc.framework_id = f.id
    LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $1
    WHERE of2.organization_id = $1
    GROUP BY f.id, f.code, f.name
  `, [organizationId]);

  const controls = await pool.query(`
    SELECT fc.control_id, fc.title, fc.priority, f.code as framework,
      COALESCE(ci.status, 'not_started') as status
    FROM organization_frameworks of2
    JOIN frameworks f ON f.id = of2.framework_id
    JOIN framework_controls fc ON fc.framework_id = f.id
    LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $1
    WHERE of2.organization_id = $1 AND (ci.status IS NULL OR ci.status != 'implemented')
    ORDER BY fc.priority ASC, f.code
    LIMIT 100
  `, [organizationId]);

  return chat({
    provider, model, organizationId,
    systemPrompt: GRC_SYSTEM,
    messages: [{ role: 'user', content: `Generate a comprehensive gap analysis report.

Framework Status:
${JSON.stringify(frameworks.rows, null, 2)}

Top Unimplemented Controls:
${JSON.stringify(controls.rows, null, 2)}

Provide:
1. Executive Summary with overall risk posture
2. Per-framework gap breakdown with % complete
3. Critical gaps requiring immediate attention (priority 1 controls)
4. Risk-ranked remediation roadmap with timeline suggestions
5. Quick wins - controls that can be implemented easily` }]
  });
}

// =====================================================================
// 2. CROSSWALK OPTIMIZER
// =====================================================================
async function optimizeCrosswalk({ organizationId, provider, model }) {
  const mappings = await pool.query(`
    SELECT fc1.control_id as source_id, fc1.title as source_title, f1.code as source_fw,
      fc2.control_id as target_id, fc2.title as target_title, f2.code as target_fw,
      cm.similarity_score, cm.mapping_type,
      COALESCE(ci1.status, 'not_started') as source_status,
      COALESCE(ci2.status, 'not_started') as target_status
    FROM control_mappings cm
    JOIN framework_controls fc1 ON fc1.id = cm.source_control_id
    JOIN framework_controls fc2 ON fc2.id = cm.target_control_id
    JOIN frameworks f1 ON f1.id = fc1.framework_id
    JOIN frameworks f2 ON f2.id = fc2.framework_id
    JOIN organization_frameworks of1 ON of1.framework_id = f1.id AND of1.organization_id = $1
    LEFT JOIN control_implementations ci1 ON ci1.control_id = fc1.id AND ci1.organization_id = $1
    LEFT JOIN control_implementations ci2 ON ci2.control_id = fc2.id AND ci2.organization_id = $1
    WHERE cm.similarity_score >= 80
    ORDER BY cm.similarity_score DESC
    LIMIT 200
  `, [organizationId]);

  return chat({
    provider, model, organizationId,
    systemPrompt: GRC_SYSTEM,
    messages: [{ role: 'user', content: `Analyze crosswalk mappings and recommend optimal implementation order.

Crosswalk Mappings (score >= 80%):
${JSON.stringify(mappings.rows, null, 2)}

Provide:
1. Top 10 "implement first" controls that satisfy the most cross-framework requirements
2. For each recommendation, list all frameworks satisfied and the similarity scores
3. Estimated effort reduction percentage from leveraging crosswalks
4. Controls that are already implemented and their crosswalk impact
5. Recommended implementation sequence for maximum coverage with minimum effort` }]
  });
}

// =====================================================================
// 3. COMPLIANCE FORECASTING
// =====================================================================
async function forecastCompliance({ organizationId, provider, model }) {
  const history = await pool.query(`
    SELECT DATE_TRUNC('week', ci.created_at) as week,
      COUNT(*) as controls_completed
    FROM control_implementations ci
    WHERE ci.organization_id = $1 AND ci.status = 'implemented'
    GROUP BY DATE_TRUNC('week', ci.created_at)
    ORDER BY week DESC
    LIMIT 12
  `, [organizationId]);

  const totals = await pool.query(`
    SELECT COUNT(fc.id) as total,
      COUNT(ci.id) FILTER (WHERE ci.status = 'implemented') as done
    FROM organization_frameworks of2
    JOIN frameworks f ON f.id = of2.framework_id
    JOIN framework_controls fc ON fc.framework_id = f.id
    LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $1
    WHERE of2.organization_id = $1
  `, [organizationId]);

  return chat({
    provider, model, organizationId,
    systemPrompt: GRC_SYSTEM,
    messages: [{ role: 'user', content: `Forecast compliance trajectory.

Implementation Velocity (weekly):
${JSON.stringify(history.rows, null, 2)}

Current Totals: ${JSON.stringify(totals.rows[0])}

Provide:
1. Current compliance percentage and trend direction
2. Estimated date to reach 80%, 90%, and 100% compliance
3. Velocity analysis - is the team accelerating or decelerating?
4. Bottleneck identification - what's slowing implementation
5. Recommendations to accelerate timeline
6. Risk assessment if current pace continues` }]
  });
}

// =====================================================================
// 4. REGULATORY CHANGE MONITOR
// =====================================================================
async function monitorRegulatoryChanges({ organizationId, frameworks: fwList, provider, model }) {
  const adopted = await pool.query(`
    SELECT f.code, f.name, f.version FROM organization_frameworks of2
    JOIN frameworks f ON f.id = of2.framework_id WHERE of2.organization_id = $1
  `, [organizationId]);

  return chat({
    provider, model, organizationId,
    systemPrompt: GRC_SYSTEM + '\nYou have knowledge of regulatory changes and updates through your training data.',
    messages: [{ role: 'user', content: `Analyze regulatory changes that may impact this organization.

Adopted Frameworks:
${JSON.stringify(adopted.rows, null, 2)}

Provide:
1. Recent and upcoming regulatory changes for each adopted framework
2. Impact assessment for each change (High/Medium/Low)
3. New controls or requirements that may need to be added
4. Deprecated or modified controls
5. Timeline for compliance with new requirements
6. Recommended actions to stay ahead of changes` }]
  });
}

// =====================================================================
// 5. REMEDIATION PLAYBOOKS
// =====================================================================
async function generateRemediationPlaybook({ controlId, organizationId, provider, model }) {
  const control = await pool.query(`
    SELECT fc.*, f.code as framework_code, f.name as framework_name,
      COALESCE(ci.status, 'not_started') as impl_status, ci.notes as impl_notes
    FROM framework_controls fc
    JOIN frameworks f ON f.id = fc.framework_id
    LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $1
    WHERE fc.id = $2
  `, [organizationId, controlId]);

  if (control.rows.length === 0) throw new Error('Control not found');

  const assets = await pool.query(`
    SELECT a.name, a.hostname, ac.code as category, a.criticality
    FROM assets a JOIN asset_categories ac ON ac.id = a.category_id
    WHERE a.organization_id = $1 ORDER BY a.criticality LIMIT 20
  `, [organizationId]);

  return chat({
    provider, model, organizationId,
    systemPrompt: GRC_SYSTEM,
    messages: [{ role: 'user', content: `Generate a detailed remediation playbook for this control.

Control:
${JSON.stringify(control.rows[0], null, 2)}

Organization Assets:
${JSON.stringify(assets.rows, null, 2)}

Provide:
1. Step-by-step implementation guide (numbered steps)
2. Required tools and technologies
3. Estimated effort (hours) and required skill level
4. Configuration examples / code snippets where applicable
5. Verification steps to confirm implementation
6. Common pitfalls and how to avoid them
7. Evidence artifacts to collect during implementation
8. Related controls that benefit from this implementation` }]
  });
}

// =====================================================================
// VULNERABILITY REMEDIATION PLAN
// =====================================================================
async function generateVulnerabilityRemediation({
  vulnerabilityId,
  organizationId,
  provider,
  model
}) {
  const findingResult = await pool.query(
    `SELECT
       vf.id,
       vf.finding_key,
       vf.vulnerability_id,
       vf.source,
       vf.standard,
       vf.title,
       vf.description,
       vf.severity,
       vf.cvss_score,
       vf.status,
       vf.due_date,
       vf.package_name,
       vf.component_name,
       vf.version_detected,
       vf.cwe_id,
       vf.kev_listed,
       vf.exploit_available,
       a.id AS asset_id,
       a.name AS asset_name,
       a.hostname AS asset_hostname,
       a.ip_address AS asset_ip,
       e.name AS environment_name
     FROM vulnerability_findings vf
     LEFT JOIN assets a ON a.id = vf.asset_id
     LEFT JOIN environments e ON e.id = a.environment_id
     WHERE vf.organization_id = $1
       AND vf.id = $2
     LIMIT 1`,
    [organizationId, vulnerabilityId]
  );

  if (findingResult.rows.length === 0) {
    throw new Error('Vulnerability finding not found');
  }

  const finding = findingResult.rows[0];

  const workflowResult = await pool.query(
    `SELECT
       vw.action_type,
       vw.action_status,
       vw.control_effect,
       vw.response_summary,
       vw.due_date,
       fc.control_id AS control_code,
       fc.title AS control_title,
       f.code AS framework_code,
       f.name AS framework_name,
       COALESCE(ci.status, 'not_started') AS implementation_status
     FROM vulnerability_control_work_items vw
     JOIN framework_controls fc ON fc.id = vw.framework_control_id
     JOIN frameworks f ON f.id = fc.framework_id
     LEFT JOIN control_implementations ci ON ci.id = vw.implementation_id
     WHERE vw.organization_id = $1
       AND vw.vulnerability_id = $2
     ORDER BY f.code, fc.control_id`,
    [organizationId, vulnerabilityId]
  );

  const poamResult = await pool.query(
    `SELECT
       id,
       title,
       status,
       priority,
       due_date,
       owner_id,
       remediation_plan
     FROM poam_items
     WHERE organization_id = $1
       AND vulnerability_id = $2
     ORDER BY created_at DESC
     LIMIT 5`,
    [organizationId, vulnerabilityId]
  );

  return chat({
    provider,
    model,
    organizationId,
    systemPrompt: GRC_SYSTEM + '\nFocus on practical remediation and control-closure actions for vulnerability findings.',
    messages: [{
      role: 'user',
      content: `Generate a vulnerability remediation and closure plan.

Vulnerability Finding:
${JSON.stringify(finding, null, 2)}

Related Control Workflow Items:
${JSON.stringify(workflowResult.rows, null, 2)}

Related POA&M Items:
${JSON.stringify(poamResult.rows, null, 2)}

Return:
1. Executive summary (risk + business impact)
2. Immediate containment actions (0-24h)
3. Remediation actions (patch/config/code/process) with owner roles and due dates
4. Control-closure impact: which controls can move to compliant, which remain partial
5. Required evidence artifacts for closure and audit defensibility
6. Residual risk statement and conditions for risk acceptance (if needed)
7. A JSON block:
{
  "finding_id": "${finding.id}",
  "priority": "low|medium|high|critical",
  "recommended_actions": [
    {
      "title": "...",
      "owner_role": "...",
      "target_days": 7,
      "evidence_required": ["..."],
      "mapped_controls": ["..."]
    }
  ],
  "closure_criteria": ["..."],
  "poam_update_suggestion": "..."
}`
    }]
  });
}

// =====================================================================
// 6. INCIDENT RESPONSE PLANS
// =====================================================================
async function generateIncidentResponsePlan({ organizationId, incidentType, provider, model }) {
  const assets = await pool.query(`
    SELECT a.name, a.hostname, a.ip_address, ac.code as category,
      a.criticality, a.security_classification, e.name as environment
    FROM assets a
    JOIN asset_categories ac ON ac.id = a.category_id
    LEFT JOIN environments e ON e.id = a.environment_id
    WHERE a.organization_id = $1 ORDER BY a.criticality LIMIT 50
  `, [organizationId]);

  return chat({
    provider, model, organizationId,
    systemPrompt: GRC_SYSTEM,
    messages: [{ role: 'user', content: `Generate an incident response plan for: ${incidentType || 'General cybersecurity incident'}

Organization Asset Inventory:
${JSON.stringify(assets.rows, null, 2)}

Generate a complete IR plan with:
1. Incident Classification & Severity Matrix
2. Detection & Identification procedures
3. Containment Strategy (short-term and long-term)
4. Eradication Steps
5. Recovery Procedures with asset-specific actions
6. Post-Incident Review checklist
7. Communication plan (internal stakeholders, regulators, affected parties)
8. Evidence preservation requirements
9. Regulatory notification requirements (GDPR 72hr, HIPAA, etc.)
10. Roles and responsibilities matrix` }]
  });
}

// =====================================================================
// 7. BOARD/EXECUTIVE REPORTS
// =====================================================================
async function generateExecutiveReport({ organizationId, provider, model }) {
  const stats = await pool.query(`
    SELECT f.code, f.name,
      COUNT(fc.id) as total,
      COUNT(ci.id) FILTER (WHERE ci.status = 'implemented') as implemented,
      COUNT(ci.id) FILTER (WHERE ci.status = 'in_progress') as in_progress,
      ROUND(COUNT(ci.id) FILTER (WHERE ci.status = 'implemented')::numeric / NULLIF(COUNT(fc.id),0) * 100, 1) as pct
    FROM organization_frameworks of2
    JOIN frameworks f ON f.id = of2.framework_id
    JOIN framework_controls fc ON fc.framework_id = f.id
    LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $1
    WHERE of2.organization_id = $1
    GROUP BY f.id, f.code, f.name ORDER BY f.name
  `, [organizationId]);

  const assetStats = await pool.query(`
    SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE criticality = 'critical') as critical,
      COUNT(*) FILTER (WHERE criticality = 'high') as high
    FROM assets WHERE organization_id = $1
  `, [organizationId]);

  return chat({
    provider, model, organizationId,
    systemPrompt: GRC_SYSTEM,
    messages: [{ role: 'user', content: `Generate a board-ready executive compliance report.

Compliance Status by Framework:
${JSON.stringify(stats.rows, null, 2)}

Asset Summary: ${JSON.stringify(assetStats.rows[0])}

Generate a professional executive report including:
1. Executive Summary (2-3 paragraphs, non-technical)
2. Overall Compliance Score with trend indicator
3. Framework-by-framework breakdown with RAG status (Red/Amber/Green)
4. Top 5 risks requiring board attention
5. Key achievements since last report
6. Resource requirements and budget considerations
7. Recommended board actions / decisions needed
8. 90-day outlook and next milestones` }]
  });
}

// =====================================================================
// 8. RISK HEATMAP
// =====================================================================
async function generateRiskHeatmap({ organizationId, provider, model }) {
  const assets = await pool.query(`
    SELECT a.name, ac.code as category, a.criticality, a.security_classification,
      a.status, e.name as environment
    FROM assets a
    JOIN asset_categories ac ON ac.id = a.category_id
    LEFT JOIN environments e ON e.id = a.environment_id
    WHERE a.organization_id = $1
  `, [organizationId]);

  const controlGaps = await pool.query(`
    SELECT f.code as framework, fc.control_id, fc.title, fc.priority
    FROM organization_frameworks of2
    JOIN frameworks f ON f.id = of2.framework_id
    JOIN framework_controls fc ON fc.framework_id = f.id
    LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $1
    WHERE of2.organization_id = $1 AND (ci.status IS NULL OR ci.status = 'not_started')
    AND fc.priority::int <= 2
    ORDER BY fc.priority LIMIT 50
  `, [organizationId]);

  return chat({
    provider, model, organizationId,
    systemPrompt: GRC_SYSTEM,
    messages: [{ role: 'user', content: `Generate a risk heatmap analysis.

Assets:
${JSON.stringify(assets.rows, null, 2)}

Priority 1-2 Control Gaps:
${JSON.stringify(controlGaps.rows, null, 2)}

Provide:
1. Risk matrix (Likelihood x Impact) with specific items placed in each cell
2. Top 10 highest risk items with scores and justification
3. Risk by category (assets, controls, processes)
4. Risk by environment (production vs staging vs dev)
5. Trend analysis and emerging risks
6. Risk acceptance recommendations vs mitigation priorities
7. Return data in a structured JSON section for heatmap visualization:
   { "heatmapData": [{ "item": "name", "likelihood": 1-5, "impact": 1-5, "category": "..." }] }` }]
  });
}

// =====================================================================
// 9. VENDOR RISK ASSESSMENT
// =====================================================================
async function assessVendorRisk({ organizationId, vendorInfo, provider, model }) {
  return chat({
    provider, model, organizationId,
    systemPrompt: GRC_SYSTEM,
    messages: [{ role: 'user', content: `Perform a third-party vendor risk assessment.

Vendor Information:
${JSON.stringify(vendorInfo, null, 2)}

Provide:
1. Overall vendor risk score (1-100) with justification
2. Risk breakdown by category:
   - Data security & privacy
   - Business continuity
   - Regulatory compliance
   - Financial stability
   - Operational resilience
3. Key risk factors identified
4. Required contractual controls
5. Recommended monitoring frequency
6. Questionnaire items to send to the vendor
7. Due diligence checklist
8. Compliance framework alignment (which controls does this vendor impact)` }]
  });
}

// =====================================================================
// 10. AUDIT READINESS SCORE
// =====================================================================
async function assessAuditReadiness({ organizationId, framework, provider, model }) {
  let fwFilter = '';
  const params = [organizationId];
  if (framework) {
    fwFilter = ' AND f.code = $2';
    params.push(framework);
  }

  const data = await pool.query(`
    SELECT f.code, f.name, fc.control_id, fc.title, fc.priority,
      COALESCE(ci.status, 'not_started') as status,
      ci.notes, ci.created_at as last_update
    FROM organization_frameworks of2
    JOIN frameworks f ON f.id = of2.framework_id
    JOIN framework_controls fc ON fc.framework_id = f.id
    LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $1
    WHERE of2.organization_id = $1${fwFilter}
    ORDER BY fc.priority, f.code
  `, params);

  const evidence = await pool.query(`
    SELECT COUNT(*) as total_evidence,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '90 days') as recent_evidence
    FROM evidence WHERE organization_id = $1
  `, [organizationId]);

  return chat({
    provider, model, organizationId,
    systemPrompt: GRC_SYSTEM,
    messages: [{ role: 'user', content: `Assess audit readiness${framework ? ' for ' + framework : ''}.

Control Status:
${JSON.stringify(data.rows.slice(0, 100), null, 2)}

Evidence Stats: ${JSON.stringify(evidence.rows[0])}

Provide:
1. Overall Audit Readiness Score (0-100) with letter grade
2. Category-by-category readiness breakdown
3. Items an auditor would flag as findings
4. Missing evidence gaps
5. Controls with stale documentation (>90 days since update)
6. Recommended pre-audit actions (prioritized checklist)
7. Estimated time to become audit-ready
8. Sample auditor questions and suggested responses` }]
  });
}

// =====================================================================
// 11. ASSET-TO-CONTROL MAPPING
// =====================================================================
async function mapAssetsToControls({ organizationId, provider, model }) {
  const assets = await pool.query(`
    SELECT a.id, a.name, ac.code as category, a.criticality,
      a.security_classification, a.hostname, a.cloud_provider,
      a.ai_model_type, a.ai_risk_level
    FROM assets a JOIN asset_categories ac ON ac.id = a.category_id
    WHERE a.organization_id = $1 ORDER BY a.criticality LIMIT 30
  `, [organizationId]);

  const frameworks = await pool.query(`
    SELECT f.code, f.name FROM organization_frameworks of2
    JOIN frameworks f ON f.id = of2.framework_id WHERE of2.organization_id = $1
  `, [organizationId]);

  return chat({
    provider, model, organizationId,
    systemPrompt: GRC_SYSTEM,
    messages: [{ role: 'user', content: `Map assets to applicable compliance controls.

Assets:
${JSON.stringify(assets.rows, null, 2)}

Adopted Frameworks: ${JSON.stringify(frameworks.rows)}

For each asset, identify:
1. Which framework controls directly apply to this asset type
2. Priority of each control-asset pairing (Critical/High/Medium/Low)
3. Any gaps where assets lack required controls
4. Recommended control implementations per asset category
5. Return structured mapping data:
   { "mappings": [{ "asset": "name", "controls": [{ "id": "XX-1", "framework": "code", "priority": "high", "reason": "..." }] }] }` }]
  });
}

// =====================================================================
// 12. SHADOW IT DETECTION
// =====================================================================
async function detectShadowIT({ organizationId, provider, model }) {
  const assets = await pool.query(`
    SELECT a.name, ac.code as category, a.hostname, a.ip_address, a.cloud_provider,
      a.status, a.security_classification, e.name as environment
    FROM assets a JOIN asset_categories ac ON ac.id = a.category_id
    LEFT JOIN environments e ON e.id = a.environment_id
    WHERE a.organization_id = $1
  `, [organizationId]);

  const controls = await pool.query(`
    SELECT f.code, fc.control_id, fc.title FROM organization_frameworks of2
    JOIN frameworks f ON f.id = of2.framework_id
    JOIN framework_controls fc ON fc.framework_id = f.id
    WHERE of2.organization_id = $1
    AND (fc.title ILIKE '%inventory%' OR fc.title ILIKE '%asset%' OR fc.title ILIKE '%configuration%')
  `, [organizationId]);

  return chat({
    provider, model, organizationId,
    systemPrompt: GRC_SYSTEM,
    messages: [{ role: 'user', content: `Analyze asset inventory for potential Shadow IT gaps.

Registered Assets:
${JSON.stringify(assets.rows, null, 2)}

Asset-related Controls:
${JSON.stringify(controls.rows, null, 2)}

Analyze and provide:
1. Categories of assets that are typically present but missing from inventory
2. Common Shadow IT patterns based on the current asset profile
3. Specific asset types that should be investigated
4. Questions to ask department heads about undocumented systems
5. Automated discovery recommendations (tools and techniques)
6. Risk exposure from potential unregistered assets
7. Compliance impact of Shadow IT on adopted frameworks` }]
  });
}

// =====================================================================
// 13. AI/ML MODEL GOVERNANCE CHECKS
// =====================================================================
async function checkAIGovernance({ organizationId, provider, model }) {
  const aiAssets = await pool.query(`
    SELECT a.name, a.ai_model_type, a.ai_risk_level, a.ai_training_data_source,
      a.ai_bias_testing_completed, a.ai_bias_testing_date, a.ai_human_oversight_required,
      a.status, a.version
    FROM assets a JOIN asset_categories ac ON ac.id = a.category_id
    WHERE a.organization_id = $1 AND ac.code = 'ai_agent'
  `, [organizationId]);

  const aiControls = await pool.query(`
    SELECT f.code, f.name, fc.control_id, fc.title, COALESCE(ci.status, 'not_started') as status
    FROM organization_frameworks of2
    JOIN frameworks f ON f.id = of2.framework_id
    JOIN framework_controls fc ON fc.framework_id = f.id
    LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $1
    WHERE of2.organization_id = $1
    AND f.code IN ('eu_ai_act', 'nist_ai_rmf', 'iso_42001', 'iso_42005')
  `, [organizationId]);

  return chat({
    provider, model, organizationId,
    systemPrompt: GRC_SYSTEM,
    messages: [{ role: 'user', content: `Perform AI/ML model governance assessment.

AI Assets:
${JSON.stringify(aiAssets.rows, null, 2)}

AI Governance Controls:
${JSON.stringify(aiControls.rows, null, 2)}

Assess:
1. EU AI Act compliance status per AI asset (risk classification, conformity assessment)
2. NIST AI RMF alignment check
3. ISO/IEC 42001 AI management system alignment (governance and operational controls)
4. ISO/IEC 42005 AI system impact assessment coverage
5. Bias testing gaps and recommendations
6. Data governance status for training data
7. Human oversight requirements vs current implementation
8. Model documentation completeness
9. Transparency and explainability gaps
10. Recommended governance actions prioritized by risk level` }]
  });
}

// =====================================================================
// 14. NATURAL LANGUAGE COMPLIANCE QUERY
// =====================================================================
async function queryCompliance({ organizationId, question, provider, model }) {
  const stats = await pool.query(`
    SELECT f.code, f.name,
      COUNT(fc.id) as total, COUNT(ci.id) FILTER (WHERE ci.status = 'implemented') as implemented,
      ROUND(COUNT(ci.id) FILTER (WHERE ci.status = 'implemented')::numeric / NULLIF(COUNT(fc.id),0) * 100, 1) as pct
    FROM organization_frameworks of2
    JOIN frameworks f ON f.id = of2.framework_id
    JOIN framework_controls fc ON fc.framework_id = f.id
    LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $1
    WHERE of2.organization_id = $1 GROUP BY f.id, f.code, f.name
  `, [organizationId]);

  const assetCount = await pool.query('SELECT COUNT(*) as count FROM assets WHERE organization_id = $1', [organizationId]);
  const evidenceCount = await pool.query('SELECT COUNT(*) as count FROM evidence WHERE organization_id = $1', [organizationId]);

  return chat({
    provider, model, organizationId,
    systemPrompt: GRC_SYSTEM + `\nAnswer the user's compliance question based on their actual data. Be specific and cite numbers.`,
    messages: [{ role: 'user', content: `Question: ${question}

Organization Data:
- Framework Compliance: ${JSON.stringify(stats.rows)}
- Total Assets: ${assetCount.rows[0].count}
- Total Evidence: ${evidenceCount.rows[0].count}

Answer the question thoroughly based on this data.` }]
  });
}

// =====================================================================
// 15. TRAINING RECOMMENDATIONS
// =====================================================================
async function recommendTraining({ organizationId, provider, model }) {
  const gaps = await pool.query(`
    SELECT f.code, fc.control_id, fc.title, fc.priority
    FROM organization_frameworks of2
    JOIN frameworks f ON f.id = of2.framework_id
    JOIN framework_controls fc ON fc.framework_id = f.id
    LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $1
    WHERE of2.organization_id = $1 AND (ci.status IS NULL OR ci.status = 'not_started')
    ORDER BY fc.priority LIMIT 50
  `, [organizationId]);

  return chat({
    provider, model, organizationId,
    systemPrompt: GRC_SYSTEM,
    messages: [{ role: 'user', content: `Recommend security awareness training based on compliance gaps.

Unimplemented Controls:
${JSON.stringify(gaps.rows, null, 2)}

Provide:
1. Priority training topics based on gaps (ranked)
2. Target audience for each topic (IT, management, all staff, developers)
3. Recommended training format (online, hands-on, workshop)
4. Suggested training providers/resources
5. Training schedule recommendation
6. How each training topic maps to specific control gaps
7. KPIs to measure training effectiveness` }]
  });
}

// =====================================================================
// 16. EVIDENCE COLLECTION ASSISTANT
// =====================================================================
async function suggestEvidence({ controlId, organizationId, provider, model }) {
  const control = await pool.query(`
    SELECT fc.*, f.code as framework_code, f.name as framework_name
    FROM framework_controls fc JOIN frameworks f ON f.id = fc.framework_id WHERE fc.id = $1
  `, [controlId]);

  if (control.rows.length === 0) throw new Error('Control not found');

  return chat({
    provider, model, organizationId,
    systemPrompt: GRC_SYSTEM,
    messages: [{ role: 'user', content: `Suggest evidence artifacts for this control.

Control: ${JSON.stringify(control.rows[0], null, 2)}

Provide:
1. Required evidence artifacts (what an auditor expects)
2. Acceptable evidence formats (screenshots, exports, policies, etc.)
3. Evidence collection procedures step-by-step
4. Template outlines for any documents needed
5. Automation opportunities for evidence collection
6. Evidence freshness requirements (how often to update)
7. Common mistakes that make evidence insufficient` }]
  });
}

// =====================================================================
// BONUS: CONTROL ANALYSIS (existing feature)
// =====================================================================
async function analyzeControl({ controlId, organizationId, provider, model }) {
  const control = await pool.query(`
    SELECT fc.*, f.code as framework_code, f.name as framework_name,
      COALESCE(ci.status, 'not_started') as impl_status
    FROM framework_controls fc
    JOIN frameworks f ON f.id = fc.framework_id
    LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $1
    WHERE fc.id = $2
  `, [organizationId, controlId]);

  if (control.rows.length === 0) throw new Error('Control not found');

  return chat({
    provider, model, organizationId,
    systemPrompt: GRC_SYSTEM,
    messages: [{ role: 'user', content: `Analyze this control and provide implementation guidance.

Control: ${JSON.stringify(control.rows[0], null, 2)}

Provide:
1. Plain-English explanation of what this control requires
2. Implementation approach for a mid-size organization
3. Technical vs procedural requirements
4. Estimated implementation effort
5. Key evidence artifacts needed
6. Related controls and dependencies` }]
  });
}

// =====================================================================
// BONUS: GENERATE TEST PROCEDURES
// =====================================================================
async function generateTestProcedures({ controlId, organizationId, provider, model }) {
  const control = await pool.query(`
    SELECT fc.*, f.code as framework_code FROM framework_controls fc
    JOIN frameworks f ON f.id = fc.framework_id WHERE fc.id = $1
  `, [controlId]);

  if (control.rows.length === 0) throw new Error('Control not found');

  return chat({
    provider, model, organizationId,
    systemPrompt: GRC_SYSTEM,
    messages: [{ role: 'user', content: `Generate test procedures for this control.

Control: ${JSON.stringify(control.rows[0], null, 2)}

Provide:
1. Test objective
2. Test steps (numbered, detailed)
3. Expected results for pass/fail
4. Sample sizes and frequency
5. Automation scripts where applicable
6. Evidence to collect during testing` }]
  });
}

// =====================================================================
// BONUS: ASSET RISK ANALYSIS
// =====================================================================
async function analyzeAssetRisk({ assetId, organizationId, provider, model }) {
  const asset = await pool.query(`
    SELECT a.*, ac.name as category_name, ac.code as category_code, e.name as environment_name
    FROM assets a JOIN asset_categories ac ON ac.id = a.category_id
    LEFT JOIN environments e ON e.id = a.environment_id
    WHERE a.id = $1 AND a.organization_id = $2
  `, [assetId, organizationId]);

  if (asset.rows.length === 0) throw new Error('Asset not found');

  return chat({
    provider, model, organizationId,
    systemPrompt: GRC_SYSTEM,
    messages: [{ role: 'user', content: `Perform a risk analysis on this asset.

Asset: ${JSON.stringify(asset.rows[0], null, 2)}

Provide:
1. Risk score (1-100) with justification
2. Threat vectors specific to this asset type
3. Vulnerability assessment areas
4. Compliance requirements (which frameworks apply)
5. Recommended security controls
6. Monitoring recommendations` }]
  });
}

// =====================================================================
// BONUS: POLICY GENERATOR
// =====================================================================
async function generatePolicy({ policyType, organizationId, provider, model }) {
  const frameworks = await pool.query(`
    SELECT f.code, f.name FROM organization_frameworks of2
    JOIN frameworks f ON f.id = of2.framework_id WHERE of2.organization_id = $1
  `, [organizationId]);

  return chat({
    provider, model, organizationId, maxTokens: 8192,
    systemPrompt: GRC_SYSTEM,
    messages: [{ role: 'user', content: `Generate a comprehensive ${policyType} policy document.

Adopted Frameworks: ${JSON.stringify(frameworks.rows)}

Generate a complete, professional policy including:
1. Policy title, version, effective date placeholders
2. Purpose and scope
3. Policy statements (specific, actionable)
4. Roles and responsibilities
5. Procedures and standards
6. Compliance and enforcement
7. Related policies and references
8. Revision history template
Map requirements to the organization's adopted frameworks where applicable.` }]
  });
}

// =====================================================================
// AUDITOR AI: PBC REQUEST DRAFTING
// =====================================================================
async function generateAuditPbcDraft({
  organizationId,
  provider,
  model,
  requestContext,
  controlId,
  frameworkCode,
  dueDate,
  priority,
  templateStandard
}) {
  if (!requestContext || !String(requestContext).trim()) {
    throw new Error('requestContext is required');
  }

  let control = null;
  if (controlId) {
    const controlResult = await pool.query(`
      SELECT fc.control_id, fc.title, fc.description, f.code as framework_code, f.name as framework_name
      FROM framework_controls fc
      JOIN frameworks f ON f.id = fc.framework_id
      WHERE fc.id = $1
      LIMIT 1
    `, [controlId]);
    control = controlResult.rows[0] || null;
  }

  const recentResults = await pool.query(`
    SELECT ar.status, ar.risk_level, ar.finding, ar.evidence_collected,
      ap.procedure_id, ap.title AS procedure_title, fc.control_id, f.code AS framework_code
    FROM assessment_results ar
    JOIN assessment_procedures ap ON ap.id = ar.assessment_procedure_id
    JOIN framework_controls fc ON fc.id = ap.framework_control_id
    JOIN frameworks f ON f.id = fc.framework_id
    WHERE ar.organization_id = $1
    ORDER BY COALESCE(ar.assessed_at, ar.updated_at, ar.created_at) DESC
    LIMIT 20
  `, [organizationId]);

  return chat({
    provider,
    model,
    organizationId,
    systemPrompt: GRC_SYSTEM + '\nYou are helping an auditor draft request-for-evidence (PBC) items.',
    messages: [{
      role: 'user',
      content: `Draft a high-quality PBC (Provided By Client) request that is auditor-ready.

Audit Request Context:
${requestContext}

Optional Metadata:
- frameworkCode: ${frameworkCode || 'not provided'}
- controlId: ${controlId || 'not provided'}
- dueDate: ${dueDate || 'not provided'}
- priority: ${priority || 'not provided'}

Template Standard (follow this structure and tone when provided):
${templateStandard || 'No custom template provided.'}

Control Context (if available):
${JSON.stringify(control, null, 2)}

Recent Assessment Context:
${JSON.stringify(recentResults.rows, null, 2)}

Return:
1. PBC request title
2. Exact artifacts requested (bulleted list)
3. Period covered and sampling expectations
4. Acceptance criteria (what makes evidence sufficient)
5. Follow-up questions if evidence is incomplete
6. A JSON block:
{
  "title": "...",
  "request_details": "...",
  "requested_artifacts": ["..."],
  "acceptance_criteria": ["..."],
  "suggested_due_date": "${dueDate || ''}",
  "priority": "${priority || 'medium'}"
}`
    }]
  });
}

// =====================================================================
// AUDITOR AI: WORKPAPER DRAFTING
// =====================================================================
async function generateAuditWorkpaperDraft({
  organizationId,
  provider,
  model,
  controlId,
  objective,
  procedurePerformed,
  evidenceSummary,
  testOutcome,
  templateStandard
}) {
  if (!objective || !String(objective).trim()) {
    throw new Error('objective is required');
  }

  let control = null;
  if (controlId) {
    const controlResult = await pool.query(`
      SELECT fc.control_id, fc.title, fc.description, f.code as framework_code, f.name as framework_name
      FROM framework_controls fc
      JOIN frameworks f ON f.id = fc.framework_id
      WHERE fc.id = $1
      LIMIT 1
    `, [controlId]);
    control = controlResult.rows[0] || null;
  }

  return chat({
    provider,
    model,
    organizationId,
    systemPrompt: GRC_SYSTEM + '\nYou are helping an auditor draft formal workpaper narratives.',
    messages: [{
      role: 'user',
      content: `Draft an auditor workpaper narrative.

Control Context:
${JSON.stringify(control, null, 2)}

Inputs:
- Objective: ${objective}
- Procedure Performed: ${procedurePerformed || 'not provided'}
- Evidence Summary: ${evidenceSummary || 'not provided'}
- Test Outcome: ${testOutcome || 'not provided'}

Template Standard (follow this structure and tone when provided):
${templateStandard || 'No custom template provided.'}

Return:
1. Workpaper title
2. Objective section
3. Scope and sampling section
4. Procedure performed (auditor-style narrative)
5. Results and exceptions
6. Conclusion with alignment to control intent
7. Reviewer checklist
8. A JSON block:
{
  "title": "...",
  "objective": "...",
  "procedure_performed": "...",
  "conclusion": "...",
  "status_recommendation": "draft|in_review|finalized"
}`
    }]
  });
}

// =====================================================================
// AUDITOR AI: FINDING DRAFTING
// =====================================================================
async function generateAuditFindingDraft({
  organizationId,
  provider,
  model,
  controlId,
  issueSummary,
  evidenceSummary,
  severityHint,
  recommendationScope,
  templateStandard
}) {
  if (!issueSummary || !String(issueSummary).trim()) {
    throw new Error('issueSummary is required');
  }

  let control = null;
  if (controlId) {
    const controlResult = await pool.query(`
      SELECT fc.control_id, fc.title, fc.description, f.code as framework_code, f.name as framework_name
      FROM framework_controls fc
      JOIN frameworks f ON f.id = fc.framework_id
      WHERE fc.id = $1
      LIMIT 1
    `, [controlId]);
    control = controlResult.rows[0] || null;
  }

  const peerFindings = await pool.query(`
    SELECT status, risk_level, finding
    FROM assessment_results
    WHERE organization_id = $1
      AND status = 'other_than_satisfied'
      AND finding IS NOT NULL
    ORDER BY COALESCE(assessed_at, updated_at, created_at) DESC
    LIMIT 10
  `, [organizationId]);

  return chat({
    provider,
    model,
    organizationId,
    systemPrompt: GRC_SYSTEM + '\nYou are helping an auditor draft findings using observation/criteria/cause/effect format.',
    messages: [{
      role: 'user',
      content: `Draft a formal audit finding.

Control Context:
${JSON.stringify(control, null, 2)}

Inputs:
- Issue Summary: ${issueSummary}
- Evidence Summary: ${evidenceSummary || 'not provided'}
- Severity Hint: ${severityHint || 'not provided'}
- Recommendation Scope: ${recommendationScope || 'not provided'}

Template Standard (follow this structure and tone when provided):
${templateStandard || 'No custom template provided.'}

Recent Comparable Findings:
${JSON.stringify(peerFindings.rows, null, 2)}

Return:
1. Finding title
2. Observation
3. Criteria (control / framework expectation)
4. Cause
5. Effect / risk impact
6. Recommendation (practical and testable)
7. Suggested management response prompt
8. A JSON block:
{
  "title": "...",
  "description": "...",
  "severity": "low|medium|high|critical",
  "recommendation": "...",
  "management_response_prompt": "...",
  "validation_steps": ["..."]
}`
    }]
  });
}

// ---------- Usage tracking ----------
async function logAIUsage(organizationId, userId, feature, provider, model) {
  await pool.query(`
    INSERT INTO ai_usage_log (organization_id, user_id, feature, provider, model, created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
  `, [organizationId, userId, feature, provider, model]);
}

async function getUsageCount(organizationId) {
  const result = await pool.query(`
    SELECT COUNT(*) as count FROM ai_usage_log
    WHERE organization_id = $1 AND created_at >= DATE_TRUNC('month', NOW())
  `, [organizationId]);
  return parseInt(result.rows[0].count);
}

function getUsageLimit(tier) {
  return getAiUsageLimit(tier);
}

// ---------- Provider status ----------
function getProviderStatus(orgKeys = {}) {
  return {
    claude: { available: !!(defaultAnthropicClient || orgKeys.claude), models: PROVIDERS.claude.models },
    openai: { available: !!(defaultOpenAIClient || orgKeys.openai), models: PROVIDERS.openai.models },
    gemini: { available: !!(defaultGeminiApiKey || orgKeys.gemini), models: PROVIDERS.gemini.models },
    grok: { available: !!(defaultXAIClient || orgKeys.grok), models: PROVIDERS.grok.models }
  };
}

module.exports = {
  chat,
  generateGapAnalysis,
  optimizeCrosswalk,
  forecastCompliance,
  monitorRegulatoryChanges,
  generateRemediationPlaybook,
  generateVulnerabilityRemediation,
  generateIncidentResponsePlan,
  generateExecutiveReport,
  generateRiskHeatmap,
  assessVendorRisk,
  assessAuditReadiness,
  mapAssetsToControls,
  detectShadowIT,
  checkAIGovernance,
  queryCompliance,
  recommendTraining,
  suggestEvidence,
  analyzeControl,
  generateTestProcedures,
  analyzeAssetRisk,
  generatePolicy,
  generateAuditPbcDraft,
  generateAuditWorkpaperDraft,
  generateAuditFindingDraft,
  logAIUsage,
  getUsageCount,
  getUsageLimit,
  getProviderStatus,
  getOrgApiKey,
  PROVIDERS
};
