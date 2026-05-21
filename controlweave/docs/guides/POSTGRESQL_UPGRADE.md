# PostgreSQL Upgrade Guide

This guide covers upgrading the PostgreSQL major version used by ControlWeave (e.g. 16 → 17).

> **Current minimum requirement:** PostgreSQL 17+  
> **Recommended:** PostgreSQL 17 (latest stable)

---

## Why Upgrade?

PostgreSQL 17 (released October 2024) brings:

- **Faster VACUUM** — up to 20× faster full-table vacuums reduce maintenance windows
- **Improved logical replication** — `pg_logical` slots survive `ALTER TABLE`
- **JSON path improvements** — better operator support used by ControlWeave's JSONB evidence metadata
- **`COPY FROM ... RETURNING`** — bulk import pipelines in seed scripts can now return inserted IDs
- **Memory & query planner improvements** — better join selection, lower peak memory for large crosswalk queries
- **pgvector 0.7+ compatibility** — required for the RAG document store (migration 084)

---

## Pre-Upgrade Checklist

```bash
# 1. Confirm current version
psql --version
pg_lsclusters

# 2. Verify pgvector is installed (required by migration 084)
psql -U postgres -c "SELECT extversion FROM pg_extension WHERE extname = 'vector';"

# 3. Back up your database
pg_dump -Fc -d grc_platform -f /backups/grc_platform_pre_upgrade.dump
# Or using the built-in backup script:
cd controlweave/backend && npm run db:backup

# 4. Note all installed extensions
psql -U postgres -d grc_platform -c "SELECT extname, extversion FROM pg_extension ORDER BY extname;"
```

---

## Railway (Production — Recommended Path)

Railway manages PostgreSQL upgrades through the dashboard:

1. Go to **Railway Dashboard → your project → PostgreSQL service**
2. Click **Settings → Database Version**
3. Select **PostgreSQL 17**
4. Railway takes a snapshot before upgrading — no manual backup needed
5. After upgrade completes, verify with:
   ```bash
   psql $DATABASE_URL -c "SELECT version();"
   ```
6. Re-enable the `vector` extension if it was reset:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

---

## Self-Hosted / VPS (Ubuntu/Debian)

### Step 1 — Add the PGDG repository

```bash
sudo apt-get install -y curl ca-certificates
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  https://www.postgresql.org/media/keys/ACCC4CF8.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
  https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt-get update
```

### Step 2 — Install PostgreSQL 17

```bash
sudo apt-get install -y postgresql-17 postgresql-17-pgvector
```

> pgvector **must** be reinstalled for the new major version — it is not carried over automatically.

### Step 3 — Back up current data

```bash
pg_dumpall -U postgres > /tmp/pg16_full_backup.sql
# Or per-database:
pg_dump -Fc -U postgres grc_platform -f /tmp/grc_platform.dump
```

### Step 4 — Run pg_upgrade

`pg_upgrade` performs an in-place upgrade without a full data copy:

```bash
# Stop both clusters first
sudo systemctl stop postgresql@16-main
sudo systemctl stop postgresql@17-main

# Run pg_upgrade (adjust paths for your OS)
sudo -u postgres /usr/lib/postgresql/17/bin/pg_upgrade \
  --old-datadir /var/lib/postgresql/16/main \
  --new-datadir /var/lib/postgresql/17/main \
  --old-bindir /usr/lib/postgresql/16/bin \
  --new-bindir /usr/lib/postgresql/17/bin \
  --link   # hard-link data files instead of copying (much faster)

# Start PostgreSQL 17
sudo systemctl start postgresql@17-main

# Verify
psql -U postgres -c "SELECT version();"
```

### Step 5 — Restore extensions

```bash
sudo -u postgres psql -d grc_platform << 'SQL'
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- used by crosswalk similarity search
SQL
```

### Step 6 — Run ControlWeave migrations

Extensions are re-registered, but ControlWeave migrations are idempotent and safe to re-run:

```bash
cd controlweave/backend
npm run migrate
```

### Step 7 — Run ANALYZE

```bash
sudo -u postgres /usr/lib/postgresql/17/bin/vacuumdb \
  --all --analyze-in-stages
```

### Step 8 — Remove old cluster (optional, after verification)

```bash
# Only after confirming the app is healthy on PG17
sudo pg_dropcluster 16 main
sudo apt-get remove postgresql-16
```

---

## Docker / docker-compose

```yaml
# docker-compose.yml — change the image tag:
services:
  postgres:
    image: pgvector/pgvector:pg17   # was pg16
    environment:
      POSTGRES_DB: grc_platform
      POSTGRES_USER: appuser
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
```

> **Note:** Changing the major version tag on an existing volume will **not** auto-upgrade the data directory.  
> You must dump → remove the volume → recreate → restore:

```bash
# Dump
docker exec postgres pg_dump -Fc -U appuser grc_platform > grc_platform.dump

# Remove the old volume and recreate with PG17
docker compose down -v
# Update the image tag to pg17
docker compose up -d

# Restore
docker exec -i postgres pg_restore -U appuser -d grc_platform < grc_platform.dump

# Re-run migrations
cd controlweave/backend && npm run migrate
```

---

## Verifying the Upgrade

```bash
# 1. Check PostgreSQL version
psql -U appuser -d grc_platform -c "SELECT version();"

# 2. Check extensions
psql -U appuser -d grc_platform -c "SELECT extname, extversion FROM pg_extension ORDER BY extname;"

# 3. Run the ControlWeave health check
curl http://localhost:3001/health

# 4. Confirm migrations are all applied
cd controlweave/backend && npm run migrate
# Should print: All migrations complete.

# 5. Run the capacity check
npm run db:capacity
```

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `extension "vector" is not available` | pgvector not installed for PG17 | `sudo apt-get install postgresql-17-pgvector` |
| `could not connect to server` after upgrade | PG17 cluster not started | `sudo systemctl start postgresql@17-main` |
| `role "appuser" does not exist` | Roles not migrated | `pg_dumpall --globals-only` before upgrade, restore after |
| `operator does not exist: uuid = character varying` | Schema bug in migrations 086/087 | Already fixed — update to latest commit |
| Slow queries after upgrade | Statistics reset by upgrade | Run `ANALYZE` or `vacuumdb --all --analyze-in-stages` |

---

## Related

- [QUICK_START.md](../../QUICK_START.md) — initial setup guide
- [PRODUCTION_AI_FIX_AND_DEMO_RESET_RUNBOOK.md](PRODUCTION_AI_FIX_AND_DEMO_RESET_RUNBOOK.md) — production recovery runbook
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — general troubleshooting
