import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/home-silk.js', import.meta.url), 'utf8');
const target = () => {
  const listeners = new Map();
  return {
    addEventListener(name, fn) { listeners.set(name, [...(listeners.get(name) || []), fn]); },
    removeEventListener(name, fn) { listeners.set(name, (listeners.get(name) || []).filter(x => x !== fn)); },
    emit(name, event = {}) { for (const fn of listeners.get(name) || []) fn(event); },
  };
};
function setup({ webgl = true, compilation = true, opening = false, home = true } = {}) {
  const rootClasses = new Set(['dark']);
  const bodyClasses = new Set(home ? ['yc-home-page'] : []);
  if (opening) bodyClasses.add('yc-opening-active');
  const frames = new Map();
  const observers = [];
  const drawing = [];
  let nextFrame = 0;
  let time = 0;
  let currentTime = 0;
  let attached = false;
  let deletedPrograms = 0;
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
    uniform1f(_, value) { currentTime = value; },
    drawArrays() { drawing.push(currentTime); },
    deleteBuffer() {}, deleteProgram() { deletedPrograms++; },
  };
  const canvas = Object.assign(target(), {
    dataset: {}, setAttribute() {}, getContext: () => webgl ? gl : null,
  });
  const root = { classList: { contains: key => rootClasses.has(key) }, clientWidth: 1280 };
  const body = {
    classList: { contains: key => bodyClasses.has(key) },
    prepend() { attached = true; },
  };
  const document = Object.assign(target(), {
    body, documentElement: root, hidden: false,
    createElement: () => canvas, getElementById: () => attached ? canvas : null,
  });
  const media = Object.assign(target(), { matches: false });
  const windowEvents = target();
  const sandbox = {
    ...windowEvents, document, matchMedia: () => media,
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 3,
    requestAnimationFrame: fn => { frames.set(++nextFrame, fn); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id),
    MutationObserver: class {
      constructor(fn) { this.fn = fn; observers.push(this); }
      observe() {} disconnect() { this.fn = () => {}; }
    },
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(source, context);
  return {
    canvas, document, media, rootClasses, bodyClasses, frames, drawing, windowEvents,
    rerun: () => vm.runInContext(source, context),
    mutate: () => observers.forEach(o => o.fn()),
    tick(ms = 40) {
      time += ms;
      const callbacks = [...frames.values()]; frames.clear();
      callbacks.forEach(fn => fn(time));
    },
    get attached() { return attached; },
    get deletedPrograms() { return deletedPrograms; },
  };
}

const live = setup({ opening: true });
assert.equal(live.canvas.dataset.renderer, 'webgl');
assert.equal(live.canvas.dataset.motion, 'paused');
assert.equal(live.frames.size, 0, 'No animation behind Welcome');
assert.ok(live.canvas.width * live.canvas.height <= 1402000, 'Resolution remains bounded');
live.bodyClasses.delete('yc-opening-active'); live.mutate();
assert.equal(live.frames.size, 1);
live.tick(); live.tick(); live.tick();
assert.ok(live.drawing.at(-1) > live.drawing[0], 'Silk time advances');
live.rerun();
assert.equal(live.frames.size, 1, 'No duplicate animation on repeated initialization');

live.rootClasses.delete('dark'); live.mutate();
const beforeLight = live.drawing.length;
live.tick();
assert.equal(live.drawing.length, beforeLight, 'Light mode does not render');
assert.equal(live.frames.size, 0);
live.rootClasses.add('dark'); live.mutate(); live.tick();
assert.equal(live.canvas.dataset.motion, 'flowing');

live.media.matches = true; live.media.emit('change');
const beforeReduced = live.drawing.length;
live.tick(); live.tick();
assert.equal(live.drawing.length, beforeReduced, 'Reduced motion renders a still frame');
assert.equal(live.frames.size, 0);
live.media.matches = false; live.media.emit('change');
live.document.hidden = true; live.document.emit('visibilitychange');
const beforeHidden = live.drawing.length;
live.tick(5000);
assert.equal(live.drawing.length, beforeHidden, 'Hidden tabs do not render');
live.document.hidden = false; live.document.emit('visibilitychange');
assert.equal(live.frames.size, 1);

live.windowEvents.emit('pagehide', { persisted: true });
assert.equal(live.frames.size, 0);
live.windowEvents.emit('pageshow');
assert.equal(live.frames.size, 1, 'Back/forward cache resumes a single loop');
live.canvas.emit('webglcontextlost', { preventDefault() {} });
assert.equal(live.canvas.dataset.renderer, 'fallback');
assert.equal(live.frames.size, 0);
live.canvas.emit('webglcontextrestored');
assert.equal(live.canvas.dataset.renderer, 'webgl');
assert.equal(live.frames.size, 1);
live.windowEvents.emit('pagehide', { persisted: false });
assert.equal(live.frames.size, 0);
assert.equal(live.deletedPrograms, 1);
live.windowEvents.emit('pageshow');
assert.equal(live.frames.size, 0, 'Disposed pages do not restart');
live.canvas.emit('webglcontextrestored');
assert.equal(live.frames.size, 0, 'Disposed renderers are not recreated');

assert.equal(setup({ webgl: false }).canvas.dataset.renderer, 'fallback');
assert.equal(setup({ compilation: false }).canvas.dataset.renderer, 'fallback');
assert.equal(setup({ home: false }).attached, false, 'No background on subpages');
console.log('PASS: night/light, Welcome, motion preferences, visibility, resolution, BFCache, WebGL fallback/restoration, disposal, duplicate guard, page scope');
