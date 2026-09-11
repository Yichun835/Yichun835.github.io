import assert from 'node:assert/strict';
import fs from 'node:fs';

const expectedNames = ['ZHUOYUYU', 'Fanchu Xu', 'Anxian Liu', 'Ruonan Zheng', 'Ryan Lan', 'Yulu Hu'];
const href = 'https://github.com/tpmoonchefryan';
const avatar = '/img/friends/ryan-lan.jpg';

for (const page of ['index.html', 'zh-cn/index.html']) {
  const html = fs.readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
  const friends = [...html.matchAll(/<(a|div)\b[^>]*aria-label="Friend: ([^"]+)"[^>]*>[\s\S]*?<\/\1>/g)];
  assert.deepEqual(friends.map(match => match[2]), expectedNames, `${page}: preserve all friends in order`);
  assert.equal(friends.filter(match => match[1] === 'a').length, 5, `${page}: preserve existing working links`);
  const ryan = friends.find(match => match[2] === 'Ryan Lan')[0];
  assert.ok(ryan.includes(`href="${href}"`), `${page}: GitHub destination`);
  assert.ok(ryan.includes(`src="${avatar}"`), `${page}: root-relative local avatar`);
  assert.ok(ryan.includes('alt="Ryan Lan"'), `${page}: accessible avatar`);
  assert.match(ryan, /<span\b[^>]*>Ryan Lan\s*<\/span>/, `${page}: identical visible name`);
  assert.ok(ryan.includes('rel="noopener noreferrer"'));
  assert.ok(ryan.includes('loading=lazy'));
  assert.ok(ryan.includes('width=64 height=64'), `${page}: reserve image space`);
  const yulu = friends.find(match => match[2] === 'Yulu Hu')[0];
  assert.match(yulu, /^<div\b/, `${page}: a non-interactive friend, not a placeholder link`);
  assert.ok(yulu.includes('class="yc-friend-static flex flex-col items-center gap-2 w-24"'));
  assert.ok(yulu.includes('role="group"'));
  assert.ok(yulu.includes('src="/img/friends/yulu-hu.jpg"'));
  assert.ok(yulu.includes('alt="Yulu Hu"'));
  assert.ok(yulu.includes('width=64 height=64 loading=lazy'));
  assert.match(yulu, /<span\b[^>]*>Yulu Hu<\/span>/);
  assert.doesNotMatch(yulu, /href=|tabindex=|onclick=|group-hover:|role="(?:link|button)"/i);
}

const image = fs.readFileSync(new URL(`..${avatar}`, import.meta.url));
assert.equal(image.readUInt16BE(0), 0xffd8, 'Avatar is a JPEG');
const css = fs.readFileSync(new URL('../css/aurora.css', import.meta.url), 'utf8');
assert.match(css, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/, 'Six desktop columns');
assert.match(css, /grid-template-columns: repeat\(6, minmax\(104px, 1fr\)\)/, 'Six scrollable mobile columns');
assert.match(css, /grid-template-columns: repeat\(6, minmax\(104px, 1fr\)\);\s+justify-content: start;/, 'Keep the first friend reachable at the start of mobile overflow');
assert.match(css, /\.yc-friend-static \{ cursor: default; \}/);
assert.equal(fs.readFileSync(new URL('../img/friends/yulu-hu.jpg', import.meta.url)).readUInt16BE(0), 0xffd8);
console.log('PASS: six friends, bilingual Yulu Hu, five preserved links, non-interactive new entry, local JPEGs, lazy loading and responsive row');
