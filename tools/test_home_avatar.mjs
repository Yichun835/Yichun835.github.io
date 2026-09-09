import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/aurora.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../css/aurora.css', import.meta.url), 'utf8');
const start = source.indexOf('    const addPhotoSpotlight =');
const end = source.indexOf('    for (const layoutId', start);
assert.ok(start >= 0 && end > start);

function setup(variant) {
  const created = [], windowEvents = new Map();
  const makeElement = () => {
    const styles = new Map(), events = new Map();
    return {
      styles, events, dataset: {}, children: [],
      style: { setProperty: (key, value) => styles.set(key, value) },
      append(child) { this.children.push(child); },
      setAttribute() {},
      addEventListener: (name, fn) => events.set(name, fn),
      getBoundingClientRect: () => ({ left: 100, top: 100, width: 144, height: 144 }),
    };
  };
  const avatar = { before() {}, parentElement: { classList: { contains: () => false } } };
  vm.runInNewContext(source.slice(start, end) + '\naddPhotoSpotlight(avatar, variant);', {
    avatar, variant,
    document: { createElement() { const el = makeElement(); created.push(el); return el; } },
    window: { addEventListener: (name, fn) => windowEvents.set(name, fn) },
  });
  return { frame: created[0], windowEvents };
}

const { frame, windowEvents } = setup('hero');
assert.equal(frame.styles.get('--yc-photo-intensity'), '0', 'No luminous effects');
assert.equal(frame.dataset.active, 'false');
assert.equal(frame.styles.get('--yc-magnet-x'), '0px');
assert.equal(frame.styles.get('--yc-magnet-y'), '0px');
assert.equal(frame.events.size, 0, 'Static portrait has no hover, motion or touch listeners');
assert.equal(windowEvents.size, 0, 'No unnecessary window listeners for a static frame');

const social = setup('social').frame;
assert.equal(social.styles.get('--yc-photo-intensity'), '0.38');
social.events.get('pointermove')({ clientX: 220, clientY: 130, pointerType: 'mouse' });
assert.notEqual(social.styles.get('--yc-magnet-x'), '0px', 'Friends and mentors retain their existing effect');
social.events.get('pointerleave')();
assert.equal(social.styles.get('--yc-photo-intensity'), '0.38');
assert.equal(social.styles.get('--yc-magnet-x'), '0px');

assert.match(css, /\.yc-photo-spotlight--hero\s*\{[^}]*transform: none;/);
assert.match(css, /\.yc-photo-spotlight--hero::before\s*\{\s*content: none;/, 'No halo or rotating outer ring');
assert.match(css, /html\.dark \.yc-photo-spotlight--hero::after\s*\{[^}]*filter: none;[^}]*opacity: 1;[^}]*transition: none;/, 'Permanent frame without glow or motion');
assert.match(css, /\.yc-home-avatar-crop > img\s*\{[^}]*object-fit: contain;[^}]*transform: none;/);
assert.doesNotMatch(css, /yc-avatar-(scan|aperture)|\.yc-home-avatar-crop::after/, 'Obsolete scanner CSS removed');
console.log('PASS: static bronze frame, no glow/scan/motion/listeners, original photograph framing, unchanged friends and mentors');
