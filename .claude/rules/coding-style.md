---
description: Coding style conventions for ControlWeaver
globs:
  - "**/*.js"
  - "**/*.ts"
  - "**/*.tsx"
---
# Coding Style

## Backend (JavaScript)

- **Module system**: CommonJS (`require` / `module.exports`) — no ES modules
- **Async**: Prefer `async/await` over callbacks or raw `.then()` chains; use callbacks/`.then()` only for well-justified cases (e.g., background processing, startup wiring) and document them
- **Naming**:
  - Files: camelCase for backend source (`rateLimit.js`, `aiGovernance.js`); kebab-case for backend scripts in `/scripts` (`seed-frameworks.js`, `seed-missing-controls.js`)
  - Variables/functions: camelCase (`organizationId`, `getControlById`)
  - Constants: UPPER_SNAKE_CASE (`SECURITY_CONFIG`, `DEMO_ADMIN_ACCOUNTS`)
- **Error handling**: Try-catch blocks in every route handler with proper error responses
- **No TypeScript** in backend — vanilla JavaScript only

## Frontend (TypeScript)

- **Strict mode**: TypeScript strict is enabled — no `any` types
- **Components**: Functional React components with hooks — no class components
- **File extensions**: `.tsx` for components, `.ts` for utilities
- **Naming**:
  - Components: PascalCase files (`DashboardLayout.tsx`, `ControlHealthSummary.tsx`)
  - Utilities: camelCase files (`apiClient.ts`, `dateUtils.ts`)
  - Hooks: Prefix with `use` (`useAuth`, `useDashboard`)
- **Props**: Define with named `interface`, not inline types
- **Avoid `any`**: Use `unknown` for external data and narrow safely

```typescript
// WRONG
function handleData(data: any) { ... }

// CORRECT
function handleData(data: unknown): string {
  if (data instanceof Error) return data.message;
  return 'Unknown error';
}
```

## General

- **Language**: American English only ("categorized" not "categorised")
- **File size**: Keep files under 800 lines — extract utilities from large modules
- **Function size**: Keep functions under 50 lines — use early returns to reduce nesting
- **No console.log**: Use the project logger (`const { log } = require('../utils/logger')` from routes/services, or `require('./utils/logger')` from `server.js`)
- **No emojis** in code or comments
- **Immutability**: Prefer spread operators over mutation

```javascript
// WRONG
user.name = newName;

// CORRECT
const updatedUser = { ...user, name: newName };
```
