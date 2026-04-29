const os = require('os');
const path = require('path');

/**
 * Detect the current operating system platform.
 */
function getPlatform() {
  const platform = os.platform();
  switch (platform) {
    case 'win32': return 'windows';
    case 'darwin': return 'macos';
    case 'linux': return 'linux';
    default: return platform;
  }
}

/**
 * Detect the CPU architecture.
 */
function getArchitecture() {
  return os.arch();
}

/**
 * Get the home directory.
 */
function getHomeDir() {
  return os.homedir();
}

/**
 * Get temp directory.
 */
function getTempDir() {
  return os.tmpdir();
}

module.exports = { getPlatform, getArchitecture, getHomeDir, getTempDir };
