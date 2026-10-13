// Staff preview of draft products (13 Oct 2026, fix/draft-checkout-guard). The public product list has no
// drafts; a ?preview= link reads the staff-protected /products/ with the staff login cookie. Checks, at
// phone size: no staff login -> a notice and no product; staff -> the draft opens, the photo flow works,
// and checkout shows the server's refusal; the ordinary shop never calls the staff route.
//   node tests/browser/draft-preview.cjs
'use strict';
const H = require('./harness.cjs');
const PORT = 8794;
const DRAFT = 'mug-birthday-photo';
let checks = 0, fails = 0;
function check(ok, label, detail) { checks++; if (!ok) fails++; console.log(`${ok ? 'pass' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`); }
const ready = p => String(p['Ready to Go'] || '').trim().toLowerCase() === 'yes';

async function session(browser, staff) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const log = await H.wire(ctx);
  log.staffCalls = 0; log.dialogs = [];
  const full = H.productsFixture();
  await ctx.route(/products-api\/products\/?(\?.*)?$/, async route => {
    const u = new URL(route.request().url()), p = u.pathname.replace(/^.*products-api/, '');
    const json = (b, s) => route.fulfill({ status: s || 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (p === '/products') return json({ result: full.result.filter(ready) });            // public list: no drafts
    if (p === '/products/') { log.staffCalls++; return staff ? json(full) : route.fulfill({ status: 401, body: '' }); }
    return route.fallback();
  });
  await ctx.route(/create-checkout-session/, route => { log.checkouts.push(JSON.parse(route.request().postData() || '{}'));
    route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'An item in your basket is no longer available. Please remove it and try again.' }) }); });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('dialog', d => { log.dialogs.push(d.message()); d.dismiss(); });
  return { ctx, page, log, errs };
}
const bannerText = page => page.evaluate(() => [...document.querySelectorAll('body > div')].filter(d => d.style.position === 'fixed' && d.style.zIndex === '99999').map(d => d.textContent).join(' | '));

(async () => {
  check(H.FIX.products.result.some(p => p['Product ID'] === DRAFT && !ready(p)), 'fixture has the photo mug as a draft');
  const srv = await H.startServer(PORT);
  const browser = await H.playwright().chromium.launch();

  { // 1. Customer (no staff login) opens a preview link
    const s = await session(browser, false);
    await s.page.goto(`http://localhost:${PORT}/store/?preview=${DRAFT}`);
    await s.page.waitForTimeout(1500);
    const t = await bannerText(s.page);
    check(/log in to the staff area/i.test(t), 'no staff login: notice asks for a staff login', t);
    check(!(await s.page.$('#photoOptRow')), 'no staff login: the draft does not open');
    check(s.log.staffCalls === 1, 'no staff login: staff route asked once and refused', String(s.log.staffCalls));
    check(s.errs.length === 0, 'no staff login: no page errors', s.errs.join('; '));
    await s.ctx.close();
  }
  { // 2. Staff on a phone: draft opens, photo flow works, checkout is refused by the server
    const s = await session(browser, true);
    await s.page.goto(`http://localhost:${PORT}/store/?preview=${DRAFT}`);
    await s.page.waitForSelector('#photoOptRow .modal-variant-btn', { timeout: 8000 }).catch(() => {});
    const t = await bannerText(s.page);
    check(/draft/i.test(t) && /cannot be checked out/i.test(t), 'staff: draft banner says it cannot be checked out', t);
    const opts = await s.page.$$eval('#photoOptRow .modal-variant-btn', b => b.map(x => x.textContent));
    check(opts.length >= 3, 'staff: option buttons load', opts.join(','));
    try {
      await s.page.click('#photoOptRow .modal-variant-btn >> nth=1');
      await s.page.setInputFiles('#photoFile', { name: 'phone.jpg', mimeType: 'image/jpeg', buffer: await H.makeJpeg(s.page) });
      await s.page.waitForSelector('#photoCropWrap:not([style*="none"])', { timeout: 5000 });
      await s.page.waitForFunction(() => /Photo added/.test((document.getElementById('photoStatus') || {}).textContent || ''), null, { timeout: 5000 });
      await s.page.check('#photoRights');
      check(s.log.uploads === 1, 'staff: photo uploaded once', String(s.log.uploads));
      await s.page.click('#modalAddBtn');
      await s.page.waitForTimeout(400);
      const stored = await s.page.evaluate(() => localStorage.getItem('cbj_cart_v1') || '');
      check(stored.includes(DRAFT), 'staff: draft line is in the basket (preview testing)');
      await s.page.evaluate(() => { if (typeof openCart === 'function') openCart(); });
      await s.page.waitForTimeout(300);
      await s.page.click('#checkoutBtn', { timeout: 4000 });
      await s.page.waitForTimeout(800);
      check(s.log.checkouts.length === 1, 'staff: checkout request sent (server decides)');
      check(s.log.dialogs.some(d => /no longer available/.test(d)), 'staff: server refusal shown to staff', s.log.dialogs.join(' / '));
      check(!/stripe-checkout-test|checkout\.stripe/.test(s.page.url()), 'staff: no redirect to Stripe', s.page.url());
      await s.page.reload(); await s.page.waitForTimeout(1500);
      check(await s.page.$('#photoOptRow') !== null || /preview/.test(s.page.url()), 'staff: refresh keeps the preview');
    } catch (e) { check(false, 'staff: photo flow', e.message.split('\n')[0]); }
    check(s.errs.length === 0, 'staff: no page errors', s.errs.join('; '));
    await s.ctx.close();
  }
  { // 3. Ordinary shop: no staff call, draft not in the grid, a live product still opens
    const s = await session(browser, false);
    await s.page.goto(`http://localhost:${PORT}/store/#keyring-010`);
    await s.page.waitForSelector('#modalAddBtn', { timeout: 8000 }).catch(() => {});
    check(s.log.staffCalls === 0, 'shop: staff route never called', String(s.log.staffCalls));
    const html = await s.page.content();
    check(!html.includes(`data-id="${DRAFT}"`) && !(await s.page.$(`[onclick*="${DRAFT}"]`)), 'shop: draft not in the grid');
    check(!!(await s.page.$('#modalAddBtn')), 'shop: live product link still opens');
    check(s.errs.length === 0, 'shop: no page errors', s.errs.join('; '));
    await s.ctx.close();
  }
  { // 4. Preview link for a LIVE product: no staff call, no draft banner
    const s = await session(browser, false);
    await s.page.goto(`http://localhost:${PORT}/store/?preview=keyring-010`);
    await s.page.waitForTimeout(1500);
    check(s.log.staffCalls === 0, 'live preview link: no staff call');
    check(!/draft|log in/i.test(await bannerText(s.page)), 'live preview link: no draft or login notice');
    await s.ctx.close();
  }
  await browser.close(); srv.close();
  console.log(`\n${checks - fails}/${checks} checks passed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
