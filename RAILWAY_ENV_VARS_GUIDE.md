# Railway Deployment - Environment Variables Guide

## Overview

This guide documents all required and optional environment variables for deploying ControlWeave-Pro on Railway with Docker containers.

## Service Architecture

Railway should have **three services**:
1. **PostgreSQL Database** - Managed Railway PostgreSQL
2. **Backend Service** - `controlweave/backend` with Dockerfile
3. **Frontend Service** - `controlweave/frontend` with Dockerfile

## Railway Service Configuration

### Backend Service Settings
- **Root Directory**: `controlweave/backend`
- **Builder**: Dockerfile (auto-detected from `controlweave/backend/Dockerfile`)
- **Health Check Path**: `/health`
- **Health Check Timeout**: 100 seconds
- **Restart Policy**: On Failure (max 3 retries)

### Frontend Service Settings
- **Root Directory**: `controlweave/frontend`
- **Builder**: Dockerfile (auto-detected from `controlweave/frontend/Dockerfile`)
- **Health Check Path**: `/health`
- **Health Check Timeout**: 100 seconds
- **Restart Policy**: On Failure (max 3 retries)

## Backend Environment Variables

### Required Variables

```bash
# Database Connection (provided by Railway PostgreSQL service)
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require

# Security - JWT Configuration
JWT_SECRET=<generate-a-long-random-string-at-least-32-characters>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Application Settings
NODE_ENV=production
PORT=3001  # Railway will override this with its own PORT

# CORS Configuration (use your frontend Railway URL)
CORS_ORIGINS=https://your-frontend-app.up.railway.app
# OR for multiple origins:
# CORS_ORIGINS=https://your-frontend-app.up.railway.app,https://your-custom-domain.com

# Frontend URL (for emails, redirects, etc.)
FRONTEND_URL=https://your-frontend-app.up.railway.app

# Demo account credential delivery (required if using public contact/demo account emails)
DEMO_ACCOUNT_PASSWORD=<strong-demo-password>
```

> If `DEMO_ACCOUNT_PASSWORD` is not set, the public contact flow still works, but credential delivery emails are skipped and onboarding is marked as required.

### Optional Variables

```bash
# Host binding (defaults to 0.0.0.0 if not set)
HOST=0.0.0.0

# Trust proxy (Railway uses proxies)
TRUST_PROXY=true

# Background Scheduler
REMINDER_INTERVAL_MINUTES=60  # Default: 60 minutes
DISABLE_REMINDER_SCHEDULER=false  # Set to true to disable

# Redis for WebSocket scaling (optional)
REDIS_URL=redis://user:password@host:port

# Email Service (for password reset, notifications)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<your-sendgrid-api-key>
SMTP_FROM=noreply@yourdomain.com

# AI/LLM API Keys (optional - users can add their own via UI)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
XAI_API_KEY=...
GROQ_API_KEY=...

# Stripe Billing (optional)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PROFESSIONAL_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...

# Security Headers
HSTS_MAX_AGE=31536000
CSP_DIRECTIVES=default-src 'self'

# Logging
LOG_LEVEL=info  # debug, info, warn, error
```

## Frontend Environment Variables

### Required Variables

```bash
# API Connection (use your backend Railway URL)
NEXT_PUBLIC_API_URL=https://your-backend-app.up.railway.app/api/v1

# Application Info
NEXT_PUBLIC_APP_NAME=ControlWeave

# Node Environment
NODE_ENV=production
PORT=3000  # Railway will override this with its own PORT
```

### Optional Variables

```bash
# Analytics (optional)
NEXT_PUBLIC_ANALYTICS_ID=UA-XXXXXXXX-X

# Feature Flags (optional)
NEXT_PUBLIC_ENABLE_SSO=true
NEXT_PUBLIC_ENABLE_PASSKEY=true
```

## PostgreSQL Database Configuration

Railway PostgreSQL service automatically provides:
- `DATABASE_URL` - Connection string
- `PGHOST` - Database host
- `PGPORT` - Database port (default: 5432)
- `PGUSER` - Database user
- `PGPASSWORD` - Database password
- `PGDATABASE` - Database name

**Note**: Use the `DATABASE_URL` in your backend service. Railway will automatically inject this when you link the database to your backend service.

## How to Set Environment Variables in Railway

### Method 1: Railway UI
1. Go to your Railway project
2. Select the service (backend or frontend)
3. Click on "Variables" tab
4. Click "New Variable"
5. Add variable name and value
6. Click "Add"
7. Service will automatically redeploy with new variables

### Method 2: Railway CLI
```bash
# Set a variable
railway variables set KEY=value

# Set multiple variables from a file
railway variables set --file .env.production
```

### Method 3: Link Services
For `DATABASE_URL`, use Railway's service linking:
1. Go to backend service
2. Click "Settings" → "Service Variables"
3. Click "Reference Variable"
4. Select PostgreSQL service
5. Select `DATABASE_URL`

## Security Best Practices

### JWT_SECRET Generation
```bash
# Generate a secure random secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### CORS_ORIGINS
- **Development**: Use `http://localhost:3000` or `*` (wildcard)
- **Production**: Use specific Railway URLs or custom domains
- **Multiple origins**: Comma-separated list

### Database SSL
Railway PostgreSQL requires SSL. Ensure `?sslmode=require` is in `DATABASE_URL`:
```
postgresql://user:pass@host:port/db?sslmode=require
```

## Verification Steps

