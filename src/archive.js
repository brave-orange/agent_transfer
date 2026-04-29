const archiver = require('archiver');
const extract = require('extract-zip');
const fs = require('fs');
const path = require('path');

/**
 * Create a .agent-mig migration archive from source directories.
 * Format: ZIP with manifest.json + framework directories
 */
async function createArchive(sourceDirs, outputPath, manifest) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(archive.pointer()));
    archive.on('error', (err) => reject(err));

    archive.pipe(output);

    // Add manifest
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    // Add framework directories
    for (const [frameworkName, dirPath] of Object.entries(sourceDirs)) {
      if (fs.existsSync(dirPath)) {
        archive.directory(dirPath, frameworkName);
      }
    }

    archive.finalize();
  });
}

/**
 * Extract a .agent-mig migration archive.
 */
async function extractArchive(archivePath, outputDir) {
  await extract(archivePath, { dir: outputDir });
}

/**
 * Read manifest from an extracted migration directory.
 */
function readManifest(extractedDir) {
  const manifestPath = path.join(extractedDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Invalid migration file: manifest.json not found');
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
}

module.exports = { createArchive, extractArchive, readManifest };
