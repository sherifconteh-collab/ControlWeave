const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate, requireTier, requirePermission } = require('../middleware/auth');

router.use(authenticate);

// GET /dashboard/stats
router.get('/stats', requirePermission('dashboard.read'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;

    // Overall compliance
    const overallResult = await pool.query(`
      SELECT
        COUNT(DISTINCT fc.id) as total_controls,
        COUNT(DISTINCT CASE WHEN ci.status = 'implemented' THEN ci.id END) as implemented,
        COUNT(DISTINCT CASE WHEN ci.status = 'satisfied_via_crosswalk' THEN ci.id END) as satisfied_via_crosswalk,
        COUNT(DISTINCT fc.id) as total_applicable
      FROM organization_frameworks of2
      JOIN framework_controls fc ON fc.framework_id = of2.framework_id
      LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $1
      WHERE of2.organization_id = $1
    `, [orgId]);

    const overall = overallResult.rows[0];
    const totalControls = parseInt(overall.total_controls) || 0;
    const implemented = parseInt(overall.implemented) || 0;
    const crosswalked = parseInt(overall.satisfied_via_crosswalk) || 0;
    const compliancePercentage = totalControls > 0
      ? Math.round(((implemented + crosswalked) / totalControls) * 1000) / 10
      : 0;

    // Per-framework breakdown
    const frameworkResult = await pool.query(`
      SELECT
        f.id, f.name, f.code,
        COUNT(DISTINCT fc.id) as total_controls,
        COUNT(DISTINCT CASE WHEN ci.status = 'implemented' THEN ci.id END) as implemented,
        COUNT(DISTINCT CASE WHEN ci.status = 'satisfied_via_crosswalk' THEN ci.id END) as crosswalked
      FROM organization_frameworks of2
      JOIN frameworks f ON f.id = of2.framework_id
      JOIN framework_controls fc ON fc.framework_id = f.id
      LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $1
      WHERE of2.organization_id = $1
      GROUP BY f.id, f.name, f.code
      ORDER BY f.name
    `, [orgId]);

    const frameworks = frameworkResult.rows.map(fw => ({
      id: fw.id,
      name: fw.name,
      code: fw.code,
      totalControls: parseInt(fw.total_controls),
      implemented: parseInt(fw.implemented),
      crosswalked: parseInt(fw.crosswalked),
      compliancePercentage: parseInt(fw.total_controls) > 0
        ? Math.round(((parseInt(fw.implemented) + parseInt(fw.crosswalked)) / parseInt(fw.total_controls)) * 1000) / 10
        : 0
    }));

    res.json({
      success: true,
      data: {
        overall: {
          totalControls,
          implemented,
          satisfiedViaCrosswalk: crosswalked,
          totalApplicable: totalControls,
          compliancePercentage
        },
        frameworks
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to load dashboard stats' });
  }
});

// GET /dashboard/priority-actions
router.get('/priority-actions', requirePermission('dashboard.read'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;

    const result = await pool.query(`
      SELECT fc.id, fc.control_id, fc.title, fc.priority, f.name as framework_name, f.code as framework_code,
             COALESCE(ci.status, 'not_started') as status
      FROM organization_frameworks of2
      JOIN framework_controls fc ON fc.framework_id = of2.framework_id
      JOIN frameworks f ON f.id = fc.framework_id
      LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $1
      WHERE of2.organization_id = $1
        AND (ci.status IS NULL OR ci.status = 'not_started')
        AND fc.priority IN ('P1', 'high', 'critical')
      ORDER BY fc.priority, f.name
      LIMIT 20
    `, [orgId]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Priority actions error:', error);
    res.status(500).json({ success: false, error: 'Failed to load priority actions' });
  }
});

// GET /dashboard/recent-activity
router.get('/recent-activity', requirePermission('dashboard.read'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;

    const result = await pool.query(`
      SELECT al.id, al.event_type, al.resource_type, al.details, al.created_at,
             u.first_name, u.last_name, u.email
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.organization_id = $1
      ORDER BY al.created_at DESC
      LIMIT 20
    `, [orgId]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Recent activity error:', error);
    res.status(500).json({ success: false, error: 'Failed to load recent activity' });
  }
});

// GET /dashboard/compliance-trend
router.get('/compliance-trend', requirePermission('dashboard.read'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const period = req.query.period || '30d';

    let days = 30;
    if (period === '7d') days = 7;
    else if (period === '90d') days = 90;
    else if (period === '1y') days = 365;

    // Get current compliance snapshot
    const result = await pool.query(`
      SELECT
        DATE(ci.created_at) as date,
        COUNT(DISTINCT CASE WHEN ci.status = 'implemented' THEN ci.id END) as implemented,
        COUNT(DISTINCT ci.id) as total_changes
      FROM control_implementations ci
      WHERE ci.organization_id = $1
        AND ci.created_at >= NOW() - ($2 || ' days')::INTERVAL
      GROUP BY DATE(ci.created_at)
      ORDER BY date
    `, [orgId, days.toString()]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Compliance trend error:', error);
    res.status(500).json({ success: false, error: 'Failed to load compliance trend' });
  }
});

// GET /dashboard/crosswalk-impact
router.get('/crosswalk-impact', requirePermission('dashboard.read'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;

    const result = await pool.query(`
      SELECT
        f.name as framework_name, f.code as framework_code,
        COUNT(DISTINCT CASE WHEN ci.status = 'satisfied_via_crosswalk' THEN ci.id END) as crosswalk_count,
        COUNT(DISTINCT fc.id) as total_controls
      FROM organization_frameworks of2
      JOIN frameworks f ON f.id = of2.framework_id
      JOIN framework_controls fc ON fc.framework_id = f.id
      LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $1
      WHERE of2.organization_id = $1
      GROUP BY f.name, f.code
      HAVING COUNT(DISTINCT CASE WHEN ci.status = 'satisfied_via_crosswalk' THEN ci.id END) > 0
      ORDER BY crosswalk_count DESC
    `, [orgId]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Crosswalk impact error:', error);
    res.status(500).json({ success: false, error: 'Failed to load crosswalk impact' });
  }
});

// GET /dashboard/maturity-score (Professional+ only)
router.get('/maturity-score', requireTier('professional'), requirePermission('dashboard.read'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;

    // Gather metrics for maturity calculation
    const controlsResult = await pool.query(`
      SELECT
        COUNT(DISTINCT fc.id) as total_controls,
        COUNT(DISTINCT CASE WHEN ci.status = 'implemented' THEN ci.id END) as implemented,
        COUNT(DISTINCT CASE WHEN ci.status = 'satisfied_via_crosswalk' THEN ci.id END) as crosswalked,
        COUNT(DISTINCT CASE WHEN ci.status = 'in_progress' THEN ci.id END) as in_progress,
        COUNT(DISTINCT CASE WHEN ci.assigned_to IS NOT NULL THEN ci.id END) as assigned
      FROM organization_frameworks of2
      JOIN framework_controls fc ON fc.framework_id = of2.framework_id
      LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $1
      WHERE of2.organization_id = $1
    `, [orgId]);

    const frameworksResult = await pool.query(
      'SELECT COUNT(*) as count FROM organization_frameworks WHERE organization_id = $1',
      [orgId]
    );

    const evidenceResult = await pool.query(
      'SELECT COUNT(*) as count FROM evidence WHERE organization_id = $1',
      [orgId]
    );

    const assessmentResult = await pool.query(`
      SELECT COUNT(*) as count FROM assessment_results ar
      JOIN assessment_procedures ap ON ap.id = ar.assessment_procedure_id
      JOIN framework_controls fc ON fc.id = ap.framework_control_id
      JOIN organization_frameworks of2 ON of2.framework_id = fc.framework_id
      WHERE of2.organization_id = $1
    `, [orgId]);

    const c = controlsResult.rows[0];
    const total = parseInt(c.total_controls) || 1;
    const implemented = parseInt(c.implemented) || 0;
    const crosswalked = parseInt(c.crosswalked) || 0;
    const inProgress = parseInt(c.in_progress) || 0;
    const assigned = parseInt(c.assigned) || 0;
    const frameworks = parseInt(frameworksResult.rows[0].count) || 0;
    const evidence = parseInt(evidenceResult.rows[0].count) || 0;
    const assessments = parseInt(assessmentResult.rows[0].count) || 0;

    // Maturity scoring (CMMI-inspired, 1.0 - 5.0)
    // Dimension scores (0-100 each)
    const compliancePct = ((implemented + crosswalked) / total) * 100;
    const coveragePct = Math.min((assigned / total) * 100, 100);
    const evidencePct = Math.min((evidence / Math.max(implemented, 1)) * 50, 100); // 2 evidence per impl = 100%
    const assessmentPct = Math.min((assessments / Math.max(total * 0.1, 1)) * 100, 100);
    const frameworkPct = Math.min((frameworks / 3) * 100, 100); // 3+ frameworks = 100%

    const dimensions = [
      { name: 'Implementation', score: Math.round(compliancePct), weight: 0.35,
        description: 'Percentage of controls implemented or crosswalked' },
      { name: 'Assignment', score: Math.round(coveragePct), weight: 0.15,
        description: 'Controls assigned to responsible owners' },
      { name: 'Evidence', score: Math.round(evidencePct), weight: 0.20,
        description: 'Evidence documentation collected per implemented control' },
      { name: 'Assessment', score: Math.round(assessmentPct), weight: 0.15,
        description: 'Assessment procedures completed and results recorded' },
      { name: 'Coverage', score: Math.round(frameworkPct), weight: 0.15,
        description: 'Compliance frameworks adopted by the organization' },
    ];

    const weightedScore = dimensions.reduce((sum, d) => sum + (d.score * d.weight), 0);

    // Map 0-100 score to 1.0-5.0 maturity level
    let level, label;
    if (weightedScore >= 80) { level = 5; label = 'Optimizing'; }
    else if (weightedScore >= 60) { level = 4; label = 'Managed'; }
    else if (weightedScore >= 40) { level = 3; label = 'Defined'; }
    else if (weightedScore >= 20) { level = 2; label = 'Repeatable'; }
    else { level = 1; label = 'Initial'; }

    const maturityScore = Math.round((weightedScore / 100) * 4 + 1);

    res.json({
      success: true,
      data: {
        overallScore: Math.min(maturityScore, 5),
        overallPercentage: Math.round(weightedScore),
        level,
        label,
        dimensions,
        recommendations: getRecommendations(dimensions)
      }
    });
  } catch (error) {
    console.error('Maturity score error:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate maturity score' });
  }
});

function getRecommendations(dimensions) {
  const recs = [];
  for (const d of dimensions) {
    if (d.score < 30) {
      recs.push({ dimension: d.name, priority: 'critical', message: `${d.name} is very low (${d.score}%). Focus on improving ${d.description.toLowerCase()}.` });
    } else if (d.score < 60) {
      recs.push({ dimension: d.name, priority: 'medium', message: `${d.name} needs improvement (${d.score}%). Continue working on ${d.description.toLowerCase()}.` });
    }
  }
  return recs;
}

module.exports = router;
