// Build browser icons from the official source, without redrawing the artwork.
// macOS sips only crops transparent padding and resizes/formats the PNG.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'img/site-icon/moonlab-retriever-original.png');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'yichun-site-icons-'));
const base = path.join(temp, 'icon.png');
const sips = args => execFileSync('sips', args, { stdio: 'pipe' });
// All artwork lies within this square; only unused transparent pixels are cut.
sips(['--cropToHeightWidth', '160', '160', '--cropOffset', '54', '25', source, '--out', base]);
const sizes = new Map([
  [16, 'favicon-16x16.png'], [32, 'favicon-32x32.png'],
  [180, 'apple-touch-icon.png'], [192, 'android-chrome-192x192.png'],
  [512, 'android-chrome-512x512.png'],
]);
for (const [size, file] of sizes) {
  sips(['--resampleHeightWidth', String(size), String(size), base, '--out', path.join(root, file)]);
}

// A multi-resolution ICO also replaces the browser's implicit /favicon.ico fallback.
const frames = [16, 32, 48].map(size => {
  const file = path.join(temp, `${size}.png`);
  sips(['--resampleHeightWidth', String(size), String(size), base, '--out', file]);
  return { size, png: fs.readFileSync(file) };
});
const header = Buffer.alloc(6 + frames.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);
let offset = header.length;
frames.forEach(({ size, png }, i) => {
  const entry = 6 + i * 16;
  header[entry] = header[entry + 1] = size;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
fs.writeFileSync(path.join(root, 'favicon.ico'), Buffer.concat([header, ...frames.map(f => f.png)]));

const fingerprint = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex').slice(0, 12);
const url = file => `/${file}?v=${fingerprint(file)}`;
const manifestPath = path.join(root, 'site.webmanifest');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
for (const icon of manifest.icons) icon.src = url(icon.src.split('?')[0].replace(/^\//, ''));
fs.writeFileSync(manifestPath, JSON.stringify(manifest) + '\n');
const iconFiles = ['apple-touch-icon.png', 'favicon.ico', 'favicon-32x32.png', 'favicon-16x16.png', 'site.webmanifest'];
const links = [
  `<link rel="apple-touch-icon" sizes="180x180" href="${url(iconFiles[0])}">`,
  `<link rel="icon" type="image/x-icon" sizes="16x16 32x32 48x48" href="${url(iconFiles[1])}">`,
  `<link rel="icon" type="image/png" sizes="32x32" href="${url(iconFiles[2])}">`,
  `<link rel="icon" type="image/png" sizes="16x16" href="${url(iconFiles[3])}">`,
  `<link rel="manifest" href="${url(iconFiles[4])}">`,
].join('\n');
let count = 0;
for (const page of execFileSync('git', ['ls-files', '*.html'], { cwd: root, encoding: 'utf8' }).trim().split('\n')) {
  const file = path.join(root, page);
  const original = fs.readFileSync(file, 'utf8');
  if (!original.includes('favicon-32x32.png')) continue;
  let inserted = false;
  const updated = original.replace(/<link\b[^>]*(?:favicon(?:-\d+x\d+\.png|\.ico)|apple-touch-icon\.png|site\.webmanifest)[^>]*>\s*/g, () => {
    if (inserted) return '';
    inserted = true;
    return `${links}\n`;
  });
  if (updated !== original) { fs.writeFileSync(file, updated); count++; }
}
console.log(`Updated favicon assets and ${count} pages; temporary frames: ${temp}`);
