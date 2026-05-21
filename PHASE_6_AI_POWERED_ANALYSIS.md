# Phase 6: AI-Powered Analysis - Implementation Plan

## Overview

This phase adds intelligent AI-powered features that provide predictive analytics, automated regulatory impact analysis, and smart remediation recommendations. These features leverage LLM capabilities to help organizations proactively manage compliance risks.

## Scope

### 1. Automated Regulatory Impact Analysis

#### Feature Description
When new regulatory changes are detected or added to the system, automatically analyze their impact on the organization's current compliance posture and provide actionable recommendations.

#### Implementation

**Backend Service**:
```javascript
// backend/src/services/regulatoryImpactAnalysisService.js
const { callLLM } = require('./llmService');
const { pool } = require('../config/database');

class RegulatoryImpactAnalysisService {
  async analyzeRegulatoryChange(changeId, organizationId) {
    // Get regulatory change details
    const changeResult = await pool.query(
      `SELECT rc.*, rj.jurisdiction_name, rj.jurisdiction_code
       FROM regulatory_changes rc
       JOIN regulatory_jurisdictions rj ON rc.jurisdiction_id = rj.id
       WHERE rc.id = $1`,
      [changeId]
    );
    
    if (changeResult.rows.length === 0) {
      throw new Error('Regulatory change not found');
    }
    
    const change = changeResult.rows[0];
    
    // Get organization context
    const orgContext = await this.getOrganizationContext(organizationId);
    
    // Get affected frameworks and controls
    const affectedControls = await this.getAffectedControls(
      change.affected_frameworks,
      change.affected_controls
    );
    
    // Build analysis prompt
    const prompt = this.buildAnalysisPrompt(change, orgContext, affectedControls);
    
    // Call LLM for analysis
    const analysis = await callLLM(organizationId, prompt, {
      feature: 'regulatory_impact_analysis',
      model_preference: 'advanced', // Use best available model
      temperature: 0.3, // Lower temperature for analytical tasks
      max_tokens: 2000
    });
    
    // Parse and structure the analysis
    const structuredAnalysis = this.parseAnalysis(analysis);
    
    // Store analysis results
    await this.storeAnalysis(changeId, organizationId, structuredAnalysis);
    
    return structuredAnalysis;
  }
  
  buildAnalysisPrompt(change, orgContext, affectedControls) {
    return `You are a compliance expert analyzing the impact of a new regulatory change.

**Regulatory Change:**
Title: ${change.change_title}
Type: ${change.change_type}
Jurisdiction: ${change.jurisdiction_name} (${change.jurisdiction_code})
Summary: ${change.summary}
Effective Date: ${change.effective_date}
Compliance Deadline: ${change.compliance_deadline}

**Organization Context:**
- Active Frameworks: ${orgContext.frameworks.join(', ')}
- Jurisdictions: ${orgContext.jurisdictions.join(', ')}
- AI Systems: ${orgContext.ai_systems_count}
- High-Risk AI Systems: ${orgContext.high_risk_ai_count}
- Vendors: ${orgContext.vendor_count}

**Potentially Affected Controls:**
${affectedControls.map(c => `- ${c.framework_name}: ${c.control_id} - ${c.title}`).join('\n')}

**Analysis Required:**
1. **Impact Assessment** (Low/Medium/High/Critical):
   - Overall organizational impact
   - Specific areas affected (technical, policy, operational)
   - Resource requirements

2. **Gap Analysis**:
   - Current compliance gaps that this change addresses
   - New gaps created by this change
   - Priority of addressing each gap

3. **Action Items** (prioritized list):
   - Specific actions required to achieve compliance
   - Responsible parties (Technical Team, Compliance Officer, Legal, etc.)
   - Estimated effort (hours/days)
   - Dependencies

4. **Timeline**:
   - Recommended implementation timeline
   - Milestones and checkpoints
   - Risk of non-compliance if delayed

5. **Budget Estimate**:
   - Estimated cost range for compliance implementation
   - Cost breakdown (personnel, tools, consulting, etc.)

