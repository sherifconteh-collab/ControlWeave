'use strict';

/**
 * The one definition of "which business functions does a role grant", shared
 * by SoD analysis, access review snapshots and the user detail view. A role's
 * functions come from:
 *   1. erp_role_functions (imported role -> function mappings)
 *   2. erp_role_permissions through the system's own erp_function_permissions
 *   3. erp_role_permissions through ControlWeave's starter map
 *      (erp_permission_library) for the system's platform, unless the system
 *      has use_library_map switched off
 */

const PLATFORM_BY_ERP_TYPE = Object.freeze({ sap_ecc: 'sap', sap_s4hana: 'sap', oracle_ebs: 'oracle_ebs' });

const PLATFORM_CASE = `CASE ${Object.entries(PLATFORM_BY_ERP_TYPE).map(([type, platform]) => `WHEN s.erp_type = '${type}' THEN '${platform}'`).join(' ')} END`;

/**
 * SELECT role_id, function_code for one system. `param` is the placeholder
 * that holds the system id (for example '$2').
 */
function roleFunctionsSql(param) {
  return `
    SELECT rf.role_id, rf.function_code FROM erp_role_functions rf WHERE rf.system_id = ${param}
    UNION
    SELECT rp.role_id, fp.function_code
      FROM erp_role_permissions rp
      JOIN erp_function_permissions fp ON fp.system_id = rp.system_id AND fp.permission = rp.permission
     WHERE rp.system_id = ${param}
    UNION
    SELECT rp.role_id, pl.function_code
      FROM erp_role_permissions rp
      JOIN erp_systems s ON s.id = rp.system_id AND s.use_library_map
      JOIN erp_permission_library pl ON pl.platform = ${PLATFORM_CASE} AND pl.permission = UPPER(rp.permission)
     WHERE rp.system_id = ${param}`;
}

function platformFor(erpType) {
  return PLATFORM_BY_ERP_TYPE[erpType] || null;
}

module.exports = { roleFunctionsSql, platformFor, PLATFORM_BY_ERP_TYPE };
