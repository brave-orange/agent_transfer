const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

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

function isHermesInstalled() {
  const home = require('./platform').getHomeDir();
  return fs.existsSync(path.join(home, '.hermes')) ||
    fs.existsSync(path.join(home, 'hermes', 'workspace'));
}

/**
 * Read config.yaml and discover custom paths.
 */
function discoverPaths(home, configDir) {
  const customPaths = [];
  configDir = configDir || path.join(home, '.hermes');
  const configPath = path.join(configDir, 'config.yaml');

  if (!fs.existsSync(configPath)) return customPaths;

  let config;
  try {
    config = yaml.load(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return customPaths;
  }

  if (!config || typeof config !== 'object') return customPaths;

  const candidates = [
    'workspace_dir', 'workspace', 'work_dir', 'projects_dir',
    'sessions_dir', 'sessions', 'memory_dir', 'memory',
    'skills_dir', 'skills', 'logs_dir', 'logs',
    'workspaceDir', 'workspaceDir', 'workDir', 'projectsDir',
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

  // Also check nested config objects
  for (const sectionKey of ['agent', 'paths', 'directories', 'storage']) {
    const section = config[sectionKey];
    if (section && typeof section === 'object') {
      for (const key of Object.keys(section)) {
        const val = section[key];
        if (typeof val === 'string' && val && !seen.has(val)) {
          const resolved = path.isAbsolute(val) ? val : path.join(home, val);
          if (fs.existsSync(resolved)) {
            seen.add(val);
            customPaths.push({ sourcePath: resolved, name: path.basename(resolved), type: 'dir', fromConfig: `${sectionKey}.${key}` });
          }
        }
      }
    }
  }

  return customPaths;
}

function mergeCustomPaths(items, customPaths, stagingDir) {
  const merged = [...items];

  for (const cp of customPaths) {
    let isDuplicate = false;
    for (const item of merged) {
      if (item.dest === cp.name || item.dest === cp.sourcePath) {
        isDuplicate = true;
        break;
      }
    }
    if (isDuplicate) continue;

    merged.push({
      name: cp.name,
      dest: cp.name,
      type: 'dir',
      sourcePath: cp.sourcePath,
      fromConfig: cp.fromConfig,
    });
  }

  return merged;
}

function exportHermes(stagingDir, customPath) {
  const home = customPath ? path.dirname(customPath) : require('./platform').getHomeDir();
  const hermesDir = path.join(stagingDir, 'hermes');
  fs.mkdirSync(hermesDir, { recursive: true });

  let configDir = path.join(home, '.hermes');
  if (customPath && fs.existsSync(customPath)) {
    configDir = customPath;
  }

  const items = [...HERMES_ITEMS];
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
      const destPath = path.join(hermesDir, item.name);
      copyRecursive(sourcePath, destPath);
      imported.push(item.name);
    }
  }

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
      path.join(hermesDir, '_metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
  }

  if (imported.length === 0) {
    throw new Error('Hermes Agent not found on this system');
  }

  return imported;
}

function importHermes(stagingDir, customPath) {
  const hermesDir = path.join(stagingDir, 'hermes');
  if (!fs.existsSync(hermesDir)) {
    return { imported: false, reason: 'No Hermes data in migration file' };
  }

  const home = require('./platform').getHomeDir();
  let items = HERMES_ITEMS.filter(i => i.name !== '_metadata.json');

  const metadataPath = path.join(hermesDir, '_metadata.json');
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
    const src = path.join(hermesDir, item.name);
    if (!fs.existsSync(src)) continue;

    let destPath;
    if (item.sourcePath && customPath) {
      destPath = path.join(customPath, item.name);
    } else if (item.sourcePath) {
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

module.exports = { HERMES_ITEMS, isHermesInstalled, discoverPaths, mergeCustomPaths, exportHermes, importHermes };
