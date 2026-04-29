/**
 * Build script for agent-migrate.
 * Creates portable packages for different platforms.
 *
 * Usage:
 *   node scripts/build.js            # Build for current platform
 *   node scripts/build.js all        # Build for all platforms
 *   node scripts/build.js portable   # Create portable package (no pkg)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PKG_NAME = 'agent-migrate';
const VERSION = '1.0.0';

function run(cmd, options = {}) {
  console.log(`> ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...options });
    return true;
  } catch {
    return false;
  }
}

/**
 * Build portable package - a self-contained zip with launcher scripts.
 */
function buildPortable(platform) {
  const plat = platform || getPlatform();
  const buildDir = path.join(DIST, `${PKG_NAME}-${VERSION}-${plat}`);

  // Clean and create
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true, force: true });
  }
  fs.mkdirSync(buildDir, { recursive: true });

  // Copy source files
  const srcDir = path.join(buildDir, 'src');
  fs.mkdirSync(srcDir, { recursive: true });

  const srcFiles = fs.readdirSync(path.join(ROOT, 'src'));
  for (const file of srcFiles) {
    const srcPath = path.join(ROOT, 'src', file);
    const destPath = path.join(srcDir, file);
    if (fs.statSync(srcPath).isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  // Copy package.json
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(buildDir, 'package.json'));

  // Install production dependencies
  run('npm install --production', { cwd: buildDir });

  // Create launcher scripts
  const platInfo = getPlatformInfo(plat);

  if (plat === 'windows') {
    fs.writeFileSync(path.join(buildDir, 'agent-migrate.bat'),
      `@echo off\r\nnode "%~dp0src\\index.js" %*\r\n`);
    fs.writeFileSync(path.join(buildDir, 'README.txt'),
      'Agent Migrate v' + VERSION + '\n\n' +
      'Usage: agent-migrate.bat <command> [options]\n\n' +
      'Commands:\n' +
      '  status    Show system status\n' +
      '  export    Export agent configurations\n' +
      '  import    Import agent configurations\n\n' +
      'Requires: Node.js installed on your system.\n' +
      'Download: https://nodejs.org/\n');
  } else {
    const launcher = path.join(buildDir, 'agent-migrate');
    fs.writeFileSync(launcher, '#!/bin/bash\nSCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"\nnode "$SCRIPT_DIR/src/index.js" "$@"\n');
    fs.chmodSync(launcher, '755');
    fs.writeFileSync(path.join(buildDir, 'README.txt'),
      'Agent Migrate v' + VERSION + '\n\n' +
      'Usage: ./agent-migrate <command> [options]\n\n' +
      'Commands:\n' +
      '  status    Show system status\n' +
      '  export    Export agent configurations\n' +
      '  import    Import agent configurations\n\n' +
      'Requires: Node.js installed on your system.\n' +
      'Download: https://nodejs.org/\n');
  }

  console.log(`\nPortable package created: ${buildDir}`);
  return buildDir;
}

/**
 * Get platform info.
 */
function getPlatform() {
  const p = require('os').platform();
  if (p === 'win32') return 'windows';
  if (p === 'darwin') return 'macos';
  return 'linux';
}

function getPlatformInfo(plat) {
  const info = {
    windows: { ext: '.bat', node: 'node.exe' },
    macos: { ext: '', node: 'node' },
    linux: { ext: '', node: 'node' },
  };
  return info[plat] || info.linux;
}

// --- Main ---
const args = process.argv.slice(2);
const mode = args[0] || 'portable';

if (mode === 'all') {
  buildPortable('windows');
  buildPortable('macos');
  buildPortable('linux');
} else if (mode === 'portable') {
  buildPortable();
} else {
  buildPortable(mode);
}
