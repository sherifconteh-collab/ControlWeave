#!/usr/bin/env node
require('dotenv').config()
const { DEMO_ADMIN_ACCOUNTS, resolveDemoAccountPassword } = require('./lib/demo-account-config')

const API_BASE = String(process.env.DEMO_VERIFY_API_BASE || 'https://controlweave-pro-production.up.railway.app/api/v1').replace(/\/+$/, '')
const PASSWORD = resolveDemoAccountPassword(
  { value: process.env.DEMO_VERIFY_PASSWORD, label: 'DEMO_VERIFY_PASSWORD' },
  { value: process.env.DEMO_ACCOUNT_PASSWORD, label: 'DEMO_ACCOUNT_PASSWORD' }
)
const DEFAULT_BOOTSTRAP_EMAIL = DEMO_ADMIN_ACCOUNTS.find((account) => account.tier === 'community')?.email
  || DEMO_ADMIN_ACCOUNTS[0]?.email
  || 'admin@community.com'
const DEFAULT_TARGET_EMAIL = DEMO_ADMIN_ACCOUNTS.find((account) => account.tier === 'govcloud')?.email
  || DEMO_ADMIN_ACCOUNTS[0]?.email
  || 'admin@govcloud.com'
const BOOTSTRAP_EMAIL = String(process.env.DEMO_BOOTSTRAP_ADMIN_EMAIL || DEFAULT_BOOTSTRAP_EMAIL).trim().toLowerCase()
const TARGET_EMAIL = String(process.env.DEMO_TARGET_ADMIN_EMAIL || DEFAULT_TARGET_EMAIL).trim().toLowerCase()

async function login(email, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  const payload = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, payload }
}

async function api(token, method, path, body = null) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  const payload = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, payload }
}

async function run() {
  console.log(`\n🔧 Repairing demo account ${TARGET_EMAIL} via API: ${API_BASE}\n`)

  const bootstrap = await login(BOOTSTRAP_EMAIL, PASSWORD)
  if (!bootstrap.ok) {
    throw new Error(`Bootstrap login failed for ${BOOTSTRAP_EMAIL} (${bootstrap.status})`)
  }

  const token = bootstrap.payload?.data?.tokens?.accessToken
  if (!token) {
    throw new Error('Bootstrap token missing')
  }

  const list = await api(token, 'GET', '/users')
  if (!list.ok || !Array.isArray(list.payload?.data)) {
    throw new Error(`Failed to list users (${list.status})`)
  }

  const existing = list.payload.data.find((user) => String(user.email || '').toLowerCase() === TARGET_EMAIL)

  if (!existing) {
    const create = await api(token, 'POST', '/users', {
      email: TARGET_EMAIL,
      password: PASSWORD,
      full_name: 'Demo Account',
      role: 'admin'
    })
    if (!create.ok) {
      throw new Error(`Failed to create ${TARGET_EMAIL} (${create.status})`)
    }
    console.log(`  ✓ Created ${TARGET_EMAIL}`)
  } else {
    const patch = await api(token, 'PATCH', `/users/${existing.id}`, {
      full_name: existing.full_name || 'Uma Utilities',
      role: 'admin',
      is_active: true
    })
    if (!patch.ok) {
      throw new Error(`Failed to patch ${TARGET_EMAIL} (${patch.status})`)
    }
    console.log(`  ✓ Updated ${TARGET_EMAIL} (active admin)`)
  }

  const verify = await login(TARGET_EMAIL, PASSWORD)
  if (!verify.ok) {
    throw new Error(`Post-repair login still failing (${verify.status})`)
  }

  console.log(`  ✓ Verified login for ${TARGET_EMAIL}`)
  console.log('\n✅ Utilities demo account repaired.\n')
}

run().catch((error) => {
  console.error(`\n❌ Repair failed: ${error.message}\n`)
  process.exit(1)
})
