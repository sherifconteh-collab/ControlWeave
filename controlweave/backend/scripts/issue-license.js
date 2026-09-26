#!/usr/bin/env node
'use strict';

/**
 * Issue offline license keys for self-hosted customers (open-core model).
 *
 *   node scripts/issue-license.js keygen --out ./license-keys
 *     Creates an RSA-3072 signing key pair. Keep license-private.pem offline
 *     (sales/ops only). Ship license-public.pem to customers' deployments as
 *     CONTROLWEAVE_LICENSE_PUBKEY (or bake it into the image).
 *
 *   node scripts/issue-license.js issue --key ./license-keys/license-private.pem \
 *     --licensee "Acme Health" --tier enterprise --seats 250 \
 *     [--maintenance 2027-12-31] [--expires 2027-12-31] [--features scim,sso] [--addons erp]
 *     Prints a signed license key. The customer sets LICENSE_KEY, or an
 *     administrator activates it under Settings -> License. Validation is
 *     offline (air-gapped federal installs need no network access).
 *
 * Tiers: community, pro, enterprise, govcloud. --seats -1 means unlimited.
 * Add-ons (separately licensed modules, independent of the tier): erp.
 * Omit --expires for a perpetual license; --maintenance bounds update and
 * support eligibility without switching the product off.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const TIERS = new Set(['community', 'pro', 'enterprise', 'govcloud']);
const { ADDONS } = require('../src/config/plans');

function args() {
  const out = { _: [] };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      out[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    } else {
      out._.push(argv[i]);
    }
  }
  return out;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function keygen(opts) {
  const dir = path.resolve(opts.out || './license-keys');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 3072,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  fs.writeFileSync(path.join(dir, 'license-private.pem'), privateKey, { mode: 0o600 });
  fs.writeFileSync(path.join(dir, 'license-public.pem'), publicKey, { mode: 0o644 });
  process.stdout.write(`Wrote ${dir}/license-private.pem (keep offline) and ${dir}/license-public.pem\n`);
}

function issue(opts) {
  if (!opts.key) fail('--key <private key PEM> is required');
  if (!opts.licensee) fail('--licensee is required');
  const tier = String(opts.tier || '').toLowerCase();
  if (!TIERS.has(tier)) fail(`--tier must be one of ${[...TIERS].join(', ')}`);
  const seats = opts.seats === undefined ? -1 : Number(opts.seats);
  if (!Number.isInteger(seats) || seats < -1 || seats === 0) fail('--seats must be a positive integer or -1');
  for (const field of ['maintenance', 'expires']) {
    if (opts[field] && !isDate(opts[field])) fail(`--${field} must be YYYY-MM-DD`);
  }
  const addons = opts.addons ? String(opts.addons).split(',').map((a) => a.trim().toLowerCase()).filter(Boolean) : [];
  const unknownAddon = addons.find((a) => !ADDONS[a]);
  if (unknownAddon) fail(`--addons: unknown add-on ${unknownAddon} (known: ${Object.keys(ADDONS).join(', ')})`);
  const payload = {
    tier,
    seats,
    features: opts.features ? String(opts.features).split(',').map((f) => f.trim()).filter(Boolean) : [],
    ...(addons.length ? { addons } : {}),
    ...(opts.maintenance ? { maintenance_until: opts.maintenance } : {}),
    license_id: crypto.randomUUID()
  };
  const signOptions = {
    algorithm: 'RS256',
    issuer: 'controlweave',
    audience: 'controlweave-license',
    subject: String(opts.licensee)
  };
  if (opts.expires) signOptions.expiresIn = Math.max(1, Math.floor((Date.parse(`${opts.expires}T23:59:59Z`) - Date.now()) / 1000));
  const privateKey = fs.readFileSync(path.resolve(opts.key), 'utf8');
  const bits = crypto.createPrivateKey(privateKey).asymmetricKeyDetails.modulusLength;
  if (bits < 3072) fail('Signing key must be RSA-3072 or larger');
  process.stdout.write(`${jwt.sign(payload, privateKey, signOptions)}\n`);
}

const opts = args();
if (opts._[0] === 'keygen') keygen(opts);
else if (opts._[0] === 'issue') issue(opts);
else fail('Usage: issue-license.js keygen --out DIR | issue --key PEM --licensee NAME --tier TIER [--seats N] [--maintenance DATE] [--expires DATE] [--features a,b]');
