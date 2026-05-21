# 🔑 SSO/SAML Integration Guide

Configure Single Sign-On (SSO) for ControlWeave using SAML 2.0.

> **Note**: SSO/SAML is available on the **Enterprise** tier only.

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

### Step 1: Get Service Provider (SP) Metadata from ControlWeave

1. Go to **Settings** → **Security** → **SSO/SAML**
2. Click **Download SP Metadata** or copy the SP values:
   - **Entity ID (SP)**: `https://app.controlweave.com/saml/metadata`
   - **ACS URL**: `https://app.controlweave.com/saml/callback`
   - **Name ID Format**: `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`

### Step 2: Configure Your Identity Provider

#### Okta
1. In Okta Admin: **Applications** → **Create App Integration** → **SAML 2.0**
2. **Single sign-on URL**: Your ACS URL
3. **Audience URI (SP Entity ID)**: Your Entity ID
4. **Name ID format**: EmailAddress
5. **Attribute Statements**: Add `email`, `firstName`, `lastName`
6. Download the IdP metadata XML

#### Azure AD / Entra ID
1. In Azure Portal: **Enterprise Applications** → **New Application** → **Create your own**
2. Select **Integrate any other application you don't find in the gallery**
3. Go to **Single Sign-On** → **SAML**
4. Enter the SP Entity ID and ACS URL
5. Map attributes: `user.mail` → `email`, `user.givenname` → `firstName`
6. Download the Federation Metadata XML

#### Google Workspace
1. In Google Admin: **Apps** → **Web and mobile apps** → **Add app** → **Add custom SAML app**
2. Enter ACS URL and Entity ID
3. Map attributes: `Basic Information > Primary Email` → `email`
4. Download the IdP metadata

### Step 3: Configure ControlWeave with IdP Metadata

1. Return to **Settings** → **Security** → **SSO/SAML**
2. Upload the IdP metadata XML file (or paste the metadata URL)
3. Map attributes:
   - **Email Attribute**: `email` (or IdP-specific attribute name)
   - **First Name**: `firstName` or `givenName`
   - **Last Name**: `lastName` or `sn`
4. (Optional) Configure **Default Role** for new SSO users
5. Click **Save Configuration**

### Step 4: Test the SSO Connection

1. Click **Test SSO Login**
2. A new browser window opens the IdP login page
3. Authenticate with your corporate credentials
4. On success, you'll see a confirmation message
5. Enable SSO for your organization

## Attribute Mapping Reference

| ControlWeave Field | Common SAML Attribute Name |
|-------------------|---------------------------|
| Email (required) | `email`, `mail`, `emailAddress` |
| First Name | `firstName`, `givenName`, `given_name` |
| Last Name | `lastName`, `sn`, `family_name` |
| Role | `role`, `controlweaveRole` (optional) |

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

## Related Guides

- [Security Settings](../guides/SECURITY.md) - Security configuration overview
- [User Management](../guides/USERS.md) - Managing users and roles