Please provide a structured analysis in JSON format with these sections.`;
  }
  
  parseAnalysis(analysisText) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = analysisText.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      
      // If no JSON block, try parsing the whole response
      return JSON.parse(analysisText);
    } catch (error) {
      // Fallback: return as unstructured text
      return {
        raw_analysis: analysisText,
        structured: false
      };
    }
  }
  
  async storeAnalysis(changeId, organizationId, analysis) {
    await pool.query(
      `INSERT INTO regulatory_change_analyses (
        regulatory_change_id,
        organization_id,
        impact_level,
        gap_analysis,
        action_items,
        timeline,
        budget_estimate,
        raw_analysis,
        generated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        changeId,
        organizationId,
        analysis.impact_assessment?.overall_impact || 'unknown',
        JSON.stringify(analysis.gap_analysis || {}),
        JSON.stringify(analysis.action_items || []),
        JSON.stringify(analysis.timeline || {}),
        JSON.stringify(analysis.budget_estimate || {}),
        JSON.stringify(analysis)
      ]
    );
  }
  
  async getOrganizationContext(organizationId) {
    const frameworks = await pool.query(
      `SELECT f.name FROM organization_frameworks of
       JOIN frameworks f ON of.framework_id = f.id
       WHERE of.organization_id = $1 AND of.is_active = true`,
      [organizationId]
    );
    
    const jurisdictions = await pool.query(
      `SELECT rj.jurisdiction_name FROM organization_jurisdictions oj
       JOIN regulatory_jurisdictions rj ON oj.jurisdiction_id = rj.id
       WHERE oj.organization_id = $1`,
      [organizationId]
    );
    
    const aiSystems = await pool.query(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE risk_classification IN ('high', 'unacceptable')) as high_risk
       FROM ai_boms WHERE organization_id = $1 AND is_active = true`,
      [organizationId]
    );
    
    const vendors = await pool.query(
      `SELECT COUNT(*) FROM ai_vendor_assessments
       WHERE organization_id = $1 AND status = 'active'`,
      [organizationId]
    );
    
    return {
      frameworks: frameworks.rows.map(r => r.name),
      jurisdictions: jurisdictions.rows.map(r => r.jurisdiction_name),
      ai_systems_count: parseInt(aiSystems.rows[0].total),
      high_risk_ai_count: parseInt(aiSystems.rows[0].high_risk),
      vendor_count: parseInt(vendors.rows[0].count)
    };
  }
  
  async getAffectedControls(frameworkCodes, controlIds) {
    if (!frameworkCodes || frameworkCodes.length === 0) {
      return [];
    }
    
    const result = await pool.query(
      `SELECT f.name as framework_name, fc.control_id, fc.title
       FROM framework_controls fc
       JOIN frameworks f ON fc.framework_id = f.id
       WHERE f.code = ANY($1::text[])
       AND ($2::text[] IS NULL OR fc.control_id = ANY($2::text[]))
       LIMIT 20`,
      [frameworkCodes, controlIds || null]
    );
    
    return result.rows;
  }
}

module.exports = new RegulatoryImpactAnalysisService();
```

**API Endpoint**:
```javascript
// backend/src/routes/dataSovereignty.js

// Trigger regulatory impact analysis
router.post('/regulatory-changes/:id/analyze', authenticateToken, auditLog('regulatory_change_analyze'), async (req, res) => {
  try {
    const { organization_id } = req.user;
    const { id } = req.params;
    
    const analysisService = require('../services/regulatoryImpactAnalysisService');
    const analysis = await analysisService.analyzeRegulatoryChange(id, organization_id);
    
    res.json({ success: true, data: analysis });
  } catch (error) {
    console.error('Error analyzing regulatory change:', error);
    res.status(500).json({ error: 'Failed to analyze regulatory change' });
  }
});

// Get analysis results
router.get('/regulatory-changes/:id/analysis', authenticateToken, async (req, res) => {
  try {
    const { organization_id } = req.user;
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT * FROM regulatory_change_analyses
       WHERE regulatory_change_id = $1 AND organization_id = $2
       ORDER BY generated_at DESC LIMIT 1`,
      [id, organization_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching analysis:', error);
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
});
```

### 2. Predictive Compliance Risk Scoring

#### Feature Description
Use historical data and ML models to predict future compliance risks, identify trends, and alert organizations before issues become critical.

#### Implementation

**Risk Prediction Service**:
```javascript
// backend/src/services/predictiveRiskService.js

