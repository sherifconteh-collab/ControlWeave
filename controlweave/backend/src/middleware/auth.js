const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { JWT_SECRET } = require('../config/security');
const {
  TIER_LEVELS,
  normalizeTier,
  tierLevel,
  canUseCmdb,
  getCmdbAssetLimit
} = require('../config/tierPolicy');
const { expireOrganizationTrialIfNeeded } = require('../services/subscriptionService');

const ROLE_FALLBACK_PERMISSIONS = {
  admin: ['*'],
  auditor: [
    'dashboard.read',
    'frameworks.read',
    'organizations.read',
    'users.read',
    'controls.read',
    'implementations.read',
    'evidence.read',
    'assets.read',
    'environments.read',
    'service_accounts.read',
    'audit.read',
    'reports.read',
    'assessments.read',
    'assessments.write',
    'notifications.read',
    'ai.use'
  ],
  user: [
    'dashboard.read',
    'frameworks.read',
    'organizations.read',
    'controls.read',
    'controls.write',
    'implementations.read',
    'implementations.write',
    'evidence.read',
    'evidence.write',
    'assets.read',
    'assets.write',
    'environments.read',
    'environments.write',
    'service_accounts.read',
    'service_accounts.write',
    'assessments.read',
    'assessments.write',
    'notifications.read',
    'notifications.write',
    'ai.use',
    'reports.read'
  ]
};

/**
 * Authenticate JWT token and attach user/org to request
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, JWT_SECRET);

      // Fetch user and organization details
      const userResult = await pool.query(`
        SELECT
          u.id, u.email, u.first_name, u.last_name, u.role, u.is_active,
          u.organization_id,
          o.name as organization_name, o.tier as organization_tier,
          o.billing_status as organization_billing_status,
          o.trial_status as organization_trial_status,
          o.trial_started_at as organization_trial_started_at,
          o.trial_ends_at as organization_trial_ends_at
        FROM users u
        JOIN organizations o ON u.organization_id = o.id
        WHERE u.id = $1 AND u.is_active = true
      `, [decoded.userId]);

      if (userResult.rows.length === 0) {
        return res.status(401).json({ success: false, error: 'User not found or inactive' });
      }

      req.user = userResult.rows[0];

      const trialExpired = await expireOrganizationTrialIfNeeded({
        organizationId: req.user.organization_id,
        actorUserId: req.user.id
      });
      if (trialExpired) {
        req.user.organization_tier = 'free';
        req.user.organization_billing_status = 'free';
        req.user.organization_trial_status = 'expired';
      }

      try {
        const roleNamesResult = await pool.query(`
          SELECT r.name
          FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = $1
        `, [req.user.id]);

        const permissionResult = await pool.query(`
          SELECT DISTINCT p.name
          FROM user_roles ur
          JOIN role_permissions rp ON rp.role_id = ur.role_id
          JOIN permissions p ON p.id = rp.permission_id
          WHERE ur.user_id = $1
        `, [req.user.id]);

        const fallbackPermissions = ROLE_FALLBACK_PERMISSIONS[req.user.role] || ROLE_FALLBACK_PERMISSIONS.user;
        const resolvedPermissions = new Set([
          ...permissionResult.rows.map((row) => row.name),
          ...fallbackPermissions
        ]);

        if (req.user.role === 'admin') {
          resolvedPermissions.add('*');
        }

        req.user.roles = roleNamesResult.rows.map((row) => row.name);
        req.user.permissions = Array.from(resolvedPermissions);
      } catch (authzError) {
        // Roles/permissions may not exist yet in bootstrap states.
        const fallbackPermissions = ROLE_FALLBACK_PERMISSIONS[req.user.role] || ROLE_FALLBACK_PERMISSIONS.user;
        req.user.roles = [req.user.role];
        req.user.permissions = req.user.role === 'admin'
          ? ['*']
          : fallbackPermissions;
      }

      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, error: 'Token expired' });
      }
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ success: false, error: 'Authentication failed' });
  }
};

/**
 * Require minimum tier level for access
 */
const requireTier = (minTier) => {
  return (req, res, next) => {
    const userTier = normalizeTier(req.user?.organization_tier);
    const userLevel = tierLevel(userTier);
    const requiredLevel = tierLevel(minTier);

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient tier level',
        message: `This feature requires ${minTier} tier or higher. Your current tier: ${userTier}`,
        currentTier: userTier,
        requiredTier: minTier,
        upgradeRequired: true
      });
    }

    next();
  };
};

/**
 * Check if feature is available for user's tier
 */
const checkTierLimit = async (req, res, next) => {
  try {
    const userTier = normalizeTier(req.user?.organization_tier);
    const orgId = req.user?.organization_id;

    // Free tier: No CMDB access at all
    if (!canUseCmdb(userTier)) {
      return res.status(403).json({
        success: false,
        error: 'Feature not available',
        message: 'CMDB features are not available on the free tier. Please upgrade to Starter or higher.',
        currentTier: 'free',
        upgradeRequired: true
      });
    }

    // Starter tier: 50 assets max, basic types only
    const maxAssets = getCmdbAssetLimit(userTier);
    if (maxAssets > 0) {
      const countResult = await pool.query(
        'SELECT COUNT(*) as count FROM assets WHERE organization_id = $1',
        [orgId]
      );

      const currentCount = parseInt(countResult.rows[0].count);

      // For POST requests, check if they're at the limit
      if (req.method === 'POST' && currentCount >= maxAssets) {
        return res.status(403).json({
          success: false,
          error: 'Asset limit reached',
          message: `${userTier.charAt(0).toUpperCase() + userTier.slice(1)} tier is limited to ${maxAssets} assets. Please upgrade for higher limits.`,
          currentTier: userTier,
          currentCount: currentCount,
          maxCount: maxAssets,
          upgradeRequired: true
        });
      }

      // Check if trying to create AI agent or service account (Professional+ only)
      if (req.method === 'POST' && req.body.category_id) {
        const categoryResult = await pool.query(
          'SELECT code, tier_required FROM asset_categories WHERE id = $1',
          [req.body.category_id]
        );

        if (categoryResult.rows.length > 0) {
          const category = categoryResult.rows[0];
          const requiredLevel = tierLevel(category.tier_required);
          const userLevel = tierLevel(userTier);

          if (userLevel < requiredLevel) {
            return res.status(403).json({
              success: false,
              error: 'Category not available',
              message: `${category.code} assets require ${category.tier_required} tier or higher.`,
              currentTier: userTier,
              requiredTier: category.tier_required,
              upgradeRequired: true
            });
          }
        }
      }
    }

    // Professional+ and Enterprise: Unlimited
    next();
  } catch (error) {
    console.error('Tier check error:', error);
    res.status(500).json({ success: false, error: 'Failed to check tier limits' });
  }
};

/**
 * Require admin role
 */
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }
  next();
};

function hasPermission(req, permissionName) {
  const permissions = req.user?.permissions || [];
  return permissions.includes('*') || permissions.includes(permissionName);
}

const requirePermission = (permissionName) => {
  return (req, res, next) => {
    if (!hasPermission(req, permissionName)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        requiredPermission: permissionName
      });
    }
    next();
  };
};

const requireAnyPermission = (permissionNames) => {
  return (req, res, next) => {
    const allowed = permissionNames.some((permissionName) => hasPermission(req, permissionName));
    if (!allowed) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        requiredAnyOf: permissionNames
      });
    }
    next();
  };
};

module.exports = {
  authenticate,
  requireTier,
  checkTierLimit,
  requireAdmin,
  requirePermission,
  requireAnyPermission,
  TIER_LEVELS
};
