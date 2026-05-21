# Railway Deployment Configuration Guide

## ⚠️ CRITICAL: Serverless Mode is INCORRECT for This Application

### Summary

**YES, it matters that you marked serverless in Railway!** This application **MUST NOT** be deployed in serverless mode. It requires a traditional server (container) deployment.

### Understanding Railway's Serverless Mode

**How Railway's Serverless Works:**
- Containers scale down to **zero** after periods of inactivity (saves costs)
- Incoming HTTP requests are **queued** while the container is sleeping
- Container wakes up to process queued requests (causes cold start latency)
- Requests are then served normally

**This sounds good, but...**

### Why Serverless Mode STILL WON'T WORK for This Application

While Railway's request queuing handles **HTTP traffic** gracefully, this application is designed as a **long-running server** with critical features that are **fundamentally incompatible** with scale-to-zero serverless deployments:

#### 1. **Background Scheduler (CRITICAL INCOMPATIBILITY)**
- **File**: `src/services/reminderService.js`
- **What it does**: Runs `setInterval()` every 60 minutes to:
  - Check for control reviews that are due
  - Send assessment plan reminders
  - Expire trial subscriptions
- **Problem with serverless**: When the container scales to zero, the scheduler **stops completely**. No requests come in to wake it up because these are **time-based tasks**, not request-driven. The scheduler only runs when the container is awake and serving requests.
- **Reality**: If your app has no traffic for 10+ minutes, the scheduler stops. The 60-minute interval resets each time the container wakes, meaning tasks may **never run** if traffic is sporadic.

```javascript
// From server.js line 249
const stopReminders = startReminderScheduler(); // Starts background scheduler
const server = app.listen(PORT, () => { ... });
```

#### 2. **Graceful Shutdown Handlers**
- **What it does**: Handles SIGTERM/SIGINT to cleanly close database connections and stop schedulers
- **Problem with serverless**: These handlers expect a long-running process, not frequent cold starts/shutdowns

```javascript
// From server.js lines 258-272
function shutdown(signal) {
  log('warn', 'server.shutdown.requested', { signal });
  stopReminders();
  server.close(() => {
    pool.end(() => { process.exit(0); });
  });
}
```

#### 3. **Persistent Database Connection Pool**
- **What it does**: Maintains a pool of database connections for efficiency
- **Problem with serverless**: Connection pool optimization is wasted with cold starts; may cause connection leaks

#### 4. **Background Job Processing**
- **Files**: `src/services/jobService.js`, `src/services/webhookService.js`
- **What it does**: Processes webhook events and background jobs
- **Problem with serverless**: Jobs may not be processed if container is asleep

#### 5. **LLM Service Cleanup**
- **File**: `src/services/llmService.js`
- **What it does**: Runs periodic cleanup of AI cache with `setInterval()`
- **Problem with serverless**: Cleanup won't run when container sleeps; cache memory management fails

### The Core Issue: Time-Based vs. Request-Based

**Railway's serverless request queuing helps with:**
- ✅ HTTP requests from users (queued and processed on wake)
- ✅ API calls from frontend (handled after cold start)
- ✅ Webhook deliveries (if sender retries)

**Railway's serverless CANNOT help with:**
- ❌ Time-based schedulers (`setInterval`, cron jobs)
- ❌ Background tasks that run on a schedule
- ❌ Periodic cleanup/maintenance tasks
- ❌ Any process that needs to run regardless of traffic

**The fundamental problem**: Your application needs to do work **even when no one is making requests**. Serverless architectures require external triggers (HTTP requests, queue messages) to wake up and do work. Background schedulers running inside the container don't provide those triggers.

### Impact of Using Serverless Mode

| Feature | Expected Behavior | What Happens in Serverless |
|---------|-------------------|----------------------------|
| **HTTP Requests** | Processed immediately | ✅ Queued & processed (with cold start delay) |
| **Control Review Reminders** | Sent every 60 minutes | ❌ NOT SENT when asleep (no trigger to wake) |
| **Trial Expirations** | Checked every 60 minutes | ❌ Trials never expire (scheduler paused) |
| **Assessment Notifications** | Sent on schedule | ❌ Delayed indefinitely or never sent |
| **Background Job Queue** | Processed continuously | ❌ Only processed when awake (during traffic) |
| **First Request Latency** | ~10-50ms | ⚠️ 2-5+ seconds (cold start on wake) |
| **Database Connections** | Pooled efficiently | ⚠️ Reconnect overhead on every wake |
| **Scheduled Tasks** | Run at specific times | ❌ Miss execution windows entirely |

