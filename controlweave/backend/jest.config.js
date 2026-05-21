/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',       // requires running DB
    '!src/services/ce-mcp/**'
  ],
  coverageReporters: ['text', 'lcov'],
  // Increase timeout for tests that use real filesystem operations
  testTimeout: 10000
};
