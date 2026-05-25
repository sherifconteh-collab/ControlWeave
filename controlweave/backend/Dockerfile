# Backend Dockerfile for ControlWeave
FROM node:22-alpine3.21 AS base
RUN apk update && apk upgrade --no-cache

# Install production dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Build stage
FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0

# Install system dependencies and create non-root user.
# postgresql17-client provides pg_dump/pg_restore for the backup scheduler;
# pg_dump 17 is backward-compatible with PostgreSQL 14–17.
RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache postgresql17-client && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 controlweave

# Copy necessary files
COPY --from=deps --chown=controlweave:nodejs /app/node_modules ./node_modules
COPY --chown=controlweave:nodejs . .

# Create runtime-writable directories
RUN mkdir -p /app/uploads /app/backups && \
    chown controlweave:nodejs /app/uploads /app/backups

USER controlweave

# Default port (can be overridden by Railway)
ENV PORT=3001
EXPOSE 3001

# Health check that uses the PORT environment variable
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "const port=process.env.PORT||3001;require('http').get(\`http://localhost:\${port}/health\`,(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]
