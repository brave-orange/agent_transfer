const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const nodeCmd = process.argv[0] || 'node';
const toolPath = path.join(__dirname, '..', 'src', 'index.js');
const testDir = path.join(__dirname, 'test-temp');

function cleanup(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
cleanup(testDir);
fs.mkdirSync(testDir, { recursive: true });

const homeDir = process.env.HOME || process.env.USERPROFILE;

// Mock OpenClaw
const openclawDir = path.join(homeDir, '.openclaw');
fs.mkdirSync(openclawDir, { recursive: true });
const originalOpenClawConfig = JSON.stringify({
  agents: [{ name: 'test-agent', model: 'claude-sonnet-4-6-20250514' }],
  gateway: { port: 3000 },
}, null, 2);
fs.writeFileSync(path.join(openclawDir, 'openclaw.json'), originalOpenClawConfig);
fs.writeFileSync(path.join(openclawDir, '.env'), 'OPENCLAW_API_KEY=test-key-123\n');
fs.mkdirSync(path.join(openclawDir, 'sessions'), { recursive: true });
fs.writeFileSync(path.join(openclawDir, 'sessions', 'session-001.json'), JSON.stringify({ id: '001', messages: 42 }));
fs.mkdirSync(path.join(openclawDir, 'memory'), { recursive: true });
fs.writeFileSync(path.join(openclawDir, 'memory', 'MEMORY.md'), '# Memory\n- Test memory entry');

// Mock Hermes
const hermesDir = path.join(homeDir, '.hermes');
fs.mkdirSync(hermesDir, { recursive: true });
fs.writeFileSync(path.join(hermesDir, 'config.yaml'), 'model: claude-sonnet-4-6-20250514\n');
fs.writeFileSync(path.join(hermesDir, '.env'), 'HERMES_API_KEY=test-key-456\n');
fs.writeFileSync(path.join(hermesDir, 'SOUL.md'), '# Hermes Agent Identity\nTest agent.');
fs.writeFileSync(path.join(hermesDir, 'MEMORY.md'), '# Memory\n- Test hermes memory');
fs.mkdirSync(path.join(hermesDir, 'skills'), { recursive: true });
fs.writeFileSync(path.join(hermesDir, 'skills', 'coding.md'), '# Coding Skill\nAdvanced coding.');
fs.mkdirSync(path.join(homeDir, 'hermes', 'workspace'), { recursive: true });
fs.writeFileSync(path.join(homeDir, 'hermes', 'workspace', 'notes.txt'), 'Workspace notes');

console.log('Mock data created.\n');

async function runTests() {
  let exitCode = 0;

  // Test 1: Status
  console.log('=== Test 1: Status ===');
  try {
    const output = execSync(`"${nodeCmd}" "${toolPath}" status`, { encoding: 'utf-8' });
    if (output.includes('OpenClaw') && output.includes('Hermes Agent')) {
      console.log('PASS: Status shows both frameworks\n');
    } else {
      console.log('FAIL: Status missing frameworks\n');
      exitCode = 1;
    }
  } catch (err) {
    console.log(`FAIL: ${err.message}\n`);
    exitCode = 1;
  }

  // Test 2: Export
  console.log('=== Test 2: Export ===');
  const migrationFile = path.join(testDir, 'test-migration.agent-mig');
  try {
    const output = execSync(`"${nodeCmd}" "${toolPath}" export --all --output "${migrationFile}"`, { encoding: 'utf-8' });
    console.log(output);
    if (fs.existsSync(migrationFile)) {
      const size = fs.statSync(migrationFile).size;
      console.log(`PASS: Migration file created (${size} bytes)\n`);
    } else {
      console.log('FAIL: Migration file not created\n');
      exitCode = 1;
    }
  } catch (err) {
    console.log(`FAIL: ${err.message}\n`);
    exitCode = 1;
  }

  // Test 3: Archive contents verification
  console.log('=== Test 3: Archive Verification ===');
  if (fs.existsSync(migrationFile)) {
    const extractTestDir = path.join(testDir, 'extract-test');
    fs.mkdirSync(extractTestDir, { recursive: true });

    const extract = require('extract-zip');
    await extract(migrationFile, { dir: extractTestDir });

    const manifestPath = path.join(extractTestDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

      const hasOpenClaw = fs.existsSync(path.join(extractTestDir, 'openclaw'));
      const hasHermes = fs.existsSync(path.join(extractTestDir, 'hermes'));

      if (hasOpenClaw && hasHermes) {
        console.log('PASS: Both framework data extracted correctly\n');
      } else {
        console.log(`FAIL: Missing framework data (openclaw: ${hasOpenClaw}, hermes: ${hasHermes})\n`);
        exitCode = 1;
      }
    } else {
      console.log('FAIL: manifest.json not found in archive\n');
      exitCode = 1;
    }
    cleanup(extractTestDir);
  }

  // Test 4: Import after deleting original data
  console.log('=== Test 4: Import Round-Trip ===');
  // Delete original framework directories
  cleanup(openclawDir);
  cleanup(hermesDir);
  cleanup(path.join(homeDir, 'hermes'));

  // Verify they're gone
  if (fs.existsSync(openclawDir) || fs.existsSync(hermesDir)) {
    console.log('FAIL: Could not clean up mock data for import test\n');
    exitCode = 1;
  } else {
    try {
      const output = execSync(`"${nodeCmd}" "${toolPath}" import "${migrationFile}"`, { encoding: 'utf-8' });
      console.log(output);

      // Verify OpenClaw data was restored
      const configRestored = fs.existsSync(path.join(openclawDir, 'openclaw.json'));
      const envRestored = fs.existsSync(path.join(openclawDir, '.env'));
      const sessionsRestored = fs.existsSync(path.join(openclawDir, 'sessions', 'session-001.json'));
      const memoryRestored = fs.existsSync(path.join(openclawDir, 'memory', 'MEMORY.md'));

      // Verify Hermes data was restored
      const hermesConfigRestored = fs.existsSync(path.join(hermesDir, 'config.yaml'));
      const hermesEnvRestored = fs.existsSync(path.join(hermesDir, '.env'));
      const hermesSoulRestored = fs.existsSync(path.join(hermesDir, 'SOUL.md'));
      const hermesMemoryRestored = fs.existsSync(path.join(hermesDir, 'MEMORY.md'));
      const hermesSkillsRestored = fs.existsSync(path.join(hermesDir, 'skills', 'coding.md'));
      const hermesWorkspaceRestored = fs.existsSync(path.join(homeDir, 'hermes', 'workspace', 'notes.txt'));

      const allOk = configRestored && envRestored && sessionsRestored && memoryRestored &&
        hermesConfigRestored && hermesEnvRestored && hermesSoulRestored && hermesMemoryRestored &&
        hermesSkillsRestored && hermesWorkspaceRestored;

      if (allOk) {
        console.log('PASS: All data restored correctly\n');
      } else {
        console.log(`FAIL: Import incomplete. openclaw: config=${configRestored}, env=${envRestored}, sessions=${sessionsRestored}, memory=${memoryRestored}`);
        console.log(`        hermes: config=${hermesConfigRestored}, env=${hermesEnvRestored}, soul=${hermesSoulRestored}, memory=${hermesMemoryRestored}, skills=${hermesSkillsRestored}, workspace=${hermesWorkspaceRestored}\n`);
        exitCode = 1;
      }
    } catch (err) {
      console.log(`FAIL: Import failed: ${err.message}\n`);
      exitCode = 1;
    }
  }

  // Cleanup mock data
  cleanup(openclawDir);
  cleanup(hermesDir);
  cleanup(path.join(homeDir, 'hermes'));
  cleanup(testDir);

  console.log('All tests completed.');
  process.exit(exitCode);
}

runTests();
