require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const pool = require('./config/database');
const { attachRequestContext } = require('./middleware/requestContext');
const { createRateLimiter } = require('./middleware/rateLimit');
const { log, requestLogger, serializeError } = require('./utils/logger');
const { performanceTracker } = require('./middleware/performanceMonitoring');
const { startReminderScheduler } = require('./services/reminderService');
const { SECURITY_CONFIG } = require('./config/security');
const { validateEdition, getEditionInfo, attachEditionInfo } = require('./middleware/edition');
const { getRedisAdapterStatus } = require('./services/websocketService');
const checkRailwayConfig = require('../scripts/check-railway-config');

const app = express();
const PORT = process.env.PORT || 3001;
const corsOrigins = SECURITY_CONFIG.corsOrigins;
const allowAnyOrigin = corsOrigins.includes('*');

if (process.env.TRUST_PROXY !== undefined) {
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);
}

const loginRateLimiter = createRateLimiter({
  label: 'auth-login',
  windowMs: SECURITY_CONFIG.authRateLimitWindowMs,
  max: SECURITY_CONFIG.authRateLimitMax
});
const registerRateLimiter = createRateLimiter({
  label: 'auth-register',
  windowMs: SECURITY_CONFIG.authRateLimitWindowMs,
  max: Math.max(5, Math.floor(SECURITY_CONFIG.authRateLimitMax / 2))
});
const refreshRateLimiter = createRateLimiter({
  label: 'auth-refresh',
  windowMs: SECURITY_CONFIG.refreshRateLimitWindowMs,
  max: SECURITY_CONFIG.refreshRateLimitMax
});
const passwordRecoveryRateLimiter = createRateLimiter({
  label: 'auth-password-recovery',
  windowMs: SECURITY_CONFIG.authRateLimitWindowMs,
  max: Math.max(5, Math.floor(SECURITY_CONFIG.authRateLimitMax / 2))
});
const apiRateLimiter = createRateLimiter({
  label: 'api',
  windowMs: SECURITY_CONFIG.apiRateLimitWindowMs,
  max: SECURITY_CONFIG.apiRateLimitMax,
  skip: (req) => {
    const path = req.path || '';
    return path.startsWith('/auth/login')
      || path.startsWith('/auth/register')
      || path.startsWith('/auth/refresh')
      || path.startsWith('/webhooks')
      || path.startsWith('/external-ai');
  }
});

// Middleware
app.disable('x-powered-by');
app.use(compression());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowAnyOrigin || corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true
}));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'");
  if (SECURITY_CONFIG.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});
app.use(attachRequestContext);

// Stripe webhook needs raw body for signature verification
// Must be registered before express.json() middleware
app.use('/api/v1/billing/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(performanceTracker);
app.use(requestLogger);
app.use('/api/v1/auth/login', loginRateLimiter);
app.use('/api/v1/auth/register', registerRateLimiter);
app.use('/api/v1/auth/refresh', refreshRateLimiter);
app.use('/api/v1/auth/forgot-password', passwordRecoveryRateLimiter);
app.use('/api/v1/auth/reset-password', passwordRecoveryRateLimiter);
app.use('/api/v1', apiRateLimiter);

// Validate edition at startup
validateEdition();
checkRailwayConfig();

// Health check
app.get('/', (req, res) => {
  res.json({
    name: 'ControlWeave API',
    status: 'online',
    version: 'v1',
    health: '/health',
    apiBase: '/api/v1',
    requestId: req.requestId
  });
});

// Edition info endpoint (public)
app.get('/edition', attachEditionInfo, (req, res) => {
  res.json({
    success: true,
    ...req.edition
  });
});

app.get('/health', async (req, res) => {
  try {
    const start = process.hrtime.bigint();
    await pool.query('SELECT 1');
    const dbLatency = Number(process.hrtime.bigint() - start) / 1_000_000;
    
    const memory = process.memoryUsage();
    const redisStatus = getRedisAdapterStatus();
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        status: 'connected',
        latency: Number(dbLatency.toFixed(2)) + ' ms'
      },
      memory: {
        rss: Math.round(memory.rss / 1024 / 1024) + ' MB',
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + ' MB'
      },
      uptime: Math.floor(process.uptime()) + ' seconds',
      requestId: req.requestId,
      realtime: {
        websocket: {
          adapter: redisStatus.mode,
          redis: {
            status: redisStatus.status,
            required: redisStatus.required,
            configured: redisStatus.configured,
            ...(redisStatus.error ? { error: redisStatus.error } : {})
          }
        }
      }
    };

    if (redisStatus.required && redisStatus.status !== 'connected') {
      health.status = 'degraded';
    }
    
    // Add Railway environment info if available
    if (process.env.RAILWAY_ENVIRONMENT_NAME) {
      health.railway = {
        environment: process.env.RAILWAY_ENVIRONMENT_NAME,
        serviceId: process.env.RAILWAY_SERVICE_ID || null,
        deploymentId: process.env.RAILWAY_DEPLOYMENT_ID || null
      };
    }
    
    res.json(health);
  } catch (error) {
    const redisStatus = getRedisAdapterStatus();

    // Return 200 with degraded status so Railway health check treats the
    // container as alive even when the database is temporarily unavailable.
    res.json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      database: {
        status: 'disconnected',
        error: error.message
      },
      uptime: Math.floor(process.uptime()) + ' seconds',
      requestId: req.requestId,
      realtime: {
        websocket: {
          adapter: redisStatus.mode,
          redis: {
            status: redisStatus.status,
            required: redisStatus.required,
            configured: redisStatus.configured,
            ...(redisStatus.error ? { error: redisStatus.error } : {})
          }
        }
      }
    });
  }
});

