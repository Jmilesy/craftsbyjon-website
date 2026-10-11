// Builds the read-only data snapshot the storefront mockups in /preview/ run on.
// Run on the VPS from a clone of craftsbyjon-vps-app that has products-api/storefront-catalogue.js:
//   node preview/tools/build-snapshot.mjs <path-to-products-api> > preview/data/snapshot.json
// It only reads products.db (opened read-only) and the public variant lists. The preview pages never
// call the live API, send analytics or start a checkout; they only read this file.

import path from 'node:path';
import { createRequire } from 'node:module';

const apiDir = path.resolve(process.argv[2] || '/home/craftsbyjon/products-api');
const require = createRequire(path.join(apiDir, 'package.json'));
const Database = require('better-sqlite3');
const { buildCatalogue } = await import(path.join(apiDir, 'storefront-catalogue.js'));

const db = new Database(process.env.PRODUCTS_DB || '/home/craftsbyjon/products-api/products.db', { readonly: true });
const rows = db.prepare('SELECT * FROM products ORDER BY COALESCE(sort_order, 9999) ASC, product_id ASC').all();
const collections = db.prepare('SELECT id, name, status, sort_order, banner_image, valid_months FROM collections ORDER BY sort_order').all();
const catalogue = buildCatalogue(rows, collections);
const byId = new Map(rows.map(r => [r.product_id, r]));
// Same columns the public /products/:id/public-variants route already returns, nothing more.
const variantStmt = db.prepare('SELECT id, gelato_variant_id, gelato_product_uid, option1_name, option1_value, option2_name, option2_value, option3_name, option3_value, image_url, retail_price_pence FROM product_variants WHERE product_id = ? AND active = 1 ORDER BY id');

const IMG_RE = /https:\/\/images\.craftsbyjon\.co\.uk\/products\/[A-Za-z0-9_.-]+\.(?:jpe?g|png|webp)|^[A-Za-z0-9_.-]+\.(?:jpe?g|png|webp)$/gi;
function urlsIn(v) {
  if (!v) return [];
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  let parsed = null;
  try { parsed = JSON.parse(s); } catch {}
  const out = [];
  const walk = x => {
    if (typeof x === 'string') { (x.match(IMG_RE) || []).forEach(u => out.push(u)); if (!out.length && /\.(jpe?g|png|webp)$/i.test(x)) out.push(x); }
    else if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') Object.values(x).forEach(walk);
  };
  walk(parsed ?? s);
  return out.map(u => u.startsWith('https://') ? u : 'https://images.craftsbyjon.co.uk/products/' + u.split('/').pop());
}

function parseObj(v) { try { const o = JSON.parse(v || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } }
function absolutise(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string') out[k] = v.startsWith('https://') ? v : 'https://images.craftsbyjon.co.uk/products/' + v.split('/').pop();
    else if (v && typeof v === 'object') out[k] = absolutise(v);
  }
  return out;
}
function listOf(v) {
  if (!v) return [];
  try { const a = JSON.parse(v); if (Array.isArray(a)) return a.map(String); } catch {}
  return String(v).split(/[|,]/).map(x => x.trim()).filter(Boolean);
}

const details = {};
for (const p of catalogue) {
  const r = byId.get(p.id);
  const images = [p.image,
    ...urlsIn(r.mug_image_front), ...urlsIn(r.mug_image_scene1), ...urlsIn(r.mug_image_scene2), ...urlsIn(r.mug_image_wrap),
    ...urlsIn(r.gallery_images), ...urlsIn(r.pod_gallery_images)].filter(Boolean);
  const variants = variantStmt.all(p.id);
  const options = {};
  for (const v of variants) for (const n of [1, 2, 3]) {
    const name = v['option' + n + '_name'], val = v['option' + n + '_value'];
    if (!name || val == null) continue;
    (options[name] ||= []).includes(val) || options[name].push(val);
  }
  // Older acrylic listings keep their finish choice (Clear, Black) in products.variants, not product_variants.
  const legacy = listOf(r.variants);
  if (legacy.length > 1) options.Finish = legacy;
  const legacyImages = {};
  const vi = (() => { try { return JSON.parse(r.variant_images || '{}'); } catch { return {}; } })();
  for (const [k, v] of Object.entries(vi || {})) if (typeof v === 'string' && v) legacyImages[k.toLowerCase()] = v.startsWith('https://') ? v : 'https://images.craftsbyjon.co.uk/products/' + v.split('/').pop();
  // Same rule as the live store's card button (needsVariant || personalised): only these can be added from a card.
  const pod = !!(r.pod_gallery_images && r.pod_gallery_images !== '{}');
  const tote = !!r.supplier && String(r.product_type || '').toLowerCase() === 'tote bag';
  const quickAdd = !(legacy.length > 1 || pod || tote || p.photo || Number(r.personalised) === 1);
  const prices = variants.map(v => v.retail_price_pence).filter(Number.isFinite);
  details[p.id] = {
    description: r.full_description || '',
    bullets: [1, 2, 3, 4, 5].map(n => r['bullet_point_' + n]).filter(Boolean),
    material: r.material || '',
    images: [...new Set(images)].slice(0, 8),
    options,
    priceFrom: prices.length ? Math.min(...prices) / 100 : null,
    mugMessages: p.personalisable ? listOf(r.mug_messages).slice(0, 6) : [],
    variantImages: legacyImages,
    quickAdd,
    // Raw picture data for store/variant-images.js (same shapes the live modal reads):
    vars: variants.map(v => ({ ...v, image_url: v.image_url ? (v.image_url.startsWith('https://') ? v.image_url : 'https://images.craftsbyjon.co.uk/products/' + v.image_url.split('/').pop()) : null })),
    podGallery: absolutise(parseObj(r.pod_gallery_images)),
    printGallery: absolutise(parseObj(r.pod_variant_gallery)),
    finishes: legacy.length > 1 ? legacy : [],
    // The product's own pictures without the per-colour ones, shown before a choice is made.
    defaults: [...new Set([p.image, ...urlsIn(r.mug_image_front), ...urlsIn(r.mug_image_scene1), ...urlsIn(r.mug_image_scene2), ...urlsIn(r.mug_image_wrap), ...urlsIn(r.gallery_images)].filter(Boolean))]
  };
}

process.stdout.write(JSON.stringify({
  built: new Date().toISOString(),
  note: 'Read-only copy of the live catalogue for the /preview/ mockups. Not used by the live shop.',
  collections: collections.map(c => ({ id: c.id, name: c.name, status: c.status, banner: c.banner_image, months: c.valid_months })),
  catalogue,
  details
}));
