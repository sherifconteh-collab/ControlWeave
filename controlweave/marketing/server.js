'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3002;
const SERVE_LEGACY_MARKETING = /^(1|true|yes)$/i.test(String(process.env.SERVE_LEGACY_MARKETING || ''));

// The Railway URL of the ControlWeave frontend (e.g. https://controlweave.up.railway.app)
// APP_URL is set once at deploy time in Railway and never changes at runtime.
const APP_URL = (process.env.APP_URL || process.env.PUBLIC_APP_URL || 'https://www.controlweave.com').replace(/\/$/, '');

// Read and prepare the marketing HTML at startup, injecting APP_URL so the
// client-side JS can build correct login/register links.
let servedHtml;
try {
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  const raw = fs.readFileSync(htmlPath, 'utf8');
  const script = `<script>window.CONTROLWEAVE_APP_URL=${JSON.stringify(APP_URL)};</script>`;
  // Inject before the closing </head> tag (HTML has exactly one)
  servedHtml = raw.includes('</head>')
    ? raw.replace('</head>', `${script}\n</head>`)
    : raw + script;
} catch (err) {
  console.error('Failed to read public/index.html:', err.message);
  process.exit(1);
}

// Serve static files (css, images, etc.) from public/ — index.html handled below
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

if (SERVE_LEGACY_MARKETING) {
  // Local debugging mode for the legacy static site.
  app.get('*', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(servedHtml);
  });
} else {
  // Default to the current hosted frontend so stale static marketing copy is not served in production.
  app.get('*', (req, res) => {
    res.redirect(302, `${APP_URL}${req.originalUrl || '/'}`);
  });
}

app.listen(PORT, () => {
  const mode = SERVE_LEGACY_MARKETING ? 'legacy-static' : 'redirect';
  console.log(`ControlWeave marketing site running on port ${PORT} (mode=${mode}, APP_URL=${APP_URL || '(not set)'})`);
});
