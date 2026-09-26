'use strict';

jest.mock('../../../src/config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../../../src/utils/logger', () => ({ log: jest.fn(), serializeError: (e) => e }));

const sapExtract = require('../../../src/services/erp/sapExtract');
const syncService = require('../../../src/services/erp/syncService');
const configService = require('../../../src/services/erp/configService');
const ccm = require('../../../src/services/erp/ccmService');
const { describe: describeTicket } = require('../../../src/services/erp/ticketService');
const shared = require('../../../src/services/erp/connectors/shared');
const scim = require('../../../src/services/erp/connectors/scim');
const workday = require('../../../src/services/erp/connectors/workdayRaas');
const oracleEbs = require('../../../src/services/erp/connectors/oracleEbs');
const { roleFunctionsSql, platformFor } = require('../../../src/services/erp/roleFunctions');

describe('SAP table extracts', () => {
  const library = ['F110', 'FB50', 'FK01', 'FK02', 'ME21N', 'ME22N', 'MIRO'];

  it('converts SAP dates and treats open-ended dates as empty', () => {
    expect(sapExtract.sapDate('20260131')).toBe('2026-01-31');
    expect(sapExtract.sapDate('31.01.2026')).toBe('2026-01-31');
    expect(sapExtract.sapDate('99991231')).toBe('');
    expect(sapExtract.sapDate('00000000')).toBe('');
  });

  it('expands wildcards, single-character patterns and ranges against the library', () => {
    expect(sapExtract.expandTcode('FK0*', '', library)).toEqual(['FK01', 'FK02']);
    expect(sapExtract.expandTcode('ME2+N', '', library)).toEqual(['ME21N', 'ME22N']);
    expect(sapExtract.expandTcode('F100', 'FB99', library)).toEqual(['F110', 'FB50']);
    expect(sapExtract.expandTcode('*', '', library)).toEqual(library);
    expect(sapExtract.expandTcode('zcustom', '', library)).toEqual(['ZCUSTOM']);
  });

  it('maps USR02 lock flags and AGR_1251 transaction values, flagging * roles', () => {
    const users = sapExtract.translate('sap_usr02', [{ BNAME: 'A', UFLAG: '0', USTYP: 'A' }, { BNAME: 'B', UFLAG: '64', USTYP: 'S' }]);
    expect(users.kind).toBe('users');
    expect(users.rows.map((u) => u.status)).toEqual(['active', 'locked']);
    const perms = sapExtract.translate('sap_agr_1251', [
      { AGR_NAME: 'Z_ALL', OBJECT: 'S_TCODE', FIELD: 'TCD', LOW: '*', HIGH: '' },
      { AGR_NAME: 'Z_AP', OBJECT: 'F_BKPF_BUK', FIELD: 'BUKRS', LOW: '1000', HIGH: '' }
    ], library);
    expect(perms.privilegedRoles).toEqual(['Z_ALL']);
    expect(perms.skipped).toBe(1);
    expect(perms.rows).toHaveLength(library.length);
  });

  it('rejects extracts without technical column names', () => {
    expect(() => sapExtract.translate('sap_agr_users', [{ Role: 'x', User: 'y' }])).toThrow(/AGR_NAME, UNAME/);
  });
});

describe('connector mapping', () => {
  it('reads Workday descriptors, SCIM objects and delimited lists', () => {
    expect(shared.text({ Descriptor: 'AP Clerk' })).toBe('AP Clerk');
    expect(shared.list([{ Descriptor: 'A' }, { Descriptor: 'B' }])).toEqual(['A', 'B']);
    expect(shared.list('A; B|C')).toEqual(['A', 'B', 'C']);
    expect(['Active', true, '1', 'yes'].map(shared.status)).toEqual(['active', 'active', 'active', 'active']);
    expect(['Inactive', false, '0'].map(shared.status)).toEqual(['inactive', 'inactive', 'inactive']);
  });

  it('maps a SCIM user with the enterprise extension', () => {
    const row = scim.userRow({
      userName: 'jdoe', name: { givenName: 'Jane', familyName: 'Doe' }, active: false,
      emails: [{ value: 'other@example.com' }, { value: 'jane@example.com', primary: true }],
      'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User': { department: 'Finance', manager: { value: 'u9', displayName: 'Boss' } }
    });
    expect(row).toEqual({ username: 'jdoe', full_name: 'Jane Doe', email: 'jane@example.com', department: 'Finance', manager: 'Boss', status: 'inactive' });
  });

  it('asks Workday for JSON and keeps the report path', () => {
    expect(workday.jsonUrl('https://wd5.example.com/ccx/service/customreport2/acme/isu/users?Effective=2026')).toBe(
      'https://wd5.example.com/ccx/service/customreport2/acme/isu/users?Effective=2026&format=json');
  });

  it('only accepts plain Oracle schema names', () => {
    expect(oracleEbs.schemaName({})).toBe('APPS');
    expect(() => oracleEbs.schemaName({ schema: 'apps; drop table x' })).toThrow('Invalid schema name');
    expect(oracleEbs.queries('APPS').role_permissions).toMatch(/rule_type = 'F'/);
  });
});

