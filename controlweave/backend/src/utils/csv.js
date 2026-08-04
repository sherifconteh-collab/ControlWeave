// @tier: community
/**
 * CSV helpers shared by the export routes.
 *
 * Extracted from routes/rmfInheritance.js when routes/poam.js needed the same
 * escaping. Keeping one copy matters more than the three lines it saves: a
 * subtly different escape in a second exporter is how a compliance export ends
 * up with a field that silently breaks a row for a regulator's parser.
 */

/**
 * Escape a single CSV field per RFC 4180: quote when the value contains a
 * comma, quote, CR or LF, and double any embedded quotes.
 */
function csvEscape(val) {
  const str = val === null || val === undefined ? '' : String(val);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/**
 * Build a full CSV document from a header list and row objects.
 *
 * `header` is the ordered list of keys; each row is indexed by those keys, so a
 * missing key becomes an empty field rather than shifting the row.
 */
function toCsvDocument(header, rows) {
  return [
    header.map(csvEscape).join(','),
    ...rows.map((row) => header.map((col) => csvEscape(row[col])).join(','))
  ].join('\n');
}

/**
 * Parse an RFC 4180 CSV document into { headers, rows }, where each row is an
 * object keyed by header name.
 *
 * Written as a character scanner rather than a split on commas because the
 * exporter above deliberately emits quoted fields containing commas and
 * newlines; a naive split would not survive a round trip of our own output.
 * Handles quoted fields, doubled quotes inside them, and CRLF or LF endings.
 *
 * Ragged rows are preserved rather than rejected here: missing trailing columns
 * read as empty strings and extra columns are dropped, so the caller can report
 * a useful per-row validation error instead of failing the whole document.
 */
function parseCsvDocument(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  const input = String(text || '').replace(/^﻿/, ''); // strip BOM

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') { inQuotes = true; continue; }
    if (char === ',') { row.push(field); field = ''; continue; }
    if (char === '\r') continue;
    if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += char;
  }

  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  const nonEmpty = rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0].map((header) => header.trim());
  const dataRows = nonEmpty.slice(1).map((cells) => {
    const record = {};
    headers.forEach((header, index) => { record[header] = (cells[index] ?? '').trim(); });
    return record;
  });

  return { headers, rows: dataRows };
}

module.exports = { csvEscape, toCsvDocument, parseCsvDocument };
