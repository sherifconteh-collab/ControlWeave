#!/usr/bin/env node
'use strict';

require('dotenv').config();

const { clearSession, getSessionFilePath } = require('./mcp-auth-session');

function main() {
  const sessionFile = getSessionFilePath(process.env);
  const deleted = clearSession(sessionFile);

  if (deleted) {
    console.log(`[mcp-logout] Cleared MCP session: ${sessionFile}`);
  } else {
    console.log(`[mcp-logout] No MCP session found at: ${sessionFile}`);
  }
}

main();
