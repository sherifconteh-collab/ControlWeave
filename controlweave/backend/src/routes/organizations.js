const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const ExcelJS = require('exceljs');
const multer = require('multer');
const path = require('path');
const { Readable } = require('stream');
const llm = require('../services/llmService');
const { authenticate, requirePermission } = require('../middleware/auth');
const { validateBody, isUuid } = require('../middleware/validate');
const { getFrameworkLimit, normalizeTier, shouldEnforceAiLimitForByok } = require('../config/tierPolicy');

router.use(authenticate);

const VALID_CIA_LEVELS = new Set(['low', 'moderate', 'high']);
const VALID_RMF_STAGES = new Set(['prepare', 'categorize', 'select', 'implement', 'assess', 'authorize', 'monitor']);
const VALID_COMPLIANCE_PROFILES = new Set(['private', 'federal', 'hybrid']);
const VALID_NIST_ADOPTION_MODES = new Set(['best_practice', 'mandatory']);
const VALID_ENVIRONMENT_TYPES = new Set([
  'on_prem',
  'cloud',
  'hybrid',
  'saas',
  'ot',
  'development',
  'test',
  'staging',
  'production'
]);
const VALID_DEPLOYMENT_MODELS = new Set(['on_prem', 'single_cloud', 'multi_cloud', 'hybrid', 'saas_only']);
const VALID_DATA_SENSITIVITY_TYPES = new Set([
  'pii',
  'phi',
  'pci',
  'cui',
  'fci',
  'financial',
  'operational',
  'ip',
  'public',
  'internal',
  'confidential',
  'restricted'
]);
const RMF_FRAMEWORK_CODES = new Set(['nist_800_53', 'nist_800_171']);
const NIST_800_53_REQUIRED_INFORMATION_TYPE_CODES = new Set(['nist_800_53']);
const VALID_CONTROL_IMPLEMENTATION_STATUSES = new Set([
  'not_started',
  'in_progress',
  'implemented',
  'needs_review',
  'satisfied_via_crosswalk',
  'verified',
  'not_applicable'
]);

const controlsImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024
  }
});

function toNullableString(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeArray(value, allowedSet) {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item) => String(item || '').trim().toLowerCase())
    .filter((item) => item.length > 0);

  if (allowedSet) {
    return Array.from(new Set(normalized.filter((item) => allowedSet.has(item))));
  }

  return Array.from(new Set(normalized));
}

function getDefaultOrganizationProfile(organizationId) {
  return {
    organization_id: organizationId,
    company_legal_name: null,
    company_description: null,
    industry: null,
    website: null,
    headquarters_location: null,
    employee_count_range: null,
    system_name: null,
    system_description: null,
    authorization_boundary: null,
    operating_environment_summary: null,
    confidentiality_impact: null,
    integrity_impact: null,
    availability_impact: null,
    impact_rationale: null,
    environment_types: [],
    deployment_model: null,
    cloud_providers: [],
    data_sensitivity_types: [],
    rmf_stage: null,
    rmf_notes: null,
    compliance_profile: 'private',
    nist_adoption_mode: 'best_practice',
    nist_notes: null,
    onboarding_completed: false,
    onboarding_completed_at: null
  };
}

// Verify the user belongs to the requested org
function verifyOrgAccess(req, res) {
  const orgId = req.params.orgId;
  if (orgId !== req.user.organization_id) {
    res.status(403).json({ success: false, error: 'Access denied: you do not belong to this organization' });
    return null;
  }
  return orgId;
}

// GET /organizations/me/profile
router.get('/me/profile', requirePermission('organizations.read'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const profileResult = await pool.query(
      `SELECT *
       FROM organization_profiles
       WHERE organization_id = $1
       LIMIT 1`,
      [orgId]
    );

    const frameworkResult = await pool.query(
      `SELECT f.code
       FROM organization_frameworks ofw
       JOIN frameworks f ON f.id = ofw.framework_id
       WHERE ofw.organization_id = $1`,
      [orgId]
    );

    const selectedFrameworkCodes = frameworkResult.rows
      .map((row) => String(row.code || '').toLowerCase())
      .filter((code) => code.length > 0);
    const rmfRelevant = selectedFrameworkCodes.some((code) => RMF_FRAMEWORK_CODES.has(code));
    const profile = profileResult.rows[0] || getDefaultOrganizationProfile(orgId);

    res.json({
      success: true,
      data: {
        profile,
        selected_framework_codes: selectedFrameworkCodes,
        guidance: {
          onboarding_mode: 'Private-sector baseline by default. Additional federal/NIST guidance appears when selected frameworks require it.',
          baseline_focus: [
            'Organization and system description',
            'Authorization boundary and operating environment',
            'Confidentiality, Integrity, Availability impact baseline',
            'Evidence-ready governance notes'
          ]
        },
        framework_guidance: {
          rmf_relevant: rmfRelevant,
          rmf_trigger_framework_codes: Array.from(RMF_FRAMEWORK_CODES)
        }
      }
    });
  } catch (error) {
    console.error('Organization profile read error:', error);
    res.status(500).json({ success: false, error: 'Failed to load organization profile' });
  }
});

