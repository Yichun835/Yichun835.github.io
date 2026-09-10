// Keep generated static pages on the same pre-paint bootstrap and asset versions.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const bootstrap = fs.readFileSync(new URL('first-paint.html', import.meta.url), 'utf8').trim();
const fingerprint = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex').slice(0, 12);
const cssURL = `/css/aurora.css?v=${fingerprint('css/aurora.css')}`;
const auroraURL = `/js/aurora.js?v=${fingerprint('js/aurora.js')}`;
const controlsURL = `/js/site-controls.js?v=${fingerprint('js/site-controls.js')}`;
const pages = execFileSync('git', ['ls-files', '*.html'], { cwd: root, encoding: 'utf8' }).trim().split('\n');
let changed = 0;
for (const page of pages) {
  const file = path.join(root, page);
  const original = fs.readFileSync(file, 'utf8');
  if (!original.includes('/js/aurora.js')) continue;
  // Hugo's /en/ entry is a meta-refresh alias, not a rendered page.
  if (!/<body\b/.test(original)) {
    const html = original.replace(/\/css\/aurora\.css\?v=[^"<>]*/g, cssURL)
      .replace(/\/js\/aurora\.js\?v=[^"<>]*/g, auroraURL);
    if (html !== original) { fs.writeFileSync(file, html); changed++; }
    continue;
  }
  let html = original.replace(/<style id="yc-first-paint">[\s\S]*?<\/style>\s*<script id="yc-first-paint-bootstrap">[\s\S]*?<\/script>\s*/g, '');
  html = html.replace(/(<meta charset=utf-8>)/, `$1\n${bootstrap}\n`);
  const pagePath = page.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
  const home = ['/', 'zh-cn', 'en'].includes(pagePath);
  const profile = pagePath.match(/^(?:(?:zh-cn|en)\/)?(about|research|cv|contact)$/);
  const classes = ['yichun-subtle', ...(home ? ['yc-home-page'] : []), ...(profile ? ['yc-profile-page', `yc-${profile[1]}-page`] : [])];
  html = html.replace(/<body class="([^"]*)"/, (_, value) => `<body class="${[...new Set([...value.split(/\s+/), ...classes])].join(' ')}"`);
  // Discover both stylesheets before parser-blocking theme/vendor scripts.
  html = html.replace(/<link rel="stylesheet" href="\/css\/aurora\.css[^">]*">\s*/g, '');
  html = html.replace(/(<link\b[^>]*href=[^>]*\/css\/main\.bundle[^>]*>)/, `$1\n<link rel="stylesheet" href="${cssURL}">\n`);
  html = html.replace(/<script defer(?: blocking="render" data-yc-ui-render)? src="\/js\/aurora\.js[^">]*">\s*<\/script>/, `<script defer blocking="render" data-yc-ui-render src="${auroraURL}"></script>`);
  html = html.replace(/<script defer(?: blocking="render" data-yc-ui-render)? src="\/js\/site-controls\.js[^">]*">\s*<\/script>\s*/g, '');
  html = html.replace(`src="${auroraURL}"></script>`, `src="${auroraURL}"></script>\n<script defer blocking="render" data-yc-ui-render src="${controlsURL}"></script>\n`);
  if (html !== original) { fs.writeFileSync(file, html); changed++; }
}
console.log(`Synchronized first paint and content-hashed assets in ${changed} pages.`);
