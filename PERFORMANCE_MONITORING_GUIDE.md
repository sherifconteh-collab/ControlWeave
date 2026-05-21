# Performance Monitoring Quick Start Guide

This guide shows you how to use the performance monitoring features to check the performance of ControlWeave on Railway.

## Quick Health Check

The simplest way to check if the app is running and healthy:

```bash
curl https://your-railway-app.up.railway.app/health
```

**Expected Response:**
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
  }
}
```

## Detailed Performance Statistics (Admin Only)

### Get Overall Performance Stats

```bash
# Replace YOUR_TOKEN with your admin JWT token
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-railway-app.up.railway.app/api/v1/performance/stats
```

This returns:
- Response time percentiles (p50, p95, p99)
- Error rates
- Slow request rates
- Memory usage
- Database connection pool stats
- Slowest endpoints

### Get Recent Request History

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://your-railway-app.up.railway.app/api/v1/performance/requests?limit=100"
```

Shows the last 100 requests with timing data.

### Get Database Performance

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-railway-app.up.railway.app/api/v1/performance/database
```

Returns:
- Connection pool utilization
- Query latency
- Database size
- Active connections
- Largest tables

### Get System Resources

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-railway-app.up.railway.app/api/v1/performance/system
```

Returns:
- Memory breakdown
- CPU usage
- Process info
- Railway environment details

## Using in Frontend

If you have the admin role, you can create a performance monitoring dashboard:

```typescript
import { performanceAPI } from '@/lib/api';

// In your component
const [stats, setStats] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  async function loadStats() {
    try {
      const response = await performanceAPI.getStats();
      setStats(response.data.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  }
  
  loadStats();
  
  // Refresh every 30 seconds
  const interval = setInterval(loadStats, 30000);
  return () => clearInterval(interval);
}, []);

// Display the stats
return (
  <div>
    <h2>Performance Overview</h2>
    {stats && (
      <>
        <p>Uptime: {stats.uptime.formatted}</p>
        <p>Total Requests: {stats.requests.total}</p>
        <p>Error Rate: {stats.requests.errorRate}</p>
        <p>Avg Response Time: {stats.responseTime.avg}ms</p>
        <p>p95 Response Time: {stats.responseTime.p95}ms</p>
        <p>Memory (RSS): {stats.memory.rss}</p>
        <p>DB Latency: {stats.database?.latency}</p>
      </>
    )}
  </div>
);
```

## Key Metrics to Monitor

### 1. Response Time
- **Avg < 100ms**: Excellent
- **Avg 100-500ms**: Good
- **Avg 500-1000ms**: Acceptable
- **Avg > 1000ms**: Needs investigation

### 2. Error Rate
- **< 1%**: Healthy
- **1-5%**: Monitor closely
- **> 5%**: Investigate immediately

### 3. Database Latency
- **< 10ms**: Excellent
- **10-50ms**: Good
- **50-100ms**: Acceptable
- **> 100ms**: May need optimization

### 4. Memory Usage
- **< 512 MB**: Comfortable
- **512 MB - 1 GB**: Monitor growth
- **> 1 GB**: Check for memory leaks

### 5. Slow Request Rate
- **< 5%**: Normal
- **5-10%**: Review slow endpoints
- **> 10%**: Performance issue

## Common Performance Issues

### High Response Times
**Symptoms:** p95 > 1000ms, many slow requests

**Investigate:**
```bash
# Get slowest endpoints
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-railway-app.up.railway.app/api/v1/performance/stats | \
  jq '.data.slowestEndpoints'
```

**Common Causes:**
- Heavy AI operations (gap analysis, crosswalk optimizer)
- Large database queries
- External API calls (LLM providers)

### High Error Rates
**Symptoms:** Error rate > 5%

**Investigate:**
```bash
# Check status code distribution
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-railway-app.up.railway.app/api/v1/performance/stats | \
  jq '.data.statusCodes'
```

**Common Causes:**
- Authentication failures (401)
- Permission issues (403)
- Resource not found (404)
- Server errors (500)

### Database Performance Issues
**Symptoms:** DB latency > 100ms, high connection pool usage

**Investigate:**
```bash
# Check database metrics
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-railway-app.up.railway.app/api/v1/performance/database
```

**Common Causes:**
- Missing indexes
- Large table scans
- Connection pool exhaustion
- Heavy concurrent queries

### Memory Growth
**Symptoms:** RSS consistently increasing

**Monitor over time:**
```bash
# Check memory every 5 minutes
while true; do
  curl -H "Authorization: Bearer YOUR_TOKEN" \
    https://your-railway-app.up.railway.app/api/v1/performance/system | \
    jq '.data.memory'
  sleep 300
done
```

**Common Causes:**
- Memory leaks
- Large result sets cached in memory
- Too many concurrent requests
- Large file uploads

## Setting Up Monitoring Alerts

You can use Railway's monitoring features or external services like:

1. **Railway Healthcheck**
   - Configure Railway to check `/health` endpoint
   - Set up alerts if health check fails

2. **External Monitoring** (e.g., UptimeRobot, Pingdom)
   - Monitor `/health` endpoint
   - Set up alerts for response time > threshold
   - Set up alerts for non-200 status codes

3. **Custom Monitoring Script**
   ```bash
   #!/bin/bash
   # monitor.sh - Run this as a cron job
   
   STATS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://your-app.railway.app/api/v1/performance/stats)
   
   ERROR_RATE=$(echo $STATS | jq -r '.data.requests.errorRate' | sed 's/%//')
   P95=$(echo $STATS | jq -r '.data.responseTime.p95')
   
   if (( $(echo "$ERROR_RATE > 5.0" | bc -l) )); then
     echo "ALERT: High error rate: $ERROR_RATE%"
     # Send alert (email, Slack, etc.)
   fi
   
   if (( $(echo "$P95 > 1000" | bc -l) )); then
     echo "ALERT: Slow response times: p95 = ${P95}ms"
     # Send alert
   fi
   ```

## Best Practices

1. **Regular Monitoring**: Check performance stats at least once per day
2. **Baseline Metrics**: Record baseline performance after deployment
3. **Trend Analysis**: Compare current metrics to historical baselines
4. **Proactive Investigation**: Investigate issues before they become critical
5. **Load Testing**: Test performance under expected load before going live
6. **Resource Planning**: Monitor growth trends to plan capacity upgrades

## Troubleshooting

### "Failed to get performance statistics" Error
- **Cause**: Not logged in as admin user
- **Solution**: Ensure you have admin role and valid JWT token

### Empty slowestEndpoints Array
- **Cause**: No requests tracked yet (server just started)
- **Solution**: Wait a few minutes for requests to be processed

### Database Metrics Unavailable
- **Cause**: PostgreSQL permissions or extensions not enabled
- **Solution**: Some metrics require pg_stat_statements extension

### Memory Metrics Showing as "unavailable"
- **Cause**: Permission issues or unsupported platform
- **Solution**: Check Node.js version and platform support

## Next Steps

1. Set up regular monitoring of `/health` endpoint
2. Configure Railway monitoring/alerts
3. Create a performance dashboard in the admin UI
4. Set up automated alerts for critical metrics
5. Document baseline performance metrics
6. Schedule regular performance reviews

For detailed API documentation, see [PERFORMANCE_MONITORING.md](PERFORMANCE_MONITORING.md).
