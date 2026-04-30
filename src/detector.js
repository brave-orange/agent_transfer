const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getPlatform, getHomeDir } = require('./platform');

function commandExists(cmd) {
  try {
    const platform = getPlatform();
    const checkCmd = platform === 'windows'
      ? `where ${cmd} 2>nul`
      : `which ${cmd} 2>/dev/null`;
    execSync(checkCmd, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function runCmd(cmd, options = {}) {
  try {
    const output = execSync(cmd, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: options.timeout || 60000,
      ...options,
    });
    return { success: true, output: output.toString().trim(), error: null };
  } catch (err) {
    return { success: false, output: err.stdout?.toString().trim() || '', error: err.stderr?.toString().trim() || err.message };
  }
}

function checkNodeJS() {
  const result = runCmd('node --version');
  if (!result.success) return { installed: false, version: null };
  return { installed: true, version: result.output };
}

function checkNPM() {
  const result = runCmd('npm --version');
  if (!result.success) return { installed: false, version: null };
  return { installed: true, version: result.output };
}

function checkPython() {
  const pythonResult = runCmd('python --version');
  if (pythonResult.success) return { installed: true, version: pythonResult.output, command: 'python' };

  const python3Result = runCmd('python3 --version');
  if (python3Result.success) return { installed: true, version: python3Result.output, command: 'python3' };

  return { installed: false, version: null, command: null };
}

function detectFrameworks(overrides) {
  const home = getHomeDir();
  const result = {
    openclaw: { installed: false, path: null, version: null, configDir: null },
    hermes: { installed: false, path: null, version: null, configDir: null },
  };

  // --- OpenClaw Detection ---
  if (overrides?.openclaw?.path) {
    const r = detectFromPath('openclaw', overrides.openclaw.path);
    Object.assign(result.openclaw, r);
  } else {
    if (commandExists('openclaw')) {
      result.openclaw.installed = true;
      result.openclaw.path = runCmd('openclaw --version').output || null;
    }

    const openclawConfigDir = path.join(home, '.openclaw');
    if (fs.existsSync(openclawConfigDir)) {
      result.openclaw.installed = true;
      result.openclaw.configDir = openclawConfigDir;
    }

    const openclawWorkspace = path.join(home, 'openclaw', 'workspace');
    if (fs.existsSync(openclawWorkspace)) {
      result.openclaw.installed = true;
    }
  }

  // --- Hermes Agent Detection ---
  if (overrides?.hermes?.path) {
    const r = detectFromPath('hermes', overrides.hermes.path);
    Object.assign(result.hermes, r);
  } else {
    if (commandExists('hermes')) {
      result.hermes.installed = true;
      result.hermes.path = runCmd('hermes --version').output || null;
    }

    const hermesConfigDir = path.join(home, '.hermes');
    if (fs.existsSync(hermesConfigDir)) {
      result.hermes.installed = true;
      result.hermes.configDir = hermesConfigDir;
    }

    const hermesWorkspace = path.join(home, 'hermes', 'workspace');
    if (fs.existsSync(hermesWorkspace)) {
      result.hermes.installed = true;
    }
  }

  return result;
}

/**
 * Detect framework from a user-specified path.
 */
function detectFromPath(framework, customPath) {
  if (!customPath || !fs.existsSync(customPath)) {
    return { installed: false, path: null, version: null, configDir: null };
  }

  const stat = fs.statSync(customPath);
  if (!stat.isDirectory()) return { installed: false, path: null, version: null, configDir: null };

  const result = { installed: false, path: null, version: null, configDir: customPath };

  if (framework === 'openclaw') {
    // Check for OpenClaw markers
    const markers = ['openclaw.json', '.env', 'sessions', 'memory', 'skills'];
    for (const marker of markers) {
      if (fs.existsSync(path.join(customPath, marker))) {
        result.installed = true;
        break;
      }
    }
    // Also check if the path itself is a workspace dir
    if (path.basename(customPath).toLowerCase() === 'workspace') {
      const parentConfig = path.join(path.dirname(customPath), '.openclaw', 'openclaw.json');
      if (fs.existsSync(parentConfig)) {
        result.installed = true;
        result.configDir = path.dirname(customPath);
      }
    }
  } else if (framework === 'hermes') {
    const markers = ['config.yaml', '.env', 'SOUL.md', 'MEMORY.md', 'USER.md', 'sessions', 'memory'];
    for (const marker of markers) {
      if (fs.existsSync(path.join(customPath, marker))) {
        result.installed = true;
        break;
      }
    }
    if (path.basename(customPath).toLowerCase() === 'workspace') {
      const parentConfig = path.join(path.dirname(customPath), '.hermes', 'config.yaml');
      if (fs.existsSync(parentConfig)) {
        result.installed = true;
        result.configDir = path.dirname(customPath);
      }
    }
  }

  result.path = customPath;
  return result;
}

/**
 * Validate if a given path looks like a framework installation.
 */
function isValidFrameworkPath(framework, customPath) {
  if (!customPath || !fs.existsSync(customPath)) return false;

  const stat = fs.statSync(customPath);
  if (!stat.isDirectory()) return false;

  if (framework === 'openclaw') {
    return fs.existsSync(path.join(customPath, 'openclaw.json')) ||
      fs.existsSync(path.join(customPath, '.env'));
  }

  if (framework === 'hermes') {
    return fs.existsSync(path.join(customPath, 'config.yaml')) ||
      fs.existsSync(path.join(customPath, '.env'));
  }

  return false;
}

function validateSystem() {
  const platform = getPlatform();
  const nodeCheck = checkNodeJS();
  const npmCheck = checkNPM();
  const pythonCheck = checkPython();
  const frameworks = detectFrameworks();

  return {
    platform,
    architecture: require('./platform').getArchitecture(),
    home: getHomeDir(),
    node: nodeCheck,
    npm: npmCheck,
    python: pythonCheck,
    frameworks,
  };
}

module.exports = { commandExists, runCmd, checkNodeJS, checkNPM, checkPython, detectFrameworks, detectFromPath, isValidFrameworkPath, validateSystem };
