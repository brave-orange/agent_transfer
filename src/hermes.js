const fs = require('fs');
const path = require('path');
const { getHomeDir } = require('./platform');

/**
 * Define what to migrate for Hermes Agent: name -> path mapping.
 */
const HERMES_ITEMS = [
  { name: 'config.yaml', dest: '.hermes/config.yaml', type: 'file' },
  { name: '.env', dest: '.hermes/.env', type: 'file' },
  { name: 'SOUL.md', dest: '.hermes/SOUL.md', type: 'file' },
  { name: 'MEMORY.md', dest: '.hermes/MEMORY.md', type: 'file' },
  { name: 'USER.md', dest: '.hermes/USER.md', type: 'file' },
  { name: 'sessions', dest: '.hermes/sessions', type: 'dir' },
  { name: 'memory', dest: '.hermes/memory', type: 'dir' },
  { name: 'skills', dest: '.hermes/skills', type: 'dir' },
  { name: 'workspace', dest: 'hermes/workspace', type: 'dir' },
  { name: 'logs', dest: '.hermes/logs', type: 'dir' },
  { name: 'cron', dest: '.hermes/cron', type: 'dir' },
];

/**
 * Check if Hermes is installed.
 */
function isHermesInstalled() {
  const home = getHomeDir();
  return fs.existsSync(path.join(home, '.hermes')) ||
    fs.existsSync(path.join(home, 'hermes', 'workspace'));
}

/**
 * Export Hermes config to a staging directory.
 */
function exportHermes(stagingDir) {
  const home = getHomeDir();
  const hermesDir = path.join(stagingDir, 'hermes');
  fs.mkdirSync(hermesDir, { recursive: true });

  const items = [];
  for (const item of HERMES_ITEMS) {
    const sourcePath = path.join(home, item.dest);
    if (fs.existsSync(sourcePath)) {
      const destPath = path.join(hermesDir, item.name);
      copyRecursive(sourcePath, destPath);
      items.push(item.name);
    }
  }

  if (items.length === 0) {
    throw new Error('Hermes Agent not found on this system');
  }

  return items;
}

/**
 * Import Hermes config from staging to system.
 */
function importHermes(stagingDir) {
  const hermesDir = path.join(stagingDir, 'hermes');
  if (!fs.existsSync(hermesDir)) {
    return { imported: false, reason: 'No Hermes data in migration file' };
  }

  const home = getHomeDir();
  const items = fs.readdirSync(hermesDir);
  const imported = [];

  for (const item of HERMES_ITEMS) {
    const src = path.join(hermesDir, item.name);
    if (!fs.existsSync(src)) continue;

    const destPath = path.join(home, item.dest);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    copyRecursive(src, destPath);
    imported.push(item.name);
  }

  return { imported: true, items: imported };
}

/**
 * Recursively copy a file or directory.
 */
function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

module.exports = { HERMES_ITEMS, isHermesInstalled, exportHermes, importHermes };
