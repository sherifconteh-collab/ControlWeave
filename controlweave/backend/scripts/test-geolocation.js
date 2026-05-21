#!/usr/bin/env node
// @tier: exclude
'use strict';

/**
 * Test Script: Region Tracking Geolocation Service
 * 
 * Tests the geolocation service to ensure IP addresses are correctly mapped to regions.
 */

const { 
  lookupIpGeolocation, 
  extractIpFromRequest, 
  getGeolocationFromRequest 
} = require('../src/services/geolocationService');

console.log('Testing Geolocation Service...\n');

// Test 1: Known IP addresses from different regions
console.log('Test 1: IP Geolocation Lookup');
console.log('================================');

const testIPs = [
  { ip: '8.8.8.8', expected: 'North America', desc: 'Google DNS (US)' },
  { ip: '185.60.216.35', expected: 'Europe', desc: 'UK IP' },
  { ip: '202.12.29.175', expected: 'Asia Pacific', desc: 'Singapore IP' },
  { ip: '200.201.202.203', expected: 'Latin America', desc: 'Brazil IP' }
];

testIPs.forEach(({ ip, expected, desc }) => {
  const result = lookupIpGeolocation(ip);
  const status = result?.region === expected ? '✓ PASS' : '✗ FAIL';
  console.log(`${status} ${desc} (${ip})`);
  if (result) {
    console.log(`  → Country: ${result.country_code}, Region: ${result.region}`);
  } else {
    console.log(`  → No result found`);
  }
});

console.log('');

// Test 2: Request IP extraction
console.log('Test 2: IP Extraction from Request');
console.log('===================================');

const mockRequests = [
  {
    desc: 'Direct connection',
    req: { ip: '8.8.8.8' },
    expected: '8.8.8.8'
  },
  {
    desc: 'X-Forwarded-For header',
    req: { 
      headers: { 'x-forwarded-for': '8.8.8.8, 192.168.1.1' },
      ip: '192.168.1.1'
    },
    expected: '8.8.8.8'
  },
  {
    desc: 'X-Real-IP header',
    req: { 
      headers: { 'x-real-ip': '8.8.8.8' },
      ip: '192.168.1.1'
    },
    expected: '8.8.8.8'
  },
  {
    desc: 'IPv6 with IPv4 mapping',
    req: { ip: '::ffff:8.8.8.8' },
    expected: '8.8.8.8'
  }
];

mockRequests.forEach(({ desc, req, expected }) => {
  const result = extractIpFromRequest(req);
  const status = result === expected ? '✓ PASS' : '✗ FAIL';
  console.log(`${status} ${desc}`);
  console.log(`  → Extracted: ${result}, Expected: ${expected}`);
});

console.log('');

// Test 3: Edge cases
console.log('Test 3: Edge Cases');
console.log('==================');

const edgeCases = [
  { ip: '127.0.0.1', desc: 'Localhost' },
  { ip: 'invalid-ip', desc: 'Invalid IP' },
  { ip: null, desc: 'Null IP' },
  { ip: '', desc: 'Empty string' }
];

edgeCases.forEach(({ ip, desc }) => {
  const result = lookupIpGeolocation(ip);
  const status = result === null ? '✓ PASS' : '✗ FAIL';
  console.log(`${status} ${desc} - Should return null`);
  console.log(`  → Result: ${result ? JSON.stringify(result) : 'null'}`);
});

console.log('\n✓ Geolocation service tests completed');
