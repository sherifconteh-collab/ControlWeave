const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createHash } = require('crypto');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { validateBody, requireFields, sanitizeInput } = require('../middleware/validate');
const { JWT_SECRET, SECURITY_CONFIG } = require('../config/security');
const {
  getTrialSeedData,
  expireOrganizationTrialIfNeeded
} = require('../services/subscriptionService');

const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';
const ALLOWED_INITIAL_ROLES = new Set(['admin', 'auditor', 'user']);
const MIN_PASSWORD_LENGTH = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_REGISTER_FRAMEWORK_CODES = 20;
const NIST_800_53_FRAMEWORK_CODE = 'nist_800_53';
const VALID_INFORMATION_TYPES = new Set([
  'pii',
  'phi',
  'pci',
  'cui',
  'fci',
  'financial',
  'operational',
  'ip',
  'public',
  'internal',
  'confidential',
  'restricted'
]);

function normalizeFrameworkCodes(rawValue) {
  if (!Array.isArray(rawValue)) return [];
  const normalized = rawValue
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter((entry) => entry.length > 0);
  return Array.from(new Set(normalized)).slice(0, MAX_REGISTER_FRAMEWORK_CODES);
}

function normalizeInformationTypes(rawValue) {
  if (!Array.isArray(rawValue)) return [];
  const normalized = Array.from(
    new Set(
      rawValue
        .map((entry) => String(entry || '').trim().toLowerCase())
        .filter((entry) => entry.length > 0)
    )
  );
  const invalid = normalized.filter((entry) => !VALID_INFORMATION_TYPES.has(entry));
  if (invalid.length > 0) {
    const error = new Error(`Unknown information_types values: ${invalid.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

async function assignUserRole(client, userId, userRoleName) {
  const roleLookup = await client.query(
    `SELECT id
     FROM roles
     WHERE name = $1
       AND is_system_role = true
     LIMIT 1`,
    [userRoleName]
  );

  if (roleLookup.rows.length === 0) {
    return;
  }

  await client.query(
    'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [userId, roleLookup.rows[0].id]
  );
}

function generateTokens(userId) {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_EXPIRY });
  const refreshToken = jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_EXPIRY });
  return { accessToken, refreshToken };
}

function hashRefreshToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

function isValidEmail(email) {
  return EMAIL_REGEX.test(String(email || '').trim());
}

function trimToLength(value, maxLength) {
  const normalized = String(value || '').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return normalized.slice(0, maxLength);
}

function deriveOrganizationName({ organizationName, fullName, email, role }) {
  const provided = trimToLength(organizationName, 255);
  if (provided.length > 0) {
    return provided;
  }

  const fullNameBase = String(fullName || '').trim();
  const emailLocalPart = String(email || '')
    .split('@')[0]
    .replace(/[^a-zA-Z0-9._-]+/g, ' ')
    .trim();
  const identity = fullNameBase || emailLocalPart || 'New';

  if (role === 'auditor') {
    return trimToLength(`${identity} Auditor Workspace`, 255);
  }

  return trimToLength(`${identity} Workspace`, 255);
}

async function getUserByEmail(email) {
  const result = await pool.query(
    `SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name, u.role, u.is_active,
            u.failed_login_attempts, u.locked_until,
            u.organization_id, o.name as organization_name, o.tier as organization_tier,
            o.billing_status as organization_billing_status,
            o.trial_status as organization_trial_status,
            o.trial_started_at as organization_trial_started_at,
            o.trial_ends_at as organization_trial_ends_at,
            COALESCE(op.onboarding_completed, false) as onboarding_completed
     FROM users u
     JOIN organizations o ON u.organization_id = o.id
     LEFT JOIN organization_profiles op ON op.organization_id = o.id
     WHERE u.email = $1`,
    [email]
  );

  return result.rows[0] || null;
}

async function getUserById(userId) {
  const result = await pool.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.is_active,
            u.organization_id, o.name as organization_name, o.tier as organization_tier,
            o.billing_status as organization_billing_status,
            o.trial_status as organization_trial_status,
            o.trial_started_at as organization_trial_started_at,
            o.trial_ends_at as organization_trial_ends_at,
            COALESCE(op.onboarding_completed, false) as onboarding_completed
     FROM users u
     JOIN organizations o ON u.organization_id = o.id
     LEFT JOIN organization_profiles op ON op.organization_id = o.id
     WHERE u.id = $1`,
    [userId]
  );

  return result.rows[0] || null;
}

async function resolveFrameworkIdsByCode(client, frameworkCodes) {
  if (!Array.isArray(frameworkCodes) || frameworkCodes.length === 0) {
    return [];
  }

  const result = await client.query(
    `SELECT id, code
     FROM frameworks
     WHERE is_active = true
       AND code = ANY($1::text[])`,
    [frameworkCodes]
  );

  const foundCodes = new Set(result.rows.map((row) => String(row.code || '').toLowerCase()));
  const missingCodes = frameworkCodes.filter((code) => !foundCodes.has(code));
  if (missingCodes.length > 0) {
    const error = new Error(`Unknown framework codes: ${missingCodes.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  return result.rows.map((row) => row.id);
}

// POST /auth/register
router.post('/register', validateBody((body) => requireFields(body, ['email', 'password', 'full_name'])), async (req, res) => {
  try {
    const {
      email,
      password,
      full_name,
      organization_name,
      initial_role,
      initialRole,
      framework_codes,
      frameworkCodes,
      information_types,
      informationTypes
    } = req.body;
    const selectedRole = String(initial_role || initialRole || 'admin').toLowerCase();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedFullName = String(full_name || '').trim();
    const selectedFrameworkCodes = normalizeFrameworkCodes(framework_codes || frameworkCodes);
    const selectedInformationTypes = normalizeInformationTypes(information_types || informationTypes);

    if (!ALLOWED_INITIAL_ROLES.has(selectedRole)) {
      return res.status(400).json({
        success: false,
        error: 'initial_role must be one of: admin, auditor, user'
      });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ success: false, error: 'Valid email is required' });
    }

    if (!normalizedFullName) {
      return res.status(400).json({ success: false, error: 'Full name is required' });
    }

    if (String(password || '').length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
      });
    }

    if (selectedFrameworkCodes.includes(NIST_800_53_FRAMEWORK_CODE) && selectedInformationTypes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'NIST 800-53 registration requires at least one information type selection'
      });
    }

    // Check existing user
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const nameParts = normalizedFullName.split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';
    const resolvedOrganizationName = deriveOrganizationName({
      organizationName: organization_name,
      fullName: normalizedFullName,
      email: normalizedEmail,
      role: selectedRole
    });

    const trialSeed = getTrialSeedData();

    // Create org + user in transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orgResult = await client.query(
        `INSERT INTO organizations (
           name, tier, billing_status, trial_source_tier,
           trial_started_at, trial_ends_at, trial_status, paid_tier
         )
         VALUES (
           $1, $2, $3, $4,
           NOW(), NOW() + ($5::text || ' days')::interval, $6, NULL
         )
         RETURNING
           id, name, tier, billing_status, trial_status, trial_started_at, trial_ends_at`,
        [
          resolvedOrganizationName,
          trialSeed.tier,
          trialSeed.billingStatus,
          trialSeed.trialSourceTier,
          trialSeed.trialDays,
          trialSeed.trialStatus
        ]
      );
      const org = orgResult.rows[0];

      const userResult = await client.query(
        `INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, first_name, last_name, role`,
        [org.id, normalizedEmail, passwordHash, firstName, lastName, selectedRole]
      );
      const user = userResult.rows[0];

      if (selectedFrameworkCodes.length > 0) {
        const frameworkIds = await resolveFrameworkIdsByCode(client, selectedFrameworkCodes);
        for (const frameworkId of frameworkIds) {
          await client.query(
            `INSERT INTO organization_frameworks (organization_id, framework_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [org.id, frameworkId]
          );
        }
      }

      const onboardingCompletedOnRegister = selectedRole !== 'admin';
      await client.query(
        `INSERT INTO organization_profiles (
           organization_id,
           data_sensitivity_types,
           onboarding_completed,
           onboarding_completed_at,
           created_by,
           updated_by,
           created_at,
           updated_at
         )
         VALUES (
           $1,
           $2::text[],
           $3,
           CASE WHEN $3 THEN NOW() ELSE NULL END,
           $4,
           $4,
           NOW(),
           NOW()
         )
         ON CONFLICT (organization_id) DO UPDATE SET
           data_sensitivity_types = CASE
             WHEN COALESCE(array_length(EXCLUDED.data_sensitivity_types, 1), 0) > 0
               THEN EXCLUDED.data_sensitivity_types
             ELSE organization_profiles.data_sensitivity_types
           END,
           onboarding_completed = organization_profiles.onboarding_completed OR EXCLUDED.onboarding_completed,
           onboarding_completed_at = CASE
             WHEN organization_profiles.onboarding_completed_at IS NOT NULL THEN organization_profiles.onboarding_completed_at
             WHEN organization_profiles.onboarding_completed OR EXCLUDED.onboarding_completed THEN NOW()
             ELSE NULL
           END,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()`,
        [org.id, selectedInformationTypes, onboardingCompletedOnRegister, user.id]
      );

      await assignUserRole(client, user.id, selectedRole).catch(() => {});

      const { accessToken, refreshToken } = generateTokens(user.id);

      // Store session
      await client.query(
        'INSERT INTO sessions (user_id, refresh_token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
        [user.id, hashRefreshToken(refreshToken)]
      );

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            full_name: `${user.first_name} ${user.last_name}`.trim(),
            role: user.role,
            organization_id: org.id
          },
          organization: {
            id: org.id,
            name: org.name,
            tier: org.tier,
            billing_status: org.billing_status,
            trial_status: org.trial_status,
            trial_started_at: org.trial_started_at,
            trial_ends_at: org.trial_ends_at,
            onboarding_completed: selectedRole !== 'admin',
            framework_codes: selectedFrameworkCodes,
            information_types: selectedInformationTypes
          },
          tokens: { accessToken, refreshToken }
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Register error:', error);
    const statusCode = Number(error.statusCode) || 500;
    const message = statusCode === 500 ? 'Registration failed' : String(error.message || 'Registration failed');
    res.status(statusCode).json({ success: false, error: message });
  }
});