// PUT /organizations/me/profile
router.put('/me/profile', requirePermission('organizations.read'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;

    const existingResult = await pool.query(
      `SELECT *
       FROM organization_profiles
       WHERE organization_id = $1
       LIMIT 1`,
      [orgId]
    );
    const existing = existingResult.rows[0] || getDefaultOrganizationProfile(orgId);
    const frameworkResult = await pool.query(
      `SELECT f.code
       FROM organization_frameworks ofw
       JOIN frameworks f ON f.id = ofw.framework_id
       WHERE ofw.organization_id = $1`,
      [orgId]
    );
    const selectedFrameworkCodes = frameworkResult.rows
      .map((row) => String(row.code || '').toLowerCase())
      .filter((code) => code.length > 0);
    const rmfRelevant = selectedFrameworkCodes.some((code) => RMF_FRAMEWORK_CODES.has(code));

    const confidentiality = toNullableString(req.body.confidentiality_impact)?.toLowerCase() || null;
    const integrity = toNullableString(req.body.integrity_impact)?.toLowerCase() || null;
    const availability = toNullableString(req.body.availability_impact)?.toLowerCase() || null;
    const rmfStage = toNullableString(req.body.rmf_stage)?.toLowerCase() || null;
    const deploymentModel = toNullableString(req.body.deployment_model)?.toLowerCase() || null;
    const complianceProfileInput = toNullableString(req.body.compliance_profile)?.toLowerCase() || null;
    const nistAdoptionInput = toNullableString(req.body.nist_adoption_mode)?.toLowerCase() || null;

    const complianceProfile = req.body.compliance_profile !== undefined
      ? (complianceProfileInput || 'private')
      : (existing.compliance_profile || 'private');
    const nistAdoptionMode = req.body.nist_adoption_mode !== undefined
      ? (nistAdoptionInput || 'best_practice')
      : (existing.nist_adoption_mode || 'best_practice');

    if (confidentiality && !VALID_CIA_LEVELS.has(confidentiality)) {
      return res.status(400).json({ success: false, error: 'confidentiality_impact must be one of: low, moderate, high' });
    }
    if (integrity && !VALID_CIA_LEVELS.has(integrity)) {
      return res.status(400).json({ success: false, error: 'integrity_impact must be one of: low, moderate, high' });
    }
    if (availability && !VALID_CIA_LEVELS.has(availability)) {
      return res.status(400).json({ success: false, error: 'availability_impact must be one of: low, moderate, high' });
    }
    if (rmfStage && !VALID_RMF_STAGES.has(rmfStage)) {
      return res.status(400).json({
        success: false,
        error: 'rmf_stage must be one of: prepare, categorize, select, implement, assess, authorize, monitor'
      });
    }
    if (deploymentModel && !VALID_DEPLOYMENT_MODELS.has(deploymentModel)) {
      return res.status(400).json({
        success: false,
        error: 'deployment_model must be one of: on_prem, single_cloud, multi_cloud, hybrid, saas_only'
      });
    }
    if (!VALID_COMPLIANCE_PROFILES.has(complianceProfile)) {
      return res.status(400).json({
        success: false,
        error: 'compliance_profile must be one of: private, federal, hybrid'
      });
    }
    if (!VALID_NIST_ADOPTION_MODES.has(nistAdoptionMode)) {
      return res.status(400).json({
        success: false,
        error: 'nist_adoption_mode must be one of: best_practice, mandatory'
      });
    }

    const environmentTypes = req.body.environment_types !== undefined
      ? sanitizeArray(req.body.environment_types, VALID_ENVIRONMENT_TYPES)
      : existing.environment_types || [];
    const cloudProviders = req.body.cloud_providers !== undefined
      ? sanitizeArray(req.body.cloud_providers)
      : existing.cloud_providers || [];
    const dataSensitivityTypes = req.body.data_sensitivity_types !== undefined
      ? sanitizeArray(req.body.data_sensitivity_types, VALID_DATA_SENSITIVITY_TYPES)
      : existing.data_sensitivity_types || [];

    const onboardingCompletedRequested = req.body.onboarding_completed === true;
    const onboardingCompleted = onboardingCompletedRequested || Boolean(existing.onboarding_completed);

    const nextProfile = {
      company_legal_name: req.body.company_legal_name !== undefined ? toNullableString(req.body.company_legal_name) : existing.company_legal_name,
      company_description: req.body.company_description !== undefined ? toNullableString(req.body.company_description) : existing.company_description,
      industry: req.body.industry !== undefined ? toNullableString(req.body.industry) : existing.industry,
      website: req.body.website !== undefined ? toNullableString(req.body.website) : existing.website,
      headquarters_location: req.body.headquarters_location !== undefined ? toNullableString(req.body.headquarters_location) : existing.headquarters_location,
      employee_count_range: req.body.employee_count_range !== undefined ? toNullableString(req.body.employee_count_range) : existing.employee_count_range,
      system_name: req.body.system_name !== undefined ? toNullableString(req.body.system_name) : existing.system_name,
      system_description: req.body.system_description !== undefined ? toNullableString(req.body.system_description) : existing.system_description,
      authorization_boundary: req.body.authorization_boundary !== undefined ? toNullableString(req.body.authorization_boundary) : existing.authorization_boundary,
      operating_environment_summary: req.body.operating_environment_summary !== undefined ? toNullableString(req.body.operating_environment_summary) : existing.operating_environment_summary,
      confidentiality_impact: confidentiality !== null || req.body.confidentiality_impact !== undefined ? confidentiality : existing.confidentiality_impact,
      integrity_impact: integrity !== null || req.body.integrity_impact !== undefined ? integrity : existing.integrity_impact,
      availability_impact: availability !== null || req.body.availability_impact !== undefined ? availability : existing.availability_impact,
      impact_rationale: req.body.impact_rationale !== undefined ? toNullableString(req.body.impact_rationale) : existing.impact_rationale,
      environment_types: environmentTypes,
      deployment_model: deploymentModel !== null || req.body.deployment_model !== undefined ? deploymentModel : existing.deployment_model,
      cloud_providers: cloudProviders,
      data_sensitivity_types: dataSensitivityTypes,
      rmf_stage: rmfStage !== null || req.body.rmf_stage !== undefined ? rmfStage : existing.rmf_stage,
      rmf_notes: req.body.rmf_notes !== undefined ? toNullableString(req.body.rmf_notes) : existing.rmf_notes,
      compliance_profile: complianceProfile,
      nist_adoption_mode: nistAdoptionMode,
      nist_notes: req.body.nist_notes !== undefined ? toNullableString(req.body.nist_notes) : existing.nist_notes,
      onboarding_completed: onboardingCompleted
    };

    if (onboardingCompletedRequested) {
      const requiredFields = [
        ['company_legal_name', nextProfile.company_legal_name],
        ['company_description', nextProfile.company_description],
        ['system_name', nextProfile.system_name],
        ['system_description', nextProfile.system_description],
        ['confidentiality_impact', nextProfile.confidentiality_impact],
        ['integrity_impact', nextProfile.integrity_impact],
        ['availability_impact', nextProfile.availability_impact]
      ];
      const missing = requiredFields.filter(([, value]) => !value).map(([name]) => name);

      const nistIsMandatory = rmfRelevant && (nextProfile.nist_adoption_mode === 'mandatory' || nextProfile.compliance_profile !== 'private');
      if (nistIsMandatory && !nextProfile.rmf_stage) {
        missing.push('rmf_stage');
      }

      if (nextProfile.environment_types.length === 0) {
        missing.push('environment_types');
      }

      const requiresInformationTypes = selectedFrameworkCodes.some((code) =>
        NIST_800_53_REQUIRED_INFORMATION_TYPE_CODES.has(code)
      );
      if (requiresInformationTypes && nextProfile.data_sensitivity_types.length === 0) {
        missing.push('data_sensitivity_types');
      }

      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields for onboarding completion',
          missing_fields: missing
        });
      }
    }

    const onboardingCompletedAt = onboardingCompleted
      ? (existing.onboarding_completed_at || new Date().toISOString())
      : null;

    const upsertResult = await pool.query(
      `INSERT INTO organization_profiles (
         organization_id,
         company_legal_name, company_description, industry, website, headquarters_location, employee_count_range,
         system_name, system_description, authorization_boundary, operating_environment_summary,
         confidentiality_impact, integrity_impact, availability_impact, impact_rationale,
         environment_types, deployment_model, cloud_providers, data_sensitivity_types,
         rmf_stage, rmf_notes, compliance_profile, nist_adoption_mode, nist_notes,
         onboarding_completed, onboarding_completed_at, created_by, updated_by, created_at, updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11,
         $12, $13, $14, $15,
         $16::text[], $17, $18::text[], $19::text[],
         $20, $21, $22, $23, $24,
         $25, $26, $27, $28, NOW(), NOW()
       )
       ON CONFLICT (organization_id) DO UPDATE SET
         company_legal_name = EXCLUDED.company_legal_name,
         company_description = EXCLUDED.company_description,
         industry = EXCLUDED.industry,
         website = EXCLUDED.website,
         headquarters_location = EXCLUDED.headquarters_location,
         employee_count_range = EXCLUDED.employee_count_range,
         system_name = EXCLUDED.system_name,
         system_description = EXCLUDED.system_description,
         authorization_boundary = EXCLUDED.authorization_boundary,
         operating_environment_summary = EXCLUDED.operating_environment_summary,
         confidentiality_impact = EXCLUDED.confidentiality_impact,
         integrity_impact = EXCLUDED.integrity_impact,
         availability_impact = EXCLUDED.availability_impact,
         impact_rationale = EXCLUDED.impact_rationale,
         environment_types = EXCLUDED.environment_types,
         deployment_model = EXCLUDED.deployment_model,
         cloud_providers = EXCLUDED.cloud_providers,
         data_sensitivity_types = EXCLUDED.data_sensitivity_types,
         rmf_stage = EXCLUDED.rmf_stage,
         rmf_notes = EXCLUDED.rmf_notes,
         compliance_profile = EXCLUDED.compliance_profile,
         nist_adoption_mode = EXCLUDED.nist_adoption_mode,
         nist_notes = EXCLUDED.nist_notes,
         onboarding_completed = EXCLUDED.onboarding_completed,
         onboarding_completed_at = EXCLUDED.onboarding_completed_at,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
       RETURNING *`,
      [
        orgId,
        nextProfile.company_legal_name,
        nextProfile.company_description,
        nextProfile.industry,
        nextProfile.website,
        nextProfile.headquarters_location,
        nextProfile.employee_count_range,
        nextProfile.system_name,
        nextProfile.system_description,
        nextProfile.authorization_boundary,
        nextProfile.operating_environment_summary,
        nextProfile.confidentiality_impact,
        nextProfile.integrity_impact,
        nextProfile.availability_impact,
        nextProfile.impact_rationale,
        nextProfile.environment_types,
        nextProfile.deployment_model,
        nextProfile.cloud_providers,
        nextProfile.data_sensitivity_types,
        nextProfile.rmf_stage,
        nextProfile.rmf_notes,
        nextProfile.compliance_profile,
        nextProfile.nist_adoption_mode,
        nextProfile.nist_notes,
        nextProfile.onboarding_completed,
        onboardingCompletedAt,
        existing.created_by || req.user.id,
        req.user.id
      ]
    );

    await pool.query(
      `INSERT INTO audit_logs (organization_id, user_id, event_type, resource_type, details, success)
       VALUES ($1, $2, $3, $4, $5::jsonb, true)`,
      [
        orgId,
        req.user.id,
        onboardingCompletedRequested ? 'organization_onboarding_completed' : 'organization_profile_updated',
        'organization_profile',
        JSON.stringify({
          onboarding_completed: nextProfile.onboarding_completed,
          rmf_stage: nextProfile.rmf_stage,
          compliance_profile: nextProfile.compliance_profile,
          nist_adoption_mode: nextProfile.nist_adoption_mode,
          cia: {
            confidentiality: nextProfile.confidentiality_impact,
            integrity: nextProfile.integrity_impact,
            availability: nextProfile.availability_impact
          }
        })
      ]
    );

    res.json({
      success: true,
      data: {
        profile: upsertResult.rows[0]
      }
    });
  } catch (error) {
    console.error('Organization profile update error:', error);
    res.status(500).json({ success: false, error: 'Failed to update organization profile' });
  }
});

