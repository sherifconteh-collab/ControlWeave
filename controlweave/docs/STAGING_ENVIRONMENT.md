# Staging Environment Setup Guide

Testing in production is a common and dangerous mistake. This guide explains how to run a separate **staging environment** on Railway (or any cloud provider) so every change is verified before it reaches real users.

## Why You Need Staging

| Risk | Without Staging | With Staging |
|------|----------------|--------------|
| Database migrations | Applied directly to production data | Tested against a staging DB first |
| Environment variable changes | Could break auth or integrations | Validated in isolation |
| New features | Real users hit untested code paths | QA happens in a sandbox |
| Dependency updates | Potential runtime breakage in prod | Caught before promotion |

---

## Railway Setup (Recommended)

Railway supports multiple environments per project out of the box.

### Step 1 — Create a Staging Environment in Railway

1. Open your Railway project dashboard.
2. Click **Environments** → **New Environment**.
3. Name it `staging`.
4. Railway automatically clones your production service's settings as a starting point.

### Step 2 — Override Environment Variables for Staging

In the `staging` environment, set these variables **differently** from production:

```env
# Must differ from production to prevent cross-contamination
# Keep NODE_ENV=production so Node.js applies the same optimizations and
# error handling as production. Use ENVIRONMENT to distinguish them.
NODE_ENV=production
ENVIRONMENT=staging

# Separate database — never share a database between staging and production
DATABASE_URL=postgresql://user:password@staging-host:5432/controlweave_staging?sslmode=require

# Different JWT secret — tokens from staging must not work in production
JWT_SECRET=<generate with: npm run security:generate-jwt-secret>

# Staging frontend URL
CORS_ORIGIN=https://staging.yourapp.com
FRONTEND_URL=https://staging.yourapp.com

# Lower rate limits are fine for staging
AUTH_RATE_LIMIT_MAX=200
API_RATE_LIMIT_MAX=5000

# Use a test Stripe key (never use live keys in staging)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...

# Optional: disable email sending in staging to avoid test emails reaching users
# SMTP_HOST=localhost
```

### Step 3 — Connect a Staging Domain

In the Railway staging environment, add a custom domain such as `staging.controlweave.yourdomain.com` or use the auto-generated Railway URL.

### Step 4 — Trigger Staging Deploys

Configure your Git workflow to auto-deploy the `develop` (or `staging`) branch to the staging environment and the `main` branch to production:

- **Production**: deploys from `main`
- **Staging**: deploys from `develop` or any feature branch

In Railway, set the **Source Branch** per environment under **Settings → Deploy**.

---

## Local Staging with Docker

For local staging that mirrors production, build and run the backend using the existing `Dockerfile` in `controlweave/backend`:

```bash
# Build the backend image
cd controlweave/backend
docker build -t controlweave-backend:staging .

# Create a .env.staging file (copy from .env.example and override with staging values)
# Then run the container, mapping port 3001
docker run --env-file .env.staging -p 3001:3001 --name controlweave-backend-staging controlweave-backend:staging

# In a separate terminal, apply migrations and seed test data inside the running container
docker exec -it controlweave-backend-staging npm run migrate
docker exec -it controlweave-backend-staging npm run seed:community-test-data
```

---

## Pre-Production Checklist

Run these checks in staging **before** merging to `main`:

```bash
# 1. Verify all routes load
npm run check:syntax

# 2. Security lint
npm run lint

# 3. Dependency audit
npm run audit:check

# 4. End-to-end API tests
npm run qa:e2e:dynamic

# 5. Auditor workflow
npm run qa:e2e:auditor

# 6. Crosswalk verification (requires live DB)
npm run qa:crosswalk:live
```

---

## Environment Variable Differences Summary

| Variable | Production | Staging |
|----------|-----------|---------|
| `NODE_ENV` | `production` | `production` |
| `ENVIRONMENT` | `production` | `staging` |
| `DATABASE_URL` | Production DB | Separate staging DB |
| `JWT_SECRET` | Production secret | Different secret |
| `STRIPE_SECRET_KEY` | `sk_live_...` | `sk_test_...` |
| `CORS_ORIGIN` | `https://app.controlweave.com` | `https://staging.controlweave.com` |
| `PLATFORM_ADMIN_EMAIL` | Real admin email | Test admin email |

---

## Related Documentation

- [Quick Start Guide](../QUICK_START.md)
- [Railway Deployment Guide](../RAILWAY_DEPLOYMENT_GUIDE.md)
- [Security Guide](./wiki/security/DATA_ENCRYPTION.md)
- [MCP Deployment Checklist](./MCP_DEPLOYMENT_CHECKLIST.md)
