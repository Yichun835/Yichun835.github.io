import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const controls = fs.readFileSync(new URL('../js/site-controls.js', import.meta.url), 'utf8');
const aurora = fs.readFileSync(new URL('../js/aurora.js', import.meta.url), 'utf8');
const copySource = controls.slice(controls.indexOf('  async function copyEmail(text)'), controls.indexOf('  let resetFeedback'));
assert.ok(copySource.includes('document.execCommand("copy")'));
async function checkCopy({ clipboard, fallback = false }) {
  let appended = 0, removed = 0, selected = 0, focused = 0, commands = 0;
  const field = { setAttribute() {}, select() { selected++; }, remove() { removed++; } };
  const context = vm.createContext({ navigator: { clipboard }, chinese: false,
    document: { activeElement: { focus() { focused++; } }, createElement: () => field,
      body: { append() { appended++; } }, execCommand(cmd) { assert.equal(cmd, 'copy'); commands++; return fallback; } },
  });
  vm.runInContext(copySource, context);
  const copied = await vm.runInContext('copyEmail("person@example.org")', context);
  return { copied, appended, removed, selected, focused, commands, field };
}
let copiedText;
const modern = await checkCopy({ clipboard: { writeText: async text => { copiedText = text; } } });
assert.equal(modern.copied, true); assert.equal(modern.commands, 0); assert.equal(copiedText, 'person@example.org');
const legacy = await checkCopy({ fallback: true });
assert.equal(legacy.copied, true); assert.equal(legacy.removed, 1); assert.equal(legacy.focused, 1);
assert.equal(legacy.field.value, 'person@example.org');
const denied = await checkCopy({ clipboard: { writeText: async () => { throw Error('Denied'); } }, fallback: false });
assert.equal(denied.copied, false); assert.equal(denied.removed, 1);

const stateSource = aurora.slice(aurora.indexOf('  window.ycSilkState = {'), aurora.indexOf('  const wordmark'));
assert.ok(stateSource.includes('yc-silk-phase-v1'));
const storage = new Map();
let now = 1000000;
const window = { sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) } };
vm.runInNewContext(stateSource, { window, Date: { now: () => now } });
assert.equal(window.ycSilkState.read(), 4);
window.ycSilkState.save(37.42);
assert.equal(window.ycSilkState.read(), 37.42, 'Next document resumes the material rather than restarting');
now += 301000; assert.equal(window.ycSilkState.read(9), 9, 'Old visits do not force a stale phase');
storage.set('yc-silk-phase-v1', '{broken'); assert.equal(window.ycSilkState.read(), 4);
window.sessionStorage = { getItem() { throw Error('Blocked'); }, setItem() { throw Error('Blocked'); } };
assert.doesNotThrow(() => window.ycSilkState.save(9)); assert.equal(window.ycSilkState.read(), 4);

assert.match(controls, /document\.querySelector\("#switch-layout-button"\)\?\.click\(\)/, 'Layout delegates to original transition handler');
assert.match(controls, /event\.key === "Escape"/);
assert.match(controls, /event\.detail > 0\) button\.blur\(\)/, 'Pointer copying does not leave a paused marquee');
assert.match(aurora, /pill\.append\(link, copy\)/, 'Copy button is a sibling of the email link, never nested inside it');
assert.match(aurora, /if \(duplicate\) copy\.tabIndex = -1/, 'The duplicate copy button is not an extra tab stop');
for (const page of ['index.html', 'zh-cn/index.html']) {
  const html = fs.readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
  assert.equal((html.match(/src=\/img\/yichun-home-portrait\.jpg/g) || []).length, 6);
  assert.doesNotMatch(html, /src=https:\/\/yichun835.github.io\/img\/home-avatar/);
}
console.log('PASS: clipboard success/fallback/failure, cleanup/focus, shared material phase/storage fallback, controls semantics, EN/CN homepage avatar paths');
