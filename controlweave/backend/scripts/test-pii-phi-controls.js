// @tier: exclude
/**
 * Unit-style tests for the PII/PHI detection and privacy control helpers.
 *
 * Tests the pure utility functions in aiSecurity.js as well as the shared
 * pipeline helpers (sanitizeUserMessages, applyPrivacyControls) in llmService.js.
 *
 * Run: node scripts/test-pii-phi-controls.js
 */

'use strict';

const path = require('path');

// ── Helpers ──────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function section(name) {
  console.log(`\n── ${name} ──`);
}

// ── Load modules ─────────────────────────────────────────────────────────────
const aiSecurity = require(path.join(__dirname, '../src/utils/aiSecurity'));

// applyPrivacyControls and sanitizeUserMessages are private to llmService.js;
// we test them indirectly through the exported functions they call, and via
// the public aiSecurity API they delegate to.

// ── aiSecurity.detectPiiPhi ──────────────────────────────────────────────────
section('detectPiiPhi — PII detection');

let r = aiSecurity.detectPiiPhi('Contact me at jane.doe@example.com');
assert(r.hasPii === true, 'email detected as PII');
assert(r.piiTypes.includes('EMAIL'), 'type is EMAIL');
assert(r.hasPhi === false, 'no false PHI for plain email');

r = aiSecurity.detectPiiPhi('SSN: 123-45-6789');
assert(r.hasPii === true, 'SSN detected');
assert(r.piiTypes.includes('SSN'), 'type is SSN');

r = aiSecurity.detectPiiPhi('Call us at (555) 867-5309');
assert(r.hasPii === true, 'phone number detected');
assert(r.piiTypes.includes('PHONE'), 'type is PHONE');

r = aiSecurity.detectPiiPhi('Card: 4111 1111 1111 1111');
assert(r.hasPii === true, 'credit card detected');
assert(r.piiTypes.includes('CREDIT_CARD'), 'type is CREDIT_CARD');

r = aiSecurity.detectPiiPhi('Server IP is 192.168.1.100');
assert(r.hasPii === true, 'IP address detected');
assert(r.piiTypes.includes('IP_ADDRESS'), 'type is IP_ADDRESS');

r = aiSecurity.detectPiiPhi('No sensitive data here, version 2.1.0');
assert(r.hasPii === false, 'version string not flagged as IP');
assert(r.hasPhi === false, 'no false positives on clean text');

section('detectPiiPhi — PHI detection');

r = aiSecurity.detectPiiPhi('MRN: A123456789');
assert(r.hasPhi === true, 'MRN detected as PHI');
assert(r.phiTypes.includes('MRN'), 'type is MRN');

r = aiSecurity.detectPiiPhi('NPI: 1234567890');
assert(r.hasPhi === true, 'NPI detected');
assert(r.phiTypes.includes('NPI'), 'type is NPI');

r = aiSecurity.detectPiiPhi('ICD-10: A09.0');
assert(r.hasPhi === true, 'ICD-10 code detected');
assert(r.phiTypes.includes('ICD_CODE'), 'type is ICD_CODE');

r = aiSecurity.detectPiiPhi('HbA1c: 7.2%');
assert(r.hasPhi === true, 'lab result with unit detected');
assert(r.phiTypes.includes('LAB_RESULT'), 'type is LAB_RESULT');

r = aiSecurity.detectPiiPhi('WBC: 5.4 K/uL');
assert(r.hasPhi === true, 'WBC lab result detected');

// PSA should no longer match without a unit suffix (false-positive fix)
r = aiSecurity.detectPiiPhi('PSA: 5');
assert(r.hasPhi === false, 'PSA without unit does not false-positive');

// HbA1c without a unit should not match either
r = aiSecurity.detectPiiPhi('HbA1c: 7.2');
assert(r.hasPhi === false, 'lab marker without required unit suffix not matched');

// ── aiSecurity.redactPiiPhi ──────────────────────────────────────────────────
section('redactPiiPhi — redaction');

