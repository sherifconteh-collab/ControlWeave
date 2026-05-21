# 🔒 Security Settings Guide

Configure security features including passkeys, SSO, session policies, and access controls.

## Overview

ControlWeave provides enterprise-grade security features to protect your compliance data. This guide covers all security configuration options available in **Settings** → **Security**.

## Multi-Factor Authentication (MFA)

### Enabling MFA

1. Go to **Settings** → **Security**
2. Toggle **Require MFA** to ON
3. Choose MFA method: Authenticator App or Email OTP
4. Click **Save**

### MFA Enforcement

- **Mandatory**: All users must set up MFA before accessing the platform
- **Optional**: Users can enable MFA voluntarily

## Passkey Authentication (WebAuthn)

Passkeys provide phishing-resistant authentication using device biometrics or hardware keys.

### Setting Up Passkeys

1. Go to **Account** → **Security** → **Passkeys**
2. Click **Add Passkey**
3. Follow your device's biometric prompt (fingerprint, face ID, or hardware key)
4. Name your passkey (e.g., "MacBook Touch ID")
5. Click **Save**

### Passkey Policies (Enterprise)

Administrators can enforce passkey-only authentication:
1. **Settings** → **Security** → **Authentication Policy**
2. Enable **Require Passkey for All Logins**

## Single Sign-On (SSO) — Enterprise Only

### SAML 2.0 Configuration

1. Go to **Settings** → **Security** → **SSO/SAML**
2. Download the ControlWeave Service Provider metadata
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

## Session Management

| Setting | Default | Description |
|---------|---------|-------------|
| **Session Timeout** | 8 hours | Auto-logout after inactivity |
| **Refresh Token Expiry** | 7 days | Remember login duration |
| **Concurrent Sessions** | Unlimited | Max simultaneous logins |

Configure in **Settings** → **Security** → **Session Policy**

## IP Allowlisting — Enterprise Only

Restrict access to specific IP ranges:

1. **Settings** → **Security** → **IP Allowlist**
2. Add allowed IP addresses or CIDR ranges
3. Enable **Enforce IP Allowlist**

## Audit Log

All security events are logged in **Settings** → **Audit Log**:
- Login attempts (success/failure)
- Role changes
- SSO events
- Password resets
- API key creation/revocation

## Related Guides

- [User Management](USERS.md) - Manage team members and roles
- [Settings & Configuration](SETTINGS.md) - Organization settings
- [SSO Setup](../integrations/SSO.md) - Detailed SSO integration guide
- [Account Setup](ACCOUNT_SETUP.md) - Initial account configuration