class PredictiveRiskService {
  async calculateOrganizationRiskScore(organizationId) {
    // Gather risk factors
    const factors = await this.gatherRiskFactors(organizationId);
    
    // Calculate weighted risk score
    const riskScore = this.calculateWeightedScore(factors);
    
    // Use LLM to provide contextual analysis
    const analysis = await this.generateRiskAnalysis(organizationId, factors, riskScore);
    
    // Store prediction
    await this.storePrediction(organizationId, riskScore, factors, analysis);
    
    return {
      risk_score: riskScore,
      risk_level: this.getRiskLevel(riskScore),
      factors,
      analysis,
      predicted_at: new Date()
    };
  }
  
  async gatherRiskFactors(organizationId) {
    // Control implementation status
    const controlCoverage = await this.getControlCoverage(organizationId);
    
    // Overdue assessments
    const overdueAssessments = await this.getOverdueAssessments(organizationId);
    
    // Open POA&Ms
    const openPoams = await this.getOpenPoams(organizationId);
    
    // Unreviewed high-risk AI decisions
    const unreviewedHighRisk = await this.getUnreviewedHighRiskDecisions(organizationId);
    
    // Open monitoring events
    const openMonitoringEvents = await this.getOpenMonitoringEvents(organizationId);
    
    // Vendor risk exposure
    const vendorRisk = await this.getVendorRiskExposure(organizationId);
    
    // Regulatory compliance status
    const jurisdictionCompliance = await this.getJurisdictionCompliance(organizationId);
    
    // Trend analysis
    const trends = await this.analyzeTrends(organizationId);
    
    return {
      control_coverage: controlCoverage,
      overdue_assessments: overdueAssessments,
      open_poams: openPoams,
      unreviewed_high_risk_decisions: unreviewedHighRisk,
      open_monitoring_events: openMonitoringEvents,
      vendor_risk: vendorRisk,
      jurisdiction_compliance: jurisdictionCompliance,
      trends
    };
  }
  
  calculateWeightedScore(factors) {
    // Weighted scoring algorithm
    const weights = {
      control_coverage: 0.25,
      overdue_assessments: 0.15,
      open_poams: 0.15,
      unreviewed_high_risk: 0.15,
      monitoring_events: 0.10,
      vendor_risk: 0.10,
      jurisdiction_compliance: 0.10
    };
    
    let score = 0;
    
    // Control coverage (inverse - higher coverage = lower risk)
    score += (1 - factors.control_coverage.percentage / 100) * weights.control_coverage * 100;
    
    // Overdue assessments (normalized)
    const overdueNorm = Math.min(factors.overdue_assessments.count / 10, 1);
    score += overdueNorm * weights.overdue_assessments * 100;
    
    // Open POA&Ms
    const poamNorm = Math.min(factors.open_poams.high_priority_count / 5, 1);
    score += poamNorm * weights.open_poams * 100;
    
    // Unreviewed high-risk decisions
    const unreviewedNorm = Math.min(factors.unreviewed_high_risk_decisions.count / 20, 1);
    score += unreviewedNorm * weights.unreviewed_high_risk * 100;
    
    // Monitoring events
    const eventsNorm = Math.min(factors.open_monitoring_events.critical_count / 5, 1);
    score += eventsNorm * weights.monitoring_events * 100;
    
    // Vendor risk
    const vendorNorm = factors.vendor_risk.critical_vendors_count / Math.max(factors.vendor_risk.total_vendors, 1);
    score += vendorNorm * weights.vendor_risk * 100;
    
    // Jurisdiction compliance
    const jurisdictionNorm = factors.jurisdiction_compliance.non_compliant_count / 
                             Math.max(factors.jurisdiction_compliance.total_jurisdictions, 1);
    score += jurisdictionNorm * weights.jurisdiction_compliance * 100;
    
    return Math.round(score);
  }
  
