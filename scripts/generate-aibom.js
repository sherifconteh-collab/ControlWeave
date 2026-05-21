#!/usr/bin/env node
/**
 * AIBOM (AI Bill of Materials) Generator for ControlWeave
 * 
 * This script generates an AI Bill of Materials documenting all AI/ML
 * dependencies, models, and services used in the ControlWeave platform.
 * 
 * Output format follows emerging AIBOM standards and best practices.
 */

const fs = require('fs');
const path = require('path');

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
        "version": "1.0.0"
      }
    ],
    "component": {
      "type": "application",
      "name": "ControlWeave GRC Platform",
      "version": "1.0.0",
      "description": "AI-powered Governance, Risk, and Compliance platform"
    }
  },
  "components": [
    // LLM Provider SDKs
    {
      "type": "library",
      "name": "@anthropic-ai/sdk",
      "version": getPackageVersion('controlweave/backend/package.json', '@anthropic-ai/sdk'),
      "description": "Anthropic Claude AI SDK - Large Language Model API",
      "purl": "pkg:npm/%40anthropic-ai/sdk",
      "properties": [
        { "name": "ai:provider", "value": "Anthropic" },
        { "name": "ai:type", "value": "LLM SDK" },
        { "name": "ai:models", "value": "claude-sonnet-4-5, claude-opus-4-6" },
        { "name": "ai:usage", "value": "Compliance analysis, gap detection, remediation guidance" },
        { "name": "ai:data-access", "value": "User-provided compliance data, control descriptions" },
        { "name": "ai:privacy", "value": "BYOK - customer manages API keys and data" }
      ]
    },
    {
      "type": "library",
      "name": "openai",
      "version": getPackageVersion('controlweave/backend/package.json', 'openai'),
      "description": "OpenAI API SDK - GPT Language Models",
      "purl": "pkg:npm/openai",
      "properties": [
        { "name": "ai:provider", "value": "OpenAI" },
        { "name": "ai:type", "value": "LLM SDK" },
        { "name": "ai:models", "value": "gpt-4o, gpt-4o-mini" },
        { "name": "ai:usage", "value": "AI Copilot, compliance Q&A, policy generation" },
        { "name": "ai:data-access", "value": "Organization context, controls, evidence metadata" },
        { "name": "ai:privacy", "value": "BYOK - customer manages API keys and data" }
      ]
    },
    // AI Model Endpoints
    {
      "type": "service",
      "name": "Google Gemini API",
      "version": "1.5",
      "description": "Google Gemini Large Language Model API",
      "properties": [
        { "name": "ai:provider", "value": "Google" },
        { "name": "ai:type", "value": "LLM API" },
        { "name": "ai:models", "value": "gemini-1.5-pro, gemini-1.5-flash" },
        { "name": "ai:usage", "value": "Risk analysis, vulnerability remediation, audit preparation" },
        { "name": "ai:endpoint", "value": "https://generativelanguage.googleapis.com" },
        { "name": "ai:data-access", "value": "CMDB assets, vulnerability data, compliance posture" },
        { "name": "ai:privacy", "value": "BYOK - customer manages API keys and data" }
      ]
    },
    {
      "type": "service",
      "name": "xAI Grok API",
      "version": "3",
      "description": "xAI Grok Large Language Model API",
      "properties": [
        { "name": "ai:provider", "value": "xAI" },
        { "name": "ai:type", "value": "LLM API" },
        { "name": "ai:models", "value": "grok-3, grok-3-mini" },
        { "name": "ai:usage", "value": "Compliance forecasting, executive reporting" },
        { "name": "ai:endpoint", "value": "https://api.x.ai" },
        { "name": "ai:data-access", "value": "Aggregated compliance metrics, control health" },
        { "name": "ai:privacy", "value": "BYOK - customer manages API keys and data" }
      ]
    },
    {
      "type": "service",
      "name": "Groq API",
      "version": "1.0",
      "description": "Groq Fast Inference API for LLMs",
      "properties": [
        { "name": "ai:provider", "value": "Groq" },
        { "name": "ai:type", "value": "LLM API" },
        { "name": "ai:models", "value": "llama3-70b, mixtral-8x7b, gemma-7b" },
        { "name": "ai:usage", "value": "Real-time AI Copilot responses, quick analysis" },
        { "name": "ai:endpoint", "value": "https://api.groq.com" },
        { "name": "ai:data-access", "value": "Page context, user queries" },
        { "name": "ai:privacy", "value": "BYOK - customer manages API keys and data" }
      ]
    },
    {
      "type": "service",
      "name": "Ollama Local LLM",
      "version": "latest",
      "description": "Self-hosted local LLM service",
      "properties": [
        { "name": "ai:provider", "value": "Ollama (Self-hosted)" },
        { "name": "ai:type", "value": "Local LLM" },
        { "name": "ai:models", "value": "llama3.2, llama3.1:8b-q4_K_M, llama3.1:70b-q4_K_M, mistral:7b-q4_K_M, qwen2.5:14b-q4_K_M, phi3:mini-q4_K_M, gemma2:9b-q4_K_M" },
        { "name": "ai:usage", "value": "Air-gapped deployments, privacy-sensitive analysis" },
        { "name": "ai:endpoint", "value": "http://localhost:11434 (configurable)" },
        { "name": "ai:data-access", "value": "All data stays local - no external transmission" },
        { "name": "ai:privacy", "value": "Fully private - no API keys, all processing on-premises" }
      ]
    }
  ],
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
    }
  ],
  "aiModels": [
    {
      "name": "Claude Sonnet 4.5",
      "version": "4.5",
      "provider": "Anthropic",
      "type": "Large Language Model",
      "architecture": "Transformer",
      "usage": "Primary model for complex compliance analysis and remediation planning",
      "trainingData": "Not disclosed by provider",
      "limitations": "Requires API key, rate limits apply, context window ~200K tokens",
      "risks": [
        "Hallucination risk in factual compliance requirements",
        "Requires human review of all AI-generated content",
        "API availability dependency"
      ],
      "mitigations": [
        "All AI outputs marked as 'AI-generated - requires review'",
        "Results validated against actual framework requirements",
        "Fallback to alternative providers on failure"
      ]
    },
    {
      "name": "GPT-4o",
      "version": "4o",
      "provider": "OpenAI",
      "type": "Large Language Model",
      "architecture": "Transformer",
      "usage": "AI Copilot and general-purpose compliance Q&A",
      "trainingData": "Not disclosed by provider",
      "limitations": "Requires API key, rate limits apply, context window ~128K tokens",
      "risks": [
        "Hallucination risk in factual compliance requirements",
        "Requires human review of all AI-generated content",
        "API availability dependency"
      ],
      "mitigations": [
        "All AI outputs marked as 'AI-generated - requires review'",
        "Results validated against actual framework requirements",
        "Fallback to alternative providers on failure"
      ]
    },
    {
      "name": "Gemini 1.5 Pro",
      "version": "1.5",
      "provider": "Google",
      "type": "Large Language Model",
      "architecture": "Transformer",
      "usage": "Multi-modal analysis including document parsing and evidence analysis",
      "trainingData": "Not disclosed by provider",
      "limitations": "Requires API key, rate limits apply, context window ~2M tokens",
      "risks": [
        "Hallucination risk in factual compliance requirements",
        "Requires human review of all AI-generated content",
        "API availability dependency"
      ],
      "mitigations": [
        "All AI outputs marked as 'AI-generated - requires review'",
        "Results validated against actual framework requirements",
        "Fallback to alternative providers on failure"
      ]
    }
  ],
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
    console.log(`\nAI Components: ${aiBom.components.length}`);
    console.log(`AI Services: ${aiBom.services.length}`);
    console.log(`AI Models Documented: ${aiBom.aiModels.length}`);
    console.log(`Data Flows: ${aiBom.dataFlows.length}`);
    console.log('\nAI Providers:');
    const providers = [...new Set(aiBom.components.map(c => 
      c.properties?.find(p => p.name === 'ai:provider')?.value
    ).filter(Boolean))];
    providers.forEach(p => console.log(`  - ${p}`));
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
  aibom.components.filter(c => c.type === 'service').forEach(comp => {
    md += `#### ${comp.name}\n`;
    md += `- **Version**: ${comp.version}\n`;
    md += `- **Description**: ${comp.description}\n`;
    const props = comp.properties || [];
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
