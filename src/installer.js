const { runCmd, checkNodeJS, checkNPM, checkPython } = require('./detector');
const { getPlatform } = require('./platform');

/**
 * Installation commands for OpenClaw.
 */
function getOpenClawInstallCommand() {
  const platform = getPlatform();
  switch (platform) {
    case 'windows':
      return 'npm install -g openclaw';
    case 'macos':
    case 'linux':
      return 'npm install -g openclaw';
    default:
      return 'npm install -g openclaw';
  }
}

/**
 * Installation commands for Hermes Agent.
 */
function getHermesInstallCommand() {
  return {
    npm: 'npm install -g hermes-agent',
    pip: 'pip install hermes-agent',
    clone: 'git clone https://github.com/NousResearch/hermes-agent.git && cd hermes-agent && npm install',
  };
}

/**
 * Check prerequisites before installation.
 */
function checkPrerequisites() {
  const node = checkNodeJS();
  const npm = checkNPM();
  const python = checkPython();

  return {
    node,
    npm,
    python,
    canInstallOpenClaw: node.installed && npm.installed,
    canInstallHermes: node.installed && npm.installed,
  };
}

/**
 * Install OpenClaw framework.
 */
function installOpenClaw() {
  const cmd = getOpenClawInstallCommand();
  console.log(`Installing OpenClaw: ${cmd}`);
  const result = runCmd(cmd, { timeout: 300000 });
  if (!result.success) {
    throw new Error(`OpenClaw installation failed: ${result.error}`);
  }
  return result;
}

/**
 * Install Hermes Agent framework.
 */
function installHermes() {
  const platform = getPlatform();

  // Try npm first
  if (platform === 'windows' || platform === 'macos' || platform === 'linux') {
    const npmCmd = getHermesInstallCommand().npm;
    console.log(`Installing Hermes Agent: ${npmCmd}`);
    const result = runCmd(npmCmd, { timeout: 300000 });
    if (result.success) return result;

    // Try git clone as fallback
    console.log('npm install failed, trying git clone...');
    const gitCmd = getHermesInstallCommand().clone;
    const gitResult = runCmd(gitCmd, { timeout: 300000 });
    if (gitResult.success) return gitResult;

    throw new Error(`Hermes Agent installation failed: ${result.error}`);
  }

  throw new Error(`Unsupported platform for Hermes Agent: ${platform}`);
}

/**
 * Verify installation was successful.
 */
function verifyInstallation(framework) {
  if (framework === 'openclaw') {
    const result = runCmd('openclaw --version');
    return { installed: result.success, output: result.output };
  }
  if (framework === 'hermes') {
    const result = runCmd('hermes --version');
    return { installed: result.success, output: result.output };
  }
  return { installed: false };
}

module.exports = { checkPrerequisites, installOpenClaw, installHermes, verifyInstallation };
