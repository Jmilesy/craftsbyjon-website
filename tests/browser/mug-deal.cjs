// Mug multibuy note (12 Oct 2026). "Buy 2 mugs for £21.99" shows under the price on every mug priced £11.99 (the
// lines products-api's checkout discounts), on its product page and in the /store/ popup, and nowhere else: not
// the £14.99 photo mug, not any other product. Phone and desktop layout. Basket, checkout request, events and ?src are the
// same as without the note (compared against the shop.js before the change).
//   node tests/browser/mug-deal.cjs
//   OLD_SHOP=<path to the previous store/shop.js> node tests/browser/mug-deal.cjs   (adds the before/after comparison)
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('./harness.cjs');
const PORT = 8796, OLD_PORT = 8797;
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/live-api-20261011.json'), 'utf8'));
const PAGES = fs.readdirSync(path.join(__dirname, '../fixtures/product-pages')).filter(f => f.endsWith('.html')).map(f => f.slice(0, -5)).sort();
const BY_ID = {}; FIX.products.result.forEach(p => { BY_ID[p['Product ID']] = p; });
const HEAD = 'Buy 2 mugs for £21.99 — save £1.99!';
const TEXT = 'Mix and match eligible mugs. Discount applied automatically at checkout.';
const PHOTO = { 'mug-birthday-photo': { 'Ready to Go': 'yes' } };
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
let checks = 0, fails = 0;
function check(ok, label, detail) { checks++; if (!ok) fails++; console.log(`${ok ? 'pass' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`); }
const deal = () => { const d = document.querySelector('.mug-deal'); if (!d) return null;
  const a = d.querySelector('a'); return { n: document.querySelectorAll('.mug-deal').length, head: (d.querySelector('.mug-deal-head') || {}).textContent, text: (d.querySelector('.mug-deal-text') || {}).textContent, href: a && a.getAttribute('href'), link: a && a.textContent }; };