describe('sync scheduling and redaction', () => {
  it('computes the next run at the configured UTC hour', () => {
    const from = new Date('2026-09-24T10:30:00Z');
    expect(syncService.nextRunAt('manual', 2, from)).toBeNull();
    expect(syncService.nextRunAt('daily', 2, from).toISOString()).toBe('2026-09-25T02:00:00.000Z');
    expect(syncService.nextRunAt('daily', 23, from).toISOString()).toBe('2026-09-24T23:00:00.000Z');
    expect(syncService.nextRunAt('weekly', 2, from).toISOString()).toBe('2026-10-01T02:00:00.000Z');
  });

  it('never returns connector credentials', () => {
    const out = syncService.redact({ id: 's', connector_type: 'scim', connector_config: { baseUrl: 'https://x' }, connector_auth: { token: 'enc:v1:abc' } });
    expect(JSON.stringify(out)).not.toContain('enc:v1:abc');
    expect(out.connector_credentials_set).toEqual(['token']);
  });
});

describe('configuration baselines', () => {
  it('validates comparisons before they reach SQL casts', () => {
    expect(() => configService.validateBaseline({ config_key: 'k', comparison: 'min', expected_value: 'eight' })).toThrow('must be a number');
    expect(() => configService.validateBaseline({ config_key: 'k', comparison: 'range', expected_value: '5..1' })).toThrow('low..high');
    expect(() => configService.validateBaseline({ config_key: 'k', comparison: 'like', expected_value: '1' })).toThrow('comparison');
    expect(configService.validateBaseline({ config_key: ' k ', comparison: 'range', expected_value: '1..5' })).toEqual(
      { configKey: 'k', comparison: 'range', expected: '1..5', severity: 'high', rationale: null });
  });
});

describe('monitoring rules', () => {
  it('ships three-way match and configuration rules with valid default parameters', () => {
    const codes = ccm.RULES.map((r) => r.code);
    for (const code of ['CCM-P2P-01', 'CCM-P2P-02', 'CCM-P2P-03', 'CCM-P2P-04', 'CCM-P2P-05', 'CCM-P2P-06', 'CCM-CFG-01', 'CCM-CFG-02']) {
      expect(codes).toContain(code);
    }
    for (const rule of ccm.RULES) expect(() => ccm.resolveParams(rule, {})).not.toThrow();
    expect(() => ccm.resolveParams(ccm.RULES.find((r) => r.code === 'CCM-P2P-01'), { tolerance_pct: '5; DROP TABLE x' })).toThrow();
  });
});

describe('starter maps and tickets', () => {
  it('uses the starter map for SAP and Oracle EBS only, behind the system switch', () => {
    expect(platformFor('sap_s4hana')).toBe('sap');
    expect(platformFor('oracle_ebs')).toBe('oracle_ebs');
    expect(platformFor('workday')).toBeNull();
    expect(roleFunctionsSql('$1')).toMatch(/s\.use_library_map/);
  });

  it('describes a revocation ticket with roles and the verification note', () => {
    const text = describeTicket(
      { username: 'alice', roles_to_revoke: ['AP Clerk'], notes: 'Moved teams', decided_at: '2026-09-01T00:00:00Z', snapshot: { full_name: 'Alice' } },
      { name: 'Q3', system_name: 'SAP PRD' }
    );
    expect(text.summary).toBe('Remove SAP PRD access for alice');
    expect(text.description).toMatch(/AP Clerk/);
    expect(text.description).toMatch(/next entitlement import/);
  });
});
