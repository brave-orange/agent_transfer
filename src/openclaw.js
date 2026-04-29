const fs = require('fs');
const path = require('path');
const { getHomeDir } = require('./platform');

/**
 * Define what to migrate for OpenClaw: name -> path mapping.
 * Using stable names (not key names) for archive compatibility.
 */
const OPENCLAW_ITEMS = [
  { name: 'openclaw.json', dest: '.openclaw/openclaw.json', type: 'file' },
  { name: '.env', dest: '.openclaw/.env', type: 'file' },
  { name: 'sessions', dest: '.openclaw/sessions', type: 'dir' },
  { name: 'memory', dest: '.openclaw/memory', type: 'dir' },
  { name: 'skills', dest: '.openclaw/skills', type: 'dir' },
  { name: 'workspace', dest: 'openclaw/workspace', type: 'dir' },
];

/**
 * Check if OpenClaw is installed.
 */
function isOpenClawInstalled() {
  const home = getHomeDir();
  return fs.existsSync(path.join(home, '.openclaw')) ||
    fs.existsSync(path.join(home, 'openclaw', 'workspace'));
}

/**
 * Export OpenClaw config to a staging directory.
 */
function exportOpenClaw(stagingDir) {
  const home = getHomeDir();
  const openClawDir = path.join(stagingDir, 'openclaw');
  fs.mkdirSync(openClawDir, { recursive: true });

  const items = [];
  for (const item of OPENCLAW_ITEMS) {
    const sourcePath = path.join(home, item.dest);
    if (fs.existsSync(sourcePath)) {
      const destPath = path.join(openClawDir, item.name);
      copyRecursive(sourcePath, destPath);
      items.push(item.name);
    }
  }

  if (items.length === 0) {
    throw new Error('OpenClaw not found on this system');
  }

  return items;
}

/**
 * Import OpenClaw config from staging to system.
 */
function importOpenClaw(stagingDir) {
  const openClawDir = path.join(stagingDir, 'openclaw');
  if (!fs.existsSync(openClawDir)) {
    return { imported: false, reason: 'No OpenClaw data in migration file' };
  }

  const home = getHomeDir();
  const items = fs.readdirSync(openClawDir);
  const imported = [];

  for (const item of OPENCLAW_ITEMS) {
    const src = path.join(openClawDir, item.name);
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

module.exports = { OPENCLAW_ITEMS, isOpenClawInstalled, exportOpenClaw, importOpenClaw };
