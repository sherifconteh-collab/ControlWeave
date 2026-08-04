const { csvEscape, toCsvDocument, parseCsvDocument } = require('../src/utils/csv');

describe('csvEscape', () => {
  it('leaves plain values alone', () => {
    expect(csvEscape('Web Server 01')).toBe('Web Server 01');
  });

  it('quotes values containing a comma, quote or newline', () => {
    expect(csvEscape('Chen, Alice')).toBe('"Chen, Alice"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
  });

  it('renders null and undefined as empty, not as the words', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });
});

describe('parseCsvDocument', () => {
  it('parses a simple document into records keyed by header', () => {
    const { headers, rows } = parseCsvDocument('name,status\nWeb 01,active\nDB 01,maintenance');
    expect(headers).toEqual(['name', 'status']);
    expect(rows).toEqual([
      { name: 'Web 01', status: 'active' },
      { name: 'DB 01', status: 'maintenance' }
    ]);
  });

  it('handles quoted fields containing commas, quotes and newlines', () => {
    const { rows } = parseCsvDocument('name,notes\n"Chen, Alice","said ""go""\nthen left"');
    expect(rows[0].name).toBe('Chen, Alice');
    expect(rows[0].notes).toBe('said "go"\nthen left');
  });

  it('accepts CRLF endings and strips a BOM', () => {
    const { headers, rows } = parseCsvDocument('﻿name,status\r\nWeb 01,active\r\n');
    expect(headers).toEqual(['name', 'status']);
    expect(rows).toEqual([{ name: 'Web 01', status: 'active' }]);
  });

  it('pads short rows rather than shifting later columns', () => {
    const { rows } = parseCsvDocument('name,status,location\nWeb 01,active');
    expect(rows[0]).toEqual({ name: 'Web 01', status: 'active', location: '' });
  });

  it('ignores blank lines', () => {
    const { rows } = parseCsvDocument('name\nWeb 01\n\n\nDB 01\n');
    expect(rows).toEqual([{ name: 'Web 01' }, { name: 'DB 01' }]);
  });

  it('returns empty for an empty document', () => {
    expect(parseCsvDocument('')).toEqual({ headers: [], rows: [] });
    expect(parseCsvDocument('   \n  ')).toEqual({ headers: [], rows: [] });
  });
});

describe('round trip', () => {
  // The importer's whole premise is that an operator can export the inventory,
  // edit it and feed it back in. That only holds if the parser survives every
  // value the exporter is willing to quote, so assert it directly.
  it('survives values the exporter quotes', () => {
    const header = ['name', 'notes', 'location'];
    const original = [
      { name: 'Web 01', notes: 'plain', location: 'Rack A' },
      { name: 'Chen, Alice', notes: 'said "go"', location: '' },
      { name: 'Multi', notes: 'line1\nline2', location: 'DC-2' }
    ];

    const { rows } = parseCsvDocument(toCsvDocument(header, original));
    expect(rows).toEqual(original);
  });
});
