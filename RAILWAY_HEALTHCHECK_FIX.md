# Railway Health Check Troubleshooting Guide

## Quick Fix for Health Check Failures

If your Railway deployments are building successfully but failing health checks, follow this guide.

## Problem Symptoms

```
====================
Starting Healthcheck
====================
Path: /health
Retry window: 1m40s

Attempt #1 failed with service unavailable. Continuing to retry for 1m29s
Attempt #2 failed with service unavailable. Continuing to retry for 1m18s
...
Attempt #6 failed with service unavailable. Continuing to retry for 8s

1/1 replicas never became healthy!
Healthcheck failed!
```

## Common Causes & Solutions

### 1. Backend Not Binding to 0.0.0.0

**Problem**: Backend listens on `localhost` or `127.0.0.1` instead of `0.0.0.0`

**Solution**: Ensure server binds to `0.0.0.0`
```javascript
// In server.js
const HOST = process.env.HOST || '0.0.0.0';
const server = app.listen(PORT, HOST, () => { ... });
```

**Dockerfile Fix**:
```dockerfile
ENV HOST=0.0.0.0
```

### 2. Frontend Not Setting HOSTNAME

**Problem**: Next.js standalone server listens on `localhost` by default

**Solution**: Set `HOSTNAME` environment variable
```dockerfile
ENV HOSTNAME=0.0.0.0
```

### 3. Missing /health Endpoint

**Problem**: Application doesn't have a `/health` route

**Backend Solution**: Add health endpoint
```javascript
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

**Frontend Solution**: Add health route (Next.js App Router)
```typescript
// src/app/health/route.ts
export function GET() {
  return Response.json({ status: "ok" }, { status: 200 });
}
```

### 4. Server Crashes on Startup

**Problem**: Application fails to start due to missing dependencies or errors

**How to Diagnose**:
1. Check Railway deploy logs for errors
2. Look for module not found errors
3. Check for missing environment variables

**Common Fixes**:
- Add missing dependencies to package.json
- Create missing middleware/service files
- Set required environment variables
- Fix import paths

### 5. Wrong PORT Configuration

**Problem**: Application doesn't use Railway's PORT variable

**Solution**: Use environment variable
```javascript
const PORT = process.env.PORT || 3001;
```

**Railway automatically sets**:
- `PORT` - The port your app should listen on
- Application MUST bind to this port for health checks to work

### 6. Database Connection Issues

**Problem**: App requires database but can't connect

**Symptoms**: Health check fails because DB query fails

**Solutions**:
1. Verify `DATABASE_URL` is set
2. Link PostgreSQL service to backend service
3. Ensure SSL mode is enabled (`?sslmode=require`)
4. Make health check work even if DB is temporarily unavailable

**Robust Health Check**:
```javascript
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    // Still return 200 if service is up, but note DB issue
    res.json({ 
      status: 'degraded', 
      database: 'disconnected',
      error: error.message 
    });
  }
});
```

### 7. Railway.json Configuration Issues

**Problem**: Wrong builder or commands specified

**Solution**: Use DOCKERFILE builder for Docker-based builds
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE"
  },
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

**Don't use**: npm commands when using Dockerfiles

### 8. Dockerfile Issues

**Problem**: Multi-stage build doesn't copy files correctly

**Backend Common Issues**:
- Missing `node_modules` copy
- Missing source files
- Wrong working directory

**Frontend Common Issues**:
- Missing `.next/standalone` build output
- Missing `public` directory
- Missing `.next/static` directory

**Verify Dockerfile Stages**:
```dockerfile
# Deps stage - install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

# Builder stage - build app
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runner stage - production
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static

ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
```

## Step-by-Step Debugging Process

### Step 1: Verify Service Configuration

In Railway dashboard:
- ✅ Root directory is set correctly
  - Backend: `controlweave/backend`
  - Frontend: `controlweave/frontend`
- ✅ Dockerfile exists in root directory
- ✅ Health check path is `/health`

### Step 2: Check Build Logs

Look for:
- ✅ Dockerfile found and used
- ✅ Build completes without errors
- ✅ Image pushed successfully
- ❌ Any error messages during build

### Step 3: Check Deploy Logs

Look for:
- Server startup messages
- Error messages
- Module not found errors
- Database connection errors

### Step 4: Test Locally with Docker

```bash
# Build the image
cd controlweave/backend
docker build -t backend-test .

