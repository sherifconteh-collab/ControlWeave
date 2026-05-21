# Region Tracking Implementation

## Overview

This implementation adds region tracking for data sovereignty planning to the ControlWeave platform. It captures geographic location data from user IP addresses during registration and login to support compliance with data residency requirements.

## Features

### 1. Database Schema
- **Migration 061**: Adds `region` and `country_code` fields to:
  - `users` table: Track individual user locations
  - `organizations` table: Track organization primary locations
- Indexes added for efficient region-based queries

### 2. Geolocation Service
Located at: `controlweave/backend/src/services/geolocationService.js`

**Features:**
- Offline IP geolocation using `geoip-lite` (no external API calls)
- Support for IPv4 and IPv6 addresses
- Automatic IPv6-mapped IPv4 address cleanup
- Proxy-aware IP extraction from:
  - `X-Forwarded-For` header (load balancers)
  - `X-Real-IP` header (alternative proxy)
  - `CF-Connecting-IP` header (Cloudflare)
  - Direct connection IP addresses

**Region Mapping:**
- North America (US, CA, MX)
- Europe (GB, DE, FR, IT, ES, etc.)
- Asia Pacific (CN, JP, IN, SG, AU, etc.)
- Middle East (AE, SA, IL, etc.)
- Latin America (BR, AR, CL, etc.)
- Africa (ZA, NG, KE, etc.)

### 3. Backend Integration

#### Authentication Endpoints (`src/routes/auth.js`)
- **Registration (`POST /auth/register`)**:
  - Captures IP geolocation on signup
  - Stores region/country in both user and organization records
  - Logs event to audit logs with geolocation data

- **Login (`POST /auth/login`)**:
  - Updates user region on each login (detects location changes)
  - Uses `COALESCE` to preserve existing data if geolocation fails
  - Logs login event with current location

#### Platform Admin API (`src/routes/platformAdmin.js`)
- **Overview Endpoint (`GET /api/v1/platform-admin/overview`)**:
  - Returns `region_distribution` array with count per region
  - Includes country code breakdown within regions
  
- **Organizations Endpoint (`GET /api/v1/platform-admin/organizations`)**:
  - Returns region and country_code fields for each organization
  - Supports filtering by region (`?region=Europe`)
  - Supports sorting by region (`?sort_by=region&sort_order=asc`)

**Security:**
- All endpoints protected by `authenticate` and `requirePlatformOwner` middleware
- Rate limited: 120 requests/minute for platform admin operations
- Input validation on region filter parameters
- SQL injection prevention via parameterized queries

### 4. Frontend Integration

#### Platform Admin Overview (`frontend/src/app/dashboard/platform/page.tsx`)
- Displays "Regional Distribution" section
- Shows region name with country code badge
- Counts organizations per region
- Handles empty state gracefully

#### Platform Admin Organizations (`frontend/src/app/dashboard/platform/organizations/page.tsx`)
- Region column added to organizations table
- Region filter dropdown (dynamically populated)
- Clear filter button for easy reset
- Country code badges for visual distinction

### 5. Audit Logging
All region-related events are logged to `audit_logs` table with:
- Event type: `user.registered` or `user.login`
- IP address (for compliance tracking)
- Region and country_code in details JSON
- User agent string
- Authentication method

This supports AU-2 compliance requirements for:
- Location tracking (where events occurred)
- Source identification (IP address)
- Complete event details (region/country)

## Usage

### Backend

```javascript
const { getGeolocationFromRequest, extractIpFromRequest } = require('../services/geolocationService');

// In route handler
const geo = getGeolocationFromRequest(req);
if (geo) {
  console.log(geo.country_code); // e.g., 'US'
  console.log(geo.region);       // e.g., 'North America'
  console.log(geo.country_name); // e.g., 'United States'
}

// Extract IP only
const ipAddress = extractIpFromRequest(req);
```

### Frontend

```typescript
// Get overview with region distribution
const overview = await platformAdminAPI.getOverview();
console.log(overview.data.region_distribution);

// Filter organizations by region
const orgs = await platformAdminAPI.getOrganizations({ 
  region: 'Europe',
  page: 1,
  limit: 50
});
```

## Testing

### Unit Tests
Run geolocation service tests:
```bash
cd controlweave/backend
node scripts/test-geolocation.js
```

Tests cover:
- IP geolocation lookup for known addresses
- Request header parsing (X-Forwarded-For, X-Real-IP, etc.)
- IPv6-mapped IPv4 address handling
- Edge cases (localhost, invalid IPs, null values)

### Manual Testing
1. **Registration Flow**:
   - Sign up with a new account
   - Check database: `SELECT region, country_code FROM users WHERE email = 'test@example.com'`
   - Verify audit log: `SELECT * FROM audit_logs WHERE event_type = 'user.registered' ORDER BY created_at DESC LIMIT 1`

2. **Login Flow**:
   - Log in from different IPs (or use VPN)
   - Verify user region updates
   - Check audit logs for location tracking

3. **Platform Admin**:
   - Navigate to `/dashboard/platform`
   - Verify "Regional Distribution" section appears
   - Navigate to `/dashboard/platform/organizations`
   - Test region filter dropdown
   - Verify country code badges display correctly

## Database Migration

To apply the migration:
```bash
cd controlweave/backend
npm run migrate:one 061_add_region_tracking.sql
```

Or run all pending migrations:
```bash
npm run migrate
```

## Configuration

No additional configuration required. The `geoip-lite` package includes its own IP database.

To update the geolocation database (optional):
```bash
cd controlweave/backend
npm update geoip-lite
```

## Privacy Considerations

- Only captures coarse-grained location (country/region)
- Does not store precise coordinates
- IP addresses stored in audit logs per compliance requirements
- Region data helps with data sovereignty planning
- Users cannot opt-out as this is required for compliance

## Future Enhancements

Potential improvements:
- Add region-based data residency enforcement
- Display user's current region in profile
- Add region change notifications
- Regional compliance framework recommendations
- Data export by region for GDPR/CCPA requests
- Multi-region deployment support

## Dependencies

- `geoip-lite` (^1.4.10): Offline IP geolocation library
  - No external API calls required
  - Database included in package
  - Regular updates via npm

## Security Notes

### CodeQL Findings
The CodeQL scan reported rate limiting concerns for platform admin endpoints. This is a **false positive**:
- All routes protected by `platformAdminLimiter` middleware (line 26 in platformAdmin.js)
- Rate limit: 120 requests/minute per user
- Applied to entire router, not individual routes
- CodeQL doesn't recognize router-level middleware application

### Actual Security Measures
- ✅ Rate limiting in place
- ✅ Authentication required (JWT)
- ✅ Platform admin role verification
- ✅ SQL injection prevention (parameterized queries)
- ✅ Input validation on all parameters
- ✅ Audit logging for compliance

## Support

For issues or questions:
1. Check the test suite: `scripts/test-geolocation.js`
2. Review geolocation service: `src/services/geolocationService.js`
3. Verify middleware order in `src/routes/platformAdmin.js`
4. Check audit logs for captured data
