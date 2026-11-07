// Pages that used to have no canonical tag (7 Nov 2026, Ahrefs "duplicate pages without canonical"): each is served
// at both craftsbyjon.co.uk and www.craftsbyjon.co.uk, so each needs exactly one absolute, non-www canonical that
// points at its own .html address (clean URLs return 404).
//   node tests/canonical-tags.test.cjs
'use strict';
const fs = require('fs'), path = require('path');
const pages = ['custom-orders', 'terms', 'privacy', 'world-cup-2026'];
let fails = 0;
for (const p of pages) {
  const html = fs.readFileSync(path.join(__dirname, '..', p + '.html'), 'utf8');
  const tags = html.match(/<link[^>]+rel="canonical"[^>]*>/g) || [];
  const href = tags.length === 1 ? (tags[0].match(/href="([^"]*)"/) || [])[1] : null;
  const ok = tags.length === 1 && href === `https://craftsbyjon.co.uk/${p}.html` && html.indexOf(tags[0]) < html.indexOf('</head>');
  if (!ok) fails++;
  console.log(`${ok ? 'pass' : 'FAIL'}  ${p}.html canonical`, ok ? '' : `tags=${tags.length} href=${href}`);
}
console.log(fails ? `${fails} failed` : `all ${pages.length} pages have one canonical`);
process.exit(fails ? 1 : 0);
