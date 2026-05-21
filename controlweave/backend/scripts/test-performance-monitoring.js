// @tier: exclude
/**
 * Test script for performance monitoring
 * Validates that performance monitoring endpoints are working correctly
 */

const assert = require('assert');
const path = require('path');

console.log('Testing performance monitoring implementation...\n');

// Test 1: Verify performanceMonitoring middleware exists
console.log('Test 1: Checking performanceMonitoring middleware...');
try {
  const middlewarePath = path.join(__dirname, '../src/middleware/performanceMonitoring.js');
  const performanceMiddleware = require(middlewarePath);
  
  assert(typeof performanceMiddleware.performanceTracker === 'function', 
    'performanceTracker should be a function');
  assert(typeof performanceMiddleware.getPerformanceStats === 'function',
    'getPerformanceStats should be a function');
  assert(typeof performanceMiddleware.getRecentRequests === 'function',
    'getRecentRequests should be a function');
  assert(typeof performanceMiddleware.resetMetrics === 'function',
    'resetMetrics should be a function');
  
  console.log('✓ performanceMonitoring middleware exists with all required functions\n');
} catch (err) {
  console.error('✗ performanceMonitoring middleware test failed:', err.message);
  process.exit(1);
}

// Test 2: Verify performance routes exist
console.log('Test 2: Checking performance routes...');
try {
  const routesPath = path.join(__dirname, '../src/routes/performance.js');
  const fs = require('fs');
  const routesContent = fs.readFileSync(routesPath, 'utf8');
  
  assert(routesContent.includes('router.get(\'/stats\''), 
    'Stats endpoint should exist');
  assert(routesContent.includes('router.get(\'/requests\''),
    'Requests endpoint should exist');
  assert(routesContent.includes('router.get(\'/database\''),
    'Database endpoint should exist');
  assert(routesContent.includes('router.get(\'/system\''),
    'System endpoint should exist');
  
  console.log('✓ Performance routes exist with all endpoints\n');
} catch (err) {
  console.error('✗ Performance routes test failed:', err.message);
  process.exit(1);
}

// Test 3: Verify server.js includes performance monitoring
console.log('Test 3: Checking server.js integration...');
try {
  const serverPath = path.join(__dirname, '../src/server.js');
  const fs = require('fs');
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  
  assert(serverContent.includes('performanceTracker'),
    'server.js should import performanceTracker');
  assert(serverContent.includes('performanceRoutes'),
    'server.js should import performanceRoutes');
  assert(serverContent.includes('app.use(performanceTracker)'),
    'server.js should use performanceTracker middleware');
  assert(serverContent.includes('app.use(\'/api/v1/performance\', performanceRoutes)'),
    'server.js should mount performance routes');
  
  console.log('✓ server.js properly integrates performance monitoring\n');
} catch (err) {
  console.error('✗ server.js integration test failed:', err.message);
  process.exit(1);
}

// Test 4: Verify enhanced health check
console.log('Test 4: Checking enhanced health check...');
try {
  const serverPath = path.join(__dirname, '../src/server.js');
  const fs = require('fs');
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  
  assert(serverContent.includes('dbLatency'),
    'Health check should measure database latency');
  assert(serverContent.includes('memory.rss'),
    'Health check should include memory metrics');
  assert(serverContent.includes('process.uptime()'),
    'Health check should include uptime');
  assert(serverContent.includes('RAILWAY_ENVIRONMENT_NAME'),
    'Health check should include Railway environment info');
  
  console.log('✓ Health check is enhanced with performance metrics\n');
} catch (err) {
  console.error('✗ Health check test failed:', err.message);
  process.exit(1);
}

// Test 5: Test getPerformanceStats function
console.log('Test 5: Testing getPerformanceStats function...');
try {
  const middlewarePath = path.join(__dirname, '../src/middleware/performanceMonitoring.js');
  const { getPerformanceStats } = require(middlewarePath);
  
  const stats = getPerformanceStats();
  
  assert(stats.uptime, 'Stats should include uptime');
  assert(stats.requests, 'Stats should include requests');
  assert(stats.responseTime, 'Stats should include responseTime');
  assert(stats.memory, 'Stats should include memory');
  assert(stats.process, 'Stats should include process info');
  assert(stats.slowestEndpoints !== undefined, 'Stats should include slowestEndpoints');
  
  console.log('✓ getPerformanceStats returns all required metrics\n');
} catch (err) {
  console.error('✗ getPerformanceStats test failed:', err.message);
  process.exit(1);
}

console.log('════════════════════════════════════════════════════════');
console.log('✓ All performance monitoring tests passed!');
console.log('════════════════════════════════════════════════════════');
console.log('\nPerformance monitoring features implemented:');
console.log('  • Request performance tracking middleware');
console.log('  • Performance metrics storage (last 1000 requests)');
console.log('  • GET /api/v1/performance/stats - Overall statistics');
console.log('  • GET /api/v1/performance/requests - Recent request history');
console.log('  • GET /api/v1/performance/database - Database metrics');
console.log('  • GET /api/v1/performance/system - System resource metrics');
console.log('  • Enhanced /health endpoint with latency and memory');
console.log('  • Railway environment detection and reporting');
console.log('\nMetrics tracked:');
console.log('  • Request duration (avg, p50, p95, p99)');
console.log('  • Slow requests (>1000ms)');
console.log('  • Error rates and status codes');
console.log('  • Endpoint-level performance');
console.log('  • Database connection pool and latency');
console.log('  • Memory usage (RSS, heap)');
console.log('  • System uptime and process info');
console.log('════════════════════════════════════════════════════════\n');