// GET /organizations/:orgId/frameworks
router.get('/:orgId/frameworks', requirePermission('organizations.read'), async (req, res) => {
  try {
    const orgId = verifyOrgAccess(req, res);
    if (!orgId) return;

    const result = await pool.query(`
      SELECT f.id, f.name, f.code, f.version, f.description, f.category, f.tier_required,
             of2.created_at as added_at,
             COUNT(fc.id) as control_count
      FROM organization_frameworks of2
      JOIN frameworks f ON f.id = of2.framework_id
      LEFT JOIN framework_controls fc ON fc.framework_id = f.id
      WHERE of2.organization_id = $1
      GROUP BY f.id, of2.created_at
      ORDER BY f.name
    `, [orgId]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Org frameworks error:', error);
    res.status(500).json({ success: false, error: 'Failed to load organization frameworks' });
  }
});

// POST /organizations/:orgId/frameworks
router.post('/:orgId/frameworks', requirePermission('frameworks.manage'), validateBody((body) => {
  const errors = [];
  if (!Array.isArray(body.frameworkIds)) {
    errors.push('frameworkIds array is required');
  } else if (body.frameworkIds.some((id) => typeof id !== 'string' || !isUuid(id))) {
    errors.push('frameworkIds must contain valid UUID values');
  }
  return errors;
}), async (req, res) => {
  try {
    const orgId = verifyOrgAccess(req, res);
    if (!orgId) return;
    const { frameworkIds } = req.body;
    const desiredFrameworkIds = Array.from(
      new Set((frameworkIds || []).filter((id) => typeof id === 'string' && id.trim().length > 0))
    );

    // Tier-based framework limits
    const tier = normalizeTier(req.user.organization_tier);
    const maxFrameworks = getFrameworkLimit(tier);

    if (desiredFrameworkIds.length > maxFrameworks) {
      return res.status(403).json({
        success: false,
        error: `Framework limit reached`,
        message: `Your ${tier} tier allows up to ${maxFrameworks} frameworks. You selected ${desiredFrameworkIds.length}. Please upgrade to select more.`,
        currentTier: tier,
        maxFrameworks,
        requestedCount: desiredFrameworkIds.length,
        upgradeRequired: true
      });
    }

    if (desiredFrameworkIds.length > 0) {
      const availableFrameworks = await pool.query(
        `SELECT id::text AS id
         FROM frameworks
         WHERE id::text = ANY($1::text[]) AND is_active = true`,
        [desiredFrameworkIds]
      );

      if (availableFrameworks.rows.length !== desiredFrameworkIds.length) {
        return res.status(400).json({
          success: false,
          error: 'One or more framework IDs are invalid or inactive'
        });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (desiredFrameworkIds.length === 0) {
        await client.query(
          'DELETE FROM organization_frameworks WHERE organization_id = $1',
          [orgId]
        );
      } else {
        await client.query(
          `DELETE FROM organization_frameworks
           WHERE organization_id = $1
             AND NOT (framework_id::text = ANY($2::text[]))`,
          [orgId, desiredFrameworkIds]
        );

        for (const fwId of desiredFrameworkIds) {
          await client.query(
            'INSERT INTO organization_frameworks (organization_id, framework_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [orgId, fwId]
          );
        }
      }

      await client.query('COMMIT');

      // Return updated list
      const result = await client.query(`
        SELECT f.id, f.name, f.code, f.version, f.description,
               COUNT(fc.id) as control_count
        FROM organization_frameworks of2
        JOIN frameworks f ON f.id = of2.framework_id
        LEFT JOIN framework_controls fc ON fc.framework_id = f.id
        WHERE of2.organization_id = $1
        GROUP BY f.id
        ORDER BY f.name
      `, [orgId]);

      res.json({ success: true, data: result.rows });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Add frameworks error:', error);
    res.status(500).json({ success: false, error: 'Failed to add frameworks' });
  }
});

// DELETE /organizations/:orgId/frameworks/:frameworkId
router.delete('/:orgId/frameworks/:frameworkId', requirePermission('frameworks.manage'), async (req, res) => {
  try {
    const orgId = verifyOrgAccess(req, res);
    if (!orgId) return;
    const { frameworkId } = req.params;

    await pool.query(
      'DELETE FROM organization_frameworks WHERE organization_id = $1 AND framework_id = $2',
      [orgId, frameworkId]
    );

    res.json({ success: true, message: 'Framework removed' });
  } catch (error) {
    console.error('Remove framework error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove framework' });
  }
});

// GET /organizations/:orgId/controls
router.get('/:orgId/controls', requirePermission('organizations.read'), async (req, res) => {
  try {
    const orgId = verifyOrgAccess(req, res);
    if (!orgId) return;
    const { frameworkId, status } = req.query;

    let query = `
      SELECT fc.id, fc.control_id,
             COALESCE(occ.title, fc.title) as title,
             COALESCE(occ.description, fc.description) as description,
             fc.control_type, fc.priority,
             f.name as framework_name, f.code as framework_code,
             COALESCE(ci.status, 'not_started') as status,
             ci.assigned_to, ci.notes,
             u.first_name || ' ' || u.last_name as assigned_to_name
      FROM organization_frameworks of2
      JOIN framework_controls fc ON fc.framework_id = of2.framework_id
      JOIN frameworks f ON f.id = fc.framework_id
      LEFT JOIN organization_control_content_overrides occ
        ON occ.organization_id = $1
       AND occ.framework_control_id = fc.id
      LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $1
      LEFT JOIN users u ON u.id = ci.assigned_to
      WHERE of2.organization_id = $1
    `;
    const params = [orgId];
    let paramIndex = 2;

    if (frameworkId) {
      query += ` AND f.id = $${paramIndex}`;
      params.push(frameworkId);
      paramIndex++;
    }

    if (status) {
      if (status === 'not_started') {
        query += ` AND (ci.status IS NULL OR ci.status = 'not_started')`;
      } else {
        query += ` AND ci.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }
    }

    query += ' ORDER BY f.name, fc.control_id';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows, controls: result.rows });
  } catch (error) {
    console.error('Org controls error:', error);
    res.status(500).json({ success: false, error: 'Failed to load controls' });
  }
});

function normalizeHeaderKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_');
}

const CONTROL_ANSWER_IMPORT_HEADER_ALIASES = (() => {
  const aliases = {
    framework_control_id: [
      'framework_control_id',
      'framework_control_uuid',
      'framework_controlid',
      'framework_control',
      'control_uuid',
      'control_id_uuid',
      'framework_control_guid'
    ],
    framework_code: ['framework_code', 'framework', 'frameworkcode', 'framework_id', 'framework_key'],
    control_id: ['control_id', 'control', 'control_code', 'controlcode', 'control_number', 'control_identifier'],
    status: ['status', 'implementation_status', 'control_status'],
    implementation_notes: [
      'implementation_notes',
      'implementation_details',
      'implementation_detail',
      'implementation',
      'implementation_notesdetails'
    ],
    evidence_location: ['evidence_location', 'evidence', 'evidence_url', 'evidence_link', 'evidence_location_url'],
    notes: ['notes', 'note', 'comments', 'comment'],
    assigned_to_email: [
      'assigned_to_email',
      'assignee_email',
      'assigned_email',
      'owner_email',
      'assigned_to',
      'assignee'
    ],
    assigned_to_id: ['assigned_to_id', 'assignee_id', 'assigned_user_id', 'owner_id'],
    due_date: ['due_date', 'implementation_date', 'target_date', 'deadline', 'due']
  };

  const aliasToKey = new Map();
  Object.entries(aliases).forEach(([key, list]) => {
    list.forEach((entry) => {
      aliasToKey.set(normalizeHeaderKey(entry), key);
    });
    aliasToKey.set(normalizeHeaderKey(key), key);
  });

  return aliasToKey;
})();

function buildImportHeaderMap(worksheet) {
  const headerRow = worksheet.getRow(1);
  const headerMap = {};
  const present = new Set();

  for (let col = 1; col <= headerRow.cellCount; col++) {
    const rawHeader = String(headerRow.getCell(col)?.text || '').trim();
    if (!rawHeader) continue;

    const normalized = normalizeHeaderKey(rawHeader);
    const key = CONTROL_ANSWER_IMPORT_HEADER_ALIASES.get(normalized);
    if (!key) continue;
    if (headerMap[key]) continue;
    headerMap[key] = col;
    present.add(key);
  }

  return { headerMap, present };
}

function normalizeImplementationStatus(rawValue) {
  const normalized = String(rawValue || '').trim().toLowerCase();
  if (!normalized) return null;

  const mapping = new Map([
    ['not started', 'not_started'],
    ['not_started', 'not_started'],
    ['notstarted', 'not_started'],
    ['todo', 'not_started'],
    ['in progress', 'in_progress'],
    ['in_progress', 'in_progress'],
    ['inprogress', 'in_progress'],
    ['started', 'in_progress'],
    ['implemented', 'implemented'],
    ['complete', 'implemented'],
    ['completed', 'implemented'],
    ['done', 'implemented'],
    ['needs review', 'needs_review'],
    ['needs_review', 'needs_review'],
    ['review', 'needs_review'],
    ['auto-crosswalked', 'satisfied_via_crosswalk'],
    ['auto_crosswalked', 'satisfied_via_crosswalk'],
    ['satisfied via crosswalk', 'satisfied_via_crosswalk'],
    ['satisfied_via_crosswalk', 'satisfied_via_crosswalk'],
    ['crosswalked', 'satisfied_via_crosswalk'],
    ['verified', 'verified'],
    ['not applicable', 'not_applicable'],
    ['not_applicable', 'not_applicable'],
    ['n/a', 'not_applicable'],
    ['na', 'not_applicable']
  ]);

  const value = mapping.get(normalized) || normalized;
  return VALID_CONTROL_IMPLEMENTATION_STATUSES.has(value) ? value : null;
}

function parseDateCellToISO(cell) {
  if (!cell) return null;
  const value = cell.value;

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const rawText = String(cell.text || '').trim();
  if (!rawText) return null;

  // ISO date
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawText)) {
    return rawText;
  }

  // US date (MM/DD/YYYY)
  const usMatch = rawText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const mm = usMatch[1].padStart(2, '0');
    const dd = usMatch[2].padStart(2, '0');
    const yyyy = usMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const parsed = new Date(rawText);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[\",\\r\\n]/.test(text) || /^\s|\s$/.test(text)) {
    return `"${text.replace(/\"/g, '""')}"`;
  }
  return text;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function safeJsonParse(raw, fallback = null) {
  if (!nonEmptyString(raw)) return fallback;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

function extractFirstJsonObject(text) {
  const source = String(text || '');
  const start = source.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escapeNext = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escapeNext) {
        escapeNext = false;
      } else if (ch === '\\') {
        escapeNext = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }

  return null;
}

function normalizeFrameworkToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

async function getOrgDefaultLlmConfig(organizationId) {
  const result = await pool.query(
    `SELECT setting_key, setting_value
     FROM organization_settings
     WHERE organization_id = $1 AND setting_key IN ('default_provider', 'default_model')`,
    [organizationId]
  );

  const values = {};
  result.rows.forEach((row) => {
    values[row.setting_key] = row.setting_value;
  });

  const provider = ['claude', 'openai', 'gemini', 'grok'].includes(String(values.default_provider || ''))
    ? String(values.default_provider)
    : 'claude';

  return {
    provider,
    model: nonEmptyString(values.default_model) ? String(values.default_model) : null
  };
}

async function enforceImportAiLimit({ organizationId, organizationTier, provider }) {
  const tier = normalizeTier(organizationTier);
  const limit = llm.getUsageLimit(tier);
  const enforceByokLimits = shouldEnforceAiLimitForByok(tier);

  if (!enforceByokLimits) {
    const orgProviderKey = await llm.getOrgApiKey(organizationId, provider);
    if (orgProviderKey) {
      return { bypassed: true, tier, limit: 'unlimited', remaining: 'unlimited' };
    }
  }

  if (limit === -1) {
    return { bypassed: false, tier, limit: 'unlimited', remaining: 'unlimited' };
  }

  const used = await llm.getUsageCount(organizationId);
  if (used >= limit) {
    const err = new Error(`AI usage limit reached for ${tier} tier (${used}/${limit})`);
    err.status = 429;
    err.payload = {
      upgradeRequired: true,
      currentTier: tier,
      used,
      limit
    };
    throw err;
  }

  return {
    bypassed: false,
    tier,
    limit,
    remaining: Math.max(0, limit - used)
  };
}

function collectHeaderExamples(worksheet, headerCells, opts = {}) {
  const maxSampleRows = Number.isFinite(opts.maxSampleRows) ? opts.maxSampleRows : 10;
  const maxExamplesPerHeader = Number.isFinite(opts.maxExamplesPerHeader) ? opts.maxExamplesPerHeader : 3;
  const maxChars = Number.isFinite(opts.maxChars) ? opts.maxChars : 96;

  const examples = {};
  headerCells.forEach(({ header }) => {
    examples[header] = [];
  });

  const rowLimit = Math.min(worksheet.rowCount || 0, 1 + maxSampleRows);
  for (let rowNumber = 2; rowNumber <= rowLimit; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    if (!row || !row.hasValues) continue;

    headerCells.forEach(({ col, header }) => {
      const list = examples[header];
      if (!Array.isArray(list) || list.length >= maxExamplesPerHeader) return;

      const raw = String(row.getCell(col)?.text || '').trim();
      if (!raw) return;

      const clipped = raw.length > maxChars ? `${raw.slice(0, maxChars)}…` : raw;
      if (!list.includes(clipped)) {
        list.push(clipped);
      }
    });
  }

  return examples;
}

function scoreHeaderForImportAi(header) {
  const normalized = normalizeHeaderKey(header);
  let score = 0;
  const weighted = [
    ['framework', 8],
    ['control', 8],
    ['uuid', 6],
    ['guid', 6],
    ['id', 5],
    ['code', 5],
    ['status', 7],
    ['implementation', 7],
    ['evidence', 7],
    ['url', 4],
    ['link', 4],
    ['note', 4],
    ['comment', 4],
    ['assign', 4],
    ['assignee', 4],
    ['owner', 3],
    ['due', 3],
    ['deadline', 3],
    ['date', 3]
  ];

  weighted.forEach(([token, weight]) => {
    if (normalized.includes(token)) score += weight;
  });

  if (normalized.length <= 2) score -= 2;
  if (normalized.length <= 4) score -= 1;
  return score;
}

function selectHeaderCellsForImportAi(headerCells, maxHeaders = 160) {
  if (!Array.isArray(headerCells) || headerCells.length <= maxHeaders) return headerCells;

  const scored = headerCells
    .map((entry, idx) => ({
      ...entry,
      _idx: idx,
      _score: scoreHeaderForImportAi(entry.header)
    }))
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return a._idx - b._idx;
    })
    .slice(0, maxHeaders);

  return scored
    .sort((a, b) => a._idx - b._idx)
    .map(({ _idx, _score, ...rest }) => rest);
}

async function inferControlAnswerImportHeaderMapWithAI({
  organizationId,
  provider,
  model,
  headers,
  examples
}) {
  const headerPayload = headers.map((header) => ({
    header,
    examples: Array.isArray(examples?.[header]) ? examples[header].slice(0, 3) : []
  }));

  const aiRaw = await llm.chat({
    organizationId,
    provider,
    model,
    maxTokens: 900,
    systemPrompt: [
      'You map spreadsheet columns to a canonical schema for importing control implementation answers into a GRC platform.',
      'Return JSON only (no markdown, no code fences, no prose outside JSON).',
      'Use exact header names from the provided list. If a field is missing, set it to null.',
      'Prefer stable identifiers: framework_control_id (UUID) if present, otherwise framework + control identifier.'
    ].join(' '),
    messages: [{
      role: 'user',
      content: `Map spreadsheet columns to this required JSON shape:
{
  "mapping": {
    "framework_control_id": string|null,
    "framework_code": string|null,
    "control_id": string|null,
    "status": string|null,
    "implementation_notes": string|null,
    "evidence_location": string|null,
    "notes": string|null,
    "assigned_to_email": string|null,
    "assigned_to_id": string|null,
    "due_date": string|null
  },
  "confidence": {
    "framework_control_id": number,
    "framework_code": number,
    "control_id": number,
    "status": number,
    "implementation_notes": number,
    "evidence_location": number,
    "notes": number,
    "assigned_to_email": number,
    "assigned_to_id": number,
    "due_date": number
  }
}

Constraints:
- Use only header values that appear in the list below.
- Output a single JSON object only.
- Do not invent headers.

Headers with examples:
${JSON.stringify(headerPayload, null, 2)}`
    }]
  });

  const candidateJson = extractFirstJsonObject(aiRaw) || aiRaw;
  const parsed = safeJsonParse(candidateJson, null);
  if (!parsed) {
    const err = new Error('AI column mapping returned invalid JSON.');
    err.ai_raw = aiRaw;
    throw err;
  }

  const mapping = parsed.mapping && typeof parsed.mapping === 'object' ? parsed.mapping : parsed;
  return { mapping, raw: aiRaw, parsed };
}

// GET /organizations/:orgId/controls/export
router.get('/:orgId/controls/export', requirePermission('implementations.read'), async (req, res) => {
  try {
    const orgId = verifyOrgAccess(req, res);
    if (!orgId) return;

    const format = String(req.query.format || 'xlsx').trim().toLowerCase();
    if (!['xlsx', 'csv'].includes(format)) {
      return res.status(400).json({ success: false, error: "format must be one of: xlsx, csv" });
    }

    const { frameworkId, status } = req.query;

    let query = `
      SELECT
        fc.id as framework_control_id,
        f.name as framework_name,
        f.code as framework_code,
        fc.control_id,
        COALESCE(occ.title, fc.title) as title,
        COALESCE(occ.description, fc.description) as description,
        fc.control_type,
        fc.priority,
        COALESCE(ci.status, 'not_started') as status,
        ci.implementation_notes,
        ci.evidence_location,
        ci.notes,
        ci.implementation_date as due_date,
        u.email as assigned_to_email,
        NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), '') as assigned_to_name
      FROM organization_frameworks of2
      JOIN framework_controls fc ON fc.framework_id = of2.framework_id
      JOIN frameworks f ON f.id = fc.framework_id
      LEFT JOIN organization_control_content_overrides occ
        ON occ.organization_id = $1
       AND occ.framework_control_id = fc.id
      LEFT JOIN control_implementations ci
        ON ci.control_id = fc.id
       AND ci.organization_id = $1
      LEFT JOIN users u ON u.id = ci.assigned_to
      WHERE of2.organization_id = $1
    `;

    const params = [orgId];
    let paramIndex = 2;

    if (frameworkId) {
      query += ` AND f.id = $${paramIndex}`;
      params.push(frameworkId);
      paramIndex++;
    }

    if (status) {
      if (status === 'not_started') {
        query += ` AND (ci.status IS NULL OR ci.status = 'not_started')`;
      } else {
        query += ` AND ci.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }
    }

    query += ' ORDER BY f.name, fc.control_id';

    const result = await pool.query(query, params);
    const rows = result.rows || [];

    const exportColumns = [
      'framework_control_id',
      'framework_code',
      'framework_name',
      'control_id',
      'title',
      'description',
      'control_type',
      'priority',
      'status',
      'implementation_notes',
      'evidence_location',
      'notes',
      'assigned_to_email',
      'assigned_to_name',
      'due_date'
    ];

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `controlweave-control-answers-${orgId}-${stamp}.${format}`;

    res.setHeader('Content-Disposition', `attachment; filename=\"${filename}\"`);
    res.setHeader('Cache-Control', 'no-store');

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      const lines = [];
      lines.push(exportColumns.join(','));
      rows.forEach((row) => {
        const values = exportColumns.map((key) => csvEscape(row[key]));
        lines.push(values.join(','));
      });
      // Include UTF-8 BOM so Excel opens it cleanly.
      const csvText = `\uFEFF${lines.join('\r\n')}\r\n`;
      return res.status(200).send(csvText);
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Control Answers');

    sheet.columns = exportColumns.map((key) => ({
      header: key,
      key,
      width: key === 'description' || key === 'implementation_notes' || key === 'notes' ? 50 : 24
    }));

    rows.forEach((row) => {
      sheet.addRow({
        ...row,
        due_date: row.due_date ? String(row.due_date).slice(0, 10) : null
      });
    });

    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    console.error('Controls export error:', error);
    res.status(500).json({ success: false, error: 'Failed to export controls' });
  }
});

