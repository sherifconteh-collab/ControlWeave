const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const pool = require('../config/database');
const { authenticate, requireTier, requirePermission } = require('../middleware/auth');

router.use(authenticate);
router.use(requireTier('starter'));

// Helper: get compliance data for an org
async function getComplianceData(orgId) {
  const overallResult = await pool.query(`
    SELECT
      COUNT(DISTINCT fc.id) as total_controls,
      COUNT(DISTINCT CASE WHEN ci.status = 'implemented' THEN ci.id END) as implemented,
      COUNT(DISTINCT CASE WHEN ci.status = 'satisfied_via_crosswalk' THEN ci.id END) as crosswalked,
      COUNT(DISTINCT CASE WHEN ci.status = 'in_progress' THEN ci.id END) as in_progress,
      COUNT(DISTINCT CASE WHEN ci.status = 'needs_review' THEN ci.id END) as needs_review
    FROM organization_frameworks of2
    JOIN framework_controls fc ON fc.framework_id = of2.framework_id
    LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $1
    WHERE of2.organization_id = $1
  `, [orgId]);

  const frameworkResult = await pool.query(`
    SELECT
      f.name, f.code,
      COUNT(DISTINCT fc.id) as total_controls,
      COUNT(DISTINCT CASE WHEN ci.status = 'implemented' THEN ci.id END) as implemented,
      COUNT(DISTINCT CASE WHEN ci.status = 'satisfied_via_crosswalk' THEN ci.id END) as crosswalked,
      COUNT(DISTINCT CASE WHEN ci.status = 'in_progress' THEN ci.id END) as in_progress
    FROM organization_frameworks of2
    JOIN frameworks f ON f.id = of2.framework_id
    JOIN framework_controls fc ON fc.framework_id = f.id
    LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $1
    WHERE of2.organization_id = $1
    GROUP BY f.id, f.name, f.code
    ORDER BY f.name
  `, [orgId]);

  const controlsResult = await pool.query(`
    SELECT fc.control_id, fc.title, fc.priority,
           f.name as framework_name, f.code as framework_code,
           COALESCE(ci.status, 'not_started') as status,
           ci.notes, ci.implementation_date,
           u.first_name || ' ' || u.last_name as assigned_to
    FROM organization_frameworks of2
    JOIN framework_controls fc ON fc.framework_id = of2.framework_id
    JOIN frameworks f ON f.id = fc.framework_id
    LEFT JOIN control_implementations ci ON ci.control_id = fc.id AND ci.organization_id = $1
    LEFT JOIN users u ON u.id = ci.assigned_to
    WHERE of2.organization_id = $1
    ORDER BY f.name, fc.control_id
  `, [orgId]);

  return {
    overall: overallResult.rows[0],
    frameworks: frameworkResult.rows,
    controls: controlsResult.rows
  };
}

