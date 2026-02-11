const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middleware/auth');
const { createOrgRateLimiter } = require('../middleware/rateLimit');
const llm = require('../services/llmService');
const { normalizeTier, shouldEnforceAiLimitForByok, getByokPolicy } = require('../config/tierPolicy');

const aiOrgRateLimiter = createOrgRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  label: 'ai-org'
});

// All AI routes require authentication
router.use(authenticate);
router.use(requirePermission('ai.use'));
router.use(aiOrgRateLimiter);

// ---------- Middleware: Check AI usage limits ----------
async function checkAIUsage(req, res, next) {
  try {
    const params = getAIParams(req);
    const tier = normalizeTier(req.user.organization_tier);
    const limit = llm.getUsageLimit(tier);
    const enforceByokLimits = shouldEnforceAiLimitForByok(tier);

    if (!enforceByokLimits) {
      const orgProviderKey = await llm.getOrgApiKey(req.user.organization_id, params.provider);
      if (orgProviderKey) {
        req.aiUsageRemaining = 'unlimited';
        req.aiUsageByok = true;
        return next();
      }
    }

    // -1 means unlimited
    if (limit === -1) return next();

    const used = await llm.getUsageCount(req.user.organization_id);
    if (used >= limit) {
      return res.status(429).json({
        success: false,
        error: 'AI usage limit reached',
        message: `Your ${tier} tier allows ${limit} AI requests per month. You've used ${used}. Upgrade for more.`,
        currentTier: tier,
        used,
        limit,
        upgradeRequired: true
      });
    }

    req.aiUsageRemaining = limit - used;
    req.aiUsageByok = false;
    next();
  } catch (err) {
    console.error('AI usage check error:', err);
    next();
  }
}

// Helper: extract provider/model from request
function getAIParams(req) {
  return {
    provider: req.body.provider || req.query.provider || 'claude',
    model: req.body.model || req.query.model || null,
    organizationId: req.user.organization_id
  };
}

// Helper: wrap AI handler with logging
function aiHandler(feature, fn) {
  return async (req, res) => {
    const params = getAIParams(req);
    try {
      const result = await fn(req, params);
      // Log usage
      await llm.logAIUsage(params.organizationId, req.user.id, feature, params.provider, params.model).catch(() => {});
      res.json({ success: true, data: { result, feature, provider: params.provider } });
    } catch (err) {
      console.error(`AI ${feature} error:`, err);
      res.status(err.message?.includes('No API key') ? 400 : 500).json({
        success: false,
        error: err.message || `AI ${feature} failed`
      });
    }
  };
}

