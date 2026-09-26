'use strict';

/**
 * The single definition of "compliance percentage".
 *
 * Every screen that shows a compliance number -- dashboard, compliance
 * summary, trend snapshots (and the Trust Center that reads them), the
 * compliance gate, regulatory impact -- must agree for the same organization
 * at the same moment. They previously did not: some applied the selected
 * baseline and some did not, one counted only 'implemented', and all of them
 * counted Not Applicable controls against the organization.
 *
 * Definition:
 *   compliant  = implemented + verified + satisfied_via_crosswalk
 *   applicable = in-scope controls (selected baseline, see baselineScope.js)
 *                minus controls marked not_applicable
 *   percentage = compliant / applicable, one decimal place (0 when nothing
 *                is applicable)
 *
 * Excluding Not Applicable from the denominator is standard assessment
 * practice: a control that does not apply to the system cannot be failed, so
 * scoping it out must not lower the score.
 */

const COMPLIANT_STATUSES = Object.freeze(['implemented', 'verified', 'satisfied_via_crosswalk']);
const COMPLIANT_STATUS_SQL = `('implemented', 'verified', 'satisfied_via_crosswalk')`;

function compliancePercentage(compliant, total, notApplicable = 0) {
  const applicable = Number(total || 0) - Number(notApplicable || 0);
  if (applicable <= 0) return 0;
  return Math.round((Number(compliant || 0) / applicable) * 1000) / 10;
}

/**
 * SQL aggregate expressions over `fc` (framework_controls) LEFT JOINed to `ci`
 * (control_implementations for one organization). Return the columns every
 * compliance query needs, computed the same way.
 */
function complianceAggregateSql({ fc = 'fc', ci = 'ci', precision = 1 } = {}) {
  const compliant = `COUNT(DISTINCT ${ci}.id) FILTER (WHERE ${ci}.status IN ${COMPLIANT_STATUS_SQL})`;
  const notApplicable = `COUNT(DISTINCT ${ci}.id) FILTER (WHERE ${ci}.status = 'not_applicable')`;
  const total = `COUNT(DISTINCT ${fc}.id)`;
  return {
    total,
    compliant,
    notApplicable,
    percentage: `CASE WHEN ${total} - ${notApplicable} > 0
      THEN ROUND((${compliant})::numeric / (${total} - ${notApplicable})::numeric * 100, ${precision})
      ELSE 0 END`
  };
}

module.exports = {
  COMPLIANT_STATUSES,
  COMPLIANT_STATUS_SQL,
  compliancePercentage,
  complianceAggregateSql
};
