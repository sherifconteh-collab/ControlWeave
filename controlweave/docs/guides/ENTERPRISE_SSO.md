# Single Sign-On and User Provisioning

ControlWeave signs users in through your identity provider (IdP) with **SAML 2.0** or **OpenID Connect**, and lets the IdP create, update and deactivate users with **SCIM 2.0**. Both are configured by an administrator (`settings.manage`) under **Settings → Security**.

## How users sign in

On the login page, users enter their work email and choose **Sign in with SSO**. ControlWeave finds the organization from the email domain and sends the user to the IdP. After the IdP signs them in, they return to ControlWeave. If they have two-factor authentication enabled in ControlWeave, they confirm it before the session starts.

Turn on **Require SSO** to stop every other way of signing in (password, passkey, and social sign-in with Google, Microsoft, Apple or GitHub) for everyone except administrators. Administrators keep those paths so they can still get in if the IdP is unavailable. If ControlWeave cannot read the setting, sign-in is refused rather than allowed.

## SAML 2.0

1. In ControlWeave, open **Settings → Security → Single sign-on** and choose **SAML 2.0**. Copy the three service provider values shown:
   - **SP entity ID / audience**: `https://<backend>/api/v1/sso/saml/<org-id>/metadata`
   - **ACS (reply) URL**, using the HTTP-POST binding: `https://<backend>/api/v1/sso/saml/<org-id>/acs`
   - **SP metadata URL**: the same address as the entity ID. IdPs that accept metadata can import it from here.
2. In the IdP, create a SAML application with those values:
   - Set the NameID format to *EmailAddress*.
   - Send the user's email, either as the NameID or as an `email`/`mail` attribute, plus a display name or given name and surname.
   - Assertions must be signed. SHA-256 is recommended.
3. Back in ControlWeave, enter:
   - the IdP **sign-on URL**, using the HTTP-Redirect binding
   - the IdP **entity ID / issuer** (recommended)
   - the IdP **signing certificate** (PEM)
   - your **email domain**
4. Leave **Create accounts on first sign-in** on to provision users just in time with the default role, or turn it off if you provision users with SCIM.

| IdP | Where to find the values |
|---|---|
| Okta | Applications → Create App Integration → SAML 2.0. The sign-on URL, issuer and certificate are under the app's **Sign On** tab → *View SAML setup instructions*. |
| Microsoft Entra ID | Enterprise applications → New application → Create your own → SAML. The *Login URL*, *Microsoft Entra Identifier* and *Certificate (Base64)* are under **Set up single sign-on**. |

### Security properties

- A response is accepted only if all of the following hold:
  - it is signed by the configured certificate
  - it is addressed to this organization's entity ID (audience) and ACS URL
  - it is within its validity window (2 minutes clock skew allowed)
  - it answers a sign-in request ControlWeave issued in the last 10 minutes
- Request IDs are stored in the database, so a response cannot be replayed, and this works across multiple backend instances.
- **Allow IdP-initiated sign-in** (the IdP dashboard tile) removes that last request check. Each assertion is still accepted only once: its ID is recorded when it is used, so a captured response cannot be posted again. Leave the setting off unless you need the tile.
- Every SAML sign-in, and every rejected one, is written to the audit log with the reason.

## OpenID Connect

Choose **OpenID Connect**, give the IdP the **Redirect URI** shown, and enter the discovery URL, client ID and client secret. The client secret is encrypted at rest and never shown again.

## Email domains

A verified domain routes "Sign in with SSO" to your IdP. To verify one:

1. Add the domain under **Email domains** and save. It is listed as pending, with a DNS TXT record to publish.
2. At your DNS provider, create a TXT record named `_controlweave-verification.<domain>` with the value shown (`controlweave-verification=<token>`).
3. Select **Verify**. ControlWeave looks the record up, and the domain is verified once it matches. DNS changes can take a while to appear; try again if it is not found yet.

Only verified domains are used to route sign-in, and a domain can be verified by one organization only; other organizations' pending claims for it are removed when it is verified. A pending claim blocks nobody, so another tenant cannot squat your domain or send your users to an IdP it controls. You can remove the TXT record after verifying.

## SCIM 2.0 provisioning

1. Under **User provisioning (SCIM 2.0)**, click **Create SCIM token** and copy it. It is shown once, and only its hash is stored.
2. In the IdP, enable provisioning:
   - **Base URL**: `https://<backend>/api/v1/scim/v2`
   - **Authentication**: HTTP header / bearer token, using the token from step 1
   - **Okta**: turn on *Create Users*, *Update User Attributes* and *Deactivate Users*.
   - **Entra ID**: set provisioning mode to *Automatic*.
3. Assign users or groups to the application in the IdP.

What SCIM does:

| IdP action | ControlWeave effect |
|---|---|
| Assign user | Creates the user with the SSO default role (never administrator). The password is random and never shown, so the user signs in through SSO. |
| Update profile | Updates the user's name. |
| Unassign or deactivate | Deactivates the user and ends their sessions immediately. Their records remain for the audit trail. The organization's last active administrator and platform administrators are refused (SCIM error `mutability`, recorded in the audit log), so the IdP cannot lock the organization out; assign another administrator in ControlWeave first. |
| Reactivate | Reactivates the user. |

Supported:

- the Users resource, with `userName` and `externalId` equality filters
- PATCH in both Okta and Entra formats
- PUT and DELETE, where DELETE deactivates the user

Not supported:

- Groups: the endpoint returns an empty list so connection tests pass, and roles are assigned in ControlWeave
- bulk operations

Every SCIM change is audit-logged with the token that made it. Revoke a token under **Settings → Security** at any time.
