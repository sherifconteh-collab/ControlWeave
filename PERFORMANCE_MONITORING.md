# Performance Monitoring for Railway Deployment

This document describes the performance monitoring features added to ControlWeave for monitoring the application now that it's deployed on Railway.

## Overview

The performance monitoring system tracks request performance, system resources, and database metrics in real-time. This helps identify performance bottlenecks and monitor the health of the application on Railway.

## Features

### 1. Request Performance Tracking

Every API request is automatically tracked with the following metrics:
- Request duration (milliseconds)
- HTTP method and path
- Response status code
- User and organization context
- Timestamp

The system maintains a rolling window of the last 1,000 requests in memory for performance analysis.

### 2. Performance Endpoints

All performance endpoints require **admin permission** and are available under `/api/v1/performance/*`:

#### GET /api/v1/performance/stats
Returns comprehensive performance statistics including:
- **Uptime**: Application uptime in seconds and formatted
- **Requests**: Total, tracked, errors, error rate, slow requests, slow rate
- **Response Time**: Average, p50, p95, p99 percentiles
- **Status Codes**: Distribution of HTTP status codes
- **Slowest Endpoints**: Top 10 endpoints by average duration
- **Memory**: RSS, heap used, heap total
- **Process**: PID, Node version, platform, architecture
- **Database**: Connection pool stats and latency

**Example Response:**
```json
{
  "success": true,
  "data": {
    "uptime": {
      "seconds": 3600,
      "formatted": "1h 0m 0s"
    },
    "requests": {
      "total": 1500,
      "tracked": 1000,
      "errors": 15,
      "errorRate": "1.00%",
      "slowRequests": 20,
      "slowRate": "1.33%"
    },
    "responseTime": {
      "avg": 45.32,
      "p50": 32.15,
      "p95": 125.67,
      "p99": 450.23
    },
    "statusCodes": {
      "200": 1200,
      "201": 150,
      "400": 10,
      "404": 5
    },
    "slowestEndpoints": [
      {
        "endpoint": "POST /api/v1/ai/gap-analysis",
        "count": 25,
        "avgDuration": 1250.45
      }
    ],
    "memory": {
      "rss": "256 MB",
      "heapUsed": "128 MB",
      "heapTotal": "192 MB"
    },
    "database": {
      "total": 20,
      "idle": 18,
      "waiting": 0,
      "latency": "2.5 ms"
    }
  }
}
```

#### GET /api/v1/performance/requests?limit=50
Returns recent request history with detailed timing information.

**Parameters:**
- `limit` (optional): Number of requests to return (default: 50, max: 500)

**Example Response:**
```json
{
  "success": true,
  "data": {
    "count": 50,
    "requests": [
      {
        "timestamp": "2026-02-15T21:30:00.000Z",
        "method": "GET",
        "path": "/api/v1/controls",
        "statusCode": 200,
        "durationMs": 45.23,
        "userId": "user-123",
        "organizationId": "org-456"
      }
    ]
  }
}
```

#### GET /api/v1/performance/database
Returns database-specific performance metrics including:
- Connection pool statistics
- Query latency
- Database size
- Active connections
- Slow queries (if pg_stat_statements is enabled)
- Largest tables

**Example Response:**
```json
{
  "success": true,
  "data": {
    "pool": {
      "total": 20,
      "idle": 18,
      "waiting": 0
    },
    "latency": 2.5,
    "size": "1.2 GB",
    "sizeBytes": 1288490188,
    "activeConnections": 5,
    "slowQueries": [],
    "largestTables": [
      {
        "schemaname": "public",
        "tablename": "audit_logs",
        "size": "500 MB"
      }
    ]
  }
}
```

#### GET /api/v1/performance/system
Returns system resource metrics including:
- Memory usage (detailed breakdown)
- CPU usage
- Process information
- Environment details (including Railway detection)

**Example Response:**
```json
{
  "success": true,
  "data": {
    "memory": {
      "rss": 268435456,
      "rssMB": 256,
      "heapUsed": 134217728,
      "heapUsedMB": 128,
      "heapTotal": 201326592,
      "heapTotalMB": 192
    },
    "cpu": {
      "user": 1234567,
      "system": 234567
    },
    "process": {
      "pid": 12345,
      "uptime": 3600,
      "uptimeFormatted": "1h 0m 0s",
      "nodeVersion": "v20.11.0",
      "platform": "linux",
      "arch": "x64"
    },
    "environment": {
      "nodeEnv": "production",
      "port": 3001,
      "isRailway": true,
      "railwayEnv": "production"
    }
  }
}
```

### 3. Enhanced Health Check

The `/health` endpoint has been enhanced with performance metrics:

**GET /health**

No authentication required. Returns:
- Database connectivity and latency
- Memory usage
- Application uptime
- Railway environment information (if deployed on Railway)

**Example Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-15T21:30:00.000Z",
  "database": {
    "status": "connected",
    "latency": "2.5 ms"
  },
  "memory": {
    "rss": "256 MB",
    "heapUsed": "128 MB"
  },
  "uptime": "3600 seconds",
  "railway": {
    "environment": "production",
    "serviceId": "srv-abc123",
    "deploymentId": "dep-xyz789"
  },
  "requestId": "req-123456"
}
```

## Railway Integration

The system automatically detects when running on Railway and includes Railway-specific information in the health check and system metrics:

- `RAILWAY_ENVIRONMENT_NAME`: Environment name (production, staging, etc.)
- `RAILWAY_SERVICE_ID`: Service identifier
- `RAILWAY_DEPLOYMENT_ID`: Current deployment identifier

## Performance Tracking

### Slow Requests
Requests taking longer than 1000ms are automatically flagged as "slow" and tracked separately.

### Error Tracking
Requests with status codes >= 400 are tracked as errors.

### Percentile Metrics
Response times are tracked using percentiles:
- **p50 (median)**: 50% of requests are faster than this
- **p95**: 95% of requests are faster than this
- **p99**: 99% of requests are faster than this

### Endpoint Analysis
Performance metrics are aggregated by endpoint to identify which routes are slowest on average.

## Usage in Frontend

Add the performance API to your frontend application:

```typescript
import { performanceAPI } from '@/lib/api';

// Get performance statistics
const stats = await performanceAPI.getStats();

// Get recent requests
const requests = await performanceAPI.getRequests({ limit: 100 });

// Get database metrics
const dbMetrics = await performanceAPI.getDatabase();

// Get system metrics
const sysMetrics = await performanceAPI.getSystem();
```

## Monitoring Best Practices

1. **Regular Monitoring**: Check `/api/v1/performance/stats` regularly to track trends
2. **Set Alerts**: Monitor error rates and slow request percentages
3. **Database Performance**: Watch database latency and connection pool utilization
4. **Memory Usage**: Track memory growth to detect memory leaks
5. **Slow Endpoints**: Identify and optimize endpoints with high average duration

## Security Considerations

- All performance endpoints require **admin permission**
- All endpoints are protected by the application-wide API rate limiter (configured in `SECURITY_CONFIG.apiRateLimitMax`)
- Request tracking excludes sensitive data (only metadata is stored)
- Health check endpoint is public for monitoring services
- Performance data is stored in-memory and cleared on restart
- No sensitive information (passwords, tokens, keys) is included in performance logs

## Limitations

- Only the last 1,000 requests are tracked (older requests are discarded)
- Performance data is reset on application restart
- Some database metrics require specific PostgreSQL extensions (e.g., pg_stat_statements)

## Testing

Run the performance monitoring test suite:

```bash
cd controlweave/backend
node scripts/test-performance-monitoring.js
```

This validates that all components are properly integrated.
