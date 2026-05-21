#!/usr/bin/env node
'use strict';

require('dotenv').config();

const { Writable } = require('node:stream');
const readline = require('node:readline');
const {
  getSessionFilePath,
  loginWithPassword,
  normalizeApiBaseUrl,
  writeSession
} = require('./mcp-auth-session');

function parseArgValue(flag) {
  const index = process.argv.findIndex((arg) => arg === flag || arg.startsWith(`${flag}=`));
  if (index < 0) return null;

  const direct = process.argv[index];
  if (direct.includes('=')) {
    return direct.split('=').slice(1).join('=').trim();
  }

  const next = process.argv[index + 1];
  return next ? String(next).trim() : null;
}

function ask(rl, prompt, { hidden = false } = {}) {
  return new Promise((resolve) => {
    if (hidden) {
      rl.output.muted = true;
    }
    rl.question(prompt, (answer) => {
      if (hidden) {
        rl.output.muted = false;
        process.stdout.write('\n');
      }
      resolve(String(answer || '').trim());
    });
  });
}

async function main() {
  const apiBaseUrl = normalizeApiBaseUrl(process.env.GRC_API_BASE_URL || 'http://localhost:3001/api/v1');
  const sessionFile = getSessionFilePath(process.env);

  const mutableStdout = new Writable({
    write(chunk, encoding, callback) {
      if (!this.muted) {
        process.stdout.write(chunk, encoding);
      }
      callback();
    }
  });
  mutableStdout.muted = false;

  const rl = readline.createInterface({
    input: process.stdin,
    output: mutableStdout,
    terminal: true
  });

  rl.output = mutableStdout;

  try {
    const argEmail = parseArgValue('--email');
    const email = (argEmail || process.env.MCP_LOGIN_EMAIL || await ask(rl, 'ControlWeave email: ')).toLowerCase();
    const password = process.env.MCP_LOGIN_PASSWORD || await ask(rl, 'Password: ', { hidden: true });

    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    console.log(`[mcp-login] Authenticating against ${apiBaseUrl} ...`);
    const session = await loginWithPassword({ apiBaseUrl, email, password });
    const savedPath = writeSession(sessionFile, session);

    console.log('[mcp-login] Login successful. MCP session saved.');
    console.log(`[mcp-login] User: ${session.email}`);
    console.log(`[mcp-login] Organization: ${session.organizationName || session.organizationId || 'unknown'}`);
    console.log(`[mcp-login] Session file: ${savedPath}`);
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(`[mcp-login] FAILED: ${error.message}`);
  process.exit(1);
});
