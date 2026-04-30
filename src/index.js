const fs = require('fs');
const path = require('path');
const { getHomeDir, getPlatform } = require('./platform');
const { validateSystem, detectFrameworks } = require('./detector');
const { createArchive, extractArchive, readManifest } = require('./archive');
const { isOpenClawInstalled, exportOpenClaw, importOpenClaw } = require('./openclaw');
const { isHermesInstalled, exportHermes, importHermes } = require('./hermes');
const { checkPrerequisites, installOpenClaw, installHermes, verifyInstallation } = require('./installer');

const PACKAGE_NAME = 'agent-migrate v1.0.0';
const VERSION = '1.0.0';

// --- CLI ---
function printUsage() {
  console.log(`
${PACKAGE_NAME}
Cross-platform migration tool for OpenClaw and Hermes Agent configurations.

Usage:
  node src/index.js <command> [options]

Commands:
  status                    Show system status and installed frameworks
  export [options]          Export agent configurations to a migration file
  import <file> [options]   Import agent configurations from a migration file

Export Options:
  --output <path>           Output file path (default: ./agent-migration-<timestamp>.agent-mig)
  --openclaw                Include OpenClaw config
  --hermes                  Include Hermes Agent config
  --all                     Include all detected frameworks (default)
  --path <dir>              Manually specify framework config directory

Import Options:
  --force                   Overwrite existing configurations
  --auto-install            Auto-install frameworks if not present
  --openclaw                Import only OpenClaw config
  --hermes                  Import only Hermes Agent config
  --all                     Import all detected frameworks (default)
  --path <dir>              Manually specify framework config directory

Examples:
  node src/index.js status
  node src/index.js export --all --output ./my-config.agent-mig
  node src/index.js export --openclaw --hermes
  node src/index.js import ./my-config.agent-mig --auto-install
  node src/index.js import ./my-config.agent-mig --openclaw --force
`);
}

// --- STATUS ---
async function showStatus() {
  const system = validateSystem();
  console.log(`\n=== ${PACKAGE_NAME} - System Status ===\n`);
  console.log(`Platform:        ${system.platform} (${system.architecture})`);
  console.log(`Home Directory:  ${system.home}`);
  console.log(`Node.js:         ${system.node.installed ? system.node.version : 'Not installed'}`);
  console.log(`npm:             ${system.npm.installed ? system.npm.version : 'Not installed'}`);
  console.log(`Python:          ${system.python.installed ? system.python.version : 'Not installed'}`);

  console.log(`\n--- Frameworks ---`);
  const fw = system.frameworks;

  console.log(`OpenClaw:        ${fw.openclaw.installed ? 'Installed' : 'Not installed'}`);
  if (fw.openclaw.installed) {
    if (fw.openclaw.configDir) console.log(`  Config Dir:    ${fw.openclaw.configDir}`);
    if (fw.openclaw.path) console.log(`  Version:       ${fw.openclaw.path}`);
  }

  console.log(`Hermes Agent:    ${fw.hermes.installed ? 'Installed' : 'Not installed'}`);
  if (fw.hermes.installed) {
    if (fw.hermes.configDir) console.log(`  Config Dir:    ${fw.hermes.configDir}`);
    if (fw.hermes.path) console.log(`  Version:       ${fw.hermes.path}`);
  }

  console.log();
  return system;
}

// --- EXPORT ---
async function exportCmd(options) {
  console.log(`\n=== Export Agent Configuration ===\n`);

  const system = validateSystem();
  const fw = system.frameworks;

  // Determine which frameworks to export
  const includeOpenclaw = options.openclaw || options.all || (!options.hermes && !options.openclaw && fw.openclaw.installed);
  const includeHermes = options.hermes || options.all || (!options.hermes && !options.openclaw && fw.hermes.installed);

  const stagingDir = path.join(require('./platform').getTempDir(), `agent-migrate-export-${Date.now()}`);
  fs.mkdirSync(stagingDir, { recursive: true });

  let exportedFrameworks = [];

  if (includeOpenclaw) {
    if (!fw.openclaw.installed && !options.customPath) {
      console.warn('Warning: OpenClaw not detected on this system, skipping.');
      console.warn('Use --path <dir> to manually specify the config directory.');
    } else {
      console.log('Exporting OpenClaw configuration...');
      exportOpenClaw(stagingDir, options.customPath);
      exportedFrameworks.push('openclaw');
      console.log('  OpenClaw: OK');
    }
  }

  if (includeHermes) {
    if (!fw.hermes.installed && !options.customPath) {
      console.warn('Warning: Hermes Agent not detected on this system, skipping.');
      console.warn('Use --path <dir> to manually specify the config directory.');
    } else {
      console.log('Exporting Hermes Agent configuration...');
      exportHermes(stagingDir, options.customPath);
      exportedFrameworks.push('hermes');
      console.log('  Hermes Agent: OK');
    }
  }

  if (exportedFrameworks.length === 0) {
    console.error('No frameworks to export. Install OpenClaw or Hermes Agent first.');
    cleanup(stagingDir);
    process.exit(1);
  }

  // Create migration file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputPath = options.output || path.join(process.cwd(), `agent-migration-${timestamp}.agent-mig`);

  const manifest = {
    tool: PACKAGE_NAME,
    version: VERSION,
    exportDate: new Date().toISOString(),
    sourcePlatform: system.platform,
    sourceArchitecture: system.architecture,
    sourceHome: system.home,
    frameworks: exportedFrameworks,
    sourceNodeVersion: system.node.version,
    sourcePythonVersion: system.python.version,
  };

  console.log(`\nCreating migration archive...`);
  const sourceDirs = {};
  for (const fwName of exportedFrameworks) {
    sourceDirs[fwName] = path.join(stagingDir, fwName);
  }
  const finalSize = await createArchive(sourceDirs, outputPath, manifest);

  console.log(`\nMigration file created: ${outputPath}`);
  console.log(`File size: ${(finalSize / 1024).toFixed(2)} KB`);
  console.log(`Included frameworks: ${exportedFrameworks.join(', ')}`);

  // Cleanup temp
  cleanup(stagingDir);
  console.log(`\nExport complete!`);
}

