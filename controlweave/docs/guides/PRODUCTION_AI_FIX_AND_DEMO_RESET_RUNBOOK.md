# Production AI Fix + Demo Tier Reset Runbook

This runbook applies the OWASP migration dependency (`069`), resets demo tier state to true tier values, and verifies behavior in production.

## 1) Prerequisites

```powershell
npm i -g @railway/cli
railway login
```

From repo root:

```powershell
cd "c:\Users\sheri\OneDrive\Documents\GitHub\ControlWeaver-Pro"
```

Link to the production project/service (one-time per machine):

```powershell
railway link
```

## 2) Apply Migration 069

Run all pending migrations in production:

```powershell
railway run -- npm --prefix controlweave/backend run migrate
```

Optional targeted rerun for `069` only:

```powershell
railway run -- npm --prefix controlweave/backend run migrate:one -- 069_owasp_top10_2025_vulnerability_mapping.sql
```

Verify `069` is recorded:

```powershell
railway run -- node -e "require('dotenv').config(); const { Client } = require('pg'); (async()=>{ const c=new Client({connectionString:process.env.DATABASE_URL}); await c.connect(); const r=await c.query(\"SELECT filename, applied_at FROM schema_migrations WHERE filename='069_owasp_top10_2025_vulnerability_mapping.sql'\"); console.log(r.rows); await c.end(); })().catch(e=>{ console.error(e.message); process.exit(1); });"
```

## 3) Reset Demo Org Tiers (4 demo admins)

Dry run:

```powershell
railway run -- npm --prefix controlweave/backend run seed:demo:tiers:reset
```

Apply changes (recommended password standardization included):

```powershell
railway run -- npm --prefix controlweave/backend run seed:demo:tiers:reset -- --apply --password "ControlWeave!2026"
```

Expected mapping:

- `admin@community.com` -> `community`
- `admin@pro.com` -> `pro`
- `admin@enterprise.com` -> `enterprise`
- `admin@govcloud.com` -> `govcloud`

## 4) Verify Post-Change

API smoke check for 4 accounts:

```powershell
node -e "const base='https://controlweaver-pro-production.up.railway.app/api/v1'; const accts=['admin@community.com','admin@pro.com','admin@enterprise.com','admin@govcloud.com']; (async()=>{ for (const email of accts){ const login=await fetch(base+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password:'ControlWeave!2026'})}); const lj=await login.json(); const token=lj?.data?.tokens?.accessToken; const me=await fetch(base+'/auth/me',{headers:{authorization:'Bearer '+token}}); const mj=await me.json(); console.log(email,'tier=',mj?.data?.organization?.tier,'status=',me.status); } })();"
```

Critical endpoints to confirm:

- `GET /api/v1/ai/monitoring/rules` should return `200`
- `GET /api/v1/ai/monitoring/events?limit=5` should return `200`
- `GET /api/v1/ai/usage-report?limit=5` should return `200`
- `POST /api/v1/ai/security-posture` should return `200`

## 5) Platform Admin Setup

Create/update platform admin user:

```powershell
$env:PLATFORM_ADMIN_EMAIL='<set-in-railway-env>'
$env:PLATFORM_ADMIN_FIRST_NAME='Platform'
$env:PLATFORM_ADMIN_LAST_NAME='Admin'
$env:PLATFORM_ADMIN_PASSWORD='ControlWeave!2026'
railway run -- npm --prefix controlweave/backend run seed:platform-admin
```

Verify flag:

```powershell
railway run -- node -e "require('dotenv').config(); const { Client } = require('pg'); (async()=>{ const email=(process.env.PLATFORM_ADMIN_EMAIL||'').toLowerCase(); if(!email){throw new Error('Missing PLATFORM_ADMIN_EMAIL');} const c=new Client({connectionString:process.env.DATABASE_URL}); await c.connect(); const r=await c.query('SELECT email, is_platform_admin FROM users WHERE lower(email)=lower($1) LIMIT 1',[email]); console.log(r.rows); await c.end(); })().catch(e=>{ console.error(e.message); process.exit(1); });"
```
