'use strict';

jest.mock('../../src/config/database', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({ log: jest.fn(), serializeError: (e) => e }));

const saml = require('../../src/services/samlService');
const scim = require('../../src/routes/scim');

describe('SAML identity mapping', () => {
  it('prefers the configured attribute, then common email claims, then an email NameID', () => {
    expect(saml.identityFromProfile({ nameID: 'x', mail: 'A@Example.com', displayName: 'Ann A' }, {}))
      .toEqual({ email: 'a@example.com', name: 'Ann A', subject: 'x' });
    expect(saml.identityFromProfile({ nameID: 'b@example.com', attributes: { upn: 'c@example.com' } }, { saml_email_attribute: 'upn' }).email)
      .toBe('c@example.com');
    expect(saml.identityFromProfile({ nameID: 'd@example.com', givenName: 'Dee', sn: 'Dee' }, {}))
      .toEqual({ email: 'd@example.com', name: 'Dee Dee', subject: 'd@example.com' });
    expect(saml.identityFromProfile({ nameID: 'opaque-id' }, {}).email).toBeNull();
  });

  it('builds per-organization service provider URLs and normalizes PEM certificates', () => {
    const urls = saml.spUrls('org-1');
    expect(urls.acsUrl).toMatch(/\/api\/v1\/sso\/saml\/org-1\/acs$/);
    expect(urls.entityId).toBe(urls.metadataUrl);
    expect(saml.normalizeCert('-----BEGIN CERTIFICATE-----\nAB C\nD\n-----END CERTIFICATE-----\n')).toBe('ABCD');
    expect(saml.isSamlReady({ provider_type: 'saml', saml_entry_point: 'https://x', saml_idp_cert: 'A' })).toBe(true);
    expect(saml.isSamlReady({ provider_type: 'oidc' })).toBe(false);
  });
});

describe('SCIM PATCH and filters', () => {
  it('accepts Okta value-object and Entra path-style operations', () => {
    expect(scim.patchChanges([{ op: 'replace', value: { active: false } }])).toEqual({ active: false });
    expect(scim.patchChanges([
      { op: 'Replace', path: 'active', value: 'True' },
      { op: 'Add', path: 'name.familyName', value: 'Lee' },
      { op: 'Remove', path: 'externalId' }
    ])).toEqual({ active: true, lastName: 'Lee' });
  });

  it('supports userName and externalId equality filters only', () => {
    expect(scim.parseFilter('userName eq "a@b.com"')).toEqual({ attribute: 'userName', value: 'a@b.com' });
    expect(scim.parseFilter('externalId eq "00u1"')).toEqual({ attribute: 'externalId', value: '00u1' });
    expect(scim.parseFilter('emails[type eq "work"].value eq "a@b.com"')).toEqual({ attribute: 'userName', value: 'a@b.com' });
    expect(scim.parseFilter('userName sw "a"')).toEqual({ unsupported: true });
  });
});
