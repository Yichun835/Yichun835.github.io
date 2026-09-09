import fs from 'node:fs';
import assert from 'node:assert/strict';

const css = fs.readFileSync(new URL('../css/aurora.css', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../js/aurora.js', import.meta.url), 'utf8');
const opening = fs.readFileSync(new URL('../js/opening-stroke.js', import.meta.url), 'utf8');
function block(text, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = [...text.matchAll(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]+)\\}`, 'g'))].at(-1);
  assert.ok(match, selector);
  return match[1];
}
const background = value => value.match(/(?:^|\n)\s*background:\s*([^;]+);/)[1]
  .replace(/\s/g, '').replace(/\b0\./g, '.');
for (const file of ['index.html', 'zh-cn/index.html']) {
  const html = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  for (const prefix of ['', 'html.dark ']) {
    const criticalSelector = prefix ? 'html.dark.yc-opening-pending::before' : 'html.yc-opening-pending::before';
    assert.equal(background(block(html, criticalSelector)), background(block(css, `${prefix}.yc-opening-screen`)), `${file}: first paint matches the real opening in both themes`);
  }
}
const welcome = css.slice(css.indexOf('.yc-opening-screen {'), css.indexOf('@media (max-width: 639px)', css.indexOf('.yc-opening-screen {')));
const me = css.slice(css.indexOf('.yc-pixelated-photo-layer {'), css.indexOf('.yc-pixelated-photo-card[data-state="active"] .yc-pixelated-photo-label'));
for (const [name, section] of [['Welcome', welcome], ['Me', me]]) {
  for (const [, red, green, blue] of section.matchAll(/rgba\((\d+),\s*(\d+),\s*(\d+),/g)) {
    assert.ok(+red >= +green && +green >= +blue, `${name} decorative gradients stay warm`);
  }
}
assert.match(block(css, '.stroke-text__fill'), /filter: none;/, 'Welcome keeps a crisp metallic fill, not neon blur');
const luminance = hex => hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255)
  .map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)
  .reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
for (const prefix of ['', 'html.dark ']) {
  const backdrop = luminance(prefix ? '#24211a' : '#ede5d5');
  for (const stop of ['one', 'two', 'three', 'four']) {
    const ink = luminance(block(css, `${prefix}.yc-opening-stop--${stop}`).match(/stop-color:\s*(#[0-9a-f]{6})/)[1]);
    assert.ok((Math.max(backdrop, ink) + 0.05) / (Math.min(backdrop, ink) + 0.05) >= 3,
      'Every metallic stop stays readable for large Welcome text');
  }
}
assert.match(block(css, '.yc-pixelated-photo-label'), /text-shadow: none;/);
assert.match(block(css, '.yc-pixelated-photo-label'), /opacity 1400ms/);
assert.match(block(css, '.yc-pixelated-photo-card[data-state="active"] .yc-pixelated-photo-pixel'), /450ms/);
assert.match(source, /const pixelText = chinese \? "我" : "ME";/);
assert.match(source, /const activationDelay = 0;/);
assert.match(source, /const transitionDuration = 1400;/);
assert.match(source, /aboutPhoto\.addEventListener\("click", \(\) => \{[\s\S]*?suppressPixelUntilLeave = true;/);
assert.match(opening, /if \(!event\.isTrusted \|\| performance\.now\(\) - mountedAt < 500\) return;/);
assert.match(opening, /overlay\.addEventListener\("click", onClick\)/);
assert.equal((opening.match(/\bexit\(\);/g) || []).length, 2, 'Welcome only exits on click or keyboard input');
console.log('PASS: matching day/night first paint, warm Welcome/Me palettes, crisp fill, unchanged bilingual labels, timing, zoom handoff and click-to-enter');