// ======================== STATUS ========================
router.get('/status', async (req, res) => {
  try {
    const tier = normalizeTier(req.user.organization_tier);
    const limit = llm.getUsageLimit(tier);
    const used = await llm.getUsageCount(req.user.organization_id);
    const byokPolicy = getByokPolicy();
    const enforceByokLimits = shouldEnforceAiLimitForByok(tier);

    // Check for org-level keys
    const orgClaudeKey  = await llm.getOrgApiKey(req.user.organization_id, 'claude');
    const orgOpenAIKey  = await llm.getOrgApiKey(req.user.organization_id, 'openai');
    const orgGeminiKey  = await llm.getOrgApiKey(req.user.organization_id, 'gemini');
    const orgGrokKey    = await llm.getOrgApiKey(req.user.organization_id, 'grok');
    const orgGroqKey    = await llm.getOrgApiKey(req.user.organization_id, 'groq');
    const orgOllamaUrl  = await llm.getOrgApiKey(req.user.organization_id, 'ollama');

    const status = llm.getProviderStatus({
      claude: orgClaudeKey,
      openai: orgOpenAIKey,
      gemini: orgGeminiKey,
      grok:   orgGrokKey,
      groq:   orgGroqKey,
      ollama: orgOllamaUrl
    });

    res.json({
      success: true,
      data: {
        providers: {
          claude:  { available: status.claude.available  || !!orgClaudeKey,  models: status.claude.models,  hasOrgKey: !!orgClaudeKey  },
          openai:  { available: status.openai.available  || !!orgOpenAIKey,  models: status.openai.models,  hasOrgKey: !!orgOpenAIKey  },
          gemini:  { available: status.gemini.available  || !!orgGeminiKey,  models: status.gemini.models,  hasOrgKey: !!orgGeminiKey  },
          grok:    { available: status.grok.available    || !!orgGrokKey,    models: status.grok.models,    hasOrgKey: !!orgGrokKey    },
          groq:    { available: status.groq.available    || !!orgGroqKey,    models: status.groq.models,    hasOrgKey: !!orgGroqKey    },
          ollama:  { available: status.ollama.available  || !!orgOllamaUrl,  models: status.ollama.models,  hasOrgKey: !!orgOllamaUrl  }
        },
        usage: { used, limit: limit === -1 ? 'unlimited' : limit, remaining: limit === -1 ? 'unlimited' : Math.max(0, limit - used) },
        byokPolicy: {
          limitAppliesToByok: enforceByokLimits,
          mode: byokPolicy.mode,
          bypassTiers: byokPolicy.bypassTiers || []
        },
        tier,
        features: {
          // All features available to all tiers, just usage-limited
          gapAnalysis: true,
          crosswalkOptimizer: true,
          complianceForecasting: true,
          regulatoryMonitor: true,
          remediationPlaybooks: true,
          incidentResponse: true,
          executiveReports: true,
          riskHeatmap: true,
          vendorRisk: true,
          auditReadiness: true,
          assetControlMapping: true,
          shadowITDetection: true,
          aiGovernance: true,
          complianceQuery: true,
          trainingRecommendations: true,
          evidenceAssistant: true,
          controlAnalysis: true,
          testProcedures: true,
          assetRisk: true,
          policyGenerator: true,
          chat: true
        }
      }
    });
  } catch (err) {
    console.error('AI status error:', err);
    res.status(500).json({ success: false, error: 'Failed to get AI status' });
  }
});

// ======================== 1. GAP ANALYSIS ========================
router.post('/gap-analysis', checkAIUsage, aiHandler('gap_analysis', (req, params) =>
  llm.generateGapAnalysis(params)
));

// ======================== 2. CROSSWALK OPTIMIZER ========================
router.post('/crosswalk-optimizer', checkAIUsage, aiHandler('crosswalk_optimizer', (req, params) =>
  llm.optimizeCrosswalk(params)
));

// ======================== 3. COMPLIANCE FORECASTING ========================
router.post('/compliance-forecast', checkAIUsage, aiHandler('compliance_forecast', (req, params) =>
  llm.forecastCompliance(params)
));

// ======================== 4. REGULATORY MONITOR ========================
router.post('/regulatory-monitor', checkAIUsage, aiHandler('regulatory_monitor', (req, params) =>
  llm.monitorRegulatoryChanges({ ...params, frameworks: req.body.frameworks })
));

// ======================== 5. REMEDIATION PLAYBOOKS ========================
router.post('/remediation/:controlId', checkAIUsage, aiHandler('remediation_playbook', (req, params) =>
  llm.generateRemediationPlaybook({ ...params, controlId: req.params.controlId })
));

// ======================== VULNERABILITY REMEDIATION ========================
router.post('/remediation/vulnerability/:vulnerabilityId', checkAIUsage, aiHandler('vulnerability_remediation', (req, params) =>
  llm.generateVulnerabilityRemediation({ ...params, vulnerabilityId: req.params.vulnerabilityId })
));

// ======================== 6. INCIDENT RESPONSE ========================
router.post('/incident-response', checkAIUsage, aiHandler('incident_response', (req, params) =>
  llm.generateIncidentResponsePlan({ ...params, incidentType: req.body.incidentType })
));

// ======================== 7. EXECUTIVE REPORT ========================
router.post('/executive-report', checkAIUsage, aiHandler('executive_report', (req, params) =>
  llm.generateExecutiveReport(params)
));

// ======================== 8. RISK HEATMAP ========================
router.post('/risk-heatmap', checkAIUsage, aiHandler('risk_heatmap', (req, params) =>
  llm.generateRiskHeatmap(params)
));

// ======================== 9. VENDOR RISK ========================
router.post('/vendor-risk', checkAIUsage, aiHandler('vendor_risk', (req, params) =>
  llm.assessVendorRisk({ ...params, vendorInfo: req.body.vendorInfo })
));

