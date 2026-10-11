// Renders /products/{id} with the product-page.js on a craftsbyjon-vps-app branch, for every Ready to Go product
// (plus the draft photo mug, for its test). Run on the VPS from a clone of this repo:
//   node preview/tools/build-product-pages.mjs <path-to-vps-app-branch>/products-api
// Writes:
//   tests/fixtures/product-pages/{id}.html   shop files from /store/ (what the live page would load) - browser tests
//   preview/products/{id}.html               shop files from /preview/lib/, noindex, no analytics - staff preview
// Reads products.db read-only. The preview pages use the real public API, basket and checkout.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const apiDir = path.resolve(process.argv[2]);
const require = createRequire(path.join(apiDir, 'package.json'));
const Database = require('better-sqlite3');
const { renderProductPage, escapeHtml } = await import(path.join(apiDir, 'product-page.js'));
const { relatedProducts, relatedHeading } = await import(path.join(apiDir, 'related-products.js'));
const { designLinks, TYPE_LABELS } = await import(path.join(apiDir, 'design-links.js'));
const db = new Database(process.env.PRODUCTS_DB || '/home/craftsbyjon/products-api/products.db', { readonly: true });
const img = p => { if (!p) return null; if (p.startsWith('https://')) return p; const f = p.split('/').pop(); return 'https://images.craftsbyjon.co.uk/products/' + (f.includes('.') ? f : f + '.jpg'); };
const live = db.prepare(`SELECT product_id, title, collection, product_type, design_key FROM products WHERE LOWER(ready_to_go) = 'yes'`).all();
const rows = db.prepare(`SELECT * FROM products WHERE LOWER(ready_to_go) = 'yes' OR personalisation_spec LIKE '%photo%' ORDER BY product_id`).all();
// Same link lists the route builds (index.js), so the generated pages match what the server would send.
function lists(row) {
  let relatedHtml = '', designHtml = '';
  const related = relatedProducts(live, row.product_id);
  if (related.length) { const h = escapeHtml(relatedHeading(row.collection)); relatedHtml = `<nav class="related" aria-label="${h}"><h2>${h}</h2><ul>${related.map(r => `<li><a href="https://craftsbyjon.co.uk/products/${encodeURIComponent(r.product_id)}">${escapeHtml(r.title || r.product_id)}</a></li>`).join('')}</ul></nav>`; }
  const same = designLinks(live, row.product_id);
  if (same.length) designHtml = `<nav class="related" aria-label="Also available as"><h2>Love this design? Also available as</h2><ul>${same.map(r => `<li><a href="https://craftsbyjon.co.uk/products/${encodeURIComponent(r.product_id)}">${escapeHtml(TYPE_LABELS[r.product_type] || r.product_type)}: ${escapeHtml(r.title || r.product_id)}</a></li>`).join('')}</ul></nav>`;
  return { relatedHtml, designHtml };
}
fs.mkdirSync('tests/fixtures/product-pages', { recursive: true });
fs.mkdirSync('preview/products', { recursive: true });
for (const row of rows) {
  const l = lists(row);
  fs.writeFileSync(`tests/fixtures/product-pages/${row.product_id}.html`, renderProductPage(row, img, { ...l }));
  // Links between products stay inside the preview.
  const prev = renderProductPage(row, img, { ...l, assets: '/preview/lib/', preview: true })
    .replace(/https:\/\/craftsbyjon\.co\.uk\/products\/([a-z0-9-]+)/gi, (m, id) => `/preview/products/${id}.html`);
  fs.writeFileSync(`preview/products/${row.product_id}.html`, prev);
}
console.log('rendered', rows.length, 'product pages (tests and preview)');
