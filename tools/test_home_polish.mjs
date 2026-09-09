import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/home-polish.js', import.meta.url), 'utf8');
const events = () => {
  const listeners = new Map();
  return {
    addEventListener(type, fn, options = {}) {
      listeners.set(type, [...(listeners.get(type) || []), { fn, options }]);
    },
    emit(type, event = {}) {
      for (const { fn, options } of listeners.get(type) || []) {
        if (!options.signal?.aborted) fn(event);
      }
    },
  };
};

function setup({ home = true, opening = false, reduced = false, fine = true,
  chinese = false, supported = true, animationError = false } = {}) {
  const animations = [];
  const frames = new Map();
  const intersections = [];
  const mutations = [];
  let frameID = 0;
  class Element {
    constructor(text = '') {
      Object.assign(this, events());
      this.dataset = {};
      this.attributes = new Map();
      this.styles = new Map();
      this.classes = new Set();
      this.classList = { add: x => this.classes.add(x), contains: x => this.classes.has(x) };
      this.style = { setProperty: (k, v) => this.styles.set(k, v), removeProperty: k => this.styles.delete(k) };
      this.childNodes = [];
      this.textContent = text;
    }
    get children() { return this.childNodes.filter(child => child instanceof Element); }
    set textContent(text) { this.text = text; this.childNodes = []; }
    get textContent() { return this.childNodes.length ? this.childNodes.map(x => x.textContent).join('') : this.text; }
    getAttribute(k) { return this.attributes.get(k) ?? null; }
    setAttribute(k, v) { this.attributes.set(k, v); }
    removeAttribute(k) { this.attributes.delete(k); }
    append(child) { this.childNodes.push(child); }
    replaceChildren(fragment) { this.childNodes = fragment.childNodes; }
    contains(other) { return this === other || this.children.includes(other); }
    getBoundingClientRect() { return { left: 10, top: 20, width: 120, height: 40 }; }
    animate(keyframes, options) {
      if (animationError) throw new Error('Unsupported animation');
      let resolve, reject;
      const animation = {
        target: this, keyframes, options, cancelled: false,
        finished: new Promise((res, rej) => { resolve = res; reject = rej; }),
        complete() { resolve(); },
        cancel() { this.cancelled = true; reject(new Error('cancelled')); },
      };
      animations.push(animation);
      return animation;
    }
  }
  const body = new Element();
  if (home) body.classes.add('yc-home-page');
  if (opening) body.classes.add('yc-opening-active');
  body.dataset.pixelState = 'idle';
  const names = [new Element(chinese ? '陆倚淳' : 'Yichun Lu'), new Element('Yichun Lu')];
  const header = new Element('Friends');
  const cards = Array.from({ length: 6 }, (_, i) => new Element(`Friend ${i}`));
  const section = { querySelector: () => header, querySelectorAll: () => cards };
  const button = new Element('Contact me');
  button.setAttribute('href', 'mailto:ylu336@connect.hkust-gz.edu.cn');
  const document = Object.assign(events(), {
    body, hidden: false, activeElement: null, documentElement: { lang: chinese ? 'zh-CN' : 'en' },
    querySelectorAll(selector) {
      return selector === '.yc-home-profile > h1' ? names : selector === '.friends-section' ? [section] : [button];
    },
    createElement: () => new Element(),
    createDocumentFragment: () => new Element(),
    // Text nodes are present for whitespace but excluded from HTMLCollection children.
    createTextNode: text => ({ textContent: text }),
  });
  const motion = Object.assign(events(), { matches: reduced });
  const pointer = Object.assign(events(), { matches: fine });
  const sandbox = Object.assign(events(), {
    Element, document, matchMedia: query => query.includes('reduced-motion') ? motion : pointer,
    requestAnimationFrame: fn => { frames.set(++frameID, fn); return frameID; },
    cancelAnimationFrame: id => frames.delete(id),
    AbortController: class { signal = { aborted: false }; abort() { this.signal.aborted = true; } },
    IntersectionObserver: supported ? class {
      targets = new Set();
      constructor(fn) { this.fn = fn; intersections.push(this); }
      observe(el) { this.targets.add(el); }
      unobserve(el) { this.targets.delete(el); }
      disconnect() { this.targets.clear(); }
    } : undefined,
    MutationObserver: class {
      constructor(fn) { this.fn = fn; mutations.push(this); }
      observe() {} disconnect() { this.fn = () => {}; }
    },
  });
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(source, context);
  return {
    body, document, names, header, cards, button, animations, frames, motion, pointer,
    rerun: () => vm.runInContext(source, context),
    mutate: () => mutations.forEach(o => o.fn()),
    emit: sandbox.emit,
    show(el, ratio = 1) {
      for (const observer of intersections) if (observer.targets.has(el))
        observer.fn([{ target: el, isIntersecting: ratio > 0, intersectionRatio: ratio }]);
    },
    tick() { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); },
  };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const mouse = { pointerType: 'mouse', buttons: 0, clientX: 130, clientY: 60 };

