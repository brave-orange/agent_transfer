/**
 * Generate icon files for electron-builder from logo.svg.
 * Usage: node scripts/icons.js
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SVG_PATH = path.join(ROOT, 'logo.svg');

async function generateIcons() {
  // Generate 512x512 PNG (required for all platforms)
  const pngPath = path.join(ROOT, 'logo.png');
  await sharp(SVG_PATH)
    .resize(512, 512)
    .png()
    .toFile(pngPath);
  console.log('Created: logo.png (512x512)');

  // Generate 256x256 PNG for macOS
  const png256Path = path.join(ROOT, 'logo-256.png');
  await sharp(SVG_PATH)
    .resize(256, 256)
    .png()
    .toFile(png256Path);
  console.log('Created: logo-256.png (256x256)');

  // Generate ICO for Windows (multi-size: 16, 32, 48, 256)
  const icoPath = path.join(ROOT, 'logo.ico');
  await sharp(SVG_PATH)
    .resize(256, 256)
    .png()
    .toFile(path.join(ROOT, 'logo-256-for-ico.png'));

  // sharp can create .ico files
  const sizes = [16, 32, 48, 256];
  const iconBuffers = await Promise.all(
    sizes.map(async (size) => {
      return await sharp(SVG_PATH)
        .resize(size, size)
        .png()
        .toBuffer();
    })
  );

  // Write ICO manually since sharp may not support multi-size ICO
  // ICO file format: header + directory entries + image data
  const iconData = Buffer.concat(iconBuffers);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);  // reserved
  header.writeUInt16LE(1, 2);  // type: icon
  header.writeUInt16LE(sizes.length, 4);  // number of images

  const directorySize = 16 * sizes.length;
  const directory = Buffer.alloc(directorySize);

  let offset = 6 + directorySize;
  sizes.forEach((size, i) => {
    const imgBuffer = iconBuffers[i];
    directory.writeUInt8(size === 256 ? 0 : size, i * 16);  // width
    directory.writeUInt8(size === 256 ? 0 : size, i * 16 + 1);  // height
    directory.writeUInt32LE(imgBuffer.length, i * 16 + 8);  // size
    directory.writeUInt32LE(offset, i * 16 + 12);  // offset
    offset += imgBuffer.length;
  });

  const icoFile = Buffer.concat([header, directory, iconData]);
  fs.writeFileSync(icoPath, icoFile);
  console.log('Created: logo.ico (multi-size ICO)');

  // Clean up temp files
  try { fs.unlinkSync(png256Path); } catch {}
  try { fs.unlinkSync(path.join(ROOT, 'logo-256-for-ico.png')); } catch {}

  console.log('\nIcon generation complete!');
  console.log('Files: logo.png, logo.ico');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