// POST /organizations/:orgId/controls/import?mode=merge|replace
router.post(
  '/:orgId/controls/import',
  requirePermission('implementations.write'),
  controlsImportUpload.single('file'),
  async (req, res) => {
    try {
      const orgId = verifyOrgAccess(req, res);
      if (!orgId) return;

      const mode = String(req.query.mode || 'merge').trim().toLowerCase();
      if (!['merge', 'replace'].includes(mode)) {
        return res.status(400).json({ success: false, error: "mode must be one of: merge, replace" });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, error: "No file uploaded. Expected multipart/form-data with field 'file'." });
      }

      const ext = path.extname(file.originalname || '').toLowerCase();
      if (!['.xlsx', '.csv'].includes(ext)) {
        return res.status(400).json({ success: false, error: 'Unsupported file type. Please upload .xlsx or .csv.' });
      }

      const workbook = new ExcelJS.Workbook();
      if (ext === '.xlsx') {
        await workbook.xlsx.load(file.buffer);
      } else {
        const csvText = file.buffer.toString('utf8').replace(/^\uFEFF/, '');
        await workbook.csv.read(Readable.from([csvText]));
      }

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        return res.status(400).json({ success: false, error: 'No worksheet found in uploaded file.' });
      }

      const headerRow = worksheet.getRow(1);
      const headerCells = [];
      for (let col = 1; col <= headerRow.cellCount; col++) {
        const header = String(headerRow.getCell(col)?.text || '').trim();
        if (!header) continue;
        headerCells.push({ col, header });
      }

      const colByNormalizedHeader = new Map(
        headerCells.map((entry) => [normalizeHeaderKey(entry.header), entry.col])
      );

      const { headerMap, present } = buildImportHeaderMap(worksheet);
      const aiColumnMapping = {
        attempted: false,
        used: false,
        provider: null,
        model: null,
        mapping: null,
        note: null,
        error: null
      };

      const aiEnabled = String(req.query.ai ?? '1').trim() !== '0';
      const hasAiPermission = Array.isArray(req.user?.permissions)
        ? (req.user.permissions.includes('*') || req.user.permissions.includes('ai.use'))
        : req.user?.role === 'admin';

      const canonicalFields = [
        'framework_control_id',
        'framework_code',
        'control_id',
        'status',
        'implementation_notes',
        'evidence_location',
        'notes',
        'assigned_to_email',
        'assigned_to_id',
        'due_date'
      ];

      const missingFields = canonicalFields.filter((field) => !headerMap[field]);
      if (aiEnabled && hasAiPermission && missingFields.length > 0 && headerCells.length > 0) {
        aiColumnMapping.attempted = true;
        try {
          const defaults = await getOrgDefaultLlmConfig(orgId);
          const provider = ['claude', 'openai', 'gemini', 'grok'].includes(String(req.query.provider || ''))
            ? String(req.query.provider)
            : defaults.provider;
          const model = nonEmptyString(req.query.model) ? String(req.query.model) : defaults.model;

          aiColumnMapping.provider = provider;
          aiColumnMapping.model = model;

          await enforceImportAiLimit({
            organizationId: orgId,
            organizationTier: req.user.organization_tier,
            provider
          });

          const aiHeaderCells = selectHeaderCellsForImportAi(headerCells);
          if (aiHeaderCells.length !== headerCells.length) {
            aiColumnMapping.note = `AI column mapping inspected ${aiHeaderCells.length}/${headerCells.length} headers due to size limits.`;
          }

          const examples = collectHeaderExamples(worksheet, aiHeaderCells, {
            maxSampleRows: 12,
            maxExamplesPerHeader: 3,
            maxChars: 90
          });

          const aiResult = await inferControlAnswerImportHeaderMapWithAI({
            organizationId: orgId,
            provider,
            model,
            headers: aiHeaderCells.map((entry) => entry.header),
            examples
          });

          const mapping = aiResult?.mapping && typeof aiResult.mapping === 'object' ? aiResult.mapping : null;
          if (mapping) {
            aiColumnMapping.mapping = mapping;

            canonicalFields.forEach((field) => {
              if (headerMap[field]) return;
              const proposedHeader = mapping[field];
              if (!nonEmptyString(proposedHeader)) return;

              const normalizedProposed = normalizeHeaderKey(proposedHeader);
              const col = colByNormalizedHeader.get(normalizedProposed) || null;
              if (!col) return;

              headerMap[field] = col;
              present.add(field);
              aiColumnMapping.used = true;
            });
          }

          await llm.logAIUsage(orgId, req.user.id, 'control_answer_import_column_mapping', provider, model).catch(() => {});
        } catch (err) {
          aiColumnMapping.error = err?.message || String(err);
        }
      }

      const hasFrameworkControlIdColumn = Boolean(headerMap.framework_control_id);
      const hasControlIdColumn = Boolean(headerMap.control_id);
      if (!hasFrameworkControlIdColumn && !hasControlIdColumn) {
        return res.status(400).json({
          success: false,
          error: 'Missing control identifiers. Provide framework_control_id (UUID) OR control_id (control code) column.',
          ai_column_mapping: aiColumnMapping,
          headers_seen: headerCells.map((entry) => entry.header)
        });
      }

      const controlResult = await pool.query(
        `SELECT
           fc.id as framework_control_id,
           LOWER(f.code) as framework_code,
           fc.control_id
         FROM organization_frameworks of2
         JOIN framework_controls fc ON fc.framework_id = of2.framework_id
         JOIN frameworks f ON f.id = fc.framework_id
         WHERE of2.organization_id = $1`,
        [orgId]
      );

      const controlIdByFrameworkControlId = new Map();
      const controlIdByComposite = new Map();
      controlResult.rows.forEach((row) => {
        const fcId = String(row.framework_control_id);
        const code = String(row.framework_code || '').trim().toLowerCase();
        const controlCode = String(row.control_id || '').trim();
        if (fcId) {
          controlIdByFrameworkControlId.set(fcId, fcId);
        }
        if (code && controlCode) {
          controlIdByComposite.set(`${code}::${controlCode.toLowerCase()}`, fcId);
        }
      });

      const orgFrameworkResult = await pool.query(
        `SELECT LOWER(f.code) as framework_code, f.name as framework_name
         FROM organization_frameworks of2
         JOIN frameworks f ON f.id = of2.framework_id
         WHERE of2.organization_id = $1`,
        [orgId]
      );
      const frameworkCodeByToken = new Map();
      orgFrameworkResult.rows.forEach((row) => {
        const code = String(row.framework_code || '').trim().toLowerCase();
        const name = String(row.framework_name || '').trim();
        if (code) frameworkCodeByToken.set(normalizeFrameworkToken(code), code);
        if (name) frameworkCodeByToken.set(normalizeFrameworkToken(name), code);
      });
      const defaultFrameworkCode = orgFrameworkResult.rows.length === 1
        ? String(orgFrameworkResult.rows[0].framework_code || '').trim().toLowerCase()
        : null;

      const existingResult = await pool.query(
        `SELECT control_id FROM control_implementations WHERE organization_id = $1`,
        [orgId]
      );
      const hasExistingImplementation = new Set(existingResult.rows.map((row) => String(row.control_id)));

      const userResult = await pool.query(
        `SELECT id, LOWER(email) as email
         FROM users
         WHERE organization_id = $1 AND is_active = true`,
        [orgId]
      );
      const userIdByEmail = new Map(userResult.rows.map((row) => [String(row.email || ''), String(row.id)]));
      const userIds = new Set(userResult.rows.map((row) => String(row.id)));

      const summary = {
        import_mode: mode,
        filename: file.originalname,
        total_rows: 0,
        processed_rows: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        ai_column_mapping: aiColumnMapping,
        warnings: [],
        errors: []
      };

      const fileProvidesField = (field) => present.has(field);
      const maxRows = 20000;
      const rowLimit = Math.min(worksheet.rowCount || 0, maxRows);

      const upsertSql = `
        INSERT INTO control_implementations
          (control_id, organization_id, status, implementation_notes, evidence_location, assigned_to, notes, implementation_date)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (control_id, organization_id) DO UPDATE SET
          status = CASE WHEN $9 THEN EXCLUDED.status ELSE control_implementations.status END,
          implementation_notes = CASE WHEN $10 THEN EXCLUDED.implementation_notes ELSE control_implementations.implementation_notes END,
          evidence_location = CASE WHEN $11 THEN EXCLUDED.evidence_location ELSE control_implementations.evidence_location END,
          assigned_to = CASE WHEN $12 THEN EXCLUDED.assigned_to ELSE control_implementations.assigned_to END,
          notes = CASE WHEN $13 THEN EXCLUDED.notes ELSE control_implementations.notes END,
          implementation_date = CASE WHEN $14 THEN EXCLUDED.implementation_date ELSE control_implementations.implementation_date END
        RETURNING (xmax = 0) AS inserted
      `;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        for (let rowNumber = 2; rowNumber <= rowLimit; rowNumber++) {
          const row = worksheet.getRow(rowNumber);
          if (!row || !row.hasValues) continue;

          const getCellText = (field) => {
            const col = headerMap[field];
            if (!col) return '';
            return String(row.getCell(col)?.text || '').trim();
          };

          const getCell = (field) => {
            const col = headerMap[field];
            if (!col) return null;
            return row.getCell(col);
          };

          const rawFrameworkControlId = getCellText('framework_control_id');
          const rawFrameworkIdentifier = getCellText('framework_code');
          const rawControlCode = getCellText('control_id');

          // Skip completely empty identifier rows.
          if (!rawFrameworkControlId && !rawControlCode) {
            continue;
          }

          summary.total_rows += 1;

          let frameworkControlId = null;
          if (rawFrameworkControlId) {
            frameworkControlId = controlIdByFrameworkControlId.get(rawFrameworkControlId) || null;
          }
          if (!frameworkControlId && rawControlCode) {
            let resolvedFrameworkCode = defaultFrameworkCode;
            if (nonEmptyString(rawFrameworkIdentifier)) {
              const token = normalizeFrameworkToken(rawFrameworkIdentifier);
              const mapped = frameworkCodeByToken.get(token) || null;
              if (mapped) {
                resolvedFrameworkCode = mapped;
              } else if (!defaultFrameworkCode) {
                summary.errors.push({
                  row: rowNumber,
                  error: `Framework not recognized for this organization: "${rawFrameworkIdentifier}".`
                });
                continue;
              }
            }

            if (!resolvedFrameworkCode) {
              summary.errors.push({
                row: rowNumber,
                error: 'Missing framework identifier. Include a framework_code column (or import into an org with exactly one selected framework).'
              });
              continue;
            }

            const candidates = [];
            const raw = String(rawControlCode || '').trim();
            if (raw) {
              candidates.push(raw);
              const firstToken = raw.split(/\s+/)[0];
              if (firstToken && firstToken !== raw) candidates.push(firstToken);
              const cleaned = firstToken.replace(/[,:;]+$/g, '');
              if (cleaned && cleaned !== firstToken) candidates.push(cleaned);
            }

            for (const candidate of candidates) {
              const found = controlIdByComposite.get(`${resolvedFrameworkCode}::${candidate.toLowerCase()}`) || null;
              if (found) {
                frameworkControlId = found;
                break;
              }
            }
          }

          if (!frameworkControlId) {
            summary.errors.push({
              row: rowNumber,
              error: 'Control not found for this organization (check framework_control_id, or control_id + framework_code when multiple frameworks are selected).'
            });
            continue;
          }

          const statusRaw = getCellText('status');
          const statusNormalized = normalizeImplementationStatus(statusRaw);
          let statusProvided = false;
          if (fileProvidesField('status') && statusNormalized) {
            statusProvided = true;
          }
          if (statusRaw && !statusNormalized) {
            statusProvided = false;
            summary.warnings.push({ row: rowNumber, warning: `Invalid status '${statusRaw}'. Allowed: ${Array.from(VALID_CONTROL_IMPLEMENTATION_STATUSES).join(', ')}` });
          }
          const statusValue = statusNormalized || 'not_started';

          const implementationNotesRaw = getCellText('implementation_notes');
          const implementationNotesValue = implementationNotesRaw ? implementationNotesRaw : null;
          let implementationNotesProvided = false;
          if (fileProvidesField('implementation_notes')) {
            implementationNotesProvided = mode === 'replace' ? true : Boolean(implementationNotesRaw);
          }

          const evidenceLocationRaw = getCellText('evidence_location');
          const evidenceLocationValue = evidenceLocationRaw ? evidenceLocationRaw : null;
          let evidenceLocationProvided = false;
          if (fileProvidesField('evidence_location')) {
            evidenceLocationProvided = mode === 'replace' ? true : Boolean(evidenceLocationRaw);
          }

          const notesRaw = getCellText('notes');
          const notesValue = notesRaw ? notesRaw : null;
          let notesProvided = false;
          if (fileProvidesField('notes')) {
            notesProvided = mode === 'replace' ? true : Boolean(notesRaw);
          }

          const dueDateCell = getCell('due_date');
          const dueDateValue = parseDateCellToISO(dueDateCell);
          let dueDateProvided = false;
          if (fileProvidesField('due_date')) {
            const dueDateText = String(dueDateCell?.text || '').trim();
            dueDateProvided = mode === 'replace' ? true : Boolean(dueDateValue);
            if (dueDateText && !dueDateValue) {
              dueDateProvided = false;
              summary.warnings.push({ row: rowNumber, warning: `Invalid due_date '${dueDateText}'. Expected YYYY-MM-DD or MM/DD/YYYY.` });
            }
          }

          const assignedToEmailRaw = getCellText('assigned_to_email').toLowerCase();
          const assignedToIdRaw = getCellText('assigned_to_id');
          let assignedToIdValue = null;
          let assignedToProvided = false;

          if (assignedToEmailRaw) {
            const mapped = userIdByEmail.get(assignedToEmailRaw) || null;
            if (!mapped) {
              summary.warnings.push({ row: rowNumber, warning: `assigned_to_email '${assignedToEmailRaw}' not found in organization users. Assignment unchanged.` });
            } else {
              assignedToIdValue = mapped;
              assignedToProvided = true;
            }
          } else if (assignedToIdRaw && isUuid(assignedToIdRaw)) {
            if (userIds.has(assignedToIdRaw)) {
              assignedToIdValue = assignedToIdRaw;
              assignedToProvided = true;
            } else {
              summary.warnings.push({ row: rowNumber, warning: `assigned_to_id '${assignedToIdRaw}' not found in organization users. Assignment unchanged.` });
            }
          } else if (fileProvidesField('assigned_to_email') || fileProvidesField('assigned_to_id')) {
            // Empty assignment cell in replace mode means "clear".
            if (mode === 'replace') {
              assignedToIdValue = null;
              assignedToProvided = true;
            }
          }

          const hasOtherData = Boolean(
            implementationNotesValue ||
              evidenceLocationValue ||
              notesValue ||
              dueDateValue ||
              assignedToEmailRaw ||
              assignedToIdRaw
          );
          const effectiveStatusForEmptyCheck = statusNormalized || 'not_started';
          const isEmptyRow = effectiveStatusForEmptyCheck === 'not_started' && !hasOtherData;
          const hasExisting = hasExistingImplementation.has(frameworkControlId);

          // Avoid creating thousands of empty "not_started" rows from templates/exports.
          if (!hasExisting && isEmptyRow) {
            summary.skipped += 1;
            continue;
          }

          const result = await client.query(upsertSql, [
            frameworkControlId,
            orgId,
            statusValue,
            implementationNotesValue,
            evidenceLocationValue,
            assignedToIdValue,
            notesValue,
            dueDateValue,
            statusProvided,
            implementationNotesProvided,
            evidenceLocationProvided,
            assignedToProvided,
            notesProvided,
            dueDateProvided
          ]);

          summary.processed_rows += 1;
          if (result.rows[0]?.inserted) {
            summary.inserted += 1;
            hasExistingImplementation.add(frameworkControlId);
          } else {
            summary.updated += 1;
          }
        }

        await client.query(
          `INSERT INTO audit_logs (organization_id, user_id, event_type, resource_type, resource_id, details)
           VALUES ($1, $2, 'control_answers_imported', 'organization', $1, $3)`,
          [
            orgId,
            req.user.id,
            JSON.stringify({
              filename: file.originalname,
              mode,
              inserted: summary.inserted,
              updated: summary.updated,
              skipped: summary.skipped,
              warnings: summary.warnings.length,
              errors: summary.errors.length
            })
          ]
        );

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      if (worksheet.rowCount > maxRows) {
        summary.warnings.push({ row: null, warning: `Row limit exceeded. Processed first ${maxRows} rows only.` });
      }

      res.json({ success: true, data: summary });
    } catch (error) {
      console.error('Controls import error:', error);
      res.status(500).json({ success: false, error: 'Failed to import controls' });
    }
  }
);

module.exports = router;
