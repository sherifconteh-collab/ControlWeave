# Frontend Dockerfile for ControlWeave
FROM node:20-alpine3.21 AS base
RUN apk update && apk upgrade --no-cache
# The npm bundled with the Node 20 image ships tar 6.2.1 (CVE-2026-59873,
# critical, fixed in tar 7.5.19). npm 11.20.0 bundles tar 7.5.22 and still
# supports Node 20. Every stage inherits this, including the runner, where
# Railway's preDeploy and start commands call npm.
RUN npm install -g npm@11.20.0 && npm cache clean --force

# Install dependencies
FROM base AS deps
WORKDIR /app
# .npmrc carries legacy-peer-deps=true (@sentry/nextjs peer range vs Next 16).
# Without it here a strict `npm ci` fails on the peer conflict inside the
# image even though it passes in CI. The `|| npm install` fallback stays until
# strict installs have proven stable on Railway.
COPY package*.json .npmrc ./
COPY scripts ./scripts
RUN npm ci || npm install

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build-time environment variables if needed
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

# Create non-root user
RUN apk update && apk upgrade --no-cache && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/build/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/build/static ./build/static

USER nextjs

# Default port (can be overridden by Railway)
ENV PORT=3000
EXPOSE 3000

# Health check that uses the PORT environment variable
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "const port=process.env.PORT||3000;require('http').get(\`http://localhost:\${port}/health\`,(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
