import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/profile-rays.js', import.meta.url), 'utf8');
const target = () => {
  const listeners = new Map();
  return {
    addEventListener(name, fn) { listeners.set(name, [...(listeners.get(name) || []), fn]); },
    removeEventListener(name, fn) { listeners.set(name, (listeners.get(name) || []).filter(x => x !== fn)); },
    emit(name, event = {}) { for (const fn of listeners.get(name) || []) fn(event); },
    listeners,
  };
};
function setup({ profile = true, webgl = true, compilation = true, dark = true } = {}) {
  const rootClasses = new Set(dark ? ['dark'] : []);
  const bodyClasses = new Set(profile ? ['yc-profile-page'] : ['yc-home-page']);
  const frames = new Map(), observers = [], drawings = [], values = {};
  let frameId = 0, time = 0, attached = false, deletedPrograms = 0;
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4,
    ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TRIANGLES: 8,
    createShader: () => ({}), shaderSource() {}, compileShader() {},
    getShaderParameter: () => compilation, deleteShader() {},
    createProgram: () => ({}), attachShader() {}, linkProgram() {},
    getProgramParameter: () => true, useProgram() {},
    createBuffer: () => ({}), bindBuffer() {}, bufferData() {},
    getAttribLocation: () => 0, enableVertexAttribArray() {}, vertexAttribPointer() {},
    getUniformLocation: (_, name) => name, viewport() {}, uniform2f() {},
    uniform1f(name, value) { values[name] = value; },
    drawArrays() { drawings.push({ ...values }); },
    deleteBuffer() {}, deleteProgram() { deletedPrograms++; },
  };
  const canvas = Object.assign(target(), {
    dataset: {}, setAttribute() {}, getContext: () => webgl ? gl : null,
  });
  const root = { classList: { contains: key => rootClasses.has(key) }, clientWidth: 1280 };
  const body = {
    dataset: { pixelState: 'idle' },
    classList: { contains: key => bodyClasses.has(key) },
    prepend() { attached = true; },
  };
  const document = Object.assign(target(), {
    body, documentElement: root, hidden: false,
    createElement: () => canvas, getElementById: () => attached ? canvas : null,
  });
  const media = Object.assign(target(), { matches: false });
  const events = target();
  const sandbox = {
    ...events, document, matchMedia: () => media,
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 3,
    requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
    MutationObserver: class {
      constructor(fn) { this.fn = fn; observers.push(this); }
      observe() {} disconnect() { this.fn = () => {}; }
    },
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(source, context);
  return {
    canvas, document, body, root, media, rootClasses, bodyClasses, frames, drawings, events, sandbox,
    mutate: () => observers.forEach(o => o.fn()),
    rerun: () => vm.runInContext(source, context),
    tick(ms = 40) {
      time += ms;
      const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(time));
    },
    get attached() { return attached; },
    get deletedPrograms() { return deletedPrograms; },
  };
}

const live = setup();
assert.equal(live.canvas.dataset.renderer, 'webgl');
assert.equal(live.canvas.dataset.palette, 'pearl-white');
assert.equal(live.canvas.dataset.pattern, 'silk', 'Subpages share the homepage silk motif');
// The bounded fold energy is in [0, 1]; check the worst palette endpoint, not
// just a convenient screenshot phase. Secondary body copy must remain AA.
const luminance = rgb => rgb.reduce((sum, value, i) => {
  const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  return sum + linear * [0.2126, 0.7152, 0.0722][i];
}, 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05)
  / (Math.min(luminance(a), luminance(b)) + 0.05);
const dayExpression = source.match(/vec3 day = vec3\(([^)]+)\) - vec3\(([^)]+)\) \* energy/);
const dayBase = dayExpression[1].split(',').map(Number);
const dayShade = dayExpression[2].split(',').map(Number);
const nightExpression = source.match(/vec3 night = vec3\(([\d.]+) \+ ([\d.]+) \* energy\)/);
const nightPeak = Number(nightExpression[1]) + Number(nightExpression[2]);
assert.ok(contrast(dayBase.map((c, i) => c - dayShade[i]), [98, 103, 98].map(c => c / 255)) >= 4.5);
assert.ok(contrast([nightPeak, nightPeak, nightPeak], [170, 175, 170].map(c => c / 255)) >= 4.5);
assert.ok(live.canvas.width * live.canvas.height <= 1102000);
live.tick(); live.tick();
assert.ok(live.drawings.at(-1).uTime > live.drawings[0].uTime);
assert.equal(live.drawings.at(-1).uDark, 1);
live.rerun(); assert.equal(live.frames.size, 1, 'Only one animation loop');

