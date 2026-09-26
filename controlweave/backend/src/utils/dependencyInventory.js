'use strict';

/**
 * Pure helpers that read what ControlWeave depends on from package files,
 * lockfiles and Dockerfiles. Shared by scripts/generate-dependency-manifest.js
 * (build time) and services/dependencyTracker.js (runtime).
 */

const fs = require('fs');

/** name -> sorted list of every resolved version in an npm v2/v3 lockfile. */
function lockPackages(lock) {
  const packages = {};
  for (const [key, meta] of Object.entries((lock && lock.packages) || {})) {
    if (!key || !meta || !meta.version || meta.link) continue;
    const name = key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length);
    const list = packages[name] || [];
    if (!list.includes(meta.version)) packages[name] = [...list, meta.version].sort();
  }
  return packages;
}

/** Direct dependencies with the declared range and the installed version. */
function directDependencies(pkg, lock) {
  const ranges = { ...((pkg && pkg.dependencies) || {}), ...((pkg && pkg.devDependencies) || {}) };
  return Object.keys(ranges).sort().map((name) => ({
    name,
    range: ranges[name],
    installed: ((lock && lock.packages && lock.packages[`node_modules/${name}`]) || {}).version || null,
    dev: Boolean(pkg.devDependencies && pkg.devDependencies[name])
  }));
}

/** External base images named in a Dockerfile (stage aliases excluded). */
function baseImages(dockerfile) {
  if (!fs.existsSync(dockerfile)) return [];
  const aliases = new Set();
  return fs.readFileSync(dockerfile, 'utf8').split('\n').flatMap((line) => {
    const match = /^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?/i.exec(line);
    if (!match) return [];
    if (match[2]) aliases.add(match[2].toLowerCase());
    return aliases.has(match[1].toLowerCase()) ? [] : [match[1]];
  });
}

module.exports = { lockPackages, directDependencies, baseImages };
