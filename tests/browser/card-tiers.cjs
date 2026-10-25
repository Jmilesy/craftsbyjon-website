// Christmas card tiers in the basket (25 Oct 2026). Cards are 3.99 each; the basket shows the cheapest cover of the
// card count by the 1 / 3 / 6 / 12 tiers (3.99 / 10.00 / 12.99 / 22.00), mixed designs count together, and a basket
// made only by print partners says postage is included. Display only: products-api/card-tiers.js is what is charged.
//   node tests/browser/card-tiers.cjs
'use strict';
const H = require('./harness.cjs');
const PORT = 8795;
let checks = 0, fails = 0;
function check(ok, label, detail) { checks++; if (!ok) fails++; console.log(`${ok ? 'pass' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`); }

const DESIGNS = ['Castle', 'Pier', 'Middle Street', 'Regent', "St George's", 'Timeball'];
function cardProducts() {
  const base = H.FIX.products.result.find(p => p['Product ID'] === 'coaster-001');
  return DESIGNS.map((d, i) => Object.assign({}, base, {
    'Product ID': 'card-00' + (i + 1),
    'Title': 'Deal ' + d + ' Christmas Card',
    'Image URL': 'card-00' + (i + 1) + '-front.jpg',
    'Ready to Go': 'yes',
    product_type: 'Greeting Card',
    price: 3.99,
    stripe_price_id: 'price_test_card_00' + (i + 1), // the basket keys a line by its Stripe price, and every real card has its own
    made_to_order: 1,
    application_method: 'Print on Demand',
    gallery_images: '[]',
    pod_gallery_images: '{}',
    variants: '',
    personalised: 0
  }));
}

async function fresh(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const log = await H.wire(ctx);
  const cards = cardProducts();
  const all = H.productsFixture();
  all.result = all.result.concat(cards);
  await ctx.route(/products-api\/products\/?(\?.*)?$/, route => {
    const p = new URL(route.request().url()).pathname.replace(/^.*products-api/, '');
    if (p === '/products') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(all) });
    return route.fallback();
  });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => { errs.push('dialog: ' + d.message()); d.dismiss(); });
  return { ctx, page, log, errs };
}

async function addByHash(page, id) {
  await page.goto('about:blank'); // a hash-only change would not reopen the popup; a fresh load also proves the basket is kept
  await page.goto(`http://localhost:${PORT}/store/#${id}`);
  await page.waitForSelector('#modalWrap.open #modalAddBtn:not([disabled])', { timeout: 8000 });
  await page.click('#modalAddBtn');
  await page.waitForTimeout(150);
}
async function snap(page) {
  return page.evaluate(() => ({
    total: document.getElementById('cartTotal').textContent,
    count: document.getElementById('cartCount').textContent,
    saving: (document.getElementById('bundleDiscountRow') || {}).style && document.getElementById('bundleDiscountRow').style.display !== 'none' ? document.getElementById('bundleDiscountAmt').textContent : '',
    banner: document.getElementById('bundleBannerText').textContent,
    ship: document.getElementById('shippingNote').textContent
  }));
}
// Adds one more of the first line in the basket, through the real + button.
async function plusOne(page) {
  await page.evaluate(() => document.getElementById('cartBtn').click());
  await page.waitForSelector('#cartPanel.open .qty-controls');
  await page.locator('#cartPanel .qty-controls .qty-btn').nth(1).click();
  await page.waitForTimeout(100);
}

(async () => {
  const srv = await H.startServer(PORT);
  const browser = await H.playwright().chromium.launch();

  { // 1. one design, quantity 1 to 13 by the + button
    const s = await fresh(browser);
    await addByHash(s.page, 'card-001');
    const want = { 1: '£3.99', 2: '£7.98', 3: '£10.00', 4: '£12.99', 5: '£12.99', 6: '£12.99', 7: '£16.98', 8: '£20.97', 9: '£22.00', 10: '£22.00', 11: '£22.00', 12: '£22.00', 13: '£25.99' };
    for (let n = 1; n <= 13; n++) {
      if (n > 1) await plusOne(s.page);
      const v = await snap(s.page);
      check(v.count === String(n) && v.total === want[n], `${n} card${n > 1 ? 's' : ''} of one design: total ${want[n]}`, `count=${v.count} total=${v.total}`);
      if (n === 1 || n === 2) check(v.saving === '', `${n} card${n > 1 ? 's' : ''}: no saving shown`, v.saving);
      if (n === 3) check(v.saving === '−£1.97', '3 cards: saving £1.97 shown', v.saving);
      if (n === 12) check(v.saving === '−£25.88', '12 cards: saving £25.88 shown', v.saving);
      check(v.ship === 'Postage included · UK only', `${n}: cards-only basket says postage included`, v.ship);
    }
    check(s.errs.length === 0, 'no page errors', s.errs.join('; '));
    await s.ctx.close();
  }

  { // 2. mixed designs count together: 2 + 1 + 3 = 6 cards for 12.99
    const s = await fresh(browser);
    await addByHash(s.page, 'card-001'); await plusOne(s.page);
    await addByHash(s.page, 'card-002');
    let v = await snap(s.page);
    check(v.count === '3' && v.total === '£10.00', 'two designs, 3 cards: £10.00', JSON.stringify(v));
    await addByHash(s.page, 'card-003'); await addByHash(s.page, 'card-004'); await addByHash(s.page, 'card-005');
    v = await snap(s.page);
    check(v.count === '6' && v.total === '£12.99', 'five designs, 6 cards: £12.99', JSON.stringify(v));
    check(/Card mix & match applied/.test(v.banner), 'banner says card mix & match applied', v.banner);
    await s.ctx.close();
  }

  { // 3. a basket with cards and something handmade keeps the ordinary shipping note
    const s = await fresh(browser);
    await addByHash(s.page, 'card-001');
    await addByHash(s.page, 'bookmark-001');
    const v = await snap(s.page);
    check(v.total === '£7.49', 'one card and one bookmark: £7.49', JSON.stringify(v));
    check(/Free UK shipping on orders £10\+/.test(v.ship), 'mixed basket keeps the £10 free shipping note', v.ship);
    await s.ctx.close();
  }

  { // 4. what is sent to checkout: one line per card design with its own quantity (the server prices them)
    const s = await fresh(browser);
    await addByHash(s.page, 'card-001'); await addByHash(s.page, 'card-002');
    await s.page.evaluate(() => document.getElementById('cartBtn').click());
    await s.page.waitForSelector('#cartPanel.open');
    await s.page.click('#checkoutBtn');
    await s.page.waitForTimeout(600);
    const body = s.log.checkouts[0];
    check(!!body && body.items.length === 2 && body.items.every(i => i.quantity === 1 && /^card-00[12]$/.test(i.product_id)), 'checkout request carries the two card lines', body ? body.items.map(i => i.product_id + 'x' + i.quantity).join(',') : 'none sent');
    await s.ctx.close();
  }

  await browser.close(); srv.close();
  console.log(`\n${checks - fails}/${checks} checks passed`);
  process.exit(fails ? 1 : 0);
})();