live.rootClasses.delete('dark'); live.mutate(); live.tick();
assert.equal(live.drawings.at(-1).uDark, 0, 'The same canvas updates to the day palette');
assert.equal(live.canvas.dataset.motion, 'flowing');
assert.equal(setup({ dark: false }).drawings.at(-1).uDark, 0, 'Direct light-mode load works');

live.media.matches = true; live.media.emit('change');
const still = live.drawings.length;
live.tick(); live.tick(); assert.equal(live.drawings.length, still);
live.rootClasses.add('dark'); live.mutate();
assert.equal(live.drawings.at(-1).uDark, 1, 'Still frames respond to theme changes');
assert.equal(live.frames.size, 0);
live.media.matches = false; live.media.emit('change');

for (const modal of ['yc-opening-active', 'medium-zoom--opened', 'yc-mobile-menu-open']) {
  live.bodyClasses.add(modal); live.mutate(); assert.equal(live.frames.size, 0);
  live.bodyClasses.delete(modal); live.mutate(); assert.equal(live.frames.size, 1);
}
for (const phase of ['cover', 'reveal']) {
  live.body.dataset.pixelState = phase; live.mutate(); assert.equal(live.frames.size, 0);
}
live.body.dataset.pixelState = 'idle'; live.mutate(); assert.equal(live.frames.size, 1);

live.document.hidden = true; live.document.emit('visibilitychange');
const hidden = live.drawings.length; live.tick(5000);
assert.equal(live.drawings.length, hidden);
live.document.hidden = false; live.document.emit('visibilitychange');
assert.equal(live.frames.size, 1);
assert.equal(live.events.listeners.has('pointermove'), false, 'No pointer-following background');
assert.equal(live.events.listeners.has('scroll'), false, 'No scroll-following background');

live.sandbox.innerWidth = 390; live.sandbox.innerHeight = 844; live.root.clientWidth = 390;
live.events.emit('resize');
assert.equal(live.canvas.width, 488);
assert.equal(live.canvas.height, 1055);
live.events.emit('pagehide', { persisted: true }); assert.equal(live.frames.size, 0);
live.events.emit('pageshow'); assert.equal(live.frames.size, 1);
live.canvas.emit('webglcontextlost', { preventDefault() {} });
assert.equal(live.frames.size, 0); assert.equal(live.canvas.dataset.renderer, 'fallback');
live.canvas.emit('webglcontextrestored');
assert.equal(live.frames.size, 1); assert.equal(live.canvas.dataset.renderer, 'webgl');
live.events.emit('pagehide', { persisted: false });
assert.equal(live.frames.size, 0); assert.equal(live.deletedPrograms, 1);
live.events.emit('pageshow'); live.canvas.emit('webglcontextrestored');
assert.equal(live.frames.size, 0, 'Disposed pages cannot restart');
assert.equal(setup({ webgl: false }).canvas.dataset.renderer, 'fallback');
assert.equal(setup({ compilation: false }).canvas.dataset.renderer, 'fallback');
assert.equal(setup({ profile: false }).attached, false, 'Homepage keeps its own Silk background');

const shared = fs.readFileSync(new URL('../js/aurora.js', import.meta.url), 'utf8');
assert.doesNotMatch(shared, /splash-cursor\.js/, 'No cursor renderer is downloaded');
assert.doesNotMatch(shared, /research-ferrofluid\.js/, 'No independent water card is downloaded');
assert.match(shared, /classList\.add\("yc-research-editorial"\)/, 'Research uses the original content with editorial styling');
console.log('PASS: day/night lighting, continuous motion, no pointer/scroll tracking, overlays, reduced motion, resolution cap, BFCache, cleanup, WebGL fallback/restoration, no cursor/water renderer downloads');
