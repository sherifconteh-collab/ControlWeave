'use strict';

/** Helpers shared by the ERP connectors. */

/** Text from a scalar, a Workday-style { Descriptor } object or a SCIM { display, value } object. */
function text(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (typeof value === 'object') return text(value.Descriptor ?? value.descriptor ?? value.display ?? value.name ?? value.value ?? '');
  return '';
}

/** A multi-valued field as a list of names: arrays, or text separated by ; or |. */
function list(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  const single = text(value);
  return single ? single.split(/[;|]/).map((v) => v.trim()).filter(Boolean) : [];
}

/** Active/inactive from the many ways systems express it. */
function status(value) {
  if (value === undefined || value === null || value === '') return 'active';
  if (typeof value === 'boolean') return value ? 'active' : 'inactive';
  const v = text(value).toLowerCase();
  if (['1', 'true', 'y', 'yes', 'active', 'enabled', 'open'].includes(v)) return 'active';
  if (['locked', 'suspended'].includes(v)) return 'locked';
  return 'inactive';
}

function basicAuth(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

function requireSettings(config, names) {
  const missing = names.filter((n) => !config[n]);
  if (missing.length) throw new Error(`Missing connector settings: ${missing.join(', ')}`);
}

module.exports = { text, list, status, basicAuth, requireSettings };
