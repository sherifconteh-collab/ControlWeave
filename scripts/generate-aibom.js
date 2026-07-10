#!/usr/bin/env node
/**
 * AIBOM (AI Bill of Materials) Generator for ControlWeave
 *
 * Generates an AI Bill of Materials documenting all AI/ML dependencies,
 * models, and services used in the ControlWeave platform.
 *
 * The provider/model inventory (components + aiModels) is derived directly
 * from controlweave/backend/src/services/ai/providerConfig.js (PROVIDERS) —
 * the real source of truth the LLM service resolves models from — instead of
 * a hardcoded parallel copy that could drift out of sync with the actual
 * integration. Only the curated prose (usage, data-access, privacy notes,
 * risks/mitigations) stays hand-authored, keyed by the same provider ids, so
 * a provider removed from providerConfig.js disappears from the AIBOM
 * automatically.
 *
 * Output format follows emerging AIBOM standards and best practices.
 *
 * SDK-backed vs. service-only providers are deliberately NOT both emitted as
 * top-level `components`: only claude/openai are real npm dependencies
 * physically shipped in package.json/node_modules. gemini/grok/groq/ollama
 * have no SDK at all — they're called over plain HTTP if and only if an
 * operator supplies a BYOK key for them — so they're modeled as CycloneDX
 * `services` (external things the software can call, not things it embeds),
 * alongside this file's existing internal AI Copilot/Analysis service
 * entries. Every provider here reflects supported integration surface in the
 * code, not runtime usage by any given deployment — a build-time SBOM has no
 * visibility into which providers an operator has actually configured a key
 * for.
 */

const fs = require('fs');
const path = require('path');
const { PROVIDERS } = require('../controlweave/backend/src/services/ai/providerConfig');

// Curated metadata per provider id — the descriptive content code doesn't
// naturally expose. Only providers present in PROVIDERS are ever emitted.
const PROVIDER_METADATA = {
  claude: {
    type: 'library',
    sdk_dep: '@anthropic-ai/sdk',
    purl: 'pkg:npm/%40anthropic-ai/sdk',
    supplier: 'Anthropic',
    description: 'Anthropic Claude AI SDK - Large Language Model API',
    usage: 'Compliance analysis, gap detection, remediation guidance',
    dataAccess: 'User-provided compliance data, control descriptions',
    privacy: 'BYOK - customer manages API keys and data',
    architecture: 'Transformer',
    modelUsage: 'Primary model for complex compliance analysis and remediation planning',
    limitationsNote: 'Requires API key, rate limits apply',
    risks: [
      'Hallucination risk in factual compliance requirements',
      'Requires human review of all AI-generated content',
      'API availability dependency',
    ],
    mitigations: [
      "All AI outputs marked as 'AI-generated - requires review'",
      'Results validated against actual framework requirements',
      'Fallback to alternative providers on failure',
    ],
  },
  openai: {
    type: 'library',
    sdk_dep: 'openai',
    purl: 'pkg:npm/openai',
    supplier: 'OpenAI',
    description: 'OpenAI API SDK - GPT Language Models',
    usage: 'AI Copilot, compliance Q&A, policy generation',
    dataAccess: 'Organization context, controls, evidence metadata',
    privacy: 'BYOK - customer manages API keys and data',
    architecture: 'Transformer',
    modelUsage: 'AI Copilot and general-purpose compliance Q&A',
    limitationsNote: 'Requires API key, rate limits apply',
    risks: [
      'Hallucination risk in factual compliance requirements',
      'Requires human review of all AI-generated content',
      'API availability dependency',
    ],
    mitigations: [
      "All AI outputs marked as 'AI-generated - requires review'",
      'Results validated against actual framework requirements',
      'Fallback to alternative providers on failure',
    ],
  },
  gemini: {
    type: 'service',
    supplier: 'Google',
    description: 'Google Gemini Large Language Model API',
    endpoint: 'https://generativelanguage.googleapis.com',
    usage: 'Risk analysis, vulnerability remediation, audit preparation',
    dataAccess: 'CMDB assets, vulnerability data, compliance posture',
    privacy: 'BYOK - customer manages API keys and data',
    architecture: 'Transformer',
    modelUsage: 'Multi-modal analysis including document parsing and evidence analysis',
    limitationsNote: 'Requires API key, rate limits apply',
    risks: [
      'Hallucination risk in factual compliance requirements',
      'Requires human review of all AI-generated content',
      'API availability dependency',
    ],
    mitigations: [
      "All AI outputs marked as 'AI-generated - requires review'",
      'Results validated against actual framework requirements',
      'Fallback to alternative providers on failure',
    ],
  },
  grok: {
    type: 'service',
    supplier: 'xAI',
    description: 'xAI Grok Large Language Model API',
    endpoint: 'https://api.x.ai',
    usage: 'Compliance forecasting, executive reporting',
    dataAccess: 'Aggregated compliance metrics, control health',
    privacy: 'BYOK - customer manages API keys and data',
    architecture: 'Transformer',
    modelUsage: 'Compliance forecasting and executive reporting',
    limitationsNote: 'Requires API key, rate limits apply',
    risks: [
      'Hallucination risk in factual compliance requirements',
      'Requires human review of all AI-generated content',
      'API availability dependency',
    ],
    mitigations: [
      "All AI outputs marked as 'AI-generated - requires review'",
      'Results validated against actual framework requirements',
      'Fallback to alternative providers on failure',
    ],
  },
  groq: {
    type: 'service',
    supplier: 'Groq',
    description: 'Groq Fast Inference API for LLMs',
    endpoint: 'https://api.groq.com',
    usage: 'Real-time AI Copilot responses, quick analysis',
    dataAccess: 'Page context, user queries',
    privacy: 'BYOK - customer manages API keys and data',
    architecture: 'Transformer',
    modelUsage: 'Real-time AI Copilot responses and quick analysis',
    limitationsNote: 'Requires API key, subject to Groq hosted catalogue availability',
    risks: [
      'Hallucination risk in factual compliance requirements',
      'Requires human review of all AI-generated content',
      'API availability dependency',
    ],
    mitigations: [
      "All AI outputs marked as 'AI-generated - requires review'",
      'Results validated against actual framework requirements',
      'Fallback to alternative providers on failure',
    ],
  },
  ollama: {
    type: 'service',
    supplier: 'Ollama (Self-hosted)',
    description: 'Self-hosted local LLM service',
    endpoint: 'http://localhost:11434 (configurable)',
    usage: 'Air-gapped deployments, privacy-sensitive analysis',
    dataAccess: 'All data stays local - no external transmission',
    privacy: 'Fully private - no API keys, all processing on-premises',
    architecture: 'Transformer',
    modelUsage: 'Air-gapped / privacy-sensitive on-premises analysis',
    limitationsNote: 'Requires operator to run a local Ollama server; performance depends on operator hardware',
    risks: [
      'Hallucination risk in factual compliance requirements',
      'Requires human review of all AI-generated content',
      'No vendor SLA - operator-hosted',
    ],
    mitigations: [
      "All AI outputs marked as 'AI-generated - requires review'",
      'Results validated against actual framework requirements',
    ],
  },
};