(async () => {
  const srv = await H.startServer(PORT);
  const old = process.env.OLD_SHOP ? await H.startServer(OLD_PORT, { '/store/shop.js': fs.readFileSync(process.env.OLD_SHOP, 'utf8') }) : null;
  const browser = await H.playwright().chromium.launch();

  // 1. Which pages show it: exactly the twelve £11.99 mugs.
  const expected = PAGES.filter(id => BY_ID[id] && (BY_ID[id].product_type || '').toLowerCase() === 'mug' && Math.round(parseFloat(BY_ID[id].price) * 100) === 1199);
  check(JSON.stringify(expected) === JSON.stringify(['mug-001', 'mug-002', 'mug-003', 'mug-004', 'mug-005', 'mug-006', 'mug-007', 'mug-008', 'mug-009', 'mug-010', 'mug-011', 'mug-012']),
    'eligible = the twelve £11.99 mugs (teacher and retro); photo mug £' + (BY_ID['mug-birthday-photo'] || {}).price + ' is not', expected.join(','));
  const ctx = await browser.newContext(PHONE); await H.wire(ctx, { patch: PHOTO });
  const wrong = [], bad = [];
  for (const id of PAGES) {
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(`http://localhost:${PORT}/products/${id}`); await page.waitForSelector('#modalAddBtn, .empty-msg', { timeout: 15000 }).catch(() => {});
    const d = await page.evaluate(deal);
    const want = expected.includes(id);
    if (!!d !== want) wrong.push(id + (want ? ' (missing)' : ' (should not show)'));
    if (d && (d.n !== 1 || d.head !== HEAD || d.text !== TEXT || d.href !== '/collections/mugs' || !/Choose your second mug/.test(d.link))) bad.push(id + ' ' + JSON.stringify(d));
    if (errs.length) bad.push(id + ' errors: ' + errs.join(' | '));
    await page.close();
  }
  check(!wrong.length, `shown on ${expected.length} mug pages, on none of the other ${PAGES.length - expected.length} product pages (incl. photo mug, prints, t-shirts, totes, coasters, acrylics)`, wrong.join(', '));
  check(!bad.length, 'wording, single copy, link to /collections/mugs, no page errors', bad.join(' || ').slice(0, 600));
  await ctx.close();

  // 2. The /store/ popup: same rule, same wording, for every product.
  { const c = await browser.newContext(PHONE); await H.wire(c, { patch: PHOTO });
    const pw = [], pb = [];
    for (const id of PAGES) {
      const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.goto(`http://localhost:${PORT}/store/#${id}`); await p.waitForSelector('#modalWrap.open #modalAddBtn', { timeout: 15000 }).catch(() => {});
      const opened = !!(await p.$('#modalWrap.open'));
      const d = await p.evaluate(deal);
      const want = expected.includes(id);
      if (!opened && want) pb.push(id + ' popup did not open');   // products not for sale (sold out) have no popup, as before
      if (!!d !== want) pw.push(id + (want ? ' (missing)' : ' (should not show)'));
      if (d && (d.n !== 1 || d.head !== HEAD || d.text !== TEXT || d.href !== '/collections/mugs' || !/Choose your second mug/.test(d.link))) pb.push(id + ' ' + JSON.stringify(d));
      if (errs.length) pb.push(id + ' errors: ' + errs.join(' | '));
      await p.close();
    }
    check(!pw.length, `shop popup: shown for the ${expected.length} mugs, for none of the other ${PAGES.length - expected.length} products (photo mug included)`, pw.join(', '));
    check(!pb.length, 'shop popup: same wording and link, every popup opens, no page errors', pb.join(' || ').slice(0, 600));
    await c.close(); }

  // 3. Layout: under the price, above the options and Add to Cart, inside the screen, 44px link.
  for (const [w, h, mobile] of [[360, 640, true], [390, 844, true], [430, 932, true], [768, 1024, true], [1280, 900, false]]) for (const id of ['mug-005', 'mug-001']) {
    const c = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile }); await H.wire(c); const p = await c.newPage();
    await p.goto(`http://localhost:${PORT}/products/${id}`); await p.waitForSelector('#modalAddBtn'); await p.waitForTimeout(300);
    const L = await p.evaluate(() => {
      const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), h: Math.round(b.height) }; };
      return { price: r('.modal-price-row'), deal: r('.mug-deal'), link: r('.mug-deal-link'), opts: r('.mug-personalisation'), add: r('#modalAddBtn'), vw: window.innerWidth, sw: document.documentElement.scrollWidth };
    });
    const ok = L.deal && L.deal.top >= L.price.bottom - 1 && L.deal.bottom <= L.add.top && (!L.opts || L.deal.bottom <= L.opts.top) && L.deal.left >= 0 && L.deal.right <= L.vw && L.sw <= L.vw && L.link.h >= 44;
    check(ok, `${w}x${h} ${id}: under the price, above ${L.opts ? 'the name/message fields and ' : ''}Add to Cart, fits the screen, link ${L.link && L.link.h}px tall`, JSON.stringify(L));
    await p.screenshot({ path: `/tmp/mug-deal-${id}-${w}.png` }).catch(() => {});
    await c.close();
  }

  // 3b. Popup layout on the shop.
  for (const [w, h, mobile] of [[360, 640, true], [390, 844, true], [430, 932, true], [768, 1024, true], [1280, 900, false]]) for (const id of ['mug-005', 'mug-001']) {
    const c = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile }); await H.wire(c); const p = await c.newPage();
    await p.goto(`http://localhost:${PORT}/store/#${id}`); await p.waitForSelector('#modalWrap.open #modalAddBtn'); await p.waitForTimeout(400);
    const L = await p.evaluate(() => {
      const r = s => { const e = document.querySelector('#modalWrap.open ' + s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), h: Math.round(b.height) }; };
      const m = document.querySelector('#modalWrap.open .modal-details-col').getBoundingClientRect();
      return { title: r('.modal-title'), price: r('#modalPriceVal'), deal: r('.mug-deal'), link: r('.mug-deal-link'), opts: r('.mug-personalisation'), add: r('#modalAddBtn'), col: { left: Math.round(m.left), right: Math.round(m.right) }, vw: window.innerWidth, sw: document.documentElement.scrollWidth };
    });
    const ok = L.deal && L.deal.top >= L.price.bottom - 1 && L.deal.top > L.title.bottom && L.deal.bottom <= L.add.top && (!L.opts || L.deal.bottom <= L.opts.top) && L.deal.left >= L.col.left && L.deal.right <= L.col.right && L.sw <= L.vw && L.link.h >= 44;
    check(ok, `popup ${w}x${h} ${id}: under the price, above ${L.opts ? 'the name/message fields and ' : ''}Add to Cart, inside the popup, link ${L.link && L.link.h}px tall`, JSON.stringify(L));
    await p.screenshot({ path: `/tmp/mug-deal-popup-${id}-${w}.png` }).catch(() => {});
    await c.close();
  }

  // 4. Facebook visit: mug-005 → the note's link → another mug → checkout. Same request and events as before the change.
  async function journey(port) {
    const c = await browser.newContext(PHONE); const log = await H.wire(c); const p = await c.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(`http://localhost:${port}/products/mug-005?src=fb-mugdeal`); await p.waitForSelector('#modalAddBtn');
    await p.click('#modalAddBtn'); await p.waitForTimeout(500);
    await p.evaluate(() => { if (typeof closeCart === 'function') closeCart(); });
    let followed = null;
    if (await p.$('.mug-deal-link')) { await p.click('.mug-deal-link'); await p.waitForTimeout(400); followed = new URL(p.url()).pathname; }
    await p.goto(`http://localhost:${port}/products/mug-006`); await p.waitForSelector('#modalAddBtn');   // the mug chosen on the range page
    await p.click('#modalAddBtn'); await p.waitForTimeout(500);
    await p.evaluate(() => { if (typeof openCart === 'function') openCart(); }); await p.waitForTimeout(400);
    const hint = await p.evaluate(() => (document.getElementById('bundleBanner') || {}).textContent || '');
    await p.click('#checkoutBtn'); for (let i = 0; i < 40 && !log.checkouts.length; i++) await p.waitForTimeout(60);
    const saved = await p.evaluate(() => localStorage.getItem('cbj_cart_v1'));
    await c.close();
    return { followed, hint: hint.trim(), body: log.checkouts[0] || null, events: log.events.map(e => [e.event, e.product_id, e.source].join(':')), errs, analytics: log.analytics.length, live: log.live,
      lines: (JSON.parse(saved || '{}').lines || []).map(l => [l.id, l.qty, l.price].join(':')) };
  }
  const now = await journey(PORT);
  check(now.followed === '/collections/mugs', 'the note\'s link opens the mugs range in the same tab', now.followed);
  check(now.body && now.body.items.length === 2 && now.body.items.every(i => i.price === 11.99) && now.body.source === 'fb-mugdeal' && /2 for £21\.99/.test(now.hint) && !now.errs.length,
    'two mugs to checkout: both £11.99 in the request (checkout takes the £1.99), Facebook source kept, basket says "2 for £21.99 applied"', `items=${now.body && now.body.items.map(i => i.product_id + '@' + i.price)} source=${now.body && now.body.source} hint="${now.hint}" ${now.errs.join(' | ')}`);
  if (old) {
    const before = await journey(OLD_PORT);
    check(JSON.stringify(before.body) === JSON.stringify(now.body), 'checkout request identical to before the change', JSON.stringify([before.body, now.body]).slice(0, 400));
    check(JSON.stringify(before.events) === JSON.stringify(now.events) && before.analytics === now.analytics, 'events and analytics identical to before', JSON.stringify([before.events, now.events]));
    check(JSON.stringify(before.lines) === JSON.stringify(now.lines) && before.hint === now.hint, 'saved basket and basket hint identical to before', JSON.stringify([before.lines, now.lines, before.hint]));
  }

  // 5. Shop popup visit: two mugs from the /store/ popups to checkout, the same as before the change.
  async function popupJourney(port) {
    const c = await browser.newContext(PHONE); const log = await H.wire(c); const p = await c.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(`http://localhost:${port}/store/?src=fb-mugpopup#mug-001`); await p.waitForSelector('#modalWrap.open #modalAddBtn');
    await p.fill('#modal-mug-name', 'Mrs Patel'); await p.selectOption('#modal-mug-message', { index: 2 }); await p.click('.mug-store-swatch >> nth=0');
    await p.click('#modalAddBtn'); await p.waitForTimeout(500);
    const deal1 = await p.evaluate(deal);
    await p.goto('about:blank'); await p.goto(`http://localhost:${port}/store/#mug-005`); await p.waitForSelector('#modalWrap.open #modalAddBtn');
    await p.click('#modalAddBtn'); await p.waitForTimeout(500);
    await p.evaluate(() => { if (typeof closeModal === 'function') closeModal(); if (typeof openCart === 'function') openCart(); }); await p.waitForTimeout(400);
    const hint = await p.evaluate(() => (document.getElementById('bundleBanner') || {}).textContent || '');
    await p.click('#checkoutBtn'); for (let i = 0; i < 40 && !log.checkouts.length; i++) await p.waitForTimeout(60);
    const saved = await p.evaluate(() => localStorage.getItem('cbj_cart_v1'));
    await c.close();
    return { deal1, hint: hint.trim(), body: log.checkouts[0] || null, events: log.events.map(e => [e.event, e.product_id, e.source].join(':')), errs, analytics: log.analytics.length,
      lines: (JSON.parse(saved || '{}').lines || []).map(l => [l.id, l.qty, l.price].join(':')) };
  }
  const pnow = await popupJourney(PORT);
  check(pnow.deal1 && pnow.body && pnow.body.items.length === 2 && pnow.body.items.every(i => i.price === 11.99) && pnow.body.source === 'fb-mugpopup' && /2 for £21\.99/.test(pnow.hint) && !pnow.errs.length,
    'popup: teacher mug (name, message, colour) + retro mug to checkout, both £11.99, source kept, basket says "2 for £21.99 applied"', `items=${pnow.body && pnow.body.items.map(i => i.product_id + '@' + i.price + (i.mug_name ? '(' + i.mug_name + ')' : ''))} source=${pnow.body && pnow.body.source} ${pnow.errs.join(' | ')}`);
  if (old) {
    const pb = await popupJourney(OLD_PORT);
    check(JSON.stringify(pb.body) === JSON.stringify(pnow.body), 'popup: checkout request identical to before the change', JSON.stringify([pb.body, pnow.body]).slice(0, 400));
    check(JSON.stringify(pb.events) === JSON.stringify(pnow.events) && pb.analytics === pnow.analytics && JSON.stringify(pb.lines) === JSON.stringify(pnow.lines) && pb.hint === pnow.hint, 'popup: events, analytics, saved basket and basket hint identical to before', JSON.stringify([pb.events, pnow.events]));
  }

  await browser.close(); srv.close(); if (old) old.close();
  console.log(`${checks} checks, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERROR', e.stack || e.message); process.exit(2); });