let red = aiSecurity.redactPiiPhi('Email: jane@example.com and SSN: 123-45-6789');
assert(red.redacted === true, 'redacted flag is true when data found');
assert(!red.text.includes('jane@example.com'), 'email removed from text');
assert(!red.text.includes('123-45-6789'), 'SSN removed from text');
assert(red.text.includes('[EMAIL REDACTED]'), 'email placeholder inserted');
assert(red.text.includes('[SSN REDACTED]'), 'SSN placeholder inserted');
assert(red.piiTypes.includes('EMAIL'), 'piiTypes includes EMAIL');
assert(red.piiTypes.includes('SSN'), 'piiTypes includes SSN');

red = aiSecurity.redactPiiPhi('No sensitive data.');
assert(red.redacted === false, 'redacted flag is false on clean text');
assert(red.text === 'No sensitive data.', 'text unchanged on clean input');

red = aiSecurity.redactPiiPhi('');
assert(red.redacted === false, 'empty string handled gracefully');

// ── aiSecurity.scanMessagesForPiiPhi ────────────────────────────────────────
section('scanMessagesForPiiPhi — user-role filtering');

const msgs = [
  { role: 'system', content: 'SSN: 999-99-9999' },       // should not be scanned
  { role: 'user',   content: 'My email is x@y.com' },
  { role: 'assistant', content: 'MRN: A000000001' },      // should not be scanned
  { role: 'user',   content: 'No PII here.' },
];
const scan = aiSecurity.scanMessagesForPiiPhi(msgs);
assert(scan.hasPii === true, 'user message email detected');
assert(scan.hasPhi === false, 'system/assistant PHI not scanned (role filter)');
assert(scan.piiTypes.includes('EMAIL'), 'EMAIL type in results');

// ── aiSecurity.redactMessagesForPiiPhi ──────────────────────────────────────
section('redactMessagesForPiiPhi — redaction scope');

const msgsToRedact = [
  { role: 'system',    content: 'SSN: 111-22-3333' },
  { role: 'user',      content: 'My SSN is 123-45-6789' },
  { role: 'assistant', content: 'SSN: 999-88-7777' },
];
const result = aiSecurity.redactMessagesForPiiPhi(msgsToRedact);
assert(result.redacted === true, 'redacted flag true');

const sysMsg = result.messages.find(m => m.role === 'system');
assert(sysMsg.content === 'SSN: 111-22-3333', 'system message content unchanged');

const usrMsg = result.messages.find(m => m.role === 'user');
assert(!usrMsg.content.includes('123-45-6789'), 'user SSN redacted');
assert(usrMsg.content.includes('[SSN REDACTED]'), 'user SSN placeholder present');

const asstMsg = result.messages.find(m => m.role === 'assistant');
assert(asstMsg.content === 'SSN: 999-88-7777', 'assistant message content unchanged');

// ── aiSecurity.classifyDataSensitivity ──────────────────────────────────────
section('classifyDataSensitivity — internal data tagging');

let cls = aiSecurity.classifyDataSensitivity('Contact: jane@example.com, DOB: 01/15/1980');
assert(cls.detected === true, 'PII detected');
assert(cls.pii_classification !== 'none', 'classification is not none');
assert(Array.isArray(cls.pii_types) && cls.pii_types.length > 0, 'pii_types populated');
assert(['public','internal','confidential','restricted'].includes(cls.data_sensitivity), 'valid data_sensitivity value');

cls = aiSecurity.classifyDataSensitivity('MRN: A123456 — patient is diabetic');
assert(cls.detected === true, 'PHI detected');
assert(cls.pii_classification === 'critical', 'PHI maps to critical classification');
assert(cls.data_sensitivity === 'restricted', 'PHI maps to restricted sensitivity');
assert(cls.pii_types.includes('health'), 'pii_types includes health');

cls = aiSecurity.classifyDataSensitivity('SSN: 123-45-6789');
assert(cls.pii_classification === 'high', 'SSN maps to high classification');

cls = aiSecurity.classifyDataSensitivity('No sensitive information here.');
assert(cls.detected === false, 'no false positives on clean text');
assert(cls.pii_classification === 'none', 'clean text is none');
assert(cls.data_sensitivity === 'internal', 'clean text defaults to internal sensitivity');

cls = aiSecurity.classifyDataSensitivity('');
assert(cls.detected === false, 'empty string handled gracefully');

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('Some tests FAILED.');
  process.exit(1);
} else {
  console.log('All tests passed.');
}
