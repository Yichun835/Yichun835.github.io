import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../js/site-controls.js', import.meta.url), 'utf8');
const fallback = source.slice(source.indexOf('  function installMailFallback()'), source.indexOf('  async function copyEmail(text)'));
assert.ok(fallback.includes('installMailFallback();'));

for (const chinese of [false, true]) {
  const events = {};
  const lifecycle = {};
  const children = new Map();
  let appended = 0, focus = 0, prevented = 0;
  const element = () => ({ dataset: {}, textContent: '', hidden: true, isConnected: true,
    setAttribute() {}, focus() { focus++; }, contains(target) { return target === this; },
    addEventListener(name, fn) { this[name] = fn; },
    querySelector(selector) { if (!children.has(selector)) children.set(selector, element()); return children.get(selector); },
  });
  const panel = element();
  const document = {
    createElement: () => panel,
    body: { append() { appended++; } },
    addEventListener(name, fn) { events[name] = fn; },
  };
  vm.runInNewContext(fallback, { document, chinese, addEventListener(name, fn) { lifecycle[name] = fn; } });
  const link = { ...element(), getAttribute: () => 'mailto:person%2Bweb@example.org?subject=Hello' };
  const click = extra => events.click({ target: { closest: () => link }, button: 0, detail: 1,
    preventDefault() { prevented++; }, ...extra });
  for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey', 'defaultPrevented']) click({ [modifier]: true });
  click({ button: 1 });
  assert.equal(appended, 0, 'Modified/default-prevented actions keep native behavior');
  click();
  assert.equal(appended, 1);
  assert.equal(panel.hidden, false, 'Immediate visible fallback, no delayed handler detection');
  assert.equal(prevented, 0, 'Native mailto is not canceled');
  assert.equal(focus, 0, 'Pointer action does not steal focus from the mail app');
  assert.equal(children.get('.yc-mail-help-address').textContent, 'person+web@example.org');
  assert.equal(children.get('.yc-mail-help-copy').dataset.copyEmail, 'person+web@example.org');
  assert.match(children.get('.yc-mail-help-note').textContent, chinese ? /如果邮件应用没有打开/ : /If your mail app doesn’t open/);
  assert.match(children.get('[role="status"]').textContent, chinese ? /已请求/ : /requested/);
  click({ detail: 0 });
  assert.equal(appended, 1, 'Reuse one card across layouts');
  assert.equal(focus, 1, 'Keyboard users reach the copy action');
  events.keydown({ key: 'Escape', preventDefault() {} });
  assert.equal(panel.hidden, true);
  assert.equal(focus, 2, 'Escape restores trigger focus');
  click(); children.get('.yc-mail-help-close').click();
  assert.equal(panel.hidden, true);
  click(); events.pointerdown({ target: panel });
  assert.equal(panel.hidden, false, 'Inside clicks do not dismiss the card');
  events.pointerdown({ target: {} });
  assert.equal(panel.hidden, true);
  click(); lifecycle.pagehide(); assert.equal(panel.hidden, true);
  link.getAttribute = () => 'https://example.org'; click(); assert.equal(panel.hidden, true);
  link.getAttribute = () => 'mailto:%ZZ'; click(); assert.equal(panel.hidden, true);
}
const css = fs.readFileSync(new URL('../css/aurora.css', import.meta.url), 'utf8');
assert.match(css, /\.yc-mail-help\[hidden\] \{ display: none !important; \}/);
assert.match(css, /html\.dark \.yc-mail-help/);
assert.match(css, /width: min\(356px, calc\(100vw - 32px\)\)/);
assert.match(source, /button\.closest\("\.yc-mail-help"\)\?\.querySelector\('\[role="status"\]'\)/);
console.log('PASS: EN/CN email fallback, native mailto preserved, no false success, decoded address, modified clicks, keyboard/close/outside/pagehide, responsive themes');