// Import routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const frameworksRoutes = require('./routes/frameworks');
const organizationsRoutes = require('./routes/organizations');
const controlsRoutes = require('./routes/controls');
const implementationsRoutes = require('./routes/implementations');
const evidenceRoutes = require('./routes/evidence');
const auditRoutes = require('./routes/audit');
const auditFieldsRoutes = require('./routes/auditFields');
const rolesRoutes = require('./routes/roles');
const usersRoutes = require('./routes/users');
const cmdbRoutes = require('./routes/cmdb');
const assetsRoutes = require('./routes/assets');
const environmentsRoutes = require('./routes/environments');
const serviceAccountsRoutes = require('./routes/serviceAccounts');
const aiRoutes = require('./routes/ai');
const orgSettingsRoutes = require('./routes/orgSettings');
const assessmentsRoutes = require('./routes/assessments');
const reportsRoutes = require('./routes/reports');
const notificationsRoutes = require('./routes/notifications');
const splunkRoutes = require('./routes/splunk');
const vulnerabilitiesRoutes = require('./routes/vulnerabilities');
const sbomRoutes = require('./routes/sbom');
const dynamicConfigRoutes = require('./routes/dynamicConfig');
const poamRoutes = require('./routes/poam');
const exceptionsRoutes = require('./routes/exceptions');
const controlHealthRoutes = require('./routes/controlHealth');
const dashboardBuilderRoutes = require('./routes/dashboardBuilder');
const integrationsHubRoutes = require('./routes/integrationsHub');
const webhookRoutes = require('./routes/webhooks');
const dataGovernanceRoutes = require('./routes/dataGovernance');
const auditorWorkspaceRoutes = require('./routes/auditorWorkspace');
const opsRoutes = require('./routes/ops');
const passkeyRoutes = require('./routes/passkeys');
const ssoRoutes = require('./routes/sso');
const siemRoutes = require('./routes/siem');
const performanceRoutes = require('./routes/performance');
const externalAiRoutes = require('./routes/externalAi');
const externalAiKeysRoutes = require('./routes/externalAiKeys');
const platformAdminRoutes = require('./routes/platformAdmin');
const billingRoutes = require('./routes/billing');
const phase6Routes = require('./routes/phase6');
const threatIntelRoutes = require('./routes/threatIntel');
const vendorSecurityRoutes = require('./routes/vendorSecurity');
const regulatoryNewsRoutes = require('./routes/regulatoryNews');
const aiMonitoringRoutes = require('./routes/aiMonitoring');
const dataSovereigntyRoutes = require('./routes/dataSovereignty');
const policiesRoutes = require('./routes/policies');
const tprmRoutes = require('./routes/tprm');
const tprmPublicRoutes = require('./routes/tprmPublic');
const realtimeRoutes = require('./routes/realtime');
const publicContactRoutes = require('./routes/publicContact');
const aiGovernanceRoutes = require('./routes/aiGovernance');
const contactsRoutes = require('./routes/contacts');
const helpRoutes = require('./routes/help');
const ragRoutes = require('./routes/rag');
const rmfRoutes = require('./routes/rmf');
const stateAiLawsRoutes = require('./routes/stateAiLaws');
const internationalAiLawsRoutes = require('./routes/internationalAiLaws');

