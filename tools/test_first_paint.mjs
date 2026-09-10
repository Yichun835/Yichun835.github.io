import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const template = fs.readFileSync(new URL('first-paint.html', import.meta.url), 'utf8').trim();
const source = template.match(/<script id="yc-first-paint-bootstrap">([\s\S]*?)<\/script>/)[1];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(new URL(file, root))).digest('hex').slice(0, 12);

function boot({ preference = null, systemDark = false, denied = false } = {}) {
  const classes = new Set(), events = new Map(), timers = new Map(), blocking = new Set([1, 2]);
  const root = { classList: {
    add: value => classes.add(value), remove: value => classes.delete(value),
    toggle(value, on) { if (on) classes.add(value); else classes.delete(value); },
  } };
  const on = (type, listener) => events.set(type, listener);
  vm.runInNewContext(source, {
    document: { documentElement: root, addEventListener: on,
      querySelectorAll: () => [1, 2].map(id => ({ removeAttribute: () => blocking.delete(id) })),
    },
    localStorage: { getItem() { if (denied) throw new Error('Storage disabled'); return preference; } },
    window: { matchMedia: () => ({ matches: systemDark }), addEventListener: on,
      setTimeout(fn, delay) { timers.set(1, { fn, delay }); return 1; },
      clearTimeout: id => timers.delete(id),
    },
  });
  return { classes, timers, blocking, emit: (name, event) => events.get(name)?.(event) };
}

for (const settings of [
  { preference: 'dark', systemDark: false, expectedDark: true },
  { preference: 'light', systemDark: true, expectedDark: false },
  { systemDark: true, expectedDark: true },
  { systemDark: false, expectedDark: false },
  { denied: true, systemDark: true, expectedDark: true },
]) {
  const page = boot(settings);
  assert.equal(page.classes.has('dark'), settings.expectedDark, 'Correct theme before parsing body');
  assert.ok(page.classes.has('yc-ui-pending'), 'Do not expose unenhanced template');
  page.emit('DOMContentLoaded');
  assert.ok(!page.classes.has('yc-ui-pending'), 'Reveal immediately after ordered deferred scripts');
  assert.equal(page.timers.size, 0, 'Clear watchdog after normal initialization');
}
const failed = boot();
failed.emit('DOMContentLoaded');
assert.ok(!failed.classes.has('yc-ui-pending'), 'Failed asset requests cannot trap the content');
const stalled = boot();
assert.equal(stalled.timers.get(1).delay, 4000);
stalled.timers.get(1).fn();
assert.ok(!stalled.classes.has('yc-ui-pending'), 'Watchdog releases stalled network requests');
assert.equal(stalled.blocking.size, 0, 'Watchdog also releases native render blockers');
stalled.emit('DOMContentLoaded'); // A late response is harmless.
const cached = boot(); cached.emit('pageshow');
assert.ok(!cached.classes.has('yc-ui-pending'), 'History restoration releases the cover');
const navigation = boot();
let caught = 0;
for (const type of ['pagereveal', 'pageswap']) navigation.emit(type, { viewTransition: { ready: { catch: () => caught++ } } });
assert.equal(caught, 2, 'Handle skipped snapshots before deferred scripts are installed');
assert.match(template, /html\.yc-ui-pending \.yc-opening-screen \{ visibility: visible; \}/, 'Welcome remains visible and focusable during initialization');

const pages = execFileSync('git', ['ls-files', '*.html'], { cwd: root, encoding: 'utf8' }).trim().split('\n');
let count = 0;
for (const file of pages) {
  const html = fs.readFileSync(new URL(file, root), 'utf8');
  if (!html.includes('/js/aurora.js')) continue;
  if (!/<body\b/.test(html)) continue;
  count++;
  assert.ok(html.includes(template), `${file}: shared inline bootstrap`);
  assert.equal((html.match(/id="yc-first-paint-bootstrap"/g) || []).length, 1);
  const head = html.slice(0, html.indexOf('</head>'));
  assert.ok(head.indexOf('yc-first-paint-bootstrap') < head.indexOf('appearance.min.'), `${file}: theme before any blocking vendor script`);
  assert.ok(head.indexOf('/css/main.bundle') < head.indexOf('/css/aurora.css'), `${file}: custom CSS follows base CSS`);
  assert.ok(head.indexOf('/css/aurora.css') < head.indexOf('appearance.min.'), `${file}: discover final styling early`);
  assert.ok(head.includes(`<script defer blocking="render" data-yc-ui-render src="/js/aurora.js?v=${hash('js/aurora.js')}"></script>`));
  assert.ok(head.includes(`<script defer blocking="render" data-yc-ui-render src="/js/site-controls.js?v=${hash('js/site-controls.js')}"></script>`));
  assert.ok(head.includes(`/css/aurora.css?v=${hash('css/aurora.css')}`));
  assert.ok(head.indexOf('/js/aurora.js') < head.indexOf('/js/site-controls.js'), `${file}: finish UI in deterministic order`);
  const body = html.match(/<body class="([^"]*)"/)[1];
  assert.ok(body.includes('yichun-subtle'), `${file}: static base style`);
  const path = file.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
  if (['/', 'zh-cn', 'en'].includes(path)) assert.ok(body.includes('yc-home-page'));
  const profile = path.match(/^(?:(?:zh-cn|en)\/)?(about|research|cv|contact)$/);
  if (profile) assert.ok(body.includes(`yc-profile-page yc-${profile[1]}-page`));
  assert.ok(!html.match(/<html[^>]*class=[^>]*yc-ui-pending/), 'No JavaScript means no hidden-content class');
}
const aurora = fs.readFileSync(new URL('js/aurora.js', root), 'utf8');
assert.ok(!aurora.includes('siteControls.async'), 'No late asynchronous toolbar replacement');
console.log(`PASS: ${count} pages, first-paint theme, ordered UI, fingerprints, Welcome focus, storage denial, no-JS, failed/stalled assets and history fallback`);