function buildProviderProperties(id, provider, meta) {
  const properties = [
    { name: 'ai:provider', value: meta.supplier },
    { name: 'ai:type', value: meta.type === 'library' ? 'LLM SDK' : (id === 'ollama' ? 'Local LLM' : 'LLM API') },
    { name: 'ai:models', value: provider.models.join(', ') },
    { name: 'ai:usage', value: meta.usage },
    { name: 'ai:data-access', value: meta.dataAccess },
    { name: 'ai:privacy', value: meta.privacy },
  ];
  if (meta.endpoint) {
    properties.splice(4, 0, { name: 'ai:endpoint', value: meta.endpoint });
  }
  return properties;
}

// Only providers with a real npm SDK dependency are "components" (material
// actually bundled with the application, per CycloneDX's `component.type`
// spec — which has no "service" type). Providers reachable only over plain
// HTTP have no shipped artifact and belong in `buildAiProviderServices()`
// instead, in CycloneDX's dedicated top-level `services` array.
function buildComponents() {
  const components = [];
  for (const [id, provider] of Object.entries(PROVIDERS)) {
    const meta = PROVIDER_METADATA[id];
    if (!meta || meta.type !== 'library') continue;
    components.push({
      type: 'library',
      name: meta.sdk_dep,
      version: getPackageVersion('controlweave/backend/package.json', meta.sdk_dep),
      description: meta.description,
      purl: meta.purl,
      properties: buildProviderProperties(id, provider, meta),
    });
  }
  return components;
}

