-- Migration 119: Seed ai.read / ai.write / organizations.write
--
-- Same bug class already fixed once this batch (migration 117,
-- compliance.read/compliance.manage): routes/aiMonitoring.js and
-- routes/aiGovernance.js gate on requirePermission('ai.read'/'ai.write'),
-- and routes/organizations/*.js (+ tprm.js, dataSovereignty.js,
-- vendorSecurity.js, threatIntel.js) gate writes on
-- requirePermission('organizations.write') — neither permission was ever
-- seeded into the permissions table, so hasPermission() could never match
-- them and every non-admin user got a 403 regardless of role. Seed both
-- and grant them to the system roles that already do comparable read/write
-- work elsewhere in ROLE_FALLBACK_PERMISSIONS:
--   - ai.read: admin, user, auditor (mirrors controls.read's read-everywhere grant)
--   - ai.write: admin, user (mirrors controls.write — auditor stays read-only)
--   - organizations.write: admin only (org profile/systems/contracts/child-org
--     configuration is an org-admin action, not a general user action)
-- Ships in the feature-audit-fixes batch.

INSERT INTO permissions (name, resource, action, description)
VALUES
  ('ai.read', 'ai', 'read', 'View AI vendor inventory, incidents, supply-chain records, and monitoring dashboards'),
  ('ai.write', 'ai', 'write', 'Manage AI vendor records, incidents, supply-chain records, and monitoring rules'),
  ('organizations.write', 'organizations', 'write', 'Manage organization profile, systems, contracts, and child-organization configuration')
ON CONFLICT (name) DO NOTHING;

WITH ai_read_roles AS (
  SELECT id FROM roles WHERE is_system_role = true AND name IN ('admin', 'user', 'auditor')
), ai_read_perm AS (
  SELECT id FROM permissions WHERE name = 'ai.read'
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT ai_read_roles.id, ai_read_perm.id
FROM ai_read_roles, ai_read_perm
ON CONFLICT DO NOTHING;

WITH ai_write_roles AS (
  SELECT id FROM roles WHERE is_system_role = true AND name IN ('admin', 'user')
), ai_write_perm AS (
  SELECT id FROM permissions WHERE name = 'ai.write'
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT ai_write_roles.id, ai_write_perm.id
FROM ai_write_roles, ai_write_perm
ON CONFLICT DO NOTHING;

WITH org_write_roles AS (
  SELECT id FROM roles WHERE is_system_role = true AND name = 'admin'
), org_write_perm AS (
  SELECT id FROM permissions WHERE name = 'organizations.write'
)
INSERT INTO role_permissions (role_id, permission_id)
SELECT org_write_roles.id, org_write_perm.id
FROM org_write_roles, org_write_perm
ON CONFLICT DO NOTHING;

SELECT 'Migration 119 completed.' AS result;
