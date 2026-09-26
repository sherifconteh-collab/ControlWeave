/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',       // requires running DB
    '!src/services/ce-mcp/**'
  ],
  coverageReporters: ['text-summary', 'lcov'],
  // babel-plugin-istanbul fails under the current test-exclude/glob versions,
  // so coverage uses V8's native instrumentation.
  coverageProvider: 'v8',
  // Ratchet: set just below the measured baseline so coverage can only go up.
  // Raise these whenever new tests lift the numbers.
  coverageThreshold: {
    global: { statements: 12, lines: 12, functions: 22, branches: 60 }
  },
  // Increase timeout for tests that use real filesystem operations
  testTimeout: 10000,
  // Transpile htmlparser2 and its dom* dependencies, which have been
  // ESM-only since sanitize-html 2.17.6, so Jest's CommonJS runtime can
  // load them (the app itself uses native require(ESM) on Node >=20.19).
  transform: { '^.+\\.js$': 'babel-jest' },
  transformIgnorePatterns: [
    '/node_modules/(?!(htmlparser2|domhandler|domutils|domelementtype|dom-serializer|entities)/)',
  ],
};