---

## 🔄 Alternative Solutions (If You Must Use Serverless)

If cost optimization via serverless is critical and you're willing to re-architect, here are alternatives:

### Option 1: Use Web Service Mode (RECOMMENDED) ⭐
- Keep current architecture
- Reliable background processing
- Simplest solution
- Minimal additional cost

### Option 2: External Cron Service + Serverless API
**Architecture**: Remove internal scheduler, trigger via external HTTP calls

**Changes Required**:
1. Remove `startReminderScheduler()` from `server.js`
2. Create HTTP endpoints for each scheduled task:
   ```javascript
   // Add to server.js
   router.post('/api/v1/internal/run-reminders', async (req, res) => {
     // Verify secret token
     if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
       return res.status(401).json({ error: 'Unauthorized' });
     }
     await runReminderSweep();
     res.json({ success: true });
   });
   ```
3. Use external service (e.g., cron-job.org, EasyCron) to call endpoint every 60 minutes

**Pros**: Serverless compatible, external monitoring
**Cons**: Additional service dependency, more complex architecture, security concerns

### Option 3: Separate Always-On Worker Service
**Architecture**: Split into API service (serverless) + Worker service (always-on)

**Changes Required**:
1. Create new `worker.js` with only the scheduler
2. Deploy two services on Railway:
   - Main API: Serverless mode
   - Worker: Web Service mode (small instance)
3. Share database between services

**Pros**: API can scale to zero, worker stays alive
**Cons**: More complex deployment, two services to manage

### Option 4: Database-Driven Scheduling
**Architecture**: Use PostgreSQL `pg_cron` extension

**Changes Required**:
1. Enable pg_cron on your database
2. Define scheduled tasks in PostgreSQL
3. Remove Node.js schedulers

**Pros**: Database-native, reliable
**Cons**: Requires pg_cron support, database vendor lock-in

### Recommendation
**Just use Web Service mode.** The cost difference is minimal (few dollars/month), and you avoid significant re-architecture work and potential bugs. The current codebase is designed for always-on operation.

---

## ✅ CORRECT Configuration: Server Mode (Container)

### Railway Settings

**In your Railway project settings:**

1. **Service Type**: `Web Service` (NOT Serverless)
2. **Watch Paths**: Leave default or customize for your build
3. **Health Check**: Configure `/health` endpoint (optional but recommended)
4. **Restart Policy**: `On Failure` (recommended)

### Environment Variables Required

```bash
# Core Settings
NODE_ENV=production
PORT=3001  # Railway will override this automatically

# Database
DATABASE_URL=postgresql://...

# Security
JWT_SECRET=your-secret-key
CORS_ORIGINS=https://your-frontend.com

# Demo account credential delivery (required if using public contact/demo emails)
DEMO_ACCOUNT_PASSWORD=your-demo-password

# Background Jobs
REMINDER_INTERVAL_MINUTES=60  # Default: 60 minutes

# Railway-specific (auto-populated by Railway)
RAILWAY_ENVIRONMENT_NAME=production
RAILWAY_SERVICE_ID=auto-populated
RAILWAY_DEPLOYMENT_ID=auto-populated
```

### Railway.json (Optional but Recommended)