// GET /reports/compliance/pdf
router.get('/compliance/pdf', requirePermission('reports.read'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const orgName = req.user.organization_name;
    const data = await getComplianceData(orgId);
    const overall = data.overall;
    const total = parseInt(overall.total_controls) || 1;
    const implemented = parseInt(overall.implemented) || 0;
    const crosswalked = parseInt(overall.crosswalked) || 0;
    const compliancePct = Math.round(((implemented + crosswalked) / total) * 100);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="compliance-report-${new Date().toISOString().split('T')[0]}.pdf"`);
    doc.pipe(res);

    // Title page
    doc.fontSize(28).fillColor('#7c3aed').text('Compliance Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(16).fillColor('#374151').text(orgName, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(12).fillColor('#6b7280').text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: 'center' });
    doc.moveDown(2);

    // Executive Summary
    doc.fontSize(18).fillColor('#111827').text('Executive Summary');
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
    doc.moveDown(0.5);

    doc.fontSize(11).fillColor('#374151');
    doc.text(`Overall Compliance: ${compliancePct}%`);
    doc.text(`Total Controls: ${total}`);
    doc.text(`Implemented: ${implemented}`);
    doc.text(`Satisfied via Crosswalk: ${crosswalked}`);
    doc.text(`In Progress: ${overall.in_progress || 0}`);
    doc.text(`Needs Review: ${overall.needs_review || 0}`);
    doc.text(`Not Started: ${total - implemented - crosswalked - (parseInt(overall.in_progress) || 0) - (parseInt(overall.needs_review) || 0)}`);
    doc.moveDown(1.5);

    // Framework breakdown
    doc.fontSize(18).fillColor('#111827').text('Framework Breakdown');
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
    doc.moveDown(0.5);

    for (const fw of data.frameworks) {
      const fwTotal = parseInt(fw.total_controls);
      const fwImpl = parseInt(fw.implemented) + parseInt(fw.crosswalked);
      const fwPct = fwTotal > 0 ? Math.round((fwImpl / fwTotal) * 100) : 0;

      doc.fontSize(13).fillColor('#1f2937').text(`${fw.name} (${fw.code})`);
      doc.fontSize(10).fillColor('#6b7280')
        .text(`${fwPct}% compliant | ${fwImpl} of ${fwTotal} controls | ${fw.in_progress || 0} in progress`);
      doc.moveDown(0.5);
    }

    // Control details (new page)
    doc.addPage();
    doc.fontSize(18).fillColor('#111827').text('Control Details');
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').stroke();
    doc.moveDown(0.5);

    const statusColor = (s) => {
      if (s === 'implemented') return '#059669';
      if (s === 'satisfied_via_crosswalk') return '#2563eb';
      if (s === 'in_progress') return '#d97706';
      if (s === 'needs_review') return '#dc2626';
      return '#6b7280';
    };

    let currentFramework = '';
    for (const ctrl of data.controls) {
      if (doc.y > 700) doc.addPage();

      if (ctrl.framework_name !== currentFramework) {
        currentFramework = ctrl.framework_name;
        doc.moveDown(0.5);
        doc.fontSize(13).fillColor('#7c3aed').text(currentFramework);
        doc.moveDown(0.3);
      }

      doc.fontSize(9).fillColor(statusColor(ctrl.status))
        .text(`[${ctrl.status.replace(/_/g, ' ').toUpperCase()}]`, { continued: true });
      doc.fillColor('#111827').text(`  ${ctrl.control_id} - ${ctrl.title}`);

      if (ctrl.assigned_to) {
        doc.fontSize(8).fillColor('#9ca3af').text(`    Assigned: ${ctrl.assigned_to}`);
      }
    }

    // Footer
    doc.addPage();
    doc.fontSize(10).fillColor('#9ca3af').text('This report was generated by ControlWeave.', { align: 'center' });
    doc.text('For audit purposes only. Verify all data before submission.', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('PDF report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate PDF report' });
  }
});

// GET /reports/compliance/excel
router.get('/compliance/excel', requirePermission('reports.read'), async (req, res) => {
  try {
    const orgId = req.user.organization_id;
    const orgName = req.user.organization_name;
    const data = await getComplianceData(orgId);
    const overall = data.overall;
    const total = parseInt(overall.total_controls) || 1;
    const implemented = parseInt(overall.implemented) || 0;
    const crosswalked = parseInt(overall.crosswalked) || 0;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ControlWeave';
    workbook.created = new Date();

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
    ];
    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };

    summarySheet.addRow({ metric: 'Organization', value: orgName });
    summarySheet.addRow({ metric: 'Report Date', value: new Date().toLocaleDateString() });
    summarySheet.addRow({ metric: 'Overall Compliance', value: `${Math.round(((implemented + crosswalked) / total) * 100)}%` });
    summarySheet.addRow({ metric: 'Total Controls', value: total });
    summarySheet.addRow({ metric: 'Implemented', value: implemented });
    summarySheet.addRow({ metric: 'Crosswalked', value: crosswalked });
    summarySheet.addRow({ metric: 'In Progress', value: parseInt(overall.in_progress) || 0 });
    summarySheet.addRow({ metric: 'Needs Review', value: parseInt(overall.needs_review) || 0 });

    // Frameworks sheet
    const fwSheet = workbook.addWorksheet('Frameworks');
    fwSheet.columns = [
      { header: 'Framework', key: 'name', width: 35 },
      { header: 'Code', key: 'code', width: 15 },
      { header: 'Total Controls', key: 'total', width: 15 },
      { header: 'Implemented', key: 'implemented', width: 15 },
      { header: 'Crosswalked', key: 'crosswalked', width: 15 },
      { header: 'In Progress', key: 'in_progress', width: 15 },
      { header: 'Compliance %', key: 'pct', width: 15 },
    ];
    fwSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    fwSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };

    for (const fw of data.frameworks) {
      const fwTotal = parseInt(fw.total_controls);
      const fwDone = parseInt(fw.implemented) + parseInt(fw.crosswalked);
      fwSheet.addRow({
        name: fw.name,
        code: fw.code,
        total: fwTotal,
        implemented: parseInt(fw.implemented),
        crosswalked: parseInt(fw.crosswalked),
        in_progress: parseInt(fw.in_progress) || 0,
        pct: fwTotal > 0 ? `${Math.round((fwDone / fwTotal) * 100)}%` : '0%'
      });
    }

    // Controls sheet
    const ctrlSheet = workbook.addWorksheet('Controls');
    ctrlSheet.columns = [
      { header: 'Framework', key: 'framework', width: 25 },
      { header: 'Control ID', key: 'control_id', width: 15 },
      { header: 'Title', key: 'title', width: 40 },
      { header: 'Priority', key: 'priority', width: 10 },
      { header: 'Status', key: 'status', width: 20 },
      { header: 'Assigned To', key: 'assigned_to', width: 20 },
      { header: 'Notes', key: 'notes', width: 30 },
    ];
    ctrlSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ctrlSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };

    for (const ctrl of data.controls) {
      const row = ctrlSheet.addRow({
        framework: ctrl.framework_name,
        control_id: ctrl.control_id,
        title: ctrl.title,
        priority: ctrl.priority || '-',
        status: ctrl.status.replace(/_/g, ' '),
        assigned_to: ctrl.assigned_to || '-',
        notes: ctrl.notes || ''
      });

      // Color-code status
      const statusCell = row.getCell('status');
      if (ctrl.status === 'implemented') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      } else if (ctrl.status === 'in_progress') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      } else if (ctrl.status === 'not_started') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      }
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="compliance-report-${new Date().toISOString().split('T')[0]}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Excel report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate Excel report' });
  }
});

// GET /reports/types
router.get('/types', requirePermission('reports.read'), async (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'compliance-pdf', name: 'Compliance Report (PDF)', format: 'pdf', description: 'Full compliance status report with framework breakdown and control details' },
      { id: 'compliance-excel', name: 'Compliance Report (Excel)', format: 'xlsx', description: 'Spreadsheet with summary, frameworks, and all controls with status' },
    ]
  });
});

module.exports = router;
