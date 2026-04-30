const fs = require('fs');
const path = require('path');

const OPENCLAW_ITEMS = [
  { name: 'openclaw.json', dest: '.openclaw/openclaw.json', type: 'file' },
  { name: '.env', dest: '.openclaw/.env', type: 'file' },
  { name: 'sessions', dest: '.openclaw/sessions', type: 'dir' },
  { name: 'memory', dest: '.openclaw/memory', type: 'dir' },
  { name: 'skills', dest: '.openclaw/skills', type: 'dir' },
  { name: 'workspace', dest: 'openclaw/workspace', type: 'dir' },
];

function isOpenClawInstalled() {
  const home = require('./platform').getHomeDir();
  return fs.existsSync(path.join(home, '.openclaw')) ||
    fs.existsSync(path.join(home, 'openclaw', 'workspace'));
}

/**
 * Read openclaw.json and discover custom paths.
 */
function discoverPaths(home, configDir) {
  const customPaths = [];
  configDir = configDir || path.join(home, '.openclaw');
  const configPath = path.join(configDir, 'openclaw.json');

  if (!fs.existsSync(configPath)) return customPaths;

  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return customPaths;
  }

  const candidates = [
    'workspaceDir', 'workspace', 'workDir', 'projectsDir',
    'sessionsDir', 'sessions', 'memoryDir', 'memory',
    'skillsDir', 'skills', 'logsDir', 'logs',
  ];

  const seen = new Set();
  for (const key of candidates) {
    const val = config[key];
    if (typeof val === 'string' && val && !seen.has(val)) {
      const resolved = path.isAbsolute(val) ? val : path.join(home, val);
      if (fs.existsSync(resolved)) {
        seen.add(val);
        customPaths.push({ sourcePath: resolved, name: path.basename(resolved), type: 'dir', fromConfig: key });
      }
    }
  }

  return customPaths;
}

/**
 * Merge custom paths into items list, avoiding duplicates of default items.
 */
function mergeCustomPaths(items, customPaths, stagingDir) {
  const defaultNames = new Set(items.map(i => i.dest));
  const merged = [...items];

  for (const cp of customPaths) {
    const baseName = cp.name;
    const candidateDest = baseName;

    // Skip if a default item already covers this path
    let isDuplicate = false;
    for (const item of merged) {
      if (item.dest === candidateDest || item.dest === cp.sourcePath) {
        isDuplicate = true;
        break;
      }
    }
    if (isDuplicate) continue;

    merged.push({
      name: baseName,
      dest: candidateDest,
      type: 'dir',
      sourcePath: cp.sourcePath,
      fromConfig: cp.fromConfig,
    });
  }

  return merged;
}

function exportOpenClaw(stagingDir, customPath) {
  const home = customPath ? path.dirname(customPath) : require('./platform').getHomeDir();
  const openClawDir = path.join(stagingDir, 'openclaw');
  fs.mkdirSync(openClawDir, { recursive: true });

  let configDir = path.join(home, '.openclaw');
  if (customPath && fs.existsSync(customPath)) {
    configDir = customPath;
  }

  const items = [...OPENCLAW_ITEMS];

  // Discover custom paths from config file
  const discoveredPaths = discoverPaths(home, configDir);
  const mergedItems = mergeCustomPaths(items, discoveredPaths, stagingDir);

  const imported = [];
  for (const item of mergedItems) {
    let sourcePath;
    if (item.sourcePath) {
      sourcePath = item.sourcePath;
    } else if (item.type === 'file') {
      sourcePath = path.join(configDir, item.name);
    } else {
      sourcePath = path.join(home, item.dest);
    }

    if (fs.existsSync(sourcePath)) {
      const destPath = path.join(openClawDir, item.name);
      copyRecursive(sourcePath, destPath);
      imported.push(item.name);
    }
  }

  // Save custom path metadata for import
  if (discoveredPaths.length > 0) {
    const metadata = {
      sourceCustomPaths: discoveredPaths.map(cp => ({
        originalPath: cp.sourcePath,
        name: cp.name,
        fromConfig: cp.fromConfig,
      })),
      configDir,
    };
    fs.writeFileSync(
      path.join(openClawDir, '_metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
  }

  if (imported.length === 0) {
    throw new Error('OpenClaw not found on this system');
  }

  return imported;
}

function importOpenClaw(stagingDir, customPath) {
  const openClawDir = path.join(stagingDir, 'openclaw');
  if (!fs.existsSync(openClawDir)) {
    return { imported: false, reason: 'No OpenClaw data in migration file' };
  }

  const home = require('./platform').getHomeDir();
  let items = OPENCLAW_ITEMS.filter(i => i.name !== '_metadata.json');

  // Check for custom path metadata
  const metadataPath = path.join(openClawDir, '_metadata.json');
  let customPaths = [];
  if (fs.existsSync(metadataPath)) {
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      if (metadata.sourceCustomPaths) {
        customPaths = metadata.sourceCustomPaths;
      }
    } catch {
      // Ignore metadata parse errors
    }
  }

  // Merge custom paths from metadata
  const mergedItems = mergeCustomPaths(items, customPaths.map(cp => ({
    sourcePath: cp.originalPath,
    name: cp.name,
    type: 'dir',
    fromConfig: cp.fromConfig,
  })), stagingDir);

  let targetDir = home;
  if (customPath) {
    targetDir = customPath;
  }

  const imported = [];
  for (const item of mergedItems) {
    const src = path.join(openClawDir, item.name);
    if (!fs.existsSync(src)) continue;

    let destPath;
    if (item.sourcePath && customPath) {
      // If user specified custom path, put custom dirs under it
      destPath = path.join(customPath, item.name);
    } else if (item.sourcePath) {
      // Try original path, fallback to home
      destPath = item.sourcePath;
      if (!canWriteDir(path.dirname(destPath))) {
        destPath = path.join(home, item.name);
      }
    } else {
      destPath = path.join(targetDir, item.dest);
    }

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    copyRecursive(src, destPath);
    imported.push(item.name);
  }

  return { imported: true, items: imported };
}

function canWriteDir(dirPath) {
  try {
    fs.accessSync(path.dirname(dirPath), fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

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

module.exports = { OPENCLAW_ITEMS, isOpenClawInstalled, discoverPaths, mergeCustomPaths, exportOpenClaw, importOpenClaw };
