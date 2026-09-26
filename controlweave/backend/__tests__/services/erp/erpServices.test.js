jest.mock('../../../src/config/database', () => ({ query: jest.fn(), connect: jest.fn() }));

const importService = require('../../../src/services/erp/importService');
const ccm = require('../../../src/services/erp/ccmService');
const { enableFipsMode } = require('../../../src/config/fips');

describe('ERP import validation', () => {
  const functions = new Set(['AP_INVOICE_ENTRY', 'VENDOR_MAINT']);

  test('reports missing fields and unknown functions with CSV line numbers', () => {
    const { valid, errors } = importService.validateRows('role_functions', [
      { role_name: 'AP Clerk', function_code: 'ap_invoice_entry' },
      { role_name: '', function_code: 'VENDOR_MAINT' },
      { role_name: 'AP Clerk', function_code: 'MADE_UP' }
    ], functions);
    expect(valid).toEqual([{ role_name: 'AP Clerk', function_code: 'AP_INVOICE_ENTRY' }]);
    expect(errors).toEqual([{ line: 3, error: 'Missing role_name' }, { line: 4, error: 'Unknown function code MADE_UP' }]);
  });

  test('keeps the last row for a repeated key', () => {
    const { valid } = importService.validateRows('users', [
      { username: 'jdoe', department: 'AP' },
      { username: 'jdoe', department: 'GL' }
    ], functions);
    expect(valid).toEqual([{ username: 'jdoe', department: 'GL' }]);
  });

  test('validates transaction types, amounts and dates', () => {
    const { valid, errors } = importService.validateRows('transactions', [
      { txn_type: 'Payment', external_id: 'P1', amount: '1,200.50', txn_date: '2026-01-05' },
      { txn_type: 'wire', external_id: 'W1', amount: '1' },
      { txn_type: 'journal_entry', external_id: 'J1', amount: 'abc' },
      { txn_type: 'invoice', external_id: 'I1' },
      { txn_type: 'vendor_change', external_id: 'V1', txn_date: 'not a date' },
      { txn_type: 'vendor_change', external_id: 'V2' }
    ], functions);
    expect(valid.map((r) => r.external_id)).toEqual(['P1', 'V2']);
    expect(valid[0].txn_type).toBe('payment');
    expect(errors.map((e) => e.line)).toEqual([3, 4, 5, 6]);
  });

  test('maps ERP user statuses', () => {
    expect(importService.normalizeStatus('Enabled')).toBe('active');
    expect(importService.normalizeStatus('LOCKED')).toBe('locked');
    expect(importService.normalizeStatus('end-dated')).toBe('inactive');
  });
});

describe('monitoring rule parameters', () => {
  const rule = (code) => ccm.RULES.find((r) => r.code === code);

  test('defaults fill in missing parameters', () => {
    expect(ccm.resolveParams(rule('CCM-GL-03'), {})).toEqual({ time_zone: 'UTC', start_hour: 7, end_hour: 19, include_weekends: true });
  });

  test('values that would reach SQL must be well-typed', () => {
    expect(() => ccm.resolveParams(rule('CCM-GL-01'), { threshold: '1; DROP TABLE users' })).toThrow(ccm.CcmError);
    expect(() => ccm.resolveParams(rule('CCM-AP-02'), { window_days: 2.5 })).toThrow(ccm.CcmError);
    expect(() => ccm.resolveParams(rule('CCM-GL-03'), { time_zone: "UTC'--" })).toThrow(ccm.CcmError);
  });

  test('every rule renders SQL from its defaults', () => {
    ccm.RULES.forEach((r) => {
      const sql = r.sql(ccm.resolveParams(r, {}));
      expect(sql).toMatch(/fingerprint/);
      expect(sql).toMatch(/system_id = \$1/);
    });
  });
});

describe('FIPS mode', () => {
  test('is off unless FIPS_MODE=true', () => {
    expect(enableFipsMode({})).toEqual({ enabled: false });
  });
});
