'use client';

import { useCallback, useEffect, useState } from 'react';
import { scimAPI, ssoAPI } from '@/lib/api';

type Provider = 'oidc' | 'saml';

interface SsoForm {
  provider_type: Provider;
  display_name: string;
  enabled: boolean;
  auto_provision: boolean;
  default_role: string;
  discovery_url: string;
  client_id: string;
  client_secret: string;
  saml_entry_point: string;
  saml_idp_issuer: string;
  saml_idp_cert: string;
  saml_email_attribute: string;
  saml_allow_idp_initiated: boolean;
  enforce_sso: boolean;
  email_domains: string;
}

interface ServiceProviderInfo {
  entity_id: string;
  acs_url: string;
  metadata_url: string;
  oidc_redirect_uri: string;
}

interface DomainStatus {
  domain: string;
  verified: boolean;
  txt_record: { name: string; value: string };
}

interface ScimToken {
  id: string;
  name: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

const EMPTY: SsoForm = {
  provider_type: 'saml', display_name: 'Single sign-on', enabled: true, auto_provision: true, default_role: 'user',
  discovery_url: '', client_id: '', client_secret: '', saml_entry_point: '', saml_idp_issuer: '', saml_idp_cert: '',
  saml_email_attribute: '', saml_allow_idp_initiated: false, enforce_sso: false, email_domains: '',
};

const input = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500';

function apiError(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: unknown } } })?.response?.data;
  return typeof data?.error === 'string' ? data.error : fallback;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="text-xs font-medium text-gray-600">{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 break-all">{value}</code>
        <button
          type="button"
          className="text-xs text-purple-700 hover:underline"
          onClick={() => { navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => undefined); }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

export default function EnterpriseSsoPanel() {
  const [form, setForm] = useState<SsoForm>(EMPTY);
  const [certSet, setCertSet] = useState(false);
  const [sp, setSp] = useState<ServiceProviderInfo | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [tokens, setTokens] = useState<ScimToken[]>([]);
  const [scimBase, setScimBase] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [domainStatus, setDomainStatus] = useState<DomainStatus[]>([]);
  const [verifying, setVerifying] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await ssoAPI.getConfig();
      const data = (res.data?.data || null) as Record<string, unknown> | null;
      setSp((res.data?.service_provider || null) as ServiceProviderInfo | null);
      setDomainStatus(data && Array.isArray(data.email_domain_status) ? (data.email_domain_status as DomainStatus[]) : []);
      if (data) {
        setCertSet(Boolean(data.saml_idp_cert_set));
        setForm({
          ...EMPTY,
          provider_type: data.provider_type === 'oidc' ? 'oidc' : 'saml',
          display_name: str(data.display_name) || EMPTY.display_name,
          enabled: data.enabled !== false,
          auto_provision: data.auto_provision !== false,
          default_role: str(data.default_role) || 'user',
          discovery_url: str(data.discovery_url),
          client_id: str(data.client_id),
          saml_entry_point: str(data.saml_entry_point),
          saml_idp_issuer: str(data.saml_idp_issuer),
          saml_email_attribute: str(data.saml_email_attribute),
          saml_allow_idp_initiated: Boolean(data.saml_allow_idp_initiated),
          enforce_sso: Boolean(data.enforce_sso),
          email_domains: Array.isArray(data.email_domains) ? (data.email_domains as string[]).join(', ') : '',
        });
      }
    } catch { /* not configured yet */ }
    try {
      const res = await scimAPI.listTokens();
      setTokens((res.data?.data?.tokens || []) as ScimToken[]);
      setScimBase(str(res.data?.data?.base_url));
    } catch { /* SCIM list unavailable */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const verifyDomain = async (domain: string) => {
    setVerifying(domain);
    setMessage(null);
    try {
      await ssoAPI.verifyDomain(domain);
      setMessage({ ok: true, text: `${domain} is verified. Users with this email domain are now sent to your identity provider.` });
      await load();
    } catch (err: unknown) {
      setMessage({ ok: false, text: apiError(err, `Could not verify ${domain}.`) });
    } finally {
      setVerifying(null);
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await ssoAPI.saveConfig({
        ...form,
        client_secret: form.client_secret || undefined,
        saml_idp_cert: form.saml_idp_cert || undefined,
        email_domains: form.email_domains.split(/[\s,]+/).filter(Boolean),
      });
      setMessage({ ok: true, text: 'Single sign-on settings saved.' });
      setForm((f) => ({ ...f, client_secret: '', saml_idp_cert: '' }));
      await load();
    } catch (err: unknown) {
      setMessage({ ok: false, text: apiError(err, 'Could not save single sign-on settings.') });
    } finally {
      setSaving(false);
    }
  };

  const createToken = async () => {
    try {
      const res = await scimAPI.createToken('Identity provider');
      setNewToken(str(res.data?.data?.token));
      await load();
    } catch (err: unknown) {
      setMessage({ ok: false, text: apiError(err, 'Could not create a SCIM token.') });
    }
  };

  const revokeToken = async (id: string) => {
    if (!confirm('Revoke this token? Provisioning from the identity provider stops until you create a new one.')) return;
    await scimAPI.revokeToken(id).catch(() => undefined);
    await load();
  };

  const canSave = form.provider_type === 'saml' ? Boolean(form.saml_entry_point && (certSet || form.saml_idp_cert)) : Boolean(form.discovery_url && form.client_id);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Single sign-on</h2>
        <p className="text-sm text-gray-500 mb-4">
          Sign users in through your identity provider (Okta, Microsoft Entra ID, Ping, OneLogin, Google Workspace, ADFS)
          with SAML 2.0 or OpenID Connect. Users choose &quot;Sign in with SSO&quot; and enter their work email.
        </p>
        {message && (
          <div className={`mb-4 px-4 py-2 rounded-lg text-sm border ${message.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`} role="status">
            {message.text}
          </div>
        )}

        <div className="flex gap-2 mb-4" role="radiogroup" aria-label="Protocol">
          {(['saml', 'oidc'] as Provider[]).map((p) => (
            <button key={p} type="button" role="radio" aria-checked={form.provider_type === p} onClick={() => setForm({ ...form, provider_type: p })}
              className={`px-3 py-1.5 text-sm rounded-md border ${form.provider_type === p ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-300 text-gray-700'}`}>
              {p === 'saml' ? 'SAML 2.0' : 'OpenID Connect'}
            </button>
          ))}
        </div>

        {sp && (
          <div className="mb-5 p-3 bg-purple-50 border border-purple-100 rounded-lg space-y-2 max-w-2xl">
            <p className="text-xs text-purple-900 font-medium">Give these values to your identity provider administrator:</p>
            {form.provider_type === 'saml' ? (
              <>
                <CopyField label="SP entity ID / audience" value={sp.entity_id} />
                <CopyField label="ACS (reply) URL, HTTP-POST" value={sp.acs_url} />
                <CopyField label="SP metadata URL" value={sp.metadata_url} />
              </>
            ) : (
              <CopyField label="Redirect URI" value={sp.oidc_redirect_uri} />
            )}
          </div>
        )}

        <div className="space-y-4 max-w-2xl">
          <div>
            <label htmlFor="sso-name" className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
            <input id="sso-name" className={input} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          </div>
          {form.provider_type === 'saml' ? (
            <>
              <div>
                <label htmlFor="saml-sso-url" className="block text-sm font-medium text-gray-700 mb-1">IdP sign-on URL (HTTP-Redirect)</label>
                <input id="saml-sso-url" className={input} value={form.saml_entry_point} onChange={(e) => setForm({ ...form, saml_entry_point: e.target.value })} placeholder="https://acme.okta.com/app/.../sso/saml" />
              </div>
              <div>
                <label htmlFor="saml-issuer" className="block text-sm font-medium text-gray-700 mb-1">IdP entity ID / issuer (optional, recommended)</label>
                <input id="saml-issuer" className={input} value={form.saml_idp_issuer} onChange={(e) => setForm({ ...form, saml_idp_issuer: e.target.value })} placeholder="http://www.okta.com/exk..." />
              </div>
              <div>
                <label htmlFor="saml-cert" className="block text-sm font-medium text-gray-700 mb-1">
                  IdP signing certificate (PEM){certSet && <span className="text-gray-400 font-normal"> - stored; paste a new one to replace</span>}
                </label>
                <textarea id="saml-cert" rows={4} className={`${input} font-mono text-xs`} value={form.saml_idp_cert} onChange={(e) => setForm({ ...form, saml_idp_cert: e.target.value })} placeholder="-----BEGIN CERTIFICATE-----" />
              </div>
              <div>
                <label htmlFor="saml-email-attr" className="block text-sm font-medium text-gray-700 mb-1">Email attribute (optional)</label>
                <input id="saml-email-attr" className={input} value={form.saml_email_attribute} onChange={(e) => setForm({ ...form, saml_email_attribute: e.target.value })} placeholder="Defaults to email, mail or the NameID" />
              </div>
              <label htmlFor="saml-idp-init" className="flex items-center gap-2 text-sm text-gray-700">
                <input id="saml-idp-init" type="checkbox" checked={form.saml_allow_idp_initiated} onChange={(e) => setForm({ ...form, saml_allow_idp_initiated: e.target.checked })} />
                Allow IdP-initiated sign-in (app tile in the IdP dashboard). Off is safer: only responses to a sign-in started here are accepted.
              </label>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="oidc-discovery" className="block text-sm font-medium text-gray-700 mb-1">Discovery URL</label>
                <input id="oidc-discovery" className={input} value={form.discovery_url} onChange={(e) => setForm({ ...form, discovery_url: e.target.value })} placeholder="https://acme.okta.com/.well-known/openid-configuration" />
              </div>
              <div>
                <label htmlFor="oidc-client" className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                <input id="oidc-client" className={input} value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} />
              </div>
              <div>
                <label htmlFor="oidc-secret" className="block text-sm font-medium text-gray-700 mb-1">Client secret <span className="text-gray-400 font-normal">(leave blank to keep the stored one)</span></label>
                <input id="oidc-secret" type="password" autoComplete="off" className={input} value={form.client_secret} onChange={(e) => setForm({ ...form, client_secret: e.target.value })} />
              </div>
            </>
          )}
          <div>
            <label htmlFor="sso-domains" className="block text-sm font-medium text-gray-700 mb-1">Email domains</label>
            <input id="sso-domains" className={input} value={form.email_domains} onChange={(e) => setForm({ ...form, email_domains: e.target.value })} placeholder="acme.com" />
            <p className="text-xs text-gray-500 mt-1">After saving, prove you control each domain by publishing its DNS TXT record and selecting Verify. Only verified domains send users to your identity provider.</p>
            {domainStatus.length > 0 && (
              <ul role="list" className="mt-2 space-y-2">
                {domainStatus.map((d) => (
                  <li key={d.domain} role="listitem" className="border border-gray-200 rounded-md p-2 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-800">{d.domain}</span>
                      {d.verified ? (
                        <span className="text-xs font-medium text-green-700 bg-green-50 rounded px-2 py-0.5">Verified</span>
                      ) : (
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded bg-purple-600 text-white disabled:opacity-50"
                          disabled={verifying === d.domain}
                          onClick={() => { void verifyDomain(d.domain); }}
                        >
                          {verifying === d.domain ? 'Checking...' : 'Verify'}
                        </button>
                      )}
                    </div>
                    {!d.verified && (
                      <>
                        <CopyField label="TXT record name" value={d.txt_record.name} />
                        <CopyField label="TXT record value" value={d.txt_record.value} />
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap gap-4">
            {([
              ['enabled', 'Enabled'],
              ['auto_provision', 'Create accounts on first sign-in'],
              ['enforce_sso', 'Require SSO (password sign-in only for administrators)'],
            ] as const).map(([key, label]) => (
              <label key={key} htmlFor={`sso-${key}`} className="flex items-center gap-2 text-sm text-gray-700">
                <input id={`sso-${key}`} type="checkbox" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
                {label}
              </label>
            ))}
          </div>
          <button type="button" onClick={save} disabled={saving || !canSave} className="px-6 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save single sign-on'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">User provisioning (SCIM 2.0)</h2>
        <p className="text-sm text-gray-500 mb-4">
          Let your identity provider create, update and deactivate ControlWeave users automatically. Deactivating a user in
          the identity provider ends their ControlWeave sessions immediately.
        </p>
        {scimBase && <div className="max-w-2xl mb-4"><CopyField label="SCIM base URL" value={scimBase} /></div>}
        {newToken && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg max-w-2xl">
            <p className="text-sm text-amber-900 font-medium mb-1">Copy this token now. It will not be shown again.</p>
            <CopyField label="Bearer token" value={newToken} />
          </div>
        )}
        <button type="button" onClick={createToken} className="px-4 py-2 text-sm border border-purple-300 text-purple-700 rounded-md hover:bg-purple-50 mb-3">Create SCIM token</button>
        <ul role="list" className="divide-y divide-gray-100 max-w-2xl">
          {tokens.map((t) => (
            <li role="listitem" key={t.id} className="py-2 flex items-center justify-between text-sm">
              <span>
                <span className="font-medium">{t.name}</span> <code className="text-xs text-gray-500">{t.token_prefix}…</code>
                <span className="block text-xs text-gray-500">
                  Created {new Date(t.created_at).toLocaleDateString()}
                  {t.last_used_at ? `, last used ${new Date(t.last_used_at).toLocaleString()}` : ', never used'}
                  {t.revoked_at ? `, revoked ${new Date(t.revoked_at).toLocaleDateString()}` : ''}
                </span>
              </span>
              {!t.revoked_at && <button type="button" onClick={() => revokeToken(t.id)} className="text-xs text-red-600 hover:underline">Revoke</button>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
