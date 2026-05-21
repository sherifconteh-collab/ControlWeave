#!/usr/bin/env node
/**
 * complete-demo-onboarding-via-api.js
 *
 * Completes onboarding for demo organizations through public API calls.
 * Useful when direct DB/Railway access is unavailable but demo admin logins work.
 */
require('dotenv').config()
const { DEMO_ADMIN_ACCOUNTS, resolveDemoAccountPassword } = require('./lib/demo-account-config')

const API_BASE = String(process.env.DEMO_VERIFY_API_BASE || 'https://controlweave-pro-production.up.railway.app/api/v1').replace(/\/+$/, '')
const PASSWORD = resolveDemoAccountPassword(
  { value: process.env.DEMO_VERIFY_PASSWORD, label: 'DEMO_VERIFY_PASSWORD' },
  { value: process.env.DEMO_ACCOUNT_PASSWORD, label: 'DEMO_ACCOUNT_PASSWORD' }
)

const ADMIN_DEMO_ACCOUNTS = Object.freeze(
  DEMO_ADMIN_ACCOUNTS.map((account) => account.email)
)

async function postJson(url, body, token = null) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  })
  const payload = await response.json().catch(() => ({}))
  return { response, payload }
}

async function putJson(url, body, token) {
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  })
  const payload = await response.json().catch(() => ({}))
  return { response, payload }
}

async function login(email) {
  const { response, payload } = await postJson(`${API_BASE}/auth/login`, {
    email,
    password: PASSWORD
  })

  return {
    ok: response.ok,
    status: response.status,
    token: payload?.data?.tokens?.accessToken,
    payload
  }
}

async function completeOnboarding(token) {
  return putJson(
    `${API_BASE}/organizations/me/profile`,
    {
      company_legal_name: 'ControlWeave Demo Organization',
      company_description: 'Demo environment for prospect evaluations.',
      system_name: 'ControlWeave Demo Platform',
      system_description: 'Demo tenant configured for sales walkthroughs.',
      confidentiality_impact: 'moderate',
      integrity_impact: 'moderate',
      availability_impact: 'moderate',
      environment_types: ['production'],
      data_sensitivity_types: ['confidential'],
      onboarding_completed: true
    },
    token
  )
}

async function run() {
  console.log(`\n🚀 Completing demo onboarding via API at ${API_BASE}\n`)

  let failures = 0
  for (const email of ADMIN_DEMO_ACCOUNTS) {
    try {
      const auth = await login(email)
      if (!auth.ok || !auth.token) {
        failures += 1
        console.log(`  ✗ ${email.padEnd(28)} login failed (${auth.status})`)
        continue
      }

      const completed = await completeOnboarding(auth.token)
      if (!completed.response.ok) {
        failures += 1
        console.log(`  ✗ ${email.padEnd(28)} onboarding update failed (${completed.response.status})`)
        continue
      }

      console.log(`  ✓ ${email.padEnd(28)} onboarding completed`)
    } catch (error) {
      failures += 1
      console.log(`  ✗ ${email.padEnd(28)} error=${error.message}`)
    }
  }

  if (failures > 0) {
    console.log(`\n❌ Completed with ${failures} failure(s).\n`)
    process.exit(1)
  }

  console.log('\n✅ Demo onboarding completed for all admin demo accounts.\n')
}

run().catch((error) => {
  console.error(`\n❌ Failed: ${error.message}\n`)
  process.exit(1)
})