function buildAiProviderServices() {
  const services = [];
  for (const [id, provider] of Object.entries(PROVIDERS)) {
    const meta = PROVIDER_METADATA[id];
    if (!meta) {
      console.warn(`Warning: no curated AIBOM metadata for provider "${id}" — omitted from AIBOM`);
      continue;
    }
    if (meta.type === 'library') continue;
    services.push({
      name: provider.name,
      description: meta.description,
      provider: { name: meta.supplier },
      endpoints: meta.endpoint ? [meta.endpoint] : [],
      data: [{ flow: 'bi-directional', classification: meta.dataAccess }],
      properties: [
        ...buildProviderProperties(id, provider, meta),
        { name: 'ai:integration', value: 'HTTP API (no bundled SDK) — BYOK, opt-in per organization' },
      ],
    });
  }
  return services;
}

function buildAiModels() {
  return Object.entries(PROVIDERS)
    .filter(([id]) => PROVIDER_METADATA[id])
    .map(([id, provider]) => {
      const meta = PROVIDER_METADATA[id];
      return {
        name: provider.name,
        version: provider.models.join(', '),
        provider: meta.supplier,
        type: 'Large Language Model',
        architecture: meta.architecture,
        usage: meta.modelUsage,
        trainingData: 'Not disclosed by provider',
        limitations: meta.limitationsNote,
        risks: meta.risks,
        mitigations: meta.mitigations,
      };
    });
}

// AI/ML Dependencies in ControlWeave
const aiBom = {
  "$schema": "https://cyclonedx.org/schema/bom-1.5.schema.json",
  "bomFormat": "CycloneDX",
  "specVersion": "1.5",
  "serialNumber": `urn:uuid:${generateUUID()}`,
  "version": 1,
  "metadata": {
    "timestamp": new Date().toISOString(),
    "tools": [
      {
        "vendor": "ControlWeave",
        "name": "AIBOM Generator",
        "version": "2.0.0"
      }
    ],
    "component": {
      "type": "application",
      "name": "ControlWeave GRC Platform",
      "version": "1.0.0",
      "description": "AI-powered Governance, Risk, and Compliance platform"
    },
    "properties": [
      { "name": "ControlWeave:ai-integration", "value": "BYOK (Bring Your Own Key)" },
      {
        "name": "ControlWeave:ai-integration-note",
        "value": "All AI providers listed here are opt-in, BYOK integrations disabled until an operator supplies an API key. This AIBOM reflects the code's supported AI integration surface, not which providers any given deployment has actually configured or is actively using at runtime."
      },
      { "name": "ControlWeave:ai-sdk-providers", "value": Object.keys(PROVIDERS).filter((id) => PROVIDER_METADATA[id]?.type === 'library').join(',') || 'none' },
      { "name": "ControlWeave:ai-service-providers", "value": Object.keys(PROVIDERS).filter((id) => PROVIDER_METADATA[id] && PROVIDER_METADATA[id].type !== 'library').join(',') || 'none' }
    ]
  },
  "components": buildComponents(),
  "services": [
    {
      "name": "AI Copilot Service",
      "description": "Organization-aware conversational AI assistant",
      "endpoints": [
        "/api/v1/ai/copilot/chat"
      ],
      "properties": [
        { "name": "ai:capability", "value": "Conversational Q&A" },
        { "name": "ai:context", "value": "Organization frameworks, controls, evidence, posture" },
        { "name": "ai:memory", "value": "Last 20 messages per organization" },
        { "name": "ai:features", "value": "Context-aware responses, quick actions, page awareness" }
      ]
    },
    {
      "name": "AI Analysis Services",
      "description": "25+ AI-powered compliance analysis features",
      "endpoints": [
        "/api/v1/ai/analyze",
        "/api/v1/ai/compliance-forecast",
        "/api/v1/ai/gap-analysis",
        "/api/v1/ai/remediation-plan",
        "/api/v1/ai/risk-assessment"
      ],
      "properties": [
        { "name": "ai:capabilities", "value": "Gap analysis, risk heatmaps, remediation planning, audit preparation" },
        { "name": "ai:features", "value": "25+ analysis types" },
        { "name": "ai:customization", "value": "Per-organization LLM provider and model selection" }
      ]
    },
    ...buildAiProviderServices()
  ],
  "aiModels": buildAiModels(),
  "dataFlows": [
    {
      "name": "AI Analysis Flow",
      "source": "User Input + Organization Context",
      "destination": "Selected LLM Provider API",
      "dataTypes": [
        "Control descriptions",
        "Evidence metadata",
        "Compliance posture data",
        "User queries"
      ],
      "securityControls": [
        "TLS 1.3 encryption in transit",
        "No PII transmitted unless explicitly included by user",
        "BYOK - customer controls API keys and provider selection",
        "Data retention controlled by provider's policies"
      ]
    },
    {
      "name": "AI Copilot Flow",
      "source": "User Chat + Page Context",
      "destination": "Selected LLM Provider API",
      "dataTypes": [
        "User messages",
        "Page context (controls, assessments, etc.)",
        "Organization metadata"
      ],
      "securityControls": [
        "TLS 1.3 encryption in transit",
        "Chat history stored in PostgreSQL (not sent to AI providers)",
        "Context limited to current page and recent conversation",
        "User can clear chat history anytime"
      ]
    }
  ],
  "complianceControls": {
    "NIST_AI_RMF": {
      "status": "Implemented",
      "controls": [
        "GOVERN-1: Policies and practices are in place to address AI risks",
        "GOVERN-3: Workforce diversity and AI expertise are prioritized",
        "MAP-1: Context is established for AI system operation",
        "MEASURE-2: AI system performance is tracked and documented",
        "MANAGE-1: AI risks are monitored and managed"
      ]
    },
    "EU_AI_Act": {
      "status": "Compliance in progress",
      "riskLevel": "Limited Risk",
      "notes": "ControlWeave uses LLMs for decision support only, not automated decision-making"
    },
    "OWASP_LLM_Top_10": {
      "status": "Controls implemented",
      "mitigations": [
        "LLM01: Input validation and sanitization",
        "LLM02: Output validation and human review required",
        "LLM03: No training data poisoning risk (using commercial APIs)",
        "LLM06: Sensitive information disclosure - filtered in prompts",
        "LLM07: Insecure plugin design - N/A, no plugins used"
      ]
    }
  }
};

