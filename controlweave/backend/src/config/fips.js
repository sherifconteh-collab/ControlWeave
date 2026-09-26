'use strict';

/**
 * FIPS mode for federal deployments.
 *
 * FIPS_MODE=true switches Node's OpenSSL to its FIPS provider before anything
 * else uses crypto, so hashing, HMAC, AES-GCM and TLS run only through the
 * validated module and non-approved algorithms such as MD5 are refused.
 *
 * crypto.setFips(true) reports success even when no FIPS provider is
 * installed, after which every algorithm fails. enableFipsMode therefore
 * proves the switch worked: approved algorithms must still run and MD5 must be
 * refused. Anything else stops startup with an explanation, because a server
 * that claims FIPS mode but is not in it is worse than one that does not start.
 *
 * Scope: this makes ControlWeave use a FIPS 140-3 validated module when the
 * host provides one (for example a FIPS-enabled OpenSSL 3 build with its
 * fipsmodule.cnf). It does not make ControlWeave itself a validated module.
 * Password hashing uses bcrypt in JavaScript, outside the module boundary.
 */

const crypto = require('crypto');

function selfTest() {
  const problems = [];
  try {
    crypto.createHash('sha384').update('fips').digest();
    crypto.createHmac('sha384', crypto.randomBytes(48)).update('fips').digest();
    const cipher = crypto.createCipheriv('aes-256-gcm', crypto.randomBytes(32), crypto.randomBytes(12));
    cipher.update('fips');
    cipher.final();
  } catch (error) {
    problems.push(`approved algorithms are unavailable (${error.code || error.message}); the OpenSSL FIPS provider is not installed or not configured`);
  }
  try {
    crypto.createHash('md5').update('fips').digest();
    problems.push('MD5 is still available, so the FIPS provider is not enforcing approved algorithms');
  } catch {
    // Expected: MD5 is not approved.
  }
  return problems;
}

function enableFipsMode(env = process.env) {
  if (String(env.FIPS_MODE || '').toLowerCase() !== 'true') return { enabled: false };
  try {
    crypto.setFips(true);
  } catch (error) {
    throw new Error(`FIPS_MODE=true but OpenSSL refused to enter FIPS mode: ${error.message}`);
  }
  const problems = crypto.getFips() === 1 ? selfTest() : ['crypto.getFips() did not report FIPS mode'];
  if (problems.length) {
    throw new Error(`FIPS_MODE=true but ${problems.join('; ')}. Run Node with a FIPS-enabled OpenSSL 3 configuration (see docs/guides/FEDERAL_DEPLOYMENT.md) or unset FIPS_MODE.`);
  }
  return { enabled: true, openssl: process.versions.openssl };
}

function fipsStatus() {
  return { enabled: crypto.getFips() === 1, openssl: process.versions.openssl };
}

module.exports = { enableFipsMode, fipsStatus, selfTest };
