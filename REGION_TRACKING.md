# Region Tracking (Data Sovereignty)

Captures geographic location (country/region, not precise coordinates) from
user IP addresses at registration and login, to support data residency
planning and AU-2 location/source audit requirements.

## Database Schema

Migration 061 (`061_add_region_tracking.sql`) adds `region` and
`country_code` to:
- `users` — per-user location
- `organizations` — organization's primary location

Indexes added for region-based queries.

## Geolocation Service

`controlweave/backend/src/services/geolocationService.js`

- Offline lookup via `geoip-lite` (^1.4.10) — no external API calls, database ships in the package.
- Supports IPv4 and IPv6, with automatic cleanup of IPv6-mapped IPv4 addresses.
- Proxy-aware IP extraction, checked in order: `X-Forwarded-For` (load balancers) → `X-Real-IP` → `CF-Connecting-IP` (Cloudflare) → direct connection IP.

**Region buckets:** North America (US, CA, MX), Europe (GB, DE, FR, IT, ES,
etc.), Asia Pacific (CN, JP, IN, SG, AU, etc.), Middle East (AE, SA, IL,
etc.), Latin America (BR, AR, CL, etc.), Africa (ZA, NG, KE, etc.).

```javascript
const { getGeolocationFromRequest, extractIpFromRequest } = require('../services/geolocationService');

const geo = getGeolocationFromRequest(req);
if (geo) {
  geo.country_code; // e.g. 'US'
  geo.region;       // e.g. 'North America'
  geo.country_name; // e.g. 'United States'
}

const ipAddress = extractIpFromRequest(req);
```

## Backend Integration

**`src/routes/auth.js`**
- `POST /auth/register`: captures geolocation on signup, stores region/country on both the user and organization records, logs `user.registered` to audit logs with geolocation in `details`.
- `POST /auth/login`: re-resolves and updates the user's region on every login (detects location changes); uses `COALESCE` so a failed geolocation lookup doesn't wipe existing data. Logs `user.login` with current location.

**`src/routes/platformAdmin.js`**
- `GET /api/v1/platform-admin/overview`: returns a `region_distribution` array (count per region, with country-code breakdown within each region).
- `GET /api/v1/platform-admin/organizations`: returns `region`/`country_code` per org; supports `?region=Europe` filtering and `?sort_by=region&sort_order=asc` sorting.

Security stack on these endpoints: `authenticate` + `requirePlatformOwner`,
`platformAdminLimiter` (120 req/min, keyed by user id or IP — see below),
whitelisted sort fields, sanitized/bounded input (page ≥ 1, limit ≤ 100).

## Frontend Integration

- `frontend/src/app/dashboard/platform/page.tsx` — "Regional Distribution" section: region name + country badge + org count; handles empty state.
- `frontend/src/app/dashboard/platform/organizations/page.tsx` — region column, region filter dropdown (dynamically populated), clear-filter button, country badges.

```typescript
const overview = await platformAdminAPI.getOverview();
overview.data.region_distribution;

const orgs = await platformAdminAPI.getOrganizations({ region: 'Europe', page: 1, limit: 50 });
```

## Audit Logging

Every region-relevant event (`user.registered`, `user.login`) is logged to
`audit_logs` with IP address, `region`/`country_code` in `details`, user
agent, and authentication method — supporting AU-2's location/source/event
detail requirements. See `AUDIT_LOGGING.md`.

## Testing

```bash
cd controlweave/backend
node scripts/test-geolocation.js
```

Covers: known-IP lookups, header-parsing (`X-Forwarded-For` etc.), IPv6-mapped
IPv4 handling, edge cases (localhost, invalid IPs, null values).

Manual checks:
- Register a new account → `SELECT region, country_code FROM users WHERE email = '...'` and confirm an `audit_logs` row with `event_type = 'user.registered'`.
- Log in from a different IP/VPN → confirm the user's region updates and a new audit log entry is created.
- Visit `/dashboard/platform` and `/dashboard/platform/organizations` → confirm the Regional Distribution section, region filter, and country badges render.

## Migration

```bash
cd controlweave/backend
npm run migrate:one 061_add_region_tracking.sql
# or, to run all pending migrations:
npm run migrate
```

No additional configuration is required — `geoip-lite` bundles its own IP
database. To refresh it: `npm update geoip-lite`.

## Privacy

- Only coarse-grained location (country/region) is captured — no precise coordinates.
- IP addresses are stored in audit logs per compliance requirement, not exposed elsewhere.
- Users cannot opt out, since this data underpins data-sovereignty/compliance obligations.

## Security Review: CodeQL Rate-Limiting Alerts (Resolved as False Positive)

A CodeQL scan flagged `js/missing-rate-limiting` on both
`platformAdmin.js` endpoints (`/overview`, `/organizations`). This is a
**false positive** — the router applies rate limiting to every route on it
via `router.use()`, which CodeQL's static analysis doesn't track:

```javascript
const platformAdminLimiter = createRateLimiter({
  label: 'platform-admin',
  windowMs: 60 * 1000,   // 1 minute
  max: 120,               // 120 requests
  keyGenerator: (req) => req.user?.id || req.ip || 'unknown',
});

router.use(authenticate);
router.use(requirePlatformOwner);
router.use(platformAdminLimiter);   // applies to all routes defined below

router.get('/overview', ...);
router.get('/organizations', ...);
```

To verify manually: inspect `router.stack` for middleware order, or issue
121 requests within 60 seconds and confirm the 121st is rejected.

**Full security posture verified for this feature:** rate limiting (present,
router-level), authentication (JWT), authorization (platform-admin role
check on every request), SQL injection prevention (parameterized queries
throughout, sortable-field whitelist), input validation (bounded
page/limit, sanitized region filter), no sensitive data in error responses,
audit logging on all registration/login events, and coarse-only location
data. No vulnerabilities were found; the CodeQL findings can be accepted
as-is without code changes. Dependency check at the time: `geoip-lite`,
`express`, `bcryptjs`, `jsonwebtoken`, `pg` all clean.

### Possible future hardening (optional, not implemented)
- IP allowlisting for platform-admin access (`PLATFORM_ADMIN_ALLOWED_IPS`).
- Require MFA/passkey for platform-admin accounts.
- Alert on unusual platform-admin access patterns.
- Encrypt region/country_code at rest if handling especially sensitive jurisdictions.

## Future Enhancements (not implemented)

- Region-based data residency enforcement.
- Surface a user's current region in their profile.
- Region-change notifications.
- Regional compliance-framework recommendations.
- Region-scoped data export for GDPR/CCPA requests.
- Multi-region deployment support.
