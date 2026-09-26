# 🔑 SSO/SAML Integration Guide

Configure Single Sign-On (SSO) for ControlWeave using SAML 2.0.

## Overview

SSO enables your team to log in to ControlWeave using your existing corporate identity provider (IdP), eliminating the need for separate passwords.

## Supported Identity Providers

- **Okta**
- **Microsoft Azure AD / Entra ID**
- **Google Workspace**
- **OneLogin**
- **JumpCloud**
- Any SAML 2.0-compliant IdP

## Configuration Steps

The full reference, including OpenID Connect, SCIM provisioning and Require SSO, is [Enterprise SSO](../guides/ENTERPRISE_SSO.md).

### Step 1: Copy the service provider values from ControlWeave

1. Go to **Settings** → **Security** → **Single sign-on** and choose **SAML 2.0**.
2. Copy the values shown. They are specific to your organization:
   - **Entity ID / metadata URL**: `https://<backend>/api/v1/sso/saml/<organization id>/metadata`
   - **ACS URL**: `https://<backend>/api/v1/sso/saml/<organization id>/acs`
   - **Name ID format**: `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`

### Step 2: Configure your identity provider

#### Okta
1. In Okta Admin: **Applications** → **Create App Integration** → **SAML 2.0**
2. **Single sign-on URL**: your ACS URL
3. **Audience URI (SP Entity ID)**: your Entity ID
4. **Name ID format**: EmailAddress
5. **Attribute Statements**: add `email`, `firstName`, `lastName`

#### Azure AD / Entra ID
1. In Azure Portal: **Enterprise Applications** → **New Application** → **Create your own**
2. Select **Integrate any other application you don't find in the gallery**
3. Go to **Single Sign-On** → **SAML**
4. Enter the SP Entity ID and ACS URL
5. Map attributes: `user.mail` → `email`, `user.givenname` → `firstName`

#### Google Workspace
1. In Google Admin: **Apps** → **Web and mobile apps** → **Add app** → **Add custom SAML app**
2. Enter the ACS URL and Entity ID
3. Map attributes: `Basic Information > Primary Email` → `email`

### Step 3: Enter the IdP settings in ControlWeave

1. Return to **Settings** → **Security** → **Single sign-on**.
2. Enter the **IdP sign-on URL** (HTTP-Redirect), the **IdP entity ID / issuer** (recommended), and paste the **IdP signing certificate**.
3. Optionally set the **Email attribute**. By default ControlWeave reads `email`, `mail` or the NameID.
4. Choose the **Default role** for users created on first sign-in.
5. Leave **Allow IdP-initiated sign-in** off unless you need the IdP dashboard tile. When it is on, each assertion is still accepted only once.
6. Click **Save**.

### Step 4: Verify your email domains

"Sign in with SSO" finds your organization from the user's email domain, but only for **verified** domains.

1. Add the domains under **Email domains** and save.
2. For each domain, publish the DNS TXT record shown: `_controlweave-verification.<domain>` with the value `controlweave-verification=<token>`.
3. Select **Verify**.

A domain can be verified by one organization only. See [Enterprise SSO](../guides/ENTERPRISE_SSO.md#email-domains).

## Attribute Mapping Reference

| ControlWeave Field | Common SAML Attribute Name |
|-------------------|---------------------------|
| Email (required) | `email`, `mail`, `emailAddress` |
| First Name | `firstName`, `givenName`, `given_name` |
| Last Name | `lastName`, `sn`, `family_name` |

## JIT (Just-In-Time) Provisioning

With JIT provisioning enabled:
- New users are automatically created in ControlWeave on first SSO login
- Users are assigned the **Default Role** configured in SSO settings
- Administrators can later change individual user roles

## Troubleshooting

**SAML response invalid**: Ensure ACS URL and Entity ID exactly match in both IdP and SP  
**Attribute not found**: Check attribute name mapping (case-sensitive)  
**Login redirect loop**: Clear browser cookies and try again  
**Certificate expired**: Update the IdP certificate in ControlWeave settings  
**"Sign in with SSO" says SSO is not set up for my email**: The email domain is not verified yet; publish its TXT record and select **Verify**  
**Assertion was already used**: A SAML response can be posted only once; start the sign-in again from the IdP or ControlWeave

## Related Guides

- [Enterprise SSO](../guides/ENTERPRISE_SSO.md) - SAML, OIDC, SCIM and Require SSO in detail
- [Security Settings](../guides/SECURITY.md) - Security configuration overview
- [User Management](../guides/USERS.md) - Managing users and roles
