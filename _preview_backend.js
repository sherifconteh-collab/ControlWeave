/**
 * Bootstrap script to start the backend dev server from the project root.
 * Used by .claude/launch.json for preview_start.
 */
const path = require('path');
process.chdir(path.join(__dirname, 'controlweave', 'backend'));
require(path.join(process.cwd(), 'src', 'server.js'));
