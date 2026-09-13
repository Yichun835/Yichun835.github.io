import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const avatar = '/img/mentors/fangda-cuhksz-3d856e65.jpg';
const officialHash = '3d856e652e51984484b04a1989e0cb05bddf69603c6d3d199ef533ba28733b4b';
const image = fs.readFileSync(new URL(`..${avatar}`, import.meta.url));
assert.equal(image.readUInt16BE(0), 0xffd8, 'Official portrait is a JPEG');
assert.equal(createHash('sha256').update(image).digest('hex'), officialHash, 'Preserve official original bytes');

for (const page of ['index.html', 'zh-cn/index.html']) {
  const html = fs.readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
  const mentors = [...html.matchAll(/<a\b[^>]*aria-label="(?:Mentor|导师): ([^"]+)"[^>]*>[\s\S]*?<\/a>/g)];
  assert.deepEqual(mentors.map(match => match[1]), ['C. Y. Kelvin Yuen', 'Fangda'], `${page}: preserve mentor order and names`);
  const fang = mentors.find(match => match[1] === 'Fangda')[0];
  assert.ok(fang.includes('href=https://myweb.cuhk.edu.cn/fangda###'), `${page}: preserve official destination`);
  assert.ok(fang.includes(`src="${avatar}"`), `${page}: use local cache-versioned official photo`);
  assert.ok(fang.includes('alt=Fangda'));
  assert.ok(fang.includes('width=64 height=64 loading=lazy'), `${page}: preserve image dimensions and lazy loading`);
  assert.ok(fang.includes('object-fit:cover;object-position:center top'), `${page}: no stretching or clipped hair`);
  assert.doesNotMatch(fang, /src=[^\s>]*\/img\/mentors\/fangda\.jpg/, `${page}: no stale photo`);
  const kelvin = mentors.find(match => match[1] === 'C. Y. Kelvin Yuen')[0];
  assert.ok(kelvin.includes('href=https://kelvincyyuen.com/'), `${page}: preserve Kelvin link`);
  assert.ok(kelvin.includes('/img/mentors/kelvin-yuen.jpg'), `${page}: preserve Kelvin portrait`);
}

console.log('PASS: official Fangda original, local versioned path, bilingual mentors, equal-scale avatar crop and unchanged Kelvin');
