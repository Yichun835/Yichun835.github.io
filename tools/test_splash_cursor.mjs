import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/splash-cursor.js', import.meta.url), 'utf8');
function target() {
  const listeners = new Map();
  return {
    addEventListener(name, fn, options = {}) {
      const list = listeners.get(name) || [];
      list.push({ fn, signal: options.signal }); listeners.set(name, list);
    },
    emit(name, event = {}) {
      for (const { fn, signal } of listeners.get(name) || []) if (!signal?.aborted) fn(event);
    },
  };
}
function setup({ webgl = true, compilation = true, filtering = true, fine = true, reduced = false } = {}) {
  let time = 0, nextFrame = 0, draws = 0, contexts = 0, attached = false;
  const frames = new Map(), observers = [], resources = new Map();
  const bodyClasses = new Set(), uniformValues = new Map(), shaders = [];
  const finePointer = Object.assign(target(), { matches: fine });
  const motion = Object.assign(target(), { matches: reduced });
  let canvas;
  const gl = new Proxy({
    get drawingBufferWidth() { return canvas.width; },
    get drawingBufferHeight() { return canvas.height; },
    getExtension(name) { return !filtering && name.includes('linear') ? null : {}; },
    checkFramebufferStatus() { return 'FRAMEBUFFER_COMPLETE'; },
    getShaderParameter: () => compilation,
    getShaderInfoLog: () => 'test compile failure',
    getProgramParameter: (_, prop) => prop === 'ACTIVE_UNIFORMS' ? 0 : true,
    getUniformLocation: (_, name) => name,
    shaderSource(_, code) { shaders.push(code); },
    uniform1f(name, value) { uniformValues.set(name, value); },
    drawElements() { draws++; },
  }, {
    get(obj, key) {
      if (key in obj) return obj[key];
      if (key.startsWith('create')) return () => {
        const handle = { kind: key.slice(6) };
        resources.set(handle, handle.kind);
        return handle;
      };
      if (key.startsWith('delete')) return handle => resources.delete(handle);
      return /^[A-Z_0-9]+$/.test(key) ? key : () => {};
    },
  });
  canvas = Object.assign(target(), {
    dataset: {}, width: 300, height: 150, clientWidth: 1280, clientHeight: 720,
    setAttribute() {},
    getContext() { contexts++; return webgl ? gl : null; },
  });
  const body = { dataset: { pixelState: 'idle' }, classList: { contains: name => bodyClasses.has(name) },
    append() { attached = true; } };
  const document = Object.assign(target(), {
    hidden: false, body, documentElement: { classList: { contains: () => true } },
    getElementById: () => attached ? canvas : null,
    createElement: () => canvas,
  });
  class Element { constructor(input = false) { this.input = input; } closest() { return this.input ? this : null; } }
  const windowEvents = target();
  const sandbox = {
    ...windowEvents, document, devicePixelRatio: 3, Element, AbortController,
    performance: { now: () => time },
    matchMedia: query => query.includes('prefers-reduced') ? motion : finePointer,
    requestAnimationFrame: fn => { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id),
    MutationObserver: class {
      constructor(fn) { this.fn = fn; observers.push(this); }
      observe() {} disconnect() { this.fn = () => {}; }
    },
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(source, context);
  return {
    canvas, frames, resources, document, bodyClasses, motion, finePointer, windowEvents, shaders, uniformValues,
    get draws() { return draws; }, get contexts() { return contexts; },
    move(x = 500, y = 300, input = false, pointerType = 'mouse') {
      windowEvents.emit('pointermove', { pointerType, clientX: x, clientY: y, target: new Element(input) });
    },
    mutate() { observers.forEach(o => o.fn()); },
    tick(ms = 17) {
      time += ms;
      const pending = [...frames.values()]; frames.clear();
      pending.forEach(fn => fn(time));
    },
    rerun() { vm.runInContext(source, context); },
  };
}

const live = setup();
assert.equal(live.contexts, 0, 'No GPU work until mouse input');
live.move();
assert.equal(live.canvas.dataset.renderer, 'webgl-fluid');
assert.equal(live.frames.size, 0, 'First position seeds without a corner streak');
live.move(520); live.tick();
assert.equal(live.frames.size, 1);
assert.ok(live.draws > 25, 'Pressure/advection/display pipeline executes');
assert.ok(live.canvas.width * live.canvas.height <= 1600000, 'Retina cost is bounded');
const resources = live.resources.size;
live.rerun(); live.move(550); live.tick();
assert.equal(live.resources.size, resources, 'No duplicate renderer');
live.tick(2050);
assert.equal(live.frames.size, 0, 'Soft tail stops the loop within two seconds');
assert.equal(live.canvas.dataset.state, 'idle');
live.move(600); live.move(620); live.tick();
live.document.hidden = true; live.document.emit('visibilitychange');
assert.equal(live.frames.size, 0);
live.move(640); assert.equal(live.frames.size, 0);
live.document.hidden = false; live.document.emit('visibilitychange');
for (const cls of ['yc-opening-active', 'medium-zoom--opened', 'yc-mobile-menu-open']) {
  live.bodyClasses.add(cls); live.mutate(); live.move(); live.move(520);
  assert.equal(live.frames.size, 0, cls + ' pauses fluid');
  live.bodyClasses.delete(cls); live.mutate();
}
live.document.body.dataset.pixelState = 'cover'; live.move(); live.move(520);
assert.equal(live.frames.size, 0, 'Page transition is not obscured');
live.document.body.dataset.pixelState = 'idle';
live.move(); live.move(520); live.tick(); live.move(540, 300, true);
assert.equal(live.frames.size, 0, 'Text inputs are quiet');
live.move(); live.move(530); live.tick();
live.motion.matches = true; live.motion.emit('change');
assert.equal(live.frames.size, 0);
live.motion.matches = false;
live.canvas.clientWidth = 1024; live.windowEvents.emit('resize');
live.move(); live.move(530); live.tick();
assert.equal(live.resources.size, resources, 'Resize releases previous textures/FBOs');
live.canvas.clientWidth = 566; live.windowEvents.emit('resize');
live.move(); live.move(530); live.tick();
assert.equal(live.frames.size, 1, 'Narrow desktop preview still supports mouse fluid');
assert.equal(live.resources.size, resources);
live.windowEvents.emit('pagehide', { persisted: true });
assert.equal(live.frames.size, 0);
live.windowEvents.emit('pageshow'); live.move(); live.move(520); live.tick();
assert.equal(live.frames.size, 1, 'BFCache resumes only on input');
live.windowEvents.emit('pagehide', { persisted: false });
assert.equal(live.resources.size, 0, 'All textures, framebuffers, buffers, shaders and programs freed');
live.move(); live.move(520); assert.equal(live.frames.size, 0, 'Disposed handlers are removed');

for (const settings of [{ fine: false }, { reduced: true }]) {
  const quiet = setup(settings); quiet.move(); quiet.move(520);
  assert.equal(quiet.contexts, 0, 'No GPU on touch/reduced-motion');
}
const touch = setup(); touch.move(500, 300, false, 'touch');
assert.equal(touch.contexts, 0);
for (const settings of [{ webgl: false }, { compilation: false }]) {
  const fallback = setup(settings); fallback.move();
  assert.equal(fallback.canvas.dataset.state, 'unsupported');
  assert.equal(fallback.resources.size, 0);
}
const manual = setup({ filtering: false }); manual.move(); manual.move(520); manual.tick();
assert.ok(manual.draws > 0);
assert.ok(manual.shaders.some(s => s.includes('#define MANUAL_FILTERING')));
const restored = setup(); restored.move(); restored.move(520); restored.tick();
restored.canvas.emit('webglcontextlost', { preventDefault() {} });
assert.equal(restored.frames.size, 0);
restored.resources.clear(); // The browser invalidates all resources on context loss.
restored.canvas.emit('webglcontextrestored'); restored.move(); restored.move(550); restored.tick();
assert.equal(restored.canvas.dataset.renderer, 'webgl-fluid');
assert.equal(restored.frames.size, 1);
restored.windowEvents.emit('pagehide', { persisted: false });
assert.equal(restored.resources.size, 0);
console.log('PASS: fluid pipeline, lazy GPU, pointer seed, idle, reduced motion/touch, visibility, overlays, inputs, resolution, resize cleanup, BFCache, disposal, WebGL fallback/restoration');