const live = setup({ opening: true });
live.show(live.names[0]);
assert.equal(live.animations.length, 0, 'No entrance underneath Welcome');
live.body.classes.delete('yc-opening-active');
live.mutate();
assert.equal(live.animations.length, 2, 'English name enters by word');
assert.equal(live.names[0].getAttribute('aria-label'), 'Yichun Lu');
assert.equal(live.names[0].textContent, 'Yichun Lu', 'Word splitting preserves whitespace');
assert.deepEqual(live.animations.map(a => a.options.delay), [0, 70]);
live.animations.forEach(a => a.complete()); await flush();
assert.equal(live.names[0].textContent, 'Yichun Lu');
assert.equal(live.names[0].children.length, 0, 'Restore natural typography after entrance');
assert.equal(live.names[0].getAttribute('aria-label'), null);
assert.equal(live.names[0].dataset.polishReveal, 'done');
live.show(live.names[0], 0); live.show(live.names[0]); live.rerun();
assert.equal(live.animations.length, 2, 'No replay or duplicate setup');

live.show(live.cards[0], 0.05);
assert.equal(live.cards[0].dataset.polishReveal, 'waiting');
live.body.dataset.pixelState = 'cover'; live.mutate(); live.show(live.cards[0]);
assert.equal(live.cards[0].dataset.polishReveal, 'waiting', 'Wait for page transition');
live.body.dataset.pixelState = 'idle'; live.mutate();
assert.equal(live.cards[0].dataset.polishReveal, 'playing');
live.document.emit('focusin', { target: live.cards[0] });
assert.equal(live.cards[0].dataset.polishReveal, 'done', 'Keyboard focus immediately reveals a card');
live.show(live.cards[5]);
assert.equal(live.animations.at(-1).options.delay, 180, 'Cap stagger delay');
live.show(live.cards[5], 0);
assert.ok(live.animations.at(-1).cancelled, 'No offscreen animation work');

live.button.emit('pointermove', mouse); live.button.emit('pointermove', mouse);
assert.equal(live.frames.size, 1, 'One scheduled pointer update at most');
live.tick();
assert.equal(live.frames.size, 0, 'No perpetual mouse animation loop');
assert.equal(live.button.styles.get('--yc-magnet-x'), '3.00px');
assert.equal(live.button.styles.get('--yc-magnet-y'), '2.00px');
live.button.emit('pointerleave'); assert.equal(live.button.styles.size, 0);
live.button.emit('pointermove', mouse); live.document.emit('scroll');
assert.equal(live.frames.size, 0, 'Scroll cancels pointer movement');
live.button.emit('pointermove', { ...mouse, pointerType: 'touch' });
assert.equal(live.frames.size, 0, 'No magnetic touch behavior');
live.button.emit('pointermove', mouse); live.button.emit('pointerdown');
assert.equal(live.frames.size, 0, 'Press keeps target stable');
assert.equal(live.button.getAttribute('href'), 'mailto:ylu336@connect.hkust-gz.edu.cn');

live.document.hidden = true; live.document.emit('visibilitychange'); live.show(live.cards[1]);
assert.equal(live.cards[1].dataset.polishReveal, 'waiting');
live.document.hidden = false; live.document.emit('visibilitychange');
assert.equal(live.cards[1].dataset.polishReveal, 'playing');
live.motion.matches = true; live.motion.emit('change');
assert.ok(live.animations.every(a => a.cancelled), 'Reduced motion settles active animations');
assert.ok(live.cards.every(e => e.dataset.polishReveal === 'done'));
live.button.emit('pointermove', mouse); assert.equal(live.frames.size, 0);

const zh = setup({ chinese: true });
zh.show(zh.names[0]); assert.equal(zh.animations.length, 3, 'Chinese name enters by character');
zh.animations.forEach(a => a.complete()); await flush();
assert.equal(zh.names[0].textContent, '陆倚淳');

const cached = setup();
cached.emit('pagehide', { persisted: true }); cached.show(cached.header);
assert.equal(cached.animations.length, 0);
cached.emit('pageshow'); assert.equal(cached.animations.length, 1);
cached.emit('pagehide', { persisted: false });
cached.emit('pageshow'); cached.show(cached.cards[0]);
cached.button.emit('pointermove', mouse);
assert.equal(cached.animations.length, 1, 'Disposed pages do not restart');
assert.equal(cached.frames.size, 0);

const quiet = setup({ reduced: true }); quiet.show(quiet.names[0]);
assert.equal(quiet.animations.length, 0);
assert.equal(quiet.names[0].textContent, 'Yichun Lu');
const coarse = setup({ fine: false }); coarse.button.emit('pointermove', mouse);
assert.equal(coarse.frames.size, 0);
const fallback = setup({ supported: false });
assert.equal(fallback.names[0].textContent, 'Yichun Lu');
assert.equal(fallback.names[0].dataset.polishReveal, undefined);
const failed = setup({ animationError: true }); failed.show(failed.names[0]);
assert.equal(failed.names[0].textContent, 'Yichun Lu', 'Animation failure preserves text');
assert.equal(failed.names[0].dataset.polishReveal, 'done');
assert.equal(setup({ home: false }).body.dataset.homePolish, undefined);
await flush();
console.log('PASS: Welcome/page transition coordination, EN/CN names, one-shot reveal, keyboard focus, bounded magnetic pointer, touch/reduced-motion, visibility, BFCache, disposal, fallback, homepage scope');