# Run the container
docker run -p 3001:3001 -e DATABASE_URL=postgresql://... backend-test

# Test health endpoint
curl http://localhost:3001/health
```

### Step 5: Check Environment Variables

In Railway:
1. Go to service → Variables
2. Verify all required variables are set:
   - Backend: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`
   - Frontend: `NEXT_PUBLIC_API_URL`

### Step 6: Review Application Logs

After deployment attempt:
1. Go to service → Logs
2. Look for:
   - Server started message
   - Error messages
   - Module loading errors
   - Connection errors

## Quick Checklist

Use this checklist to verify your deployment configuration:

### Backend Service
- [ ] Root directory: `controlweave/backend`
- [ ] Dockerfile exists at `controlweave/backend/Dockerfile`
- [ ] Server binds to `0.0.0.0` (check code or ENV)
- [ ] `/health` endpoint exists and works
- [ ] `DATABASE_URL` environment variable is set
- [ ] `JWT_SECRET` environment variable is set
- [ ] `CORS_ORIGINS` includes frontend URL
- [ ] All required dependencies are in package.json
- [ ] No missing middleware or service files

### Frontend Service
- [ ] Root directory: `controlweave/frontend`
- [ ] Dockerfile exists at `controlweave/frontend/Dockerfile`
- [ ] `HOSTNAME=0.0.0.0` in Dockerfile
- [ ] `/health` endpoint exists (`src/app/health/route.ts`)
- [ ] `NEXT_PUBLIC_API_URL` environment variable is set
- [ ] `output: "standalone"` in next.config.ts
- [ ] Dockerfile copies standalone build correctly

### Configuration Files
- [ ] `railway.json` uses `DOCKERFILE` builder (or is not present)
- [ ] No conflicting build commands in railway.json
- [ ] Health check path is `/health`
- [ ] Health check timeout is adequate (100s recommended)

## Resolved Issues in This Fix

### Issue 1: Missing auditLog Middleware
**Symptom**: Backend crashed on startup with "Cannot find module '../middleware/auditLog'"

**Fix**: Created `src/middleware/auditLog.js` with proper audit logging middleware

### Issue 2: Wrong Auth Import
**Symptom**: Routes used `authenticateToken` which doesn't exist

**Fix**: Changed all imports to use `authenticate` instead

### Issue 3: Wrong Railway Builder
**Symptom**: railway.json specified NIXPACKS instead of DOCKERFILE

**Fix**: Updated railway.json to use DOCKERFILE builder

### Issue 4: Missing HOST Environment Variable
**Symptom**: Not explicitly set in Dockerfile

**Fix**: Added `ENV HOST=0.0.0.0` to backend Dockerfile

## Testing Your Fix

After making changes:

1. **Commit and push changes**
   ```bash
   git add .
   git commit -m "Fix health check issues"
   git push
   ```

2. **Monitor Railway deployment**
   - Watch build logs for errors
   - Wait for health check to complete
   - Should see "Deployment successful"

3. **Test endpoints**
   ```bash
   # Backend
   curl https://your-backend.up.railway.app/health
   
   # Frontend
   curl https://your-frontend.up.railway.app/health
   ```

4. **Verify application works**
   - Open frontend in browser
   - Check for API connection
   - Test login functionality

## Getting Help

If you're still experiencing issues:

1. **Check logs thoroughly**
   - Railway → Service → Logs
   - Look for the exact error message

2. **Test locally with Docker**
   - Build and run containers locally
   - Verify they work before deploying

3. **Review configuration**
   - Double-check all environment variables
   - Verify service linking (database)
   - Check CORS configuration

4. **Ask for help**
   - Include: build logs, deploy logs, error messages
   - Specify: which service is failing (backend/frontend)
   - Mention: what you've already tried

## Additional Resources

- **Railway Docs**: https://docs.railway.com/deploy/deployments
- **Docker Multi-stage Builds**: https://docs.docker.com/build/building/multi-stage/
- **Next.js Standalone**: https://nextjs.org/docs/app/api-reference/next-config-js/output
- **Express Health Checks**: Express.js best practices for health endpoints

---

**Last Updated**: 2026-02-18  
**Application**: ControlWeave-Pro  
**Platform**: Railway
