/**
 * Bootstrap script to start the Next.js frontend from the project root.
 * Used by .claude/launch.json for preview_start.
 */
const { spawn } = require('child_process');
const path = require('path');

const frontendDir = path.join(__dirname, 'controlweave', 'frontend');
const proc = spawn('npm', ['run', 'dev'], {
  cwd: frontendDir,
  stdio: 'inherit',
  env: process.env,
  shell: true,
});
proc.on('exit', code => process.exit(code ?? 0));
