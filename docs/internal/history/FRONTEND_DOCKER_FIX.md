# Frontend Docker Build Fix - Railway Deployment

## Issue Summary
Railway deployment for the frontend was failing with the following error:
```
Build Failed: build daemon returned an error < failed to solve: failed to compute cache key: 
failed to calculate checksum of ref: "/app/.next/static": not found >
```

## Root Cause
The issue was a mismatch between the Next.js build configuration and the Docker multi-stage build:

1. **next.config.ts** was configured with a custom `distDir: ".next-build"` 
2. **package.json** used `build-safe.js` script that enforced this custom directory
3. **Dockerfile** expected the standard `.next/` directory structure:
   - Tried to copy `/app/.next/standalone`
   - Tried to copy `/app/.next/static`
4. Since the build output was in `.next-build/` instead of `.next/`, the Docker COPY operations failed

## Solution Implemented

### 1. Updated next.config.ts
**Before:**
```typescript
const distDir = process.env.NEXT_DIST_DIR || ".next-build";
const nextConfig: NextConfig = {
  distDir,
};
```

**After:**
```typescript
const nextConfig: NextConfig = {
  output: "standalone",
};
```

**Why:** This enables Next.js standalone output mode and uses the default `.next` directory that the Dockerfile expects.

### 2. Updated package.json
**Before:**
```json
"build": "node scripts/build-safe.js"
```

**After:**
```json
"build": "next build"
```

**Why:** The `build-safe.js` script was designed for Windows file-locking workarounds, which aren't needed in Docker's Linux environment. Using the standard `next build` command is simpler and more reliable.

### 3. Updated tsconfig.json
**Before:**
```json
"include": [
  ".next/types/**/*.ts",
  ".next-build*/types/**/*.ts",
  ".next-build/types/**/*.ts",
  ...
]
```

**After:**
```json
"include": [
  ".next/types/**/*.ts",
  ".next/dev/types/**/*.ts"
]
```

**Why:** TypeScript should only look for type definitions in the standard `.next` directory.

### 4. Updated next-env.d.ts
**Before:**
```typescript
import "./.next-build/dev/types/routes.d.ts";
```

**After:**
```typescript
// Removed the import - Next.js auto-generates this file
```

**Why:** This file is auto-managed by Next.js and shouldn't import from custom directories.

### 5. Created .dockerignore
```
node_modules
.next
.next-build*
.git
.env*.local
...
```

**Why:** Prevents unnecessary files from being copied into the Docker build context, improving build speed and reducing image size.

### 6. Created .gitignore
```
node_modules
.next
.next-build*
out
.env*.local
...
```

**Why:** Ensures build artifacts are not committed to version control.

## How the Fix Works

### Docker Build Process (Working)
1. **deps stage**: `npm install` installs dependencies
2. **builder stage**: 
   - Copies node_modules from deps stage
   - Copies source code
   - Runs `npm run build` → executes `next build`
   - Next.js builds with `output: "standalone"` mode
   - Generates:
     - `.next/standalone/` - Standalone server files
     - `.next/static/` - Static assets
     - `server.js` - Entry point
3. **runner stage**:
   - Copies `.next/standalone` → `/app/`
   - Copies `.next/static` → `/app/.next/static`
   - Copies `public/` → `/app/public`
   - Starts with `node server.js`

### Why Standalone Mode?
Next.js standalone output mode:
- Creates a minimal Node.js server (`server.js`)
- Includes only necessary dependencies
- Results in smaller Docker images (~100MB vs ~500MB+)
- Better performance in production
- Designed for containerized deployments

## Verification

### Local Build Test
```bash
cd controlweave/frontend
npm install
npm run build
# Should create .next/standalone and .next/static directories
```

### Docker Build Test
```bash
cd controlweave/frontend
docker build -t controlweave-frontend .
docker run -p 3000:3000 controlweave-frontend
# Should start successfully and serve on port 3000
```

### Railway Deployment
After pushing these changes, Railway will:
1. Detect the Dockerfile in `controlweave/frontend/`
2. Build using the multi-stage Dockerfile
3. Successfully copy all files from `.next/` directory
4. Deploy and start the standalone server

## Files Changed
1. `controlweave/frontend/next.config.ts` - Enable standalone mode
2. `controlweave/frontend/package.json` - Use standard build command
3. `controlweave/frontend/tsconfig.json` - Remove custom distDir patterns
4. `controlweave/frontend/next-env.d.ts` - Remove custom import
5. `controlweave/frontend/.dockerignore` - Exclude build artifacts
6. `controlweave/frontend/.gitignore` - Ignore build artifacts

## Additional Notes

### build-safe.js Script
The `scripts/build-safe.js` file is still present but no longer used. It was designed to work around Windows file-locking issues during local development. Since Docker builds run in a Linux environment, these workarounds aren't necessary.

### Environment Variables
The Dockerfile supports build-time environment variables:
```dockerfile
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
```

Make sure Railway has `NEXT_PUBLIC_API_URL` set in the environment variables.

### Health Checks
The Dockerfile includes a health check:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', ...)"
```

This ensures Railway can monitor the service health.

## Troubleshooting

If build still fails:
1. Check Railway logs for the actual error message
2. Verify `controlweave/frontend` is set as the root directory
3. Ensure environment variables are set in Railway dashboard
4. Check that Dockerfile is being used (not nixpacks)

If runtime fails:
1. Check that `NEXT_PUBLIC_API_URL` points to the backend service
2. Verify the backend service is running and accessible
3. Check Railway logs for startup errors

## References
- [Next.js Standalone Output](https://nextjs.org/docs/pages/api-reference/next-config-js/output)
- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Railway Documentation](https://docs.railway.app/)