/**
 * Generate a simple UUID v4
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get package version from package.json
 */
function getPackageVersion(packageJsonPath, packageName) {
  try {
    const fullPath = path.join(__dirname, '..', packageJsonPath);
    const packageJson = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    return packageJson.dependencies[packageName] || packageJson.devDependencies[packageName] || 'unknown';
  } catch (error) {
    console.warn(`Warning: Could not read version for ${packageName} from ${packageJsonPath}`);
    return 'unknown';
  }
}

/**
 * Main function
 */
function main() {
  try {
    // Write AIBOM to file
    const outputPath = path.join(__dirname, '..', 'aibom.json');
    fs.writeFileSync(outputPath, JSON.stringify(aiBom, null, 2));
    console.log(`✅ AIBOM generated successfully: ${outputPath}`);

    // Generate human-readable summary
    const summaryPath = path.join(__dirname, '..', 'AIBOM-SUMMARY.md');
    const summary = generateMarkdownSummary(aiBom);
    fs.writeFileSync(summaryPath, summary);
    console.log(`✅ AIBOM summary generated: ${summaryPath}`);

    // Print summary to console
    console.log('\n' + '='.repeat(80));
    console.log('AI BILL OF MATERIALS SUMMARY');
    console.log('='.repeat(80));
    console.log(`\nAI Components (bundled SDKs): ${aiBom.components.length}`);
    console.log(`AI Services (HTTP-only + internal): ${aiBom.services.length}`);
    console.log(`AI Models Documented: ${aiBom.aiModels.length}`);
    console.log(`Data Flows: ${aiBom.dataFlows.length}`);
    console.log('\nAI Providers (SDK-backed):');
    const sdkProviders = [...new Set(aiBom.components.map(c =>
      c.properties?.find(p => p.name === 'ai:provider')?.value
    ).filter(Boolean))];
    sdkProviders.forEach(p => console.log(`  - ${p}`));
    console.log('\nAI Providers (HTTP-only, BYOK):');
    const httpProviders = [...new Set(aiBom.services
      .filter(s => s.properties?.some(p => p.name === 'ai:models'))
      .map(s => s.properties?.find(p => p.name === 'ai:provider')?.value)
      .filter(Boolean))];
    httpProviders.forEach(p => console.log(`  - ${p}`));
    console.log('\n' + '='.repeat(80));

    return 0;
  } catch (error) {
    console.error('❌ Error generating AIBOM:', error.message);
    return 1;
  }
}

/**
 * Generate Markdown summary of AIBOM
 */