  getRiskLevel(score) {
    if (score < 25) return 'low';
    if (score < 50) return 'medium';
    if (score < 75) return 'high';
    return 'critical';
  }
  
  async generateRiskAnalysis(organizationId, factors, riskScore) {
    const prompt = `You are a compliance risk analyst. Analyze the following risk factors and provide insights.

**Risk Score: ${riskScore}/100 (${this.getRiskLevel(riskScore)})**

**Risk Factors:**
- Control Coverage: ${factors.control_coverage.percentage}% (${factors.control_coverage.implemented}/${factors.control_coverage.total})
- Overdue Assessments: ${factors.overdue_assessments.count}
- Open POA&Ms: ${factors.open_poams.total_count} (${factors.open_poams.high_priority_count} high priority)
- Unreviewed High-Risk AI Decisions: ${factors.unreviewed_high_risk_decisions.count}
- Open Monitoring Events: ${factors.open_monitoring_events.total} (${factors.open_monitoring_events.critical_count} critical)
- Vendor Risk: ${factors.vendor_risk.critical_vendors_count}/${factors.vendor_risk.total_vendors} vendors at critical/high risk
- Jurisdiction Compliance: ${factors.jurisdiction_compliance.compliant_count}/${factors.jurisdiction_compliance.total_jurisdictions} compliant

**Trends (Last 30 Days):**
- POA&Ms Resolved: ${factors.trends.poams_resolved}
- New Vulnerabilities: ${factors.trends.new_vulnerabilities}
- Monitoring Events: ${factors.trends.monitoring_events_trend}

Provide:
1. Top 3 risk areas requiring immediate attention
2. Predicted risk trajectory (improving/stable/deteriorating)
3. Recommended actions to reduce risk score
4. Estimated timeline to reach "low" risk level

Keep the analysis concise and actionable (max 300 words).`;
    
    const analysis = await callLLM(organizationId, prompt, {
      feature: 'predictive_risk_analysis',
      temperature: 0.4,
      max_tokens: 500
    });
    
    return analysis;
  }
  
