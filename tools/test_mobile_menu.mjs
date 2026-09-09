import fs from 'node:fs';
import assert from 'node:assert/strict';

const css = fs.readFileSync(new URL('../css/aurora.css', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../js/aurora.js', import.meta.url), 'utf8');
const declarations = [...css.matchAll(/--yc-menu-(layer-one|layer-two|panel):\s*(#[0-9a-f]{6});/g)];
assert.equal(declarations.length, 6, 'Both themes define two reveal layers and the final panel');
assert.deepEqual(declarations.map(([, key, color]) => [key, color]), [
  ['layer-one', '#d8c5a4'], ['layer-two', '#eee4d3'], ['panel', '#faf9f7'],
  ['layer-one', '#75634c'], ['layer-two', '#3b332b'], ['panel', '#141615'],
], 'Champagne/cream and bronze/warm-black accents leave the final panels unchanged');
for (const [, key, color] of declarations.filter(([, key]) => key !== 'panel')) {
  const [r, g, b] = color.slice(1).match(/../g).map(hex => parseInt(hex, 16));
  assert.ok(r > g && g > b && r - b <= 55, `${key} uses a restrained warm accent, not a bright blue flash`);
}
assert.match(css, /\.yc-stagger-prelayer:nth-child\(1\)\s*\{\s*background: var\(--yc-menu-layer-one\);/);
assert.match(css, /\.yc-stagger-prelayer:nth-child\(2\)\s*\{\s*background: var\(--yc-menu-layer-two\);/);
assert.match(css, /background: var\(--yc-menu-panel\);/);
assert.match(css, /transition-delay: 42ms;/);
assert.match(css, /transition-delay: 82ms;/);
assert.match(css, /\.yc-stagger-toggle:focus-visible,[\s\S]*?outline: 2px solid var\(--yc-muted\);/);
assert.match(source, /event\.key === "Escape" && mobileMenuToggle\.checked/);
assert.match(source, /mobileMenuDialog\.setAttribute\("aria-hidden", String\(!opened\)\)/);
console.log('PASS: champagne/bronze reveal layers, unchanged neutral panels, preserved stagger timing, focus outline and Escape/ARIA behavior');