// POST /auth/login
router.post('/login', validateBody((body) => requireFields(body, ['email', 'password'])), async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    let user = await getUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(401).json({ success: false, error: 'Account is disabled' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const trialExpired = await expireOrganizationTrialIfNeeded({
      organizationId: user.organization_id,
      actorUserId: user.id
    });
    if (trialExpired) {
      const refreshedUser = await getUserByEmail(normalizedEmail);
      if (refreshedUser) {
        user = refreshedUser;
      }
    }

    const { accessToken, refreshToken } = generateTokens(user.id);

    await pool.query(
      'INSERT INTO sessions (user_id, refresh_token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'7 days\')',
      [user.id, hashRefreshToken(refreshToken)]
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          full_name: `${user.first_name} ${user.last_name}`.trim(),
          role: user.role,
          organization_id: user.organization_id
        },
        organization: {
          id: user.organization_id,
          name: user.organization_name,
          tier: user.organization_tier,
          billing_status: user.organization_billing_status,
          trial_status: user.organization_trial_status,
          trial_started_at: user.organization_trial_started_at,
          trial_ends_at: user.organization_trial_ends_at,
          onboarding_completed: Boolean(user.onboarding_completed)
        },
        tokens: { accessToken, refreshToken }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// POST /auth/refresh
router.post('/refresh', validateBody((body) => requireFields(body, ['refreshToken'])), async (req, res) => {
  try {
    const { refreshToken } = req.body;

    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ success: false, error: 'Invalid token type' });
    }

    const refreshTokenHash = hashRefreshToken(refreshToken);

    const session = await pool.query(
      `SELECT id, refresh_token
       FROM sessions
       WHERE user_id = $1
         AND expires_at > NOW()
         AND (refresh_token = $2 OR refresh_token = $3)`,
      [decoded.userId, refreshTokenHash, refreshToken]
    );

    if (session.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid or expired session' });
    }

    // Backward compatibility for older plaintext refresh tokens.
    if (session.rows[0].refresh_token !== refreshTokenHash) {
      await pool.query(
        'UPDATE sessions SET refresh_token = $1 WHERE id = $2',
        [refreshTokenHash, session.rows[0].id]
      );
    }

    const accessToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, { expiresIn: ACCESS_EXPIRY });

    res.json({ success: true, data: { accessToken } });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(401).json({ success: false, error: 'Token refresh failed' });
  }
});

// POST /auth/logout
router.post('/logout', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [req.user.id]);
    res.json({ success: true, message: 'Logged out' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, error: 'Logout failed' });
  }
});

// GET /auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    await expireOrganizationTrialIfNeeded({
      organizationId: req.user.organization_id,
      actorUserId: req.user.id
    });

    const user = await getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Values were hydrated by authenticate middleware (with fallback).
    const roles = req.user.roles || [user.role];
    const permissions = req.user.permissions || (user.role === 'admin' ? ['*'] : []);

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        full_name: `${user.first_name} ${user.last_name}`.trim(),
        role: user.role,
        organization: {
          id: user.organization_id,
          name: user.organization_name,
          tier: user.organization_tier,
          billing_status: user.organization_billing_status,
          trial_status: user.organization_trial_status,
          trial_started_at: user.organization_trial_started_at,
          trial_ends_at: user.organization_trial_ends_at,
          onboarding_completed: Boolean(user.onboarding_completed)
        },
        onboarding_required: !Boolean(user.onboarding_completed),
        roles,
        permissions
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
});

module.exports = router;
