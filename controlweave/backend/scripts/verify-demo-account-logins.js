#!/usr/bin/env node
/**
 * verify-demo-account-logins.js
 *
 * Verifies demo accounts can log in and checks onboarding_required from /auth/me.
 *
 * Env:
 *   DEMO_VERIFY_API_BASE=https://<host>/api/v1
 *   DEMO_VERIFY_PASSWORD=ControlWeave!2026
 */
require('dotenv').config()
const { DEMO_ADMIN_ACCOUNTS, resolveDemoAccountPassword } = require('./lib/demo-account-config')

const API_BASE = String(process.env.DEMO_VERIFY_API_BASE || 'http://localhost:3001/api/v1').replace(/\/+$/, '')
const PASSWORD = resolveDemoAccountPassword(
  { value: process.env.DEMO_VERIFY_PASSWORD, label: 'DEMO_VERIFY_PASSWORD' },
  { value: process.env.DEMO_ACCOUNT_PASSWORD, label: 'DEMO_ACCOUNT_PASSWORD' }
)

const ADMIN_ACCOUNTS = Object.freeze(
  DEMO_ADMIN_ACCOUNTS.map((account) => account.email)
)

const AUDITOR_ACCOUNTS = Object.freeze([
  'auditor@community.com',
  'auditor@pro.com',
  'auditor@enterprise.com',
  'auditor@govcloud.com'
])

async function login(email) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD })
  })

  const payload = await response.json().catch(() => ({}))
  const accessToken = payload?.data?.tokens?.accessToken

  return {
    status: response.status,
    ok: response.ok,
    accessToken,
    payload
  }
}

async function me(accessToken) {
  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: { authorization: `Bearer ${accessToken}` }
  })

  const payload = await response.json().catch(() => ({}))
  return {
    status: response.status,
    ok: response.ok,
    payload
  }
}

async function run() {
  const includeAuditors = String(process.env.DEMO_VERIFY_INCLUDE_AUDITORS || 'false').toLowerCase() === 'true'
  const accounts = includeAuditors
    ? [...ADMIN_ACCOUNTS, ...AUDITOR_ACCOUNTS]
    : ADMIN_ACCOUNTS

  console.log(`\n🔎 Verifying demo account login access against ${API_BASE}\n`)

  let failures = 0
  for (const email of accounts) {
    try {
      const loginResult = await login(email)
      if (!loginResult.ok || !loginResult.accessToken) {
        failures += 1
        console.log(`  ✗ ${email.padEnd(28)} login failed (${loginResult.status})`)
        continue
      }

      const meResult = await me(loginResult.accessToken)
      const onboardingRequired = Boolean(meResult.payload?.data?.onboarding_required)
      const tier = meResult.payload?.data?.organization?.tier || 'unknown'

      if (!meResult.ok) {
        failures += 1
        console.log(`  ✗ ${email.padEnd(28)} /auth/me failed (${meResult.status})`)
        continue
      }

      if (onboardingRequired) {
        failures += 1
        console.log(`  ✗ ${email.padEnd(28)} tier=${tier} onboarding_required=true`)
      } else {
        console.log(`  ✓ ${email.padEnd(28)} tier=${tier} onboarding_required=false`)
      }
    } catch (error) {
      failures += 1
      console.log(`  ✗ ${email.padEnd(28)} error=${error.message}`)
    }
  }

  if (failures > 0) {
    console.log(`\n❌ Demo login verification finished with ${failures} failure(s).\n`)
    process.exit(1)
  }

  console.log('\n✅ All demo accounts can log in and skip onboarding.\n')
}

run().catch((error) => {
  console.error(`\n❌ Verification failed: ${error.message}\n`)
  process.exit(1)
})
