import assert from 'node:assert/strict';
import fs from 'node:fs';

const expectedNames = ['ZHUOYUYU', 'Fanchu Xu', 'Anxian Liu', 'Ruonan Zheng', 'Ryan Lan'];
const href = 'https://github.com/tpmoonchefryan';
const avatar = '/img/friends/ryan-lan.jpg';

for (const page of ['index.html', 'zh-cn/index.html']) {
  const html = fs.readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
  const friends = [...html.matchAll(/<a\b[^>]*aria-label="Friend: ([^"]+)"[^>]*>[\s\S]*?<\/a>/g)];
  assert.deepEqual(friends.map(match => match[1]), expectedNames, `${page}: preserve all friends in order`);
  const ryan = friends.find(match => match[1] === 'Ryan Lan')[0];
  assert.ok(ryan.includes(`href="${href}"`), `${page}: GitHub destination`);
  assert.ok(ryan.includes(`src="${avatar}"`), `${page}: root-relative local avatar`);
  assert.ok(ryan.includes('alt="Ryan Lan"'), `${page}: accessible avatar`);
  assert.match(ryan, /<span\b[^>]*>Ryan Lan\s*<\/span>/, `${page}: identical visible name`);
  assert.ok(ryan.includes('rel="noopener noreferrer"'));
  assert.ok(ryan.includes('loading=lazy'));
  assert.ok(ryan.includes('width=64 height=64'), `${page}: reserve image space`);
}

const image = fs.readFileSync(new URL(`..${avatar}`, import.meta.url));
assert.equal(image.readUInt16BE(0), 0xffd8, 'Avatar is a JPEG');
const css = fs.readFileSync(new URL('../css/aurora.css', import.meta.url), 'utf8');
assert.match(css, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/, 'Five desktop columns');
assert.match(css, /grid-template-columns: repeat\(5, minmax\(104px, 1fr\)\)/, 'Five scrollable mobile columns');
assert.match(css, /grid-template-columns: repeat\(5, minmax\(104px, 1fr\)\);\s+justify-content: start;/, 'Keep the first friend reachable at the start of mobile overflow');
console.log('PASS: five friends, identical EN/CN Ryan Lan name, local JPEG, GitHub link, lazy loading and responsive row');