Create a `railway.json` in your backend directory:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd controlweave/backend && npm install"
  },
  "deploy": {
    "startCommand": "cd controlweave/backend && npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

---

## 🏗️ Metal Build Option

### What is Metal Build?

Railway's "metal" build option refers to **dedicated infrastructure** vs shared infrastructure. This is SEPARATE from the serverless vs. container decision.

### Should You Use Metal?

**For most cases: NO, standard containers are sufficient.**

| Consideration | Standard Containers | Metal/Dedicated |
|---------------|---------------------|-----------------|
| **Cost** | Lower (shared resources) | Higher (dedicated resources) |
| **Performance** | Sufficient for most apps | Guaranteed resources |
| **Use Case** | Dev, staging, small-medium production | High-traffic production |
| **Noisy Neighbor Risk** | Possible (shared infrastructure) | None (isolated) |

**Use Metal Build if:**
- Your app consistently uses >2GB RAM
- You need guaranteed CPU resources
- You have extremely high traffic (>1000 req/s)
- You need predictable, consistent performance
- Cost is less important than performance guarantees

**Standard Containers are fine if:**
- This is dev/staging environment
- Production traffic is low-to-medium (<500 req/s)
- Cost optimization is important
- Acceptable to have some performance variance

### Recommendation for ControlWeaver-Pro

**Start with Standard Containers**. Monitor performance and upgrade to Metal only if you observe:
- Consistent high memory usage (>80% of allocated)
- CPU throttling during peak hours
- Performance degradation that impacts users

---

## 🚀 Deployment Checklist

### Initial Deployment

- [ ] **Set Service Type to "Web Service"** (NOT Serverless)
- [ ] Configure all required environment variables
- [ ] Set `NODE_ENV=production`
- [ ] Configure database connection string
- [ ] Set up frontend CORS_ORIGINS
- [ ] If using public contact/demo emails, set `DEMO_ACCOUNT_PASSWORD`
- [ ] **Verify reminder scheduler is enabled** (check logs for "reminders.scheduler.started")

### Post-Deployment Verification

```bash
# 1. Check health endpoint
curl https://your-app.railway.app/health

# Expected response:
{
  "status": "healthy",
  "database": { "status": "connected", "latency": "X ms" },
  "memory": { "rss": "XXX MB", "heapUsed": "XXX MB" },
  "uptime": "XXX seconds",
  "railway": {
    "environment": "production",
    "serviceId": "...",
    "deploymentId": "..."
  }
}

# 2. Check server logs for scheduler
# Should see: "reminders.scheduler.started" with intervalMinutes
```

### Monitoring

Watch for these log messages to confirm everything is running:
- `server.started` - Server is up
- `reminders.scheduler.started` - Background scheduler is running
- `reminders.sweep.completed` - Scheduler is executing (every 60 min)
- No `server.shutdown.requested` unless you're intentionally restarting

---

## 🔧 Troubleshooting

### Problem: Reminders Not Being Sent

**Symptom**: Users not receiving notifications about due reviews

**Causes**:
1. ❌ Serverless mode is enabled - **MUST FIX**
2. Environment variable `DISABLE_REMINDER_SCHEDULER=true` - Remove this
3. Scheduler interval too long - Check `REMINDER_INTERVAL_MINUTES`

**Solution**: 
```bash
# In Railway UI, verify:
Service Type = Web Service (not Serverless)
DISABLE_REMINDER_SCHEDULER = not set
REMINDER_INTERVAL_MINUTES = 60 (or desired interval)
```

### Problem: High Cold Start Latency

**Symptom**: First request after inactivity takes 5+ seconds

**Cause**: Serverless mode is enabled

**Solution**: Change to Web Service mode

### Problem: Database Connection Errors

**Symptom**: Random "connection pool exhausted" errors

**Possible Causes**:
1. Serverless mode causing connection churn
2. Not enough connections in pool
3. Connections not being released

**Solutions**:
1. Ensure Web Service mode (not serverless)
2. Check database connection limits
3. Review connection pool configuration

---

## 📊 Resource Recommendations

### Development/Staging

```
Memory: 512 MB - 1 GB
CPU: Shared
Type: Standard Container
```

### Production (Small-Medium)

```
Memory: 1 GB - 2 GB
CPU: Shared (1-2 vCPU)
Type: Standard Container
```

### Production (High Traffic)

```
Memory: 2 GB - 4 GB
CPU: Dedicated (2-4 vCPU)
Type: Metal/Dedicated (if needed)
```

---

## 🎯 Key Takeaways

1. ⚠️ **NEVER use Serverless mode** - This app requires 24/7 uptime
2. ✅ **Use Web Service (Container) mode** - Essential for background jobs
3. 🏗️ **Metal build is optional** - Start with standard, upgrade if needed
4. 📊 **Monitor the scheduler** - Check logs for "reminders.scheduler.started"
5. 🔍 **Verify health checks** - Use `/health` endpoint to confirm deployment

---

## Additional Resources

- [Railway Container Deployments](https://docs.railway.com/deploy/deployments)
- [Railway Environment Variables](https://docs.railway.com/develop/variables)
- [Node.js Best Practices on Railway](https://blog.railway.app/p/nodejs-on-railway)

---

**Last Updated**: 2026-02-16
**Application**: ControlWeaver-Pro Backend
**Deployment Platform**: Railway
