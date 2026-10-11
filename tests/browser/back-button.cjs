// Phone Back/Forward with the product popup (11 Oct 2026). Opening a product in /store/ adds a history entry
// (/store/#id); a shopper's Back must close the popup and stay in the shop, Forward must reopen it, and a Back onto
// a product entry must show that product. Before this fix the popstate handler looked for 'modal-overlay'
// (the element is #modalOverlay), so Back changed the address but left the popup open.
//   node tests/browser/back-button.cjs
'use strict';
const H = require('./harness.cjs');
const PORT = 8794;
let checks = 0, fails = 0;
function check(ok, label, detail) { checks++; if (!ok) fails++; console.log(`${ok ? 'pass' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`); }
const state = page => page.evaluate(() => ({
  open: document.getElementById('modalWrap').classList.contains('open'),
  shown: (window.__modalOpenedId || null),
  title: (document.querySelector('#modalWrap.open .modal-title') || {}).textContent || null,
  url: location.pathname + location.search + location.hash
}));

(async () => {
  const srv = await H.startServer(PORT);
  const browser = await H.playwright().chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const log = await H.wire(ctx);
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  // A shopper arrives from Facebook on the shop, taps a product card.
  await page.goto(`http://localhost:${PORT}/store/?src=test-back`);
  await page.waitForSelector('.card');
  await page.click('.card >> nth=0');
  await page.waitForSelector('#modalWrap.open #modalAddBtn');
  const first = await state(page);
  check(first.open && /#/.test(first.url), 'tapping a card opens the popup and adds a history entry', first.url);

  await page.goBack(); await page.waitForTimeout(300);
  const back = await state(page);
  check(!back.open && back.url.startsWith('/store/'), 'Back closes the popup and stays in the shop', JSON.stringify(back));

  await page.goForward(); await page.waitForTimeout(300);
  const fwd = await state(page);
  check(fwd.open && fwd.url === first.url, 'Forward reopens the same product', JSON.stringify(fwd));

  // Close with the X, then Back: the product the shopper was looking at comes back.
  await page.click('#modalWrap.open .modal-close');
  await page.waitForTimeout(300);
  const closed = await state(page);
  await page.goBack(); await page.waitForTimeout(300);
  const backToProduct = await state(page);
  check(!closed.open && backToProduct.open && backToProduct.url === first.url, 'after closing with X, Back shows that product again', JSON.stringify(backToProduct));
  await page.goBack(); await page.waitForTimeout(300);
  const backToShop = await state(page);
  check(!backToShop.open && backToShop.url === '/store/?src=test-back', 'one more Back returns to the shop as the shopper arrived', JSON.stringify(backToShop));

  // Two products in a row, then Back twice.
  await page.click('.card >> nth=1'); await page.waitForSelector('#modalWrap.open #modalAddBtn');
  const a = await state(page);
  await page.click('#modalWrap.open .modal-close'); await page.waitForTimeout(200);
  await page.click('.card >> nth=2'); await page.waitForSelector('#modalWrap.open #modalAddBtn');
  const b = await state(page);
  await page.goBack(); await page.waitForTimeout(300);
  const b1 = await state(page);
  await page.goBack(); await page.waitForTimeout(300);
  const b2 = await state(page);
  check(!b1.open && b2.open && b2.url === a.url && b.url !== a.url, 'Back from product B closes it; Back again shows product A', `${JSON.stringify(b1)} ${JSON.stringify(b2)}`);

  // Buying still works after all that navigation, and Back never added a basket line.
  await page.click('#modalAddBtn'); await page.waitForTimeout(300);
  const lines = await page.evaluate(() => JSON.parse(localStorage.getItem('cbj_cart_v1') || '{}').lines || []);
  check(lines.length === 1, 'Add to Cart after Back/Forward adds exactly one line', `${lines.length} line(s)`);
  check(!errs.length, 'no page errors', errs.join(' | '));
  const views = log.events.filter(e => e.event === 'product_view').length;
  console.log(`(product_view events in this run: ${views})`);
  await browser.close(); srv.close();
  console.log(`${checks} checks, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})();
