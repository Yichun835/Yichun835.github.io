import fs from 'node:fs';
import assert from 'node:assert/strict';

const css = fs.readFileSync(new URL('../css/aurora.css', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../js/aurora.js', import.meta.url), 'utf8');
const declarations = [...css.matchAll(/--yc-menu-(?:layer-one|layer-two|panel):\s*(#[0-9a-f]{6});/g)];
assert.equal(declarations.length, 6, 'Both themes define two reveal layers and the final panel');
for (const [, color] of declarations) {
  const channels = color.slice(1).match(/../g).map(hex => parseInt(hex, 16));
  assert.ok(Math.max(...channels) - Math.min(...channels) <= 5, `${color} stays neutral throughout the entrance`);
}
assert.match(css, /\.yc-stagger-prelayer:nth-child\(1\)\s*\{\s*background: var\(--yc-menu-layer-one\);/);
assert.match(css, /\.yc-stagger-prelayer:nth-child\(2\)\s*\{\s*background: var\(--yc-menu-layer-two\);/);
assert.match(css, /background: var\(--yc-menu-panel\);/);
assert.match(css, /transition-delay: 42ms;/);
assert.match(css, /transition-delay: 82ms;/);
assert.match(css, /\.yc-stagger-toggle:focus-visible,[\s\S]*?outline: 2px solid var\(--yc-muted\);/);
assert.match(source, /event\.key === "Escape" && mobileMenuToggle\.checked/);
assert.match(source, /mobileMenuDialog\.setAttribute\("aria-hidden", String\(!opened\)\)/);
console.log('PASS: neutral day/night reveal layers and panel, preserved stagger timing, focus outline and Escape/ARIA behavior');