  async storePrediction(organizationId, riskScore, factors, analysis) {
    await pool.query(
      `INSERT INTO compliance_risk_predictions (
        organization_id,
        risk_score,
        risk_level,
        risk_factors,
        ai_analysis,
        predicted_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        organizationId,
        riskScore,
        this.getRiskLevel(riskScore),
        JSON.stringify(factors),
        analysis
      ]
    );
  }
}

module.exports = new PredictiveRiskService();
```

### 3. Smart Remediation Recommendations

#### Feature Description
Automatically generate step-by-step remediation plans for identified compliance gaps, control failures, and security findings.

#### Implementation

**Remediation Service**:
```javascript
// backend/src/services/smartRemediationService.js

class SmartRemediationService {
  async generateRemediationPlan(finding) {
    // finding can be: POA&M, vulnerability, control gap, monitoring event, etc.
    
    const context = await this.gatherRemediationContext(finding);
    const plan = await this.generateAIPlan(finding, context);
    
    return {
      finding_id: finding.id,
      finding_type: finding.type,
      remediation_plan: plan,
      generated_at: new Date()
    };
  }
  
  async generateAIPlan(finding, context) {
    const prompt = `You are a cybersecurity and compliance remediation expert. Generate a detailed remediation plan.

**Finding:**
Type: ${finding.type}
Title: ${finding.title}
Description: ${finding.description}
Severity: ${finding.severity}
Affected System: ${finding.affected_system}

**Context:**
- Framework: ${context.framework}
- Control: ${context.control_id} - ${context.control_title}
- Organization Type: ${context.org_type}
- Available Resources: ${context.resources}
- Budget Constraint: ${context.budget_constraint}

**Generate a remediation plan with:**

1. **Executive Summary** (2-3 sentences)

2. **Root Cause Analysis**
   - Likely root causes
   - Contributing factors

3. **Remediation Steps** (numbered, specific, actionable)
   - Each step should include:
     * Action description
     * Responsible party (role, not name)
     * Estimated effort (hours/days)
     * Dependencies
     * Verification method

4. **Timeline**
   - Immediate actions (0-7 days)
   - Short-term (1-4 weeks)
   - Long-term (1-3 months)

5. **Resource Requirements**
   - Personnel (roles and time commitment)
   - Tools or services needed
   - Estimated budget

6. **Success Criteria**
   - Measurable outcomes
   - How to verify remediation

7. **Risk Considerations**
   - Risks if not remediated
   - Risks during remediation
   - Mitigation strategies

Provide the plan in a structured format.`;
    
    const plan = await callLLM(context.organization_id, prompt, {
      feature: 'smart_remediation',
      temperature: 0.5,
      max_tokens: 1500
    });
    
    return plan;
  }
  
  async gatherRemediationContext(finding) {
    // Gather relevant context about the organization, affected systems, etc.
    const orgContext = await pool.query(
      `SELECT tier, industry FROM organizations WHERE id = $1`,
      [finding.organization_id]
    );
    
    // Get control details if applicable
    let controlContext = {};
    if (finding.control_id) {
      const controlResult = await pool.query(
        `SELECT fc.control_id, fc.title, f.name as framework_name
         FROM framework_controls fc
         JOIN frameworks f ON fc.framework_id = f.id
         WHERE fc.id = $1`,
        [finding.control_id]
      );
      if (controlResult.rows.length > 0) {
        controlContext = controlResult.rows[0];
      }
    }
    
    return {
      organization_id: finding.organization_id,
      framework: controlContext.framework_name || 'N/A',
      control_id: controlContext.control_id || 'N/A',
      control_title: controlContext.title || 'N/A',
      org_type: orgContext.rows[0]?.industry || 'General',
      resources: orgContext.rows[0]?.tier || 'unknown',
      budget_constraint: this.getBudgetConstraintByTier(orgContext.rows[0]?.tier)
    };
  }
  
  getBudgetConstraintByTier(tier) {
    const constraints = {
      free: 'Minimal budget, focus on low-cost solutions',
      starter: 'Limited budget ($1K-$5K)',
      professional: 'Moderate budget ($5K-$25K)',
      enterprise: 'Flexible budget, can invest in comprehensive solutions'
    };
    return constraints[tier] || 'Unknown budget';
  }
}

module.exports = new SmartRemediationService();
```

### 4. Compliance Trend Analysis

#### Feature Description
Analyze compliance trends over time and provide predictive insights about future compliance state.

#### Implementation

**API Endpoint**:
```javascript
// backend/src/routes/analytics.js

router.get('/compliance-trends', authenticateToken, async (req, res) => {
  try {
    const { organization_id } = req.user;
    const { days = 90 } = req.query;
    
    const trends = await this.calculateTrends(organization_id, days);
    const prediction = await this.predictFutureTrends(organization_id, trends);
    
    res.json({
      success: true,
      data: {
        historical: trends,
        prediction: prediction
      }
    });
  } catch (error) {
    console.error('Error calculating trends:', error);
    res.status(500).json({ error: 'Failed to calculate trends' });
  }
});
```

## Database Schema

### Regulatory Change Analyses Table

```sql
CREATE TABLE IF NOT EXISTS regulatory_change_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regulatory_change_id UUID NOT NULL REFERENCES regulatory_changes(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Analysis results
  impact_level VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
  gap_analysis JSONB,
  action_items JSONB,
  timeline JSONB,
  budget_estimate JSONB,
  raw_analysis JSONB,
  
  -- Metadata
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by_user UUID REFERENCES users(id),
  
  UNIQUE (regulatory_change_id, organization_id)
);

CREATE INDEX idx_reg_change_analyses_org ON regulatory_change_analyses (organization_id);
CREATE INDEX idx_reg_change_analyses_change ON regulatory_change_analyses (regulatory_change_id);
```

### Compliance Risk Predictions Table

```sql
CREATE TABLE IF NOT EXISTS compliance_risk_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Prediction results
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level VARCHAR(20) NOT NULL,
  risk_factors JSONB NOT NULL,
  ai_analysis TEXT,
  
  -- Prediction metadata
  predicted_at TIMESTAMPTZ DEFAULT NOW(),
  prediction_horizon_days INTEGER DEFAULT 30,
  
  -- Actual outcome (for model improvement)
  actual_risk_score INTEGER CHECK (actual_risk_score >= 0 AND actual_risk_score <= 100),
  outcome_recorded_at TIMESTAMPTZ
);

CREATE INDEX idx_risk_predictions_org ON compliance_risk_predictions (organization_id);
CREATE INDEX idx_risk_predictions_date ON compliance_risk_predictions (predicted_at DESC);
```

### Remediation Plans Table

```sql
CREATE TABLE IF NOT EXISTS ai_remediation_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Finding reference
  finding_type VARCHAR(50) NOT NULL, -- 'poam', 'vulnerability', 'control_gap', 'monitoring_event'
  finding_id UUID NOT NULL,
  finding_title VARCHAR(500),
  
  -- Remediation plan
  plan_summary TEXT,
  root_cause_analysis TEXT,
  remediation_steps JSONB,
  timeline JSONB,
  resource_requirements JSONB,
  success_criteria TEXT,
  risk_considerations TEXT,
  raw_plan TEXT,
  
  -- Plan status
  status VARCHAR(50) DEFAULT 'generated', -- 'generated', 'approved', 'in_progress', 'completed', 'rejected'
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  
  -- Metadata
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by_user UUID REFERENCES users(id)
);

CREATE INDEX idx_remediation_plans_org ON ai_remediation_plans (organization_id);
CREATE INDEX idx_remediation_plans_finding ON ai_remediation_plans (finding_type, finding_id);
CREATE INDEX idx_remediation_plans_status ON ai_remediation_plans (organization_id, status);
```

## Frontend Components

### Regulatory Impact Analysis View

```typescript
// components/data-sovereignty/RegulatoryImpactAnalysis.tsx

export function RegulatoryImpactAnalysis({ changeId }: { changeId: string }) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const runAnalysis = async () => {
    setLoading(true);
    try {
      const response = await apiClient.post(
        `/data-sovereignty/regulatory-changes/${changeId}/analyze`
      );
      setAnalysis(response.data.data);
    } catch (error) {
      toast.error('Failed to analyze regulatory change');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">AI Impact Analysis</h3>
        <Button onClick={runAnalysis} disabled={loading}>
          {loading ? 'Analyzing...' : 'Run Analysis'}
        </Button>
      </div>
      
      {analysis && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Impact Assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={getImpactVariant(analysis.impact_assessment.overall_impact)}>
                {analysis.impact_assessment.overall_impact.toUpperCase()}
              </Badge>
              <p className="mt-2">{analysis.impact_assessment.description}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Gap Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              {analysis.gap_analysis.gaps.map((gap, index) => (
                <div key={index} className="mb-4 p-4 border rounded">
                  <h4 className="font-semibold">{gap.area}</h4>
                  <p>{gap.description}</p>
                  <Badge>{gap.priority}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Action Items</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {analysis.action_items.map((item, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2 font-bold">{index + 1}.</span>
                    <div>
                      <p className="font-medium">{item.action}</p>
                      <p className="text-sm text-gray-600">
                        Owner: {item.responsible_party} | Effort: {item.estimated_effort}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
```

## Acceptance Criteria

- [ ] Regulatory changes can be automatically analyzed for impact
- [ ] Analysis provides actionable recommendations
- [ ] Risk scores are calculated and displayed on dashboard
- [ ] Risk predictions are updated daily
- [ ] Remediation plans are generated for findings
- [ ] Remediation plans can be approved and tracked
- [ ] Trend analysis shows historical and predicted compliance state
- [ ] All AI-generated content includes disclaimer
- [ ] Users can provide feedback on AI recommendations
- [ ] LLM costs are tracked per feature

## Performance & Cost Management

- Implement caching for similar analyses
- Rate limit AI-powered features per tier
- Track token usage and costs
- Use cheaper models for non-critical features
- Batch analysis requests when possible

---

**Ready for Development**: After Phase 4-5 completion
**Dependencies**: LLM integration, historical compliance data
**Estimated Timeline**: 4-5 weeks
**Team Size**: 1-2 backend developers with ML/AI experience
