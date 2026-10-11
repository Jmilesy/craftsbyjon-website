// The cookie banner never blocks buying on a phone (11 Oct 2026). With consent unanswered, a shopper taps
// Add to Cart and the basket's Checkout for real (Playwright refuses a tap on a covered button), the checkout
// request goes out, no analytics load, and answering the banner gives the space back.
//   node tests/browser/cookie-banner.cjs
'use strict';
const H = require('./harness.cjs');
const PORT = 8792;
let checks = 0, fails = 0;
function check(ok, label, detail) { checks++; if (!ok) fails++; console.log(`${ok ? 'pass' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`); }

(async () => {
  const srv = await H.startServer(PORT);
  const browser = await H.playwright().chromium.launch();
  for (const [w, h] of [[320, 568], [360, 640], [390, 844], [430, 932]]) for (const [label, url] of [['/store/', '/store/?src=test-banner#keyring-010'], ['/products/', '/products/keyring-010?src=test-banner']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    const log = await H.wire(ctx, { consent: null });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(`http://localhost:${PORT}${url}`);
    await page.waitForSelector('#modalAddBtn');
    const name = `${w}x${h} ${label}`;
    try {
      await page.click('.modal-variants .modal-variant-btn:text-is("Black")', { timeout: 4000 });
      await page.click('#modalAddBtn', { timeout: 4000 });
      await page.evaluate(() => { if (typeof openCart === 'function') openCart(); });
      await page.waitForTimeout(350);
      await page.click('#checkoutBtn', { timeout: 4000 });
      for (let i = 0; i < 50 && !log.checkouts.length; i++) await page.waitForTimeout(60);
    } catch (e) { errs.push(e.message.split('\n')[0]); }
    const banner = await page.evaluate(() => { const b = document.getElementById('cookieBanner'); return !!b && getComputedStyle(b).display !== 'none'; });
    const item = log.checkouts[0] && log.checkouts[0].items[0];
    check(banner && item && item.variant === 'Black' && !log.analytics.length && !errs.length, `${name} Black keyring to checkout with the banner up`, `banner=${banner} basket=${item && item.variant} analytics=${log.analytics.length} ${errs.join(' | ')}`);
    await ctx.close();
  }
  // Answering gives the room back (and Accept still loads the tags).
  for (const choice of ['Decline', 'Accept']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const log = await H.wire(ctx, { consent: null });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${PORT}/products/keyring-010?src=test-banner`);
    await page.waitForSelector('#modalAddBtn');
    const before = await page.evaluate(() => ({ cls: document.documentElement.classList.contains('cbj-consent-open'), h: document.documentElement.style.getPropertyValue('--cbj-consent-h') }));
    await page.click(`#cookie${choice}`);
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({ cls: document.documentElement.classList.contains('cbj-consent-open'), h: document.documentElement.style.getPropertyValue('--cbj-consent-h'), stored: localStorage.getItem('cbj_cookie_consent'), pad: getComputedStyle(document.body).paddingBottom }));
    const tagsOk = choice === 'Accept' ? log.analytics.length > 0 : log.analytics.length === 0;
    check(before.cls && parseInt(before.h) > 0 && !after.cls && !after.h && after.stored === { Decline: 'declined', Accept: 'accepted' }[choice] && tagsOk, `${choice}: room reserved while open, released after, consent stored`, `before=${JSON.stringify(before)} after=${JSON.stringify(after)} analytics=${log.analytics.length}`);
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(`${checks} checks, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})();