// Mount routes
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/auth/passkey', passkeyRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/sso', ssoRoutes);
app.use('/api/v1/siem', siemRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/frameworks', frameworksRoutes);
app.use('/api/v1/organizations', organizationsRoutes);
app.use('/api/v1/controls', controlsRoutes);
app.use('/api/v1/implementations', implementationsRoutes);
app.use('/api/v1/evidence', evidenceRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/audit', auditFieldsRoutes); // Dynamic fields management under same base path
app.use('/api/v1/roles', rolesRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/cmdb', cmdbRoutes);
app.use('/api/v1/assets', assetsRoutes);
app.use('/api/v1/environments', environmentsRoutes);
app.use('/api/v1/service-accounts', serviceAccountsRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/environments', environmentsRoutes);
app.use('/api/service-accounts', serviceAccountsRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/settings', orgSettingsRoutes);
app.use('/api/v1/assessments', assessmentsRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/integrations-hub', integrationsHubRoutes);
app.use('/api/v1/integrations', splunkRoutes);
app.use('/api/v1/vulnerabilities', vulnerabilitiesRoutes);
app.use('/api/v1/sbom', sbomRoutes);
app.use('/api/v1/config', dynamicConfigRoutes);
app.use('/api/v1/poam', poamRoutes);
app.use('/api/v1/exceptions', exceptionsRoutes);
app.use('/api/v1/control-health', controlHealthRoutes);
app.use('/api/v1/dashboard-builder', dashboardBuilderRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/data-governance', dataGovernanceRoutes);
app.use('/api/v1/auditor-workspace', auditorWorkspaceRoutes);
app.use('/api/v1/ops', opsRoutes);
app.use('/api/v1/performance', performanceRoutes);
app.use('/api/v1/external-ai', externalAiRoutes);
app.use('/api/v1/ai/external-keys', externalAiKeysRoutes);
app.use('/api/v1/platform-admin', platformAdminRoutes);
app.use('/api/v1/phase6', phase6Routes);
app.use('/api/v1/threat-intel', threatIntelRoutes);
app.use('/api/v1/vendor-security', vendorSecurityRoutes);
app.use('/api/v1/regulatory-news', regulatoryNewsRoutes);
app.use('/api/v1/ai/monitoring', aiMonitoringRoutes);
app.use('/api/v1/data-sovereignty', dataSovereigntyRoutes);
app.use('/api/v1/policies', policiesRoutes);
app.use('/api/v1/tprm', tprmRoutes);
app.use('/api/v1/tprm-public', tprmPublicRoutes);
app.use('/api/v1/realtime', realtimeRoutes);
app.use('/api/v1/public', publicContactRoutes);
app.use('/api/v1/ai-governance', aiGovernanceRoutes);
app.use('/api/v1/contacts', contactsRoutes);
app.use('/api/v1/help', helpRoutes);
app.use('/api/v1/rag', ragRoutes);
app.use('/api/v1/rmf', rmfRoutes);
app.use('/api/v1/state-ai-laws', stateAiLawsRoutes);
app.use('/api/v1/international-ai-laws', internationalAiLawsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  const correlationId = req.requestId;
  log('error', 'request.failed', {
    requestId: correlationId,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id || null,
    organizationId: req.user?.organization_id || null,
    error: serializeError(err)
  });

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    correlationId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found', correlationId: req.requestId });
});

// Auto-provision platform admin on startup if env vars are set
// Set PLATFORM_ADMIN_EMAIL (+ optionally PLATFORM_ADMIN_PASSWORD,
// PLATFORM_ADMIN_FIRST_NAME, PLATFORM_ADMIN_LAST_NAME, PLATFORM_ADMIN_ORG)
// in Railway Variables and the account is created/updated on every deploy.
function maskEmailForLog(value) {
  const email = String(value || '').trim().toLowerCase()
  if (!email.includes('@')) return '<redacted>'
  const [local, domain] = email.split('@')
  if (!local || !domain) return '<redacted>'
  const safeLocal = local.length <= 2
    ? `${local[0] || '*'}*`
    : `${local.slice(0, 2)}***`
  return `${safeLocal}@${domain}`
}

async function ensurePlatformAdmin() {
  const email = String(process.env.PLATFORM_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!email) return; // env var not set — skip silently

  const { randomBytes } = require('crypto');
  const bcrypt = require('bcryptjs');
  const firstName = String(process.env.PLATFORM_ADMIN_FIRST_NAME || 'Platform').trim();
  const lastName  = String(process.env.PLATFORM_ADMIN_LAST_NAME  || 'Admin').trim();
  const orgName   = String(process.env.PLATFORM_ADMIN_ORG        || 'ControlWeave Platform').trim();
  let   password  = String(process.env.PLATFORM_ADMIN_PASSWORD   || '').trim();
  const generated = !password;
  if (generated) password = `CW-${randomBytes(9).toString('base64url')}!1`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let orgId;
    const existingOrg = await client.query(
      'SELECT id FROM organizations WHERE name = $1 LIMIT 1', [orgName]
    );
    if (existingOrg.rows.length > 0) {
      orgId = existingOrg.rows[0].id;
    } else {
      const orgRes = await client.query(
        `INSERT INTO organizations (name, tier, billing_status)
         VALUES ($1, 'enterprise', 'active_paid') RETURNING id`,
        [orgName]
      );
      orgId = orgRes.rows[0].id;
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await client.query(
      `INSERT INTO users
         (organization_id, email, password_hash, first_name, last_name, role, is_active, is_platform_admin)
       VALUES ($1,$2,$3,$4,$5,'admin',true,true)
       ON CONFLICT (email) DO UPDATE SET
         organization_id=EXCLUDED.organization_id, password_hash=EXCLUDED.password_hash,
         first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name,
         role='admin', is_active=true, is_platform_admin=true
       RETURNING id, email, (xmax=0) AS inserted`,
      [orgId, email, hash, firstName, lastName]
    );
    const userId = result.rows[0].id;

    // Mark onboarding complete so platform admin goes straight to dashboard
    await client.query(
      `INSERT INTO organization_profiles
         (organization_id, onboarding_completed, onboarding_completed_at, created_by, updated_by)
       VALUES ($1, true, NOW(), $2, $2)
       ON CONFLICT (organization_id) DO UPDATE SET
         onboarding_completed     = true,
         onboarding_completed_at  = COALESCE(organization_profiles.onboarding_completed_at, NOW()),
         updated_by               = EXCLUDED.updated_by`,
      [orgId, userId]
    );

    await client.query('COMMIT');

    const mode = result.rows[0].inserted ? 'created' : 'updated';
    log('info', 'platform.admin.provisioned', {
      email: maskEmailForLog(email),
      status: mode,
      org: orgName
    });
    if (generated) {
      log('warn', 'platform.admin.generated_password', {
        email: maskEmailForLog(email),
        message: 'Generated temporary password for platform admin during startup. Set PLATFORM_ADMIN_PASSWORD in deployment variables to avoid this.'
      });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    log('error', 'platform.admin.provision_failed', {
      email: maskEmailForLog(email),
      error: err.message
    });
  } finally {
    client.release();
  }
}

// Start server
const stopReminders = startReminderScheduler();
const HOST = process.env.HOST || '0.0.0.0';
const server = app.listen(PORT, HOST, () => {
  log('info', 'server.started', {
    host: HOST,
    port: Number(PORT),
    health: `http://localhost:${PORT}/health`,
    environment: process.env.NODE_ENV || 'development'
  });

  // Initialize WebSocket server after HTTP server is ready
  const { initializeWebSocket } = require('./services/websocketService');
  initializeWebSocket(server);

  // Auto-provision platform admin if env vars are present
  ensurePlatformAdmin().catch((err) =>
    log('error', 'platform.admin.startup_error', { error: err.message })
  );
});

// Graceful shutdown
function shutdown(signal) {
  log('warn', 'server.shutdown.requested', { signal });
  stopReminders();
  server.close(() => {
    log('info', 'server.http.closed');
    pool.end(() => {
      log('info', 'server.db.closed');
      process.exit(0);
    });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