// --- IMPORT ---
async function importCmd(archivePath, options) {
  console.log(`\n=== Import Agent Configuration ===\n`);

  if (!fs.existsSync(archivePath)) {
    console.error(`Migration file not found: ${archivePath}`);
    process.exit(1);
  }

  // Extract archive
  const extractDir = path.join(require('./platform').getTempDir(), `agent-migrate-import-${Date.now()}`);
  fs.mkdirSync(extractDir, { recursive: true });

  console.log('Extracting migration archive...');
  await extractArchive(archivePath, extractDir);

  // Read manifest
  const manifest = readManifest(extractDir);
  console.log(`Migration file created: ${manifest.exportDate}`);
  console.log(`Source platform: ${manifest.sourcePlatform} (${manifest.sourceArchitecture})`);
  console.log(`Included frameworks: ${manifest.frameworks.join(', ')}`);

  // Check current system
  const currentPlatform = getPlatform();
  if (currentPlatform !== manifest.sourcePlatform) {
    console.log(`\nNote: Cross-platform migration detected (${manifest.sourcePlatform} -> ${currentPlatform})`);
  }

  // Determine which frameworks to import
  let targetFrameworks = manifest.frameworks;
  if (options.openclaw && !options.hermes) {
    targetFrameworks = ['openclaw'];
  } else if (options.hermes && !options.openclaw) {
    targetFrameworks = ['hermes'];
  }

  // Auto-install if needed
  if (options.autoInstall) {
    console.log(`\nChecking prerequisites...`);
    const prereqs = checkPrerequisites();

    if (!prereqs.node.installed || !prereqs.npm.installed) {
      console.error('Node.js and npm are required but not installed.');
      console.error('Please install Node.js from https://nodejs.org/');
      cleanup(extractDir);
      process.exit(1);
    }

    const fw = detectFrameworks();

    if (targetFrameworks.includes('openclaw') && !fw.openclaw.installed) {
      console.log(`\nOpenClaw not detected. Installing...`);
      try {
        installOpenClaw();
        const verified = verifyInstallation('openclaw');
        if (verified.installed) {
          console.log('  OpenClaw installed successfully.');
        } else {
          console.warn('  Warning: OpenClaw installation completed but verification failed.');
        }
      } catch (err) {
        console.error(`  Installation error: ${err.message}`);
        console.log('  You may need to install OpenClaw manually: npm install -g openclaw');
      }
    }

    if (targetFrameworks.includes('hermes') && !fw.hermes.installed) {
      console.log(`\nHermes Agent not detected. Installing...`);
      try {
        installHermes();
        const verified = verifyInstallation('hermes');
        if (verified.installed) {
          console.log('  Hermes Agent installed successfully.');
        } else {
          console.warn('  Warning: Hermes Agent installation completed but verification failed.');
        }
      } catch (err) {
        console.error(`  Installation error: ${err.message}`);
        console.log('  You may need to install Hermes Agent manually.');
      }
    }
  }

  // Import frameworks
  console.log(`\nImporting configurations...`);

  if (targetFrameworks.includes('openclaw')) {
    const result = importOpenClaw(extractDir, options.customPath);
    if (result.imported) {
      console.log(`  OpenClaw: Imported (${result.items.join(', ')})`);
    } else {
      console.log(`  OpenClaw: ${result.reason}`);
    }
  }

  if (targetFrameworks.includes('hermes')) {
    const result = importHermes(extractDir, options.customPath);
    if (result.imported) {
      console.log(`  Hermes Agent: Imported (${result.items.join(', ')})`);
    } else {
      console.log(`  Hermes Agent: ${result.reason}`);
    }
  }

  // Cleanup
  cleanup(extractDir);
  console.log(`\nImport complete!`);
}

// --- CLEANUP ---
function cleanup(target) {
  try {
    if (fs.existsSync(target)) {
      if (fs.statSync(target).isDirectory()) {
        fs.rmSync(target, { recursive: true, force: true });
      } else {
        fs.unlinkSync(target);
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

// --- MAIN ---
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const command = args[0];

  switch (command) {
    case 'status': {
      await showStatus();
      break;
    }

    case 'export': {
      const options = parseArgs(args.slice(1));
      await exportCmd(options);
      break;
    }

    case 'import': {
      if (args.length < 2) {
        console.error('Error: import command requires a migration file path.');
        console.error('Usage: node src/index.js import <file> [options]');
        process.exit(1);
      }
      const archivePath = args[1];
      const options = parseArgs(args.slice(2));
      await importCmd(archivePath, options);
      break;
    }

    case 'help':
    case '--help':
    case '-h': {
      printUsage();
      break;
    }

    default: {
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
    }
  }
}

/**
 * Parse CLI options from args array.
 */
function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--output':
        options.output = args[++i];
        break;
      case '--all':
        options.all = true;
        break;
      case '--openclaw':
        options.openclaw = true;
        break;
      case '--hermes':
        options.hermes = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--auto-install':
        options.autoInstall = true;
        break;
      case '--path':
        options.customPath = args[++i];
        break;
      default:
        // If it looks like a file path (for export output)
        if (!arg.startsWith('--') && !options.output) {
          options.output = arg;
        }
    }
  }
  return options;
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