// ======================== 10. AUDIT READINESS ========================
router.post('/audit-readiness', checkAIUsage, aiHandler('audit_readiness', (req, params) =>
  llm.assessAuditReadiness({ ...params, framework: req.body.framework })
));

// ======================== AUDITOR AI: PBC DRAFT ========================
router.post('/audit/pbc-draft', checkAIUsage, aiHandler('audit_pbc_draft', (req, params) =>
  llm.generateAuditPbcDraft({
    ...params,
    requestContext: req.body.requestContext,
    controlId: req.body.controlId,
    frameworkCode: req.body.frameworkCode,
    dueDate: req.body.dueDate,
    priority: req.body.priority
  })
));

// ======================== AUDITOR AI: WORKPAPER DRAFT ========================
router.post('/audit/workpaper-draft', checkAIUsage, aiHandler('audit_workpaper_draft', (req, params) =>
  llm.generateAuditWorkpaperDraft({
    ...params,
    controlId: req.body.controlId,
    objective: req.body.objective,
    procedurePerformed: req.body.procedurePerformed,
    evidenceSummary: req.body.evidenceSummary,
    testOutcome: req.body.testOutcome
  })
));

// ======================== AUDITOR AI: FINDING DRAFT ========================
router.post('/audit/finding-draft', checkAIUsage, aiHandler('audit_finding_draft', (req, params) =>
  llm.generateAuditFindingDraft({
    ...params,
    controlId: req.body.controlId,
    issueSummary: req.body.issueSummary,
    evidenceSummary: req.body.evidenceSummary,
    severityHint: req.body.severityHint,
    recommendationScope: req.body.recommendationScope
  })
));

// ======================== 11. ASSET-CONTROL MAPPING ========================
router.post('/asset-control-mapping', checkAIUsage, aiHandler('asset_control_mapping', (req, params) =>
  llm.mapAssetsToControls(params)
));

// ======================== 12. SHADOW IT DETECTION ========================
router.post('/shadow-it', checkAIUsage, aiHandler('shadow_it', (req, params) =>
  llm.detectShadowIT(params)
));

// ======================== 13. AI GOVERNANCE ========================
router.post('/ai-governance', checkAIUsage, aiHandler('ai_governance', (req, params) =>
  llm.checkAIGovernance(params)
));

// ======================== 14. COMPLIANCE QUERY ========================
router.post('/query', checkAIUsage, aiHandler('compliance_query', (req, params) =>
  llm.queryCompliance({ ...params, question: req.body.question })
));

// ======================== 15. TRAINING RECOMMENDATIONS ========================
router.post('/training-recommendations', checkAIUsage, aiHandler('training_recommendations', (req, params) =>
  llm.recommendTraining(params)
));

// ======================== 16. EVIDENCE ASSISTANT ========================
router.post('/evidence-suggest/:controlId', checkAIUsage, aiHandler('evidence_suggest', (req, params) =>
  llm.suggestEvidence({ ...params, controlId: req.params.controlId })
));

// ======================== CONTROL ANALYSIS ========================
router.post('/analyze/control/:id', checkAIUsage, aiHandler('control_analysis', (req, params) =>
  llm.analyzeControl({ ...params, controlId: req.params.id })
));

// ======================== TEST PROCEDURES ========================
router.post('/test-procedures/:controlId', checkAIUsage, aiHandler('test_procedures', (req, params) =>
  llm.generateTestProcedures({ ...params, controlId: req.params.controlId })
));

// ======================== ASSET RISK ========================
router.post('/analyze/asset/:id', checkAIUsage, aiHandler('asset_risk', (req, params) =>
  llm.analyzeAssetRisk({ ...params, assetId: req.params.id })
));

// ======================== POLICY GENERATOR ========================
router.post('/generate-policy', checkAIUsage, aiHandler('policy_generator', (req, params) =>
  llm.generatePolicy({ ...params, policyType: req.body.policyType })
));

// ======================== CHAT ========================
router.post('/chat', checkAIUsage, aiHandler('chat', (req, params) =>
  llm.chat({ ...params, messages: req.body.messages, systemPrompt: req.body.systemPrompt })
));

module.exports = router;
