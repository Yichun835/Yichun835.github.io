import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../js/aurora.js', import.meta.url), 'utf8');
const initStart = source.indexOf('  if (nativePageTransitions) {');
const initEnd = source.indexOf('  const pixelNoise', initStart);
const clickStart = source.indexOf('  document.addEventListener("click", (event) => {\n    const link = event.target.closest("a[href]");');
const clickEnd = source.indexOf('  window.addEventListener("pageshow"', clickStart);
assert.ok(initStart > 0 && initEnd > initStart && clickStart > 0 && clickEnd > clickStart);

function setup({ native = true, reduced = false } = {}) {
  const events = new Map(), storage = new Map(), classes = new Set();
  let click, covers = 0, prevented = 0, destination;
  const body = { dataset: { pixelState: 'idle', arrival: 'direct' },
    classList: { add: key => classes.add(key), contains: key => classes.has(key) } };
  const window = {
    location: { href: 'https://yichun835.github.io/about/', origin: 'https://yichun835.github.io',
      pathname: '/about/', search: '', assign: href => { destination = href; } },
    sessionStorage: { setItem: (key, value) => storage.set(key, value) },
    addEventListener: (name, fn) => events.set(name, fn),
  };
  const context = vm.createContext({
    window, body, URL, Date, nativePageTransitions: native,
    reducedMotion: { matches: reduced }, pixelStorageKey: 'transition',
    normalizePath: p => p.replace(/\/$/, '') || '/',
    beginPixelCover: fn => { covers++; fn(); },
    document: { addEventListener: (_, fn) => { click = fn; } },
  });
  vm.runInContext(source.slice(initStart, initEnd) + source.slice(clickStart, clickEnd), context);
  return {
    body, events, classes, storage,
    get covers() { return covers; }, get prevented() { return prevented; },
    get destination() { return destination; },
    click(href = 'https://yichun835.github.io/research/', options = {}) {
      const link = { href, target: options.target || '', hasAttribute: key => key === 'download' && !!options.download };
      click({ button: 0, preventDefault: () => { prevented++; }, ...options,
        target: { closest: () => options.missing ? null : link } });
    },
  };
}

const modern = setup();
modern.click();
assert.equal(modern.prevented, 0, 'Browser begins navigation immediately');
assert.equal(modern.covers, 0, 'No artificial cover delay');
assert.equal(modern.storage.size, 0, 'No stale PixelSwap handoff');
const legacy = setup({ native: false }); legacy.click();
assert.equal(legacy.prevented, 1);
assert.equal(legacy.covers, 1);
assert.equal(legacy.destination, 'https://yichun835.github.io/research/');
assert.equal(JSON.parse(legacy.storage.get('transition')).path, '/research');
for (const options of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true },
  { altKey: true }, { button: 1 }, { target: '_blank' }, { download: true },
  { defaultPrevented: true }, { missing: true }]) {
  const page = setup({ native: false }); page.click(undefined, options);
  assert.equal(page.prevented, 0, JSON.stringify(options));
}
for (const href of ['mailto:a@example.org', 'https://github.com/Yichun835',
  'https://yichun835.github.io/about/#summary']) {
  const page = setup({ native: false }); page.click(href);
  assert.equal(page.prevented, 0, href);
}
const quiet = setup({ native: false, reduced: true }); quiet.click();
assert.equal(quiet.covers, 0);

modern.events.get('pageswap')({});
assert.equal(modern.body.dataset.pixelState, 'idle');
let resolve, skipped = 0;
const transition = { ready: Promise.resolve(), finished: new Promise(r => { resolve = r; }), skipTransition: () => { skipped++; } };
modern.events.get('pageswap')({ viewTransition: transition });
assert.equal(modern.body.dataset.pixelState, 'cover');
modern.events.get('pagereveal')({ viewTransition: transition });
assert.equal(modern.body.dataset.arrival, 'internal');
assert.equal(modern.body.dataset.pixelState, 'reveal');
resolve(); await new Promise(r => setImmediate(r));
assert.equal(modern.body.dataset.pixelState, 'idle');
modern.classes.add('yc-opening-active');
modern.events.get('pagereveal')({ viewTransition: transition });
assert.equal(skipped, 1, 'Welcome stays click-controlled, outside the transition');
const motion = setup({ reduced: true });
motion.events.get('pageswap')({ viewTransition: transition });
assert.equal(skipped, 2);
const failed = setup();
failed.events.get('pagereveal')({ viewTransition: {
  ready: Promise.reject(new Error('Snapshot skipped')),
  finished: Promise.reject(new Error('Snapshot skipped')), skipTransition() {},
} });
await new Promise(r => setImmediate(r));
assert.equal(failed.body.dataset.pixelState, 'idle', 'Skipped snapshots cannot leave the cursor paused');
console.log('PASS: immediate native navigation, legacy handoff, modifier/download/external/hash links, reduced motion, transition state cleanup, Welcome protection');
