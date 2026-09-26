'use strict';

/**
 * Translate SAP standard table extracts into ERP import rows, so an SAP
 * ECC or S/4HANA system can be loaded from the tables auditors already pull
 * (SE16 / SE16N download saved as CSV with technical field names):
 *
 *   USR02      user master: BNAME, USTYP, UFLAG, GLTGB, TRDAT, CLASS
 *   AGR_USERS  role assignments: AGR_NAME, UNAME, FROM_DAT, TO_DAT
 *   AGR_1251   role authorization values: AGR_NAME, OBJECT, FIELD, LOW, HIGH
 *
 * From AGR_1251 only S_TCODE / TCD values are used (the transactions a role
 * can start). Wildcards (F*, *) and ranges (LOW..HIGH) are expanded against
 * the transaction codes in the SAP permission library, and kept as written, so
 * a role holding "*" maps to every library function. Roles holding "*" are
 * flagged privileged.
 */

const SAP_KINDS = Object.freeze({
  sap_usr02: { target: 'users', required: ['BNAME'] },
  sap_agr_users: { target: 'assignments', required: ['AGR_NAME', 'UNAME'] },
  sap_agr_1251: { target: 'role_permissions', required: ['AGR_NAME', 'OBJECT', 'FIELD', 'LOW'] }
});

const USER_TYPES = { A: 'dialog', B: 'system', C: 'communication', L: 'reference', S: 'service' };

/** Field lookup that ignores case and surrounding spaces in headers. */
function field(row, name) {
  const key = Object.keys(row).find((k) => k.trim().toUpperCase() === name);
  return key === undefined ? '' : String(row[key] || '').trim();
}

/** SAP DATS (YYYYMMDD, or DD.MM.YYYY from a formatted download) to YYYY-MM-DD; empty, zero and 9999-12-31 to ''. */
function sapDate(value) {
  const text = String(value || '').trim();
  let iso = '';
  if (/^\d{8}$/.test(text)) iso = `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  else if (/^\d{2}\.\d{2}\.\d{4}$/.test(text)) iso = `${text.slice(6, 10)}-${text.slice(3, 5)}-${text.slice(0, 2)}`;
  else if (/^\d{4}-\d{2}-\d{2}$/.test(text)) iso = text;
  if (!iso || iso.startsWith('0000') || iso.startsWith('9999')) return '';
  return iso;
}

function usersFromUsr02(rows) {
  return rows.map((row) => {
    const lockFlag = Number(field(row, 'UFLAG') || 0);
    return {
      username: field(row, 'BNAME'),
      status: lockFlag ? 'locked' : 'active',
      end_date: sapDate(field(row, 'GLTGB')),
      last_login_at: sapDate(field(row, 'TRDAT')),
      department: field(row, 'CLASS'),
      user_type: USER_TYPES[field(row, 'USTYP').toUpperCase()] || ''
    };
  });
}

function assignmentsFromAgrUsers(rows) {
  return rows.map((row) => ({
    username: field(row, 'UNAME'),
    role_name: field(row, 'AGR_NAME'),
    granted_at: sapDate(field(row, 'FROM_DAT')),
    expires_at: sapDate(field(row, 'TO_DAT'))
  }));
}

function wildcardMatcher(pattern) {
  // SAP patterns: * is any run of characters, + is exactly one.
  const escaped = pattern.replace(/[.?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\+/g, '.');
  return new RegExp(`^${escaped}$`);
}

/**
 * Expand one S_TCODE value into the transaction codes it grants, limited to
 * codes the library knows (plus the literal value when it is a plain code).
 */
function expandTcode(low, high, libraryCodes) {
  const from = low.toUpperCase();
  const to = high.toUpperCase();
  if (to && to !== from) return libraryCodes.filter((code) => code >= from && code <= to);
  if (/[*+]/.test(from)) {
    const match = wildcardMatcher(from);
    return libraryCodes.filter((code) => match.test(code));
  }
  return [from];
}

function permissionsFromAgr1251(rows, libraryCodes) {
  const out = [];
  const privilegedRoles = new Set();
  let skipped = 0;
  for (const row of rows) {
    if (field(row, 'OBJECT').toUpperCase() !== 'S_TCODE' || field(row, 'FIELD').toUpperCase() !== 'TCD') {
      skipped += 1;
      continue;
    }
    const role = field(row, 'AGR_NAME');
    const low = field(row, 'LOW');
    if (!role || !low) continue;
    if (low === '*') privilegedRoles.add(role);
    for (const code of expandTcode(low, field(row, 'HIGH'), libraryCodes)) out.push({ role_name: role, permission: code });
  }
  return { rows: out, privilegedRoles: [...privilegedRoles], skipped };
}

/**
 * Convert rows of an SAP table kind. Returns { kind, rows, privilegedRoles,
 * skipped } where kind is the import kind the rows are written as.
 */
function translate(kind, rows, libraryCodes = []) {
  const spec = SAP_KINDS[kind];
  const headers = new Set(Object.keys(rows[0] || {}).map((k) => k.trim().toUpperCase()));
  const missing = spec.required.filter((name) => !headers.has(name));
  if (missing.length) {
    const error = new Error(`The ${kind.slice(4).toUpperCase()} extract needs the technical column names: ${missing.join(', ')}`);
    error.status = 400;
    throw error;
  }
  if (kind === 'sap_usr02') return { kind: spec.target, rows: usersFromUsr02(rows), privilegedRoles: [] };
  if (kind === 'sap_agr_users') return { kind: spec.target, rows: assignmentsFromAgrUsers(rows), privilegedRoles: [] };
  const result = permissionsFromAgr1251(rows, libraryCodes);
  return { kind: spec.target, rows: result.rows, privilegedRoles: result.privilegedRoles, skipped: result.skipped };
}

module.exports = { SAP_KINDS, translate, sapDate, expandTcode };
