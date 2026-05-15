#!/usr/bin/env node
// Re-encode photos from assets/photos/_originals/ (and staged/_originals/) into
// optimized JPEG + WebP next to them. Max 3200px on the long edge.
//
// Usage:
//   node scripts/optimize-photos.js

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const MAX_LONG_EDGE = 3200;
const JPEG_QUALITY = 85;
const WEBP_QUALITY = 80;

const DIRS = [
  { src: path.join(ROOT, 'assets/photos/_originals'),       dest: path.join(ROOT, 'assets/photos') },
  { src: path.join(ROOT, 'assets/photos/staged/_originals'), dest: path.join(ROOT, 'assets/photos/staged') }
];

function fmtBytes(n) {
  if (n > 1024 * 1024) return (n / (1024 * 1024)).toFixed(2) + ' MB';
  if (n > 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}

async function processFile(srcPath, destDir) {
  const filename = path.basename(srcPath);
  const ext = path.extname(filename).toLowerCase();
  const stem = path.basename(filename, ext);

  const srcSize = fs.statSync(srcPath).size;
  const isPng = ext === '.png';

  // Read source, prepare resize pipeline
  const image = sharp(srcPath, { failOn: 'none' });
  const meta = await image.metadata();
  const longEdge = Math.max(meta.width || 0, meta.height || 0);
  const needsResize = longEdge > MAX_LONG_EDGE;

  function pipeline() {
    let p = sharp(srcPath, { failOn: 'none' });
    if (needsResize) {
      p = p.resize({
        width: meta.width >= meta.height ? MAX_LONG_EDGE : null,
        height: meta.height > meta.width ? MAX_LONG_EDGE : null,
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    return p;
  }

  // Primary output: same format as source (JPEG → JPEG, PNG → PNG)
  let primaryOut, primaryBytes;
  if (isPng) {
    // PNG: keep lossless, but recompress for smaller size
    primaryOut = path.join(destDir, filename);
    await pipeline()
      .png({ compressionLevel: 9, palette: true })
      .toFile(primaryOut);
    primaryBytes = fs.statSync(primaryOut).size;
  } else {
    // JPG/JPEG: use jpeg-style filename matching source extension preference
    primaryOut = path.join(destDir, filename);
    await pipeline()
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true })
      .toFile(primaryOut);
    primaryBytes = fs.statSync(primaryOut).size;
  }

  // WebP companion output
  const webpOut = path.join(destDir, stem + '.webp');
  await pipeline()
    .webp({ quality: WEBP_QUALITY, effort: 5 })
    .toFile(webpOut);
  const webpBytes = fs.statSync(webpOut).size;

  const dims = needsResize ? `${meta.width}x${meta.height} → resized` : `${meta.width}x${meta.height}`;
  const totalNew = primaryBytes + webpBytes;
  const reduction = ((1 - totalNew / srcSize) * 100).toFixed(0);

  console.log(
    `${filename.padEnd(30)} ${dims.padEnd(22)} ` +
    `orig ${fmtBytes(srcSize).padStart(10)}  ` +
    `→ ${fmtBytes(primaryBytes).padStart(10)} + webp ${fmtBytes(webpBytes).padStart(10)}  ` +
    `(${reduction}% smaller)`
  );
}

async function main() {
  for (const { src, dest } of DIRS) {
    if (!fs.existsSync(src)) {
      console.log(`skip (no source dir): ${src}`);
      continue;
    }
    const files = fs.readdirSync(src).filter(f => /\.(jpe?g|png)$/i.test(f));
    console.log(`\n=== ${path.relative(ROOT, src)} → ${path.relative(ROOT, dest)} (${files.length} files) ===\n`);
    for (const f of files) {
      try {
        await processFile(path.join(src, f), dest);
      } catch (err) {
        console.error(`FAILED ${f}: ${err.message}`);
      }
    }
  }
  console.log('\nDone.');
}

main();
