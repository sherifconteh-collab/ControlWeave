'use strict';

/**
 * Oracle E-Business Suite: read-only queries against the APPS schema
 * application object library (FND) tables, through node-oracledb in thin mode
 * (no Oracle client libraries needed). Use a dedicated database account with
 * SELECT on the objects below and nothing else:
 *   FND_USER, FND_USER_RESP_GROUPS_ALL, FND_RESPONSIBILITY_VL,
 *   FND_COMPILED_MENU_FUNCTIONS, FND_FORM_FUNCTIONS, FND_RESP_FUNCTIONS,
 *   PER_ALL_ASSIGNMENTS_F
 *
 * Roles are responsibilities; a responsibility's permissions are the form
 * functions granted by its menu less its function and menu exclusions, which
 * map to business functions through the Oracle E-Business Suite starter map
 * and the system's own function map.
 *
 * Settings: host, port (default 1521), serviceName, username, password, and
 * optionally schema (default APPS).
 */

const { assertSafeUrl } = require('../../../utils/netGuard');
const { requireSettings } = require('./shared');

const MAX_ROWS = 200000;
// A query that hangs (locks, a slow link) must not hold the system's sync
// lock forever.
const CALL_TIMEOUT_MS = Math.max(10000, Number(process.env.ERP_EBS_CALL_TIMEOUT_MS) || 300000);
// Host names, IPv4 or bracketed IPv6, and service names, as the EZConnect
// string "host:port/service" allows; anything else could smuggle connect
// descriptor syntax into the connection.
const HOST_PATTERN = /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*|\[[0-9A-Fa-f:.]+\])$/;
const SERVICE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.$#-]{0,127}$/;

function loadDriver() {
  try {
    return require('oracledb');
  } catch {
    throw new Error('The Oracle database driver (oracledb) is not installed on this server; run npm install oracledb');
  }
}

function schemaName(config) {
  const schema = String(config.schema || 'APPS').toUpperCase();
  if (!/^[A-Z][A-Z0-9_$#]{0,29}$/.test(schema)) throw new Error('Invalid schema name');
  return schema;
}

function queries(schema) {
  return {
    users: `
      SELECT u.user_name AS "username", u.description AS "full_name", u.email_address AS "email",
             TO_CHAR(u.end_date, 'YYYY-MM-DD') AS "end_date",
             TO_CHAR(u.last_logon_date, 'YYYY-MM-DD"T"HH24:MI:SS') AS "last_login_at",
             CASE WHEN u.end_date IS NOT NULL AND u.end_date <= SYSDATE THEN 'inactive'
                  WHEN u.start_date > SYSDATE THEN 'inactive' ELSE 'active' END AS "status",
             (SELECT MIN(su.user_name)
                FROM ${schema}.per_all_assignments_f paf
                JOIN ${schema}.fnd_user su ON su.employee_id = paf.supervisor_id
               WHERE paf.person_id = u.employee_id AND paf.primary_flag = 'Y'
                 AND SYSDATE BETWEEN paf.effective_start_date AND paf.effective_end_date) AS "manager"
        FROM ${schema}.fnd_user u`,
    assignments: `
      SELECT u.user_name AS "username", r.responsibility_name AS "role_name",
             TO_CHAR(g.start_date, 'YYYY-MM-DD') AS "granted_at", TO_CHAR(g.end_date, 'YYYY-MM-DD') AS "expires_at"
        FROM ${schema}.fnd_user_resp_groups_all g
        JOIN ${schema}.fnd_user u ON u.user_id = g.user_id
        JOIN ${schema}.fnd_responsibility_vl r
          ON r.responsibility_id = g.responsibility_id AND r.application_id = g.responsibility_application_id
       WHERE (g.end_date IS NULL OR g.end_date > SYSDATE) AND (r.end_date IS NULL OR r.end_date > SYSDATE)`,
    role_permissions: `
      SELECT DISTINCT r.responsibility_name AS "role_name", f.function_name AS "permission"
        FROM ${schema}.fnd_responsibility_vl r
        JOIN ${schema}.fnd_compiled_menu_functions cmf ON cmf.menu_id = r.menu_id AND cmf.grant_flag = 'Y'
        JOIN ${schema}.fnd_form_functions f ON f.function_id = cmf.function_id
       WHERE (r.end_date IS NULL OR r.end_date > SYSDATE)
         AND NOT EXISTS (SELECT 1 FROM ${schema}.fnd_resp_functions x
                          WHERE x.application_id = r.application_id AND x.responsibility_id = r.responsibility_id
                            AND x.rule_type = 'F' AND x.action_id = f.function_id)
         AND NOT EXISTS (SELECT 1 FROM ${schema}.fnd_resp_functions x
                           JOIN ${schema}.fnd_compiled_menu_functions ex ON ex.menu_id = x.action_id AND ex.function_id = f.function_id
                          WHERE x.application_id = r.application_id AND x.responsibility_id = r.responsibility_id
                            AND x.rule_type = 'M')`
  };
}

async function fetchExtract(config) {
  requireSettings(config, ['host', 'serviceName', 'username', 'password']);
  const port = Number(config.port || 1521);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
  if (!HOST_PATTERN.test(String(config.host))) throw new Error('Invalid database host');
  if (!SERVICE_PATTERN.test(String(config.serviceName))) throw new Error('Invalid service name');
  // Same private-network guard as the HTTP connectors.
  await assertSafeUrl(`https://${config.host}:${port}/`);
  const oracledb = loadDriver();
  const connection = await oracledb.getConnection({
    user: config.username,
    password: config.password,
    connectString: `${config.host}:${port}/${config.serviceName}`,
    connectTimeout: 30
  });
  try {
    connection.callTimeout = CALL_TIMEOUT_MS;
    const sql = queries(schemaName(config));
    const truncated = [];
    // Ask for one row more than the limit, so a result at the limit is
    // recognized as cut short instead of being loaded as the complete set.
    const run = async (name, text) => {
      const result = await connection.execute(text, [], { outFormat: oracledb.OUT_FORMAT_OBJECT, maxRows: MAX_ROWS + 1 });
      const rows = result.rows || [];
      if (rows.length > MAX_ROWS) {
        truncated.push(`more than ${MAX_ROWS} ${name}`);
        return rows.slice(0, MAX_ROWS);
      }
      return rows;
    };
    const users = await run('users', sql.users);
    const assignments = await run('assignments', sql.assignments);
    const rolePermissions = await run('role permissions', sql.role_permissions);
    return {
      users,
      assignments,
      role_permissions: rolePermissions,
      complete: truncated.length === 0,
      total: { users: users.length },
      incompleteReason: truncated.join('; ') || null
    };
  } finally {
    await connection.close().catch(() => {});
  }
}

module.exports = { fetchExtract, queries, schemaName, HOST_PATTERN, SERVICE_PATTERN };
