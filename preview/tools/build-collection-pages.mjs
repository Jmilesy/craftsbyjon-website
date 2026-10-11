// Renders every visible /collections/{slug} page with the collections code on a craftsbyjon-vps-app branch
// (Stage C, 12 Oct 2026). Run on the VPS from a clone of this repo:
//   node preview/tools/build-collection-pages.mjs <path-to-vps-app-branch>/products-api
// Writes:
//   tests/fixtures/collection-pages/{slug}.html  shop files from /store/, links as on the live site - browser tests
//   preview/collections/{slug}.html              shop files from /preview/lib/, noindex, no analytics, links to the
//                                                preview product and collection pages - staff preview
// Reads products.db read-only (also works before the 13 Oct collection-management migration: built-in pages).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const apiDir = path.resolve(process.argv[2]);
const require = createRequire(path.join(apiDir, 'package.json'));
const Database = require('better-sqlite3');
const C = await import(path.join(apiDir, 'collections.js'));
const { renderCollectionPage } = await import(path.join(apiDir, 'collection-page.js'));
const db = new Database(process.env.PRODUCTS_DB || '/home/craftsbyjon/products-api/products.db', { readonly: true });
const pages = C.loadPages(db), cat = C.catalogue(db), nav = C.visiblePages(pages, cat);
for (const d of ['tests/fixtures/collection-pages', 'preview/collections']) { fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); }
for (const { page } of nav) {
  const products = C.productsFor(page, cat);
  fs.writeFileSync(`tests/fixtures/collection-pages/${page.slug}.html`, renderCollectionPage(page, products, { nav }));
  const prev = renderCollectionPage(page, products, { nav, assets: '/preview/lib/', preview: true, linkBase: '/preview/collections/', linkSuffix: '.html' })
    .replace(/href="\/products\/([a-z0-9-]+)"/gi, (m, id) => `href="/preview/products/${id}.html"`);
  fs.writeFileSync(`preview/collections/${page.slug}.html`, prev);
}
fs.writeFileSync('tests/fixtures/collection-pages/_index.json', JSON.stringify(nav.map(n => ({ slug: n.page.slug, name: n.page.name, kind: n.page.source || n.page.kind, count: n.count, products: C.productsFor(n.page, cat).map(p => p.id) })), null, 2));
console.log('rendered', nav.length, 'collection pages (tests and preview)');
