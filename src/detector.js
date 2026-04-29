const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getPlatform, getHomeDir } = require('./platform');

/**
 * Check if a command exists on the system.
 */
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

/**
 * Run a command and return output.
 */
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

/**
 * Check if Node.js is installed and get version.
 */
function checkNodeJS() {
  const result = runCmd('node --version');
  if (!result.success) return { installed: false, version: null };
  return { installed: true, version: result.output };
}

/**
 * Check if npm is installed.
 */
function checkNPM() {
  const result = runCmd('npm --version');
  if (!result.success) return { installed: false, version: null };
  return { installed: true, version: result.output };
}

/**
 * Check if Python is installed (needed for some agent setups).
 */
function checkPython() {
  const pythonResult = runCmd('python --version');
  if (pythonResult.success) return { installed: true, version: pythonResult.output, command: 'python' };

  const python3Result = runCmd('python3 --version');
  if (python3Result.success) return { installed: true, version: python3Result.output, command: 'python3' };

  return { installed: false, version: null, command: null };
}

/**
 * Detect installed frameworks and their status.
 */
function detectFrameworks() {
  const home = getHomeDir();
  const platform = getPlatform();
  const result = { openclaw: { installed: false, path: null, version: null, configDir: null }, hermes: { installed: false, path: null, version: null, configDir: null } };

  // --- OpenClaw Detection ---
  // Method 1: Check CLI command
  if (commandExists('openclaw')) {
    result.openclaw.installed = true;
    result.openclaw.path = runCmd('openclaw --version').output || null;
  }

  // Method 2: Check config directory
  const openclawConfigDir = path.join(home, '.openclaw');
  if (fs.existsSync(openclawConfigDir)) {
    result.openclaw.installed = true;
    result.openclaw.configDir = openclawConfigDir;
  }

  // Method 3: Check workspace
  const openclawWorkspace = path.join(home, 'openclaw', 'workspace');
  if (fs.existsSync(openclawWorkspace)) {
    result.openclaw.installed = true;
  }

  // --- Hermes Agent Detection ---
  // Method 1: Check CLI command
  if (commandExists('hermes')) {
    result.hermes.installed = true;
    result.hermes.path = runCmd('hermes --version').output || null;
  }

  // Method 2: Check config directory
  const hermesConfigDir = path.join(home, '.hermes');
  if (fs.existsSync(hermesConfigDir)) {
    result.hermes.installed = true;
    result.hermes.configDir = hermesConfigDir;
  }

  // Method 3: Check workspace
  const hermesWorkspace = path.join(home, 'hermes', 'workspace');
  if (fs.existsSync(hermesWorkspace)) {
    result.hermes.installed = true;
  }

  return result;
}

/**
 * Validate system readiness for agent operation.
 */
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

module.exports = { commandExists, runCmd, checkNodeJS, checkNPM, checkPython, detectFrameworks, validateSystem };
