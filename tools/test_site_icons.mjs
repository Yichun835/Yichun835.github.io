import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => fs.readFileSync(path.join(root, file));
const fingerprint = file => crypto.createHash('sha256').update(read(file)).digest('hex').slice(0, 12);
const pngSize = buffer => {
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
};
for (const [file, size] of Object.entries({
  'favicon-16x16.png': 16, 'favicon-32x32.png': 32, 'apple-touch-icon.png': 180,
  'android-chrome-192x192.png': 192, 'android-chrome-512x512.png': 512,
  'img/site-icon/moonlab-retriever-original.png': 240,
})) assert.deepEqual(pngSize(read(file)), [size, size], file);

const ico = read('favicon.ico');
assert.equal(ico.readUInt16LE(0), 0);
assert.equal(ico.readUInt16LE(2), 1);
assert.equal(ico.readUInt16LE(4), 3);
for (const [i, size] of [16, 32, 48].entries()) {
  const entry = 6 + i * 16;
  const start = ico.readUInt32LE(entry + 12);
  const end = start + ico.readUInt32LE(entry + 8);
  assert.equal(ico[entry], size);
  assert.deepEqual(pngSize(ico.subarray(start, end)), [size, size]);
  assert.ok(end <= ico.length);
}

let checked = 0;
for (const page of execFileSync('git', ['ls-files', '*.html'], { cwd: root, encoding: 'utf8' }).trim().split('\n')) {
  const html = read(page).toString();
  if (!/<body\b/.test(html)) continue;
  const links = html.match(/<link\b[^>]*(?:favicon|apple-touch-icon|site\.webmanifest)[^>]*>/g) ?? [];
  assert.equal(links.length, 5, `${page}: one consistent icon set`);
  for (const link of links) {
    const href = link.match(/href="([^\"]+)"/)[1];
    const url = new URL(href, 'https://yichun835.github.io');
    assert.ok(href.startsWith('/'), `${page}: deployment-safe root-relative path`);
    assert.equal(url.searchParams.get('v'), fingerprint(url.pathname.slice(1)), `${page}: no stale icon cache URL`);
  }
  checked++;
}
assert.equal(checked, 20);
for (const icon of JSON.parse(read('site.webmanifest')).icons) {
  const url = new URL(icon.src, 'https://yichun835.github.io');
  assert.equal(url.searchParams.get('v'), fingerprint(url.pathname.slice(1)));
}
assert.match(read('licenses/site-icons.md').toString(), /26955865/);
console.log(`PASS: official source, PNG sizes, multi-resolution ICO, manifest and ${checked} EN/CN pages with versioned local icon URLs`);
