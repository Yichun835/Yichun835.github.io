import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const page of ['research/index.html', 'zh-cn/research/index.html']) {
  const html = fs.readFileSync(new URL(`../${page}`, import.meta.url), 'utf8');
  const article = html.split('article-content max-w-prose')[1];
  assert.ok(article, `${page}: original article exists`);
  const list = article.match(/<ul>([\s\S]*?)<\/ul>/)?.[1];
  assert.ok(list, `${page}: interests remain an unordered list`);
  assert.equal((list.match(/<li>/g) || []).length, 4, `${page}: four peer interests`);
  assert.doesNotMatch(list, /<(?:a|button|h[1-6])\b|tabindex|onclick/, `${page}: no navigation or heading semantics`);
}

const css = fs.readFileSync(new URL('../css/aurora.css', import.meta.url), 'utf8');
const listRule = css.match(/body\.yc-research-page \.yc-research-editorial > ul \{([^}]+)\}/)?.[1];
const itemRule = css.match(/body\.yc-research-page \.yc-research-editorial > ul > li \{([^}]+)\}/)?.[1];
assert.match(listRule, /list-style: disc outside/);
assert.match(itemRule, /display: list-item/);
assert.match(itemRule, /font-weight: 400/);
assert.doesNotMatch(listRule + itemRule, /display: grid|min-height|cursor: pointer|border-(?:top|bottom)/);
console.log('PASS: English/Chinese interests are four equal, non-interactive list items, without navigation-style cards');