function generateMarkdownSummary(aibom) {
  let md = '# AI Bill of Materials (AIBOM) - ControlWeave\n\n';
  md += `Generated: ${new Date().toISOString()}\n\n`;
  md += '## Overview\n\n';
  md += 'ControlWeave is an AI-powered GRC platform that uses multiple Large Language Models (LLMs) ';
  md += 'to provide intelligent compliance analysis, gap detection, remediation guidance, and conversational AI assistance.\n\n';

  md += '## AI/ML Dependencies\n\n';
  md += 'Only providers with a real, shipped npm SDK dependency are counted as bundled ';
  md += '"components" below; providers reached only over plain HTTP have no shipped code ';
  md += 'and are listed separately under AI Service Endpoints. All providers are opt-in BYOK ';
  md += 'integrations, disabled until an operator supplies an API key — this AIBOM reflects ';
  md += 'supported integration surface, not per-deployment runtime usage.\n\n';
  md += '### LLM Provider SDKs\n\n';
  aibom.components.filter(c => c.type === 'library').forEach(comp => {
    md += `#### ${comp.name}\n`;
    md += `- **Version**: ${comp.version}\n`;
    md += `- **Description**: ${comp.description}\n`;
    const props = comp.properties || [];
    props.forEach(prop => {
      md += `- **${prop.name.replace('ai:', '')}**: ${prop.value}\n`;
    });
    md += '\n';
  });

  md += '### AI Service Endpoints\n\n';
  aibom.services.filter(svc => svc.properties?.some(p => p.name === 'ai:models')).forEach(svc => {
    md += `#### ${svc.name}\n`;
    md += `- **Description**: ${svc.description}\n`;
    const props = svc.properties || [];
    props.forEach(prop => {
      md += `- **${prop.name.replace('ai:', '')}**: ${prop.value}\n`;
    });
    md += '\n';
  });

  md += '## AI Models in Use\n\n';
  aibom.aiModels.forEach(model => {
    md += `### ${model.name}\n`;
    md += `- **Provider**: ${model.provider}\n`;
    md += `- **Version**: ${model.version}\n`;
    md += `- **Type**: ${model.type}\n`;
    md += `- **Usage**: ${model.usage}\n`;
    md += `- **Limitations**: ${model.limitations}\n`;
    md += '\n**Risks**:\n';
    model.risks.forEach(risk => md += `- ${risk}\n`);
    md += '\n**Mitigations**:\n';
    model.mitigations.forEach(mit => md += `- ${mit}\n`);
    md += '\n';
  });

  md += '## Data Flows\n\n';
  aibom.dataFlows.forEach(flow => {
    md += `### ${flow.name}\n`;
    md += `- **Source**: ${flow.source}\n`;
    md += `- **Destination**: ${flow.destination}\n`;
    md += `- **Data Types**: ${flow.dataTypes.join(', ')}\n`;
    md += '\n**Security Controls**:\n';
    flow.securityControls.forEach(ctrl => md += `- ${ctrl}\n`);
    md += '\n';
  });

  md += '## Compliance Controls\n\n';
  Object.keys(aibom.complianceControls).forEach(framework => {
    const ctrl = aibom.complianceControls[framework];
    md += `### ${framework.replace(/_/g, ' ')}\n`;
    md += `- **Status**: ${ctrl.status}\n`;
    if (ctrl.riskLevel) md += `- **Risk Level**: ${ctrl.riskLevel}\n`;
    if (ctrl.notes) md += `- **Notes**: ${ctrl.notes}\n`;
    if (ctrl.controls) {
      md += '\n**Implemented Controls**:\n';
      ctrl.controls.forEach(c => md += `- ${c}\n`);
    }
    if (ctrl.mitigations) {
      md += '\n**Mitigations**:\n';
      ctrl.mitigations.forEach(m => md += `- ${m}\n`);
    }
    md += '\n';
  });

  md += '## Privacy & Security Architecture\n\n';
  md += '### BYOK (Bring Your Own Key) Model\n';
  md += 'ControlWeave implements a BYOK architecture where:\n';
  md += '- Customers provide their own API keys for AI providers\n';
  md += '- ControlWeave never stores or has access to customer API keys beyond the encrypted database\n';
  md += '- Customers control which AI provider and model is used\n';
  md += '- Data transmitted to AI providers is limited to necessary context only\n';
  md += '- No PII is sent unless explicitly included by the user\n\n';

  md += '### Data Retention\n';
  md += '- Chat history stored in ControlWeave database (last 20 messages)\n';
  md += '- AI provider data retention follows provider policies\n';
  md += '- Users can clear chat history at any time\n';
  md += '- No long-term storage of AI responses beyond immediate display\n\n';

  md += '### Air-Gapped Deployments\n';
  md += '- Ollama support enables fully private, on-premises AI without external API calls\n';
  md += '- Suitable for classified or highly sensitive environments\n';
  md += '- All AI processing stays within customer infrastructure\n\n';

  return md;
}

// Run the script
if (require.main === module) {
  process.exit(main());
}

module.exports = { generateAIBOM: main };