After deployment, verify your services are running correctly:

### 1. Check Backend Health
```bash
curl https://your-backend-app.up.railway.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-18T...",
  "database": {
    "status": "connected",
    "latency": "X ms"
  },
  "memory": {
    "rss": "XXX MB",
    "heapUsed": "XXX MB"
  },
  "uptime": "XXX seconds",
  "railway": {
    "environment": "production",
    "serviceId": "...",
    "deploymentId": "..."
  }
}
```

### 2. Check Frontend Health
```bash
curl https://your-frontend-app.up.railway.app/health
```

Expected response:
```json
{
  "status": "ok"
}
```

### 3. Check Backend Logs
Look for these messages in Railway logs:
```
{"level":"info","message":"server.started","host":"0.0.0.0","port":XXXX}
{"level":"info","message":"reminders.scheduler.started","intervalMinutes":60}
{"level":"info","message":"websocket.initialized"}
```

### 4. Test Frontend-Backend Connection
1. Open your frontend URL in a browser
2. Try to access the login page
3. Check browser console for API errors
4. Verify CORS is working (no CORS errors)

## Troubleshooting

### Issue: Health Check Fails
**Symptoms**: Service builds successfully but health check times out

**Solutions**:
1. Verify `HOST=0.0.0.0` is set (or defaults to 0.0.0.0 in code)
2. Check `PORT` environment variable (Railway sets this automatically)
3. Verify `/health` endpoint exists and is accessible
4. Check logs for startup errors

### Issue: Database Connection Fails
**Symptoms**: Backend starts but can't connect to database

**Solutions**:
1. Verify `DATABASE_URL` is set correctly
2. Check database service is running
3. Ensure `?sslmode=require` is in connection string
4. Link database service to backend service in Railway

### Issue: CORS Errors in Frontend
**Symptoms**: API calls fail with CORS errors in browser console

**Solutions**:
1. Verify `CORS_ORIGINS` includes your frontend URL
2. Update to match actual Railway domain
3. For multiple domains, use comma-separated list
4. Ensure protocol (https://) matches

### Issue: JWT Errors
**Symptoms**: Login fails, token invalid errors

**Solutions**:
1. Verify `JWT_SECRET` is set and matches across restarts
2. Ensure secret is at least 32 characters
3. Check `JWT_ACCESS_EXPIRY` and `JWT_REFRESH_EXPIRY` are valid

## Environment-Specific Configurations

### Development
```bash
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000
FRONTEND_URL=http://localhost:3000
```

### Staging
```bash
NODE_ENV=production
CORS_ORIGINS=https://staging-frontend.up.railway.app
FRONTEND_URL=https://staging-frontend.up.railway.app
```

### Production
```bash
NODE_ENV=production
CORS_ORIGINS=https://app.yourdomain.com
FRONTEND_URL=https://app.yourdomain.com
```

## Custom Domains

If using custom domains on Railway:

1. Add custom domain in Railway dashboard
2. Update environment variables:
   ```bash
   CORS_ORIGINS=https://app.yourdomain.com
   FRONTEND_URL=https://app.yourdomain.com
   NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
   ```
3. Update DNS records as instructed by Railway
4. Wait for SSL certificate provisioning

## Database Migrations

After initial deployment, run migrations:

```bash
# Using Railway CLI
railway run npm run migrate

# Or execute via Railway console
cd controlweave/backend && npm run migrate
```

Then seed initial data:
```bash
railway run node scripts/seed-frameworks.js
railway run node scripts/seed-missing-controls.js
railway run node scripts/seed-cmdb-data.js
```

## Monitoring

### Key Metrics to Monitor
- **Backend CPU/Memory**: Should stay below 80%
- **Database Connections**: Monitor pool usage
- **Response Times**: Health check latency
- **Error Rates**: Check logs for errors

### Railway Observability
1. Go to project → "Observability"
2. Monitor CPU, Memory, Network
3. Set up alerts for failures
4. Review logs regularly

## Cost Optimization

### Minimize Costs
1. **Use Shared Postgres**: Pro tier for dev/staging
2. **Right-size Resources**: Start small, scale up as needed
3. **Monitor Usage**: Review Railway usage dashboard
4. **Clean Up**: Remove unused services

### Recommended Tiers
- **Development**: Hobby plan ($5/month)
- **Production**: Pro plan ($20/month + usage)

## Support & Resources

- **Railway Documentation**: https://docs.railway.com
- **ControlWeave Docs**: See `RAILWAY_DEPLOYMENT_GUIDE.md`
- **Issue Tracker**: GitHub Issues
- **Community**: Railway Discord

## Checklist for New Deployment

- [ ] Create three Railway services (PostgreSQL, Backend, Frontend)
- [ ] Set root directories for backend and frontend
- [ ] Configure DATABASE_URL from PostgreSQL service
- [ ] Set JWT_SECRET (generate secure random string)
- [ ] Configure CORS_ORIGINS with frontend URL
- [ ] Set NEXT_PUBLIC_API_URL with backend URL
- [ ] Deploy services and verify health checks pass
- [ ] Run database migrations
- [ ] Seed framework and control data
- [ ] Create first admin user
- [ ] Test login and basic functionality
- [ ] Configure custom domains (optional)
- [ ] Set up monitoring and alerts
- [ ] Document any custom configuration

---

**Last Updated**: 2026-02-18  
**Application**: ControlWeave-Pro  
**Platform**: Railway  
**Build Method**: Docker (multi-stage builds)
