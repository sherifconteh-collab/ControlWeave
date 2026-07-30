/**
 * AI access governance features: analysis of customer-uploaded RBAC
 * documentation (role definitions, SoD matrices, roles & responsibilities)
 * against the organization's live permission catalog, roles, and SoD rules.
 */

'use strict';

const pool = require('../../../config/database');
const { chat, compactJSON, buildPersonalizedSystem } = require('../chatCore');
const { buildFewShotBlock } = require('../exemplarLoader');
const { sanitizePromptLabel } = require('../promptSafety');

// Uploaded documents can be large; cap what reaches the prompt so a single
// spreadsheet export cannot blow the context window or the org's token budget.
const MAX_DOCUMENT_CHARS = 24000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function featureError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function analyzeRbacDocument({ organizationId, documentId, provider, model, schemaRetryHint = null }) {
  // 404 (not 400) for a malformed id: aiHandler rewrites any 400 into its
  // missing-API-key message, which would mislead here.
  if (!documentId || !UUID_PATTERN.test(String(documentId))) {
    throw featureError(404, 'RBAC document not found');
  }
  const { rows: [document] } = await pool.query(
    'SELECT id, file_name, document_type, extracted_text FROM rbac_documents WHERE id = $1 AND organization_id = $2',
    [documentId, organizationId]
  );
  if (!document) throw featureError(404, 'RBAC document not found');

  const [catalog, roles, sodRules] = await Promise.all([
    pool.query('SELECT name, description FROM permissions ORDER BY name'),
    pool.query(`
      SELECT r.name,
             COALESCE(ARRAY_AGG(p.name) FILTER (WHERE p.id IS NOT NULL), '{}') AS permissions
      FROM roles r
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      WHERE r.organization_id = $1 OR r.is_system_role = true
      GROUP BY r.id ORDER BY r.name
    `, [organizationId]),
    pool.query(`
      SELECT name, conflicting_permissions, severity FROM sod_rules
      WHERE is_active = true AND (organization_id = $1 OR organization_id IS NULL)
    `, [organizationId])
  ]);

  const documentText = String(document.extracted_text || '').slice(0, MAX_DOCUMENT_CHARS);

  return chat({
    provider, model, organizationId,
    systemPrompt: await buildPersonalizedSystem(organizationId, null, 'compact', null, 'controls'),
    messages: [{
      role: 'user',
      content: `You are an identity and access governance analyst. An organization has uploaded its own RBAC documentation for review.${buildFewShotBlock('rbac_analysis')}

Document: "${sanitizePromptLabel(document.file_name)}" (declared type: ${document.document_type})
Document content:
"""
${documentText}
"""

Platform permission catalog (the ONLY valid values for mapped_permissions, suggested_platform_roles[].permissions, and suggested_sod_rules[].conflicting_permissions):
${compactJSON(catalog.rows)}

Existing platform roles and their permissions:
${compactJSON(roles.rows)}

Active SoD rules already enforced in the platform:
${compactJSON(sodRules.rows)}

Analyze the document:
1. Extract every role it defines with its duties, and map each role's duties onto the platform permission catalog (omit duties with no catalog equivalent, but mention them in notes).
2. Identify separation-of-duties conflicts: duties combined within one documented role, contradictions between the document and its own SoD matrix (if present), and conflicts with the active platform SoD rules.
3. Suggest platform roles worth creating (only where no existing role already covers the mapped permission set).
4. Suggest new SoD rules for conflicts the document reveals that the active platform rules do not already cover; use at least 2 catalog permission keys per rule and do not duplicate existing rules.
5. List governance gaps and risks the document exposes.

Return ONLY a JSON object with keys: summary, roles, sod_conflicts, suggested_platform_roles, suggested_sod_rules, gaps_and_risks — matching the exemplar structure exactly.${schemaRetryHint ? `\n\n[CORRECTION REQUIRED]\n${schemaRetryHint}` : ''}`
    }],
    feature: 'rbac_analysis'
  });
}

module.exports = { analyzeRbacDocument };
