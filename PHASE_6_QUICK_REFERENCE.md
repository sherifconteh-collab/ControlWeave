# Phase 6: AI-Powered Analysis - Quick Reference

## 🚀 Quick Start

### 1. Calculate Risk Score
```bash
POST /api/v1/phase6/risk-score/calculate
```

### 2. Analyze Regulatory Impact
```bash
POST /api/v1/phase6/regulatory-impact/analyze
{
  "frameworkCode": "nist_800_53",
  "changeType": "new_requirement",
  "changeDescription": "Description of the change",
  "provider": "claude"
}
```

### 3. Generate Remediation Plan
```bash
POST /api/v1/phase6/remediation/generate
{
  "controlId": 123,
  "provider": "claude"
}
```

## 📊 Risk Score Grades

| Grade | Score | Meaning |
|-------|-------|---------|
| A+ | 95-100 | Excellent |
| A | 90-94 | Very Good |
| B | 70-89 | Good |
| C | 55-69 | Fair |
| D | 40-54 | Poor |
| F | 0-39 | Failing |

## 🎯 Impact Levels

| Level | Score | Description |
|-------|-------|-------------|
| Critical | 90-100 | Major regulatory change |
| High | 70-89 | Substantial impact |
| Medium | 40-69 | Moderate impact |
| Low | 20-39 | Minor impact |
| Minimal | 0-19 | Negligible impact |

## ⚡ Priority Levels

| Level | Score | Action Timeline |
|-------|-------|----------------|
| Critical | 80-100 | Immediate |
| High | 60-79 | Within 30 days |
| Medium | 40-59 | Within 90 days |
| Low | 0-39 | As resources allow |

## 🔍 All Endpoints

### Risk Scoring
- `POST /api/v1/phase6/risk-score/calculate` - Calculate risk score
- `GET /api/v1/phase6/risk-score/latest` - Get latest score
- `GET /api/v1/phase6/risk-score/history` - Get score history

### Regulatory Impact
- `POST /api/v1/phase6/regulatory-impact/analyze` - Analyze impact
- `GET /api/v1/phase6/regulatory-impact/assessments` - List assessments
- `PUT /api/v1/phase6/regulatory-impact/assessments/:id/review` - Review assessment

### Remediation Plans
- `POST /api/v1/phase6/remediation/generate` - Generate plan
- `GET /api/v1/phase6/remediation/plans` - List plans
- `PUT /api/v1/phase6/remediation/plans/:id/status` - Update status

### Comprehensive Analysis
- `POST /api/v1/phase6/analyze/comprehensive` - Run all analyses

## 📈 Score Components

Risk Score = 
- **40%** Control Implementation
- **25%** Vulnerability Management
- **20%** Evidence Freshness
- **15%** Assessment Coverage

## 🗄️ Database Tables

1. **risk_scores** - Stores risk scores with trends
2. **regulatory_impact_assessments** - Tracks regulatory changes
3. **remediation_plans** - Smart remediation plans

## 🔐 Required Permissions

- `ai.use` - Generate analyses
- `compliance.read` - View results
- `compliance.manage` - Approve/update assessments

## 💡 Common Use Cases

### Monitor Compliance Health
1. Calculate risk score weekly
2. Track trend direction
3. Review component scores
4. Address critical gaps

### Respond to Regulatory Changes
1. Analyze new regulation impact
2. Review AI assessment
3. Approve implementation plan
4. Track compliance deadline

### Close Control Gaps
1. Generate remediation plan for control
2. Review estimated effort
3. Assign to team member
4. Track progress to completion

## 📞 Support

- Full docs: `PHASE_6_AI_POWERED_ANALYSIS.md`
- API errors include correlation IDs
- Check logs for detailed error messages
