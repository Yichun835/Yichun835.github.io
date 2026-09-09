import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/aurora.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../css/aurora.css', import.meta.url), 'utf8');
const controls = fs.readFileSync(new URL('../js/site-controls.js', import.meta.url), 'utf8');
assert.match(css, /padding-inline-end: 0\.14em;/, 'Shiny text includes last-glyph ink overhang');
assert.match(controls, /addEventListener\("yc:before-theme-change", \(\) => closeAll\(true\)\)/);
assert.match(source, /yc:appearance-open.*loadNightMaterial\(true\)/, 'Night canvas can warm up before the snapshot');

const themeSource = source.slice(source.indexOf('  // Reuse the theme\'s original handler'), source.indexOf('  const pixelStorageKey'));
function themeSetup({ reduced = false, supported = true, throws = false } = {}) {
  const classes = new Set(), order = [], properties = new Map();
  let click, applied = 0, finish;
  class Element {}
  const trigger = { getBoundingClientRect: () => ({ left: 200, top: 20, width: 20, height: 20 }) };
  const button = new Element();
  button.closest = selector => selector.includes('control') ? { querySelector: () => trigger } : button;
  const makeEvent = () => ({ target: button, prevented: false,
    preventDefault() { this.prevented = true; }, stopImmediatePropagation() {} });
  button.click = () => { const e = makeEvent(); click(e); if (!e.prevented) applied++; };
  const root = {
    classList: { add: x => classes.add(x), remove: x => classes.delete(x) },
    style: { setProperty: (key, value) => properties.set(key, value), removeProperty: key => properties.delete(key) },
  };
  const document = { documentElement: root, addEventListener: (_, fn) => { click = fn; } };
  if (supported) document.startViewTransition = fn => {
    order.push('snapshot');
    if (throws) throw new Error('Unsupported snapshot');
    return { ready: Promise.resolve().then(fn), finished: new Promise(resolve => { finish = resolve; }) };
  };
  vm.runInNewContext(themeSource, { document, Element, reducedMotion: { matches: reduced },
    window: { dispatchEvent: event => order.push(event.type) }, Event: class { constructor(type) { this.type = type; } },
    innerWidth: 1280, innerHeight: 720 });
  return { classes, order, properties, click: () => button.click(), finish: () => finish(), get applied() { return applied; } };
}
const theme = themeSetup();
theme.click();
await new Promise(resolve => setImmediate(resolve));
assert.deepEqual(theme.order, ['yc:before-theme-change', 'snapshot'], 'Popover closes before capture');
assert.equal(theme.applied, 1, 'Original theme handler runs exactly once');
assert.match(css, /animation: yc-theme-reveal 1600ms cubic-bezier\(\.3, \.12, \.3, 1\) both;/, 'CSS owns the entire reveal with a gradual finish');
assert.ok(!themeSource.includes('.animate('), 'No late or unsupported WAAPI pseudo-element attachment');
assert.equal(theme.properties.get('--yc-theme-x'), `${210 / 1280 * 100}%`, 'Origin follows the fixed icon in snapshot-relative coordinates');
assert.equal(theme.properties.get('--yc-theme-y'), `${30 / 720 * 100}%`);
const radiusPercent = parseFloat(theme.properties.get('--yc-theme-radius'));
for (const scale of [0.5, 1, 2]) {
  const snapshotRadius = radiusPercent / 100 * Math.hypot(1280 * scale, 720 * scale) / Math.SQRT2;
  assert.ok(snapshotRadius > Math.hypot(1070 * scale, 690 * scale), 'The reveal fully covers every snapshot scale, without a final corner jump');
}
theme.click(); assert.equal(theme.applied, 1, 'Repeated clicks cannot double-toggle mid-wipe');
theme.finish(); await new Promise(resolve => setImmediate(resolve));
assert.equal(theme.classes.size, 0, 'Transition lock and class are cleared');
assert.equal(theme.properties.size, 0, 'Temporary geometry is cleaned after the animation finishes');
for (const settings of [{ reduced: true }, { supported: false }, { throws: true }]) {
  const normal = themeSetup(settings); normal.click();
  assert.equal(normal.applied, 1, 'Fallback preserves the actual theme change');
  assert.equal(normal.classes.size, 0);
  assert.equal(normal.properties.size, 0);
}

const helperStart = source.indexOf('        const assemblyDuration =');
const helperEnd = source.indexOf('        const canRunParticles', helperStart);
const motion = vm.runInNewContext(source.slice(helperStart, helperEnd) + '\n({assemblyDuration, assemblyEase, particleDamping});');
assert.equal(motion.assemblyDuration, 900);
assert.equal(motion.assemblyEase(-1), 0);
assert.equal(motion.assemblyEase(1), 1);
assert.equal(motion.assemblyEase(2), 1);
const positions = [30, 60, 120].map(fps => {
  let x = 0;
  for (let n = 0; n < fps / 2; n++) x += (100 - x) * motion.particleDamping(0.1, 1000 / fps);
  return x;
});
assert.ok(Math.max(...positions) - Math.min(...positions) < 1e-10, 'Pointer easing is frame-rate independent');
const drawStart = source.indexOf('        const drawParticleText =');
const drawEnd = source.indexOf('        const renderParticleText', drawStart);
function particleSetup() {
  const point = { homeX: 100, homeY: 50, startX: 128, startY: 34, x: 128, y: 34,
    ease: 0.1, phase: 0, tone: 0, radius: 1, opacity: 0.8 };
  const stage = { dataset: {} };
  const sandbox = { point, points: [point], stage, lastParticleTime: 0, assembledAt: 0,
    width: 400, height: 150, reducedMotion: { matches: false }, pointer: { active: false },
    performance: { now: () => 0 }, document: { documentElement: { classList: { contains: () => true } } },
    context: { clearRect() {}, beginPath() {}, arc() {}, fill() {} } };
  const draw = vm.runInNewContext(source.slice(helperStart, helperEnd) + source.slice(drawStart, drawEnd) + '\ndrawParticleText;', sandbox);
  return { draw, point, stage };
}
const fast = particleSetup(), slow = particleSetup();
for (let time = 0; time <= 450; time += 15) fast.draw(time);
for (let time = 0; time <= 450; time += 150) slow.draw(time);
assert.equal(fast.point.x, slow.point.x);
assert.equal(fast.point.y, slow.point.y, 'Formation position depends on time, not rendered frame count');
fast.draw(900);
slow.draw(900);
assert.equal(fast.stage.dataset.state, 'interactive');
assert.equal(fast.point.x, slow.point.x, 'Even a dropped frame finishes formation on time');
assert.match(source, /assembledAt = performance\.now\(\) - \(reflow \? assemblyDuration : 0\)/, 'Resizing does not scatter an assembled title');
console.log('PASS: CV glyph padding, theme snapshot ordering/origin/timing/fallback/lock, contact time-based formation/damping and resize stability');
