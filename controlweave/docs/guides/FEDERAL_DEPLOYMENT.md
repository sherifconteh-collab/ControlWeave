# Federal Deployment

This guide covers the ControlWeave settings that federal and defense deployments need, and what is still outside the product.

## FIPS mode

Setting `FIPS_MODE=true` switches Node's OpenSSL to its FIPS provider before any other module loads, so hashing, HMAC, AES-GCM and TLS run only through the validated module.

`crypto.setFips(true)` reports success even when no FIPS provider is installed, and afterwards every algorithm fails. So at startup ControlWeave also checks:
- that SHA-384, HMAC-SHA-384 and AES-256-GCM work
- that MD5 is refused

If either check fails, the server does not start, and the log says why.

**Host requirements.** The host has to provide a FIPS provider. With Node 20+ on OpenSSL 3:

1. Install OpenSSL 3 with its FIPS module (`fips.so`), and run `openssl fipsinstall -out /etc/ssl/fipsmodule.cnf -module /path/to/fips.so`.
2. Create an OpenSSL configuration that includes `fipsmodule.cnf` and activates the `fips` and `base` providers.
3. Start ControlWeave with `OPENSSL_CONF=/path/to/openssl.cnf` (or `node --openssl-config=...`) and `FIPS_MODE=true`.

Use a base image whose OpenSSL FIPS module holds a current FIPS 140-3 certificate. Most hardened government images and Red Hat UBI in FIPS mode qualify.

**What this does and does not claim**
- ControlWeave then uses a validated cryptographic module for its cryptography. ControlWeave itself is not a validated module.
- Password hashing uses bcrypt in JavaScript, outside the module boundary. Document it as such in the system security plan.
- Tokens are signed HS384. Integrity hashes and webhook signatures use SHA-384.

## CAC / PIV sign-in

Use [SAML single sign-on](./ENTERPRISE_SSO.md) through the agency identity provider, which performs the certificate authentication. Enforce SSO for the organization so password sign-in is not available. ControlWeave does not terminate client certificates itself.

## Session and access controls

- Account lockout, TOTP or passkey MFA, SSO enforcement and SCIM deprovisioning are available. See [Enterprise SSO](./ENTERPRISE_SSO.md) and [Security](./SECURITY.md).
- The audit trail is append-only and hash-chained.

## Hosting and authorization

**Self-hosted.** The self-hosted license, with offline activation, covers on-premises and air-gapped enclaves. This is the path available today for DoD IL4/IL5 and agency environments: the agency's authorized infrastructure hosts ControlWeave and inherits its controls.

**SaaS.** The Railway-hosted service is not FedRAMP authorized. A FedRAMP 20x or DoD IL4/IL5 SaaS offering requires:
- hosting on an authorized platform (for example AWS GovCloud or Azure Government)
- a 3PAO assessment

That work is driven by a sponsoring agency and is outside the code base; see the [ERP plan](../ERP_GRC_PLAN.md).

**Accessibility.** A Section 508 VPAT has not been published yet.
