'use strict';

jest.mock('../../../src/config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../../../src/utils/logger', () => ({ log: jest.fn(), serializeError: (e) => e }));
jest.mock('../../../src/services/connectors/http', () => ({ requestJson: jest.fn() }));

const { requestJson } = require('../../../src/services/connectors/http');
const { assertCompleteExtract } = require('../../../src/services/erp/syncService');
const scim = require('../../../src/services/erp/connectors/scim');
const workday = require('../../../src/services/erp/connectors/workdayRaas');
const { HOST_PATTERN, SERVICE_PATTERN } = require('../../../src/services/erp/connectors/oracleEbs');

const user = (id) => ({ id: `u${id}`, userName: `user${id}`, active: true, roles: [{ value: 'AP_CLERK' }] });

describe('assertCompleteExtract', () => {
  const full = { users: [{ username: 'a' }], assignments: [{ username: 'a', role: 'r' }], complete: true };

  it('accepts a complete extract with users and assignments', () => {
    expect(() => assertCompleteExtract(full)).not.toThrow();
  });

  it('refuses an extract that did not report completeness, with status 422', () => {
    const { complete, ...unreported } = full;
    expect(complete).toBe(true);
    expect(() => assertCompleteExtract(unreported)).toThrow(/completeness not reported\); nothing was changed/);
    try { assertCompleteExtract(unreported); } catch (error) { expect(error.status).toBe(422); }
  });

  it('refuses a partial extract and names the reason', () => {
    expect(() => assertCompleteExtract({ ...full, complete: false, incompleteReason: 'the server reported 10 Users but returned 4' }))
      .toThrow(/reported 10 Users but returned 4/);
  });

  it('refuses an extract with no users', () => {
    expect(() => assertCompleteExtract({ ...full, users: [] })).toThrow(/no users/);
  });

  it('refuses users without assignments unless allowEmptyAssignments is set', () => {
    const noRoles = { ...full, assignments: [] };
    expect(() => assertCompleteExtract(noRoles)).toThrow(/allowEmptyAssignments=true/);
    expect(() => assertCompleteExtract(noRoles, { allowEmptyAssignments: 'true' })).not.toThrow();
  });
});

describe('SCIM paging completeness', () => {
  const config = { baseUrl: 'https://idp.example.com/scim', token: 't' };
  beforeEach(() => requestJson.mockReset());

  it('is complete when every reported resource is returned', async () => {
    requestJson
      .mockResolvedValueOnce({ data: { totalResults: 3, Resources: [user(1), user(2)] } })
      .mockResolvedValueOnce({ data: { totalResults: 3, Resources: [user(3)] } });
    const listed = await scim.listAll(config, 'Users');
    expect(listed).toMatchObject({ total: 3, complete: true, reason: null });
    expect(listed.resources).toHaveLength(3);
  });

  it('is incomplete when the server stops short of totalResults', async () => {
    requestJson
      .mockResolvedValueOnce({ data: { totalResults: 5, Resources: [user(1), user(2)] } })
      .mockResolvedValueOnce({ data: { totalResults: 5, Resources: [] } });
    const listed = await scim.listAll(config, 'Users');
    expect(listed.complete).toBe(false);
    expect(listed.reason).toMatch(/reported 5 Users but returned 2/);
  });

  it('marks the whole extract incomplete so the sync refuses it', async () => {
    requestJson
      .mockResolvedValueOnce({ data: { totalResults: 5, Resources: [user(1)] } })
      .mockResolvedValueOnce({ data: { totalResults: 5, Resources: [] } });
    const extract = await scim.fetchExtract(config);
    expect(extract.complete).toBe(false);
    expect(() => assertCompleteExtract(extract)).toThrow(/nothing was changed/);
  });

  it('reports a complete extract as complete', async () => {
    requestJson.mockResolvedValueOnce({ data: { totalResults: 1, Resources: [user(1)] } });
    const extract = await scim.fetchExtract(config);
    expect(extract).toMatchObject({ complete: true, total: { users: 1 }, incompleteReason: null });
    expect(() => assertCompleteExtract(extract)).not.toThrow();
  });
});

describe('connector completeness contract', () => {
  it('Workday reports its single-response extract as complete', async () => {
    requestJson.mockReset().mockResolvedValueOnce({ data: { Report_Entry: [{ username: 'a', status: 'Active', roles: 'AP Clerk' }] } });
    const extract = await workday.fetchExtract({ usersReportUrl: 'https://wd.example.com/ccx/service/customreport2/t/r', username: 'u', password: 'p' });
    expect(extract.complete).toBe(true);
    expect(extract.total.users).toBe(extract.users.length);
  });

  it('Oracle EBS rejects connect-descriptor and URL injection in host and service name', () => {
    expect(HOST_PATTERN.test('ebs-db.corp.example.com')).toBe(true);
    expect(HOST_PATTERN.test('[2001:db8::1]')).toBe(true);
    expect(HOST_PATTERN.test('x(DESCRIPTION=')).toBe(false);
    expect(HOST_PATTERN.test('host/x?y')).toBe(false);
    expect(SERVICE_PATTERN.test('EBSPROD.corp')).toBe(true);
    expect(SERVICE_PATTERN.test('svc?x=1')).toBe(false);
  });
});
