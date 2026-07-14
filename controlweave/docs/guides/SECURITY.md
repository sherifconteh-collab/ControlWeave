# 🔒 Security Settings Guide

Configure security features including two-factor authentication, passkeys, and SSO.

## Overview

ControlWeaver provides several account and organization security features, configured from **Settings** → **Security** (organization-level SSO/passkey setup) and **Account** → **Security** (your own TOTP/passkeys). This guide covers what's actually configurable today — see the note at the end for security controls that are sometimes assumed to exist but currently don't.

## Two-Factor Authentication (TOTP)

Add an extra layer of security using a TOTP authenticator app (Google Authenticator, Authy, 1Password, etc.):

1. Go to **Account** → **Security**
2. Click **Set Up Two-Factor Authentication**
3. Scan the QR code (or enter the manual key) into your authenticator app
4. Enter the 6-digit code to confirm setup
5. Save your backup codes somewhere safe

TOTP is **opt-in per user** — there is currently no organization-wide setting to require every user to enable it. Once enabled, every email + password sign-in requires both your password and a 6-digit code. Sign-ins using passkeys or SSO may authenticate without a TOTP challenge, depending on your configuration.

## Passkey Authentication (WebAuthn)

Passkeys provide phishing-resistant authentication using device biometrics or hardware keys.

### Setting Up Passkeys

1. Go to **Account** → **Security** → **Passkeys**
2. Click **Add Passkey**
3. Follow your device's biometric prompt (fingerprint, face ID, or hardware key)
4. Name your passkey (e.g., "MacBook Touch ID")
5. Click **Save**

Passkeys are opt-in per user, same as TOTP — there's no organization-wide "require passkey for all logins" enforcement toggle currently.

## Single Sign-On (SSO)

### SAML 2.0 Configuration

1. Go to **Settings** → **Security** → **SSO/SAML**
2. Download the ControlWeaver Service Provider metadata
3. Configure your Identity Provider (IdP) with the SP metadata
4. Enter the IdP metadata URL or paste the XML
5. Map user attributes (email, name, role)
6. Test the SSO connection
7. Enable SSO for your organization

**Supported Identity Providers:**
- Okta
- Azure AD / Entra ID
- Google Workspace
- OneLogin
- JumpCloud

## Session Behavior

These are fixed platform defaults, not per-organization settings — there's no Session Policy configuration UI:

| Setting | Value | Description |
|---------|-------|-------------|
| **Access Token** | 15 minutes | Short-lived; auto-refreshed in the background |
| **Refresh Token Expiry** | 7 days | How long a login stays valid without re-authenticating |
| **Account Lockout** | 5 failed attempts → 15-minute lock | Applies to password sign-in |
| **Concurrent Sessions** | 10 per user by default | Oldest sessions are evicted once the limit is reached; server-configurable via `MAX_CONCURRENT_SESSIONS`, not adjustable from the UI |

## Audit Log

All security events are logged in **Settings** → **Audit Log**:
- Login attempts (success/failure)
- Role changes
- SSO events
- Password resets
- API key creation/revocation

## Security controls that don't exist yet

A few controls that sound like they should be here, but currently have no implementation — don't reference these when advising a customer, and treat a request for them as a feature gap rather than a misconfiguration:
- **IP allowlisting** — no way to restrict access by IP range or CIDR block.
- **Organization-wide MFA mandate** — no toggle to force every user in an org to enable TOTP or passkeys.
- **Configurable session timeout** — the access/refresh token lifetimes above are fixed, not adjustable per organization.

## Related Guides

- [User Management](USERS.md) - Manage team members and roles
- [Settings & Configuration](SETTINGS.md) - Organization settings
- [SSO Setup](../integrations/SSO.md) - Detailed SSO integration guide
- [Account Setup](ACCOUNT_SETUP.md) - Initial account configuration
