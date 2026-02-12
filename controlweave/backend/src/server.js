require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const pool = require('./config/database');
const { attachRequestContext } = require('./middleware/requestContext');
const { createRateLimiter } = require('./middleware/rateLimit');
const { log, requestLogger, serializeError } = require('./utils/logger');
const { startReminderScheduler } = require('./services/reminderService');
const { SECURITY_CONFIG } = require('./config/security');

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
const apiRateLimiter = createRateLimiter({
  label: 'api',
  windowMs: SECURITY_CONFIG.apiRateLimitWindowMs,
  max: SECURITY_CONFIG.apiRateLimitMax,
  skip: (req) => {
    const path = req.path || '';
    return path.startsWith('/auth/login')
      || path.startsWith('/auth/register')
      || path.startsWith('/auth/refresh')
      || path.startsWith('/webhooks');
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
  allowedHeaders: ['Content-Type', 'Authorization'],
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
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(requestLogger);
app.use('/api/v1/auth/login', loginRateLimiter);
app.use('/api/v1/auth/register', registerRateLimiter);
app.use('/api/v1/auth/refresh', refreshRateLimiter);
app.use('/api/v1', apiRateLimiter);

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

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', database: 'connected', requestId: req.requestId });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', database: 'disconnected', error: error.message, requestId: req.requestId });
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

// Mount routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/auth/passkey', passkeyRoutes);
app.use('/api/v1/sso', ssoRoutes);
app.use('/api/v1/siem', siemRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/frameworks', frameworksRoutes);
app.use('/api/v1/organizations', organizationsRoutes);
app.use('/api/v1/controls', controlsRoutes);
app.use('/api/v1/implementations', implementationsRoutes);
app.use('/api/v1/evidence', evidenceRoutes);
app.use('/api/v1/audit', auditRoutes);
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
app.use('/api/v1/integrations', splunkRoutes);
app.use('/api/v1/vulnerabilities', vulnerabilitiesRoutes);
app.use('/api/v1/sbom', sbomRoutes);
app.use('/api/v1/config', dynamicConfigRoutes);
app.use('/api/v1/poam', poamRoutes);
app.use('/api/v1/exceptions', exceptionsRoutes);
app.use('/api/v1/control-health', controlHealthRoutes);
app.use('/api/v1/dashboard-builder', dashboardBuilderRoutes);
app.use('/api/v1/integrations-hub', integrationsHubRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/data-governance', dataGovernanceRoutes);
app.use('/api/v1/auditor-workspace', auditorWorkspaceRoutes);
app.use('/api/v1/ops', opsRoutes);

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

// Start server
const stopReminders = startReminderScheduler();
const server = app.listen(PORT, () => {
  log('info', 'server.started', {
    port: Number(PORT),
    health: `http://localhost:${PORT}/health`,
    environment: process.env.NODE_ENV || 'development'
  });
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
