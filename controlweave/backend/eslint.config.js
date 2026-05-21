// @tier: community
'use strict';

const security = require('eslint-plugin-security');

module.exports = [
  // Global ignores — must be a standalone object with no other properties
  { ignores: ['node_modules/', 'uploads/'] },

  // Security rules only — eslint:recommended is intentionally omitted so
  // this config doesn't fail CI on pre-existing style issues. Run
  // `npm run lint` at any time to surface security findings.
  security.configs.recommended,
  {
    plugins: { security },
    languageOptions: {
      ecmaVersion: 2021,
      globals: {
        // CommonJS
        require: 'readonly',
        module: 'writable',
        exports: 'writable',
        __dirname: 'readonly',
        __filename: 'readonly',
        // Node.js
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        // Node.js 20.16+ globals (per engines field: >=20.16.0)
        fetch: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly'
      }
    },
    rules: {
      // Hard errors: these patterns are always security vulnerabilities
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      // Security plugin overrides — keep all as warnings so developers can
      // see findings without blocking the build on false positives
      'security/detect-eval-with-expression': 'error',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-require': 'warn',
      'security/detect-object-injection': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-unsafe-regex': 'warn',
      // Allow console for backend server logging
      'no-console': 'off'
    }
  }
];
