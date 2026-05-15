#!/usr/bin/env node
// Rewrite index.html so every <img src="assets/photos/…"> is wrapped in a
// <picture> with a WebP <source> first. Also update style.css to use
// image-set() for the hero background.
//
// Idempotent: re-running on already-wrapped images is a no-op (the regex
// requires a bare <img> tag, not one already inside a <picture>).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');
const CSS  = path.join(ROOT, 'style.css');

// --- index.html: wrap photo <img> tags in <picture> ---

let html = fs.readFileSync(HTML, 'utf8');
let wrapCount = 0;

// Match a bare <img …src="assets/photos/…ext" …>
// — only on lines where the previous non-whitespace token is not </source>
//   or <picture>, which protects already-wrapped images.
// We do this by ensuring the regex's lookbehind for "<picture>" comes up empty.
const IMG_RE = /(<img\s[^>]*?src="(assets\/photos\/[^"]+?)\.(jpe?g|png)"[^>]*?>)/g;

html = html.replace(IMG_RE, function (full, imgTag, stemPath, ext) {
  // Skip if this img is already inside a <picture> element — detect by checking
  // a small window of context preceding the match.
  const idx = arguments[arguments.length - 2];
  const before = html.substring(Math.max(0, idx - 60), idx);
  if (/<picture[^>]*>\s*(?:<source[^>]*>\s*)*$/i.test(before)) {
    return full; // already wrapped
  }
  wrapCount++;
  const webp = stemPath + '.webp';
  return `<picture><source srcset="${webp}" type="image/webp">${imgTag}</picture>`;
});

fs.writeFileSync(HTML, html, 'utf8');
console.log(`index.html: wrapped ${wrapCount} <img> tag(s) in <picture>.`);

// --- style.css: convert hero background to image-set() ---

let css = fs.readFileSync(CSS, 'utf8');
const HERO_BG_RE = /background-image:\s*url\(['"]?assets\/photos\/hero-twilight\.jpg['"]?\);/;
if (HERO_BG_RE.test(css)) {
  const replacement =
    `background-image: url('assets/photos/hero-twilight.jpg');\n` +
    `  /* WebP for browsers that support image-set; falls back to the url() above. */\n` +
    `  background-image: -webkit-image-set(\n` +
    `    url('assets/photos/hero-twilight.webp') type('image/webp'),\n` +
    `    url('assets/photos/hero-twilight.jpg') type('image/jpeg')\n` +
    `  );\n` +
    `  background-image: image-set(\n` +
    `    url('assets/photos/hero-twilight.webp') type('image/webp'),\n` +
    `    url('assets/photos/hero-twilight.jpg') type('image/jpeg')\n` +
    `  );`;
  css = css.replace(HERO_BG_RE, replacement);
  fs.writeFileSync(CSS, css, 'utf8');
  console.log('style.css: hero background updated to image-set() with JPEG fallback.');
} else {
  console.log('style.css: hero background already converted or not found (skipped).');
}
