// /products/{id}: everything around the purchase.   node tests/browser/product-page-behaviour.cjs
'use strict';
const H = require('./harness.cjs');
const { checkoutFromBasket, wait } = require('./scenarios.cjs');
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const DESK = { viewport: { width: 1280, height: 900 } };
const results = []; let cur;
const section = n => { cur = { n, pass: 0, fail: [] }; results.push(cur); };
const ok = (c, m) => { if (c) cur.pass++; else cur.fail.push(m); };
const B = 'http://localhost:8786';

(async () => {
  const srv = await H.startServer(8786);
  const browser = await H.playwright().chromium.launch();
  async function open(vp, url, wopts) {
    const ctx = await browser.newContext(vp);
    const log = await H.wire(ctx, wopts);
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(B + url);
    return { ctx, page, log, errors };
  }
  const ready = page => page.waitForSelector('#modalWrap.open #modalAddBtn', { timeout: 10000 }).then(() => true, () => false);

  // 1. Facebook arrival: source carried through view, basket and checkout; one product_view only.
  section('Facebook link: source kept from landing to checkout');
  {
    const { ctx, page, log, errors } = await open(PHONE, '/products/mug-005?src=fb-deal-watch-official');
    ok(await ready(page), 'page did not become buyable');
    await page.click('#modalAddBtn');
    const body = await checkoutFromBasket(page, log, {});
    const views = log.events.filter(e => e.event === 'product_view');
    ok(views.length === 1 && views[0].source === 'fb-deal-watch-official' && views[0].product_id === 'mug-005', 'product_view: ' + JSON.stringify(views));
    ok(log.events.some(e => e.event === 'add_to_basket' && e.source === 'fb-deal-watch-official'), 'add_to_basket source');
    ok(body && body.source === 'fb-deal-watch-official', 'checkout source ' + (body && body.source));
    ok(log.events.some(e => e.event === 'checkout_started' && e.source === 'fb-deal-watch-official' && /^cart:mug-005x1/.test(e.path)), 'checkout_started with basket');
    ok(await page.evaluate(() => sessionStorage.getItem('cbj_src')) === 'fb-deal-watch-official', 'source not kept for the rest of the visit');
    ok(!errors.length, errors.join(' '));
    await ctx.close();
  }

  // 2. An existing basket (from /store/) survives a visit to a product page.
  section('Existing basket is kept, not overwritten');
  {
    const { ctx, page, log } = await open(PHONE, '/store/');
    await page.waitForSelector('#grid .card', { timeout: 10000 });
    await page.evaluate(() => { const p = allProducts.find(x => x['Product ID'] === 'bookmark-011'); addToCart(p, null); addToCart(allProducts.find(x => x['Product ID'] === 'coaster-001'), null); });
    await page.goto(B + '/products/pod-t-shirt-pier?src=test-basket');
    ok(await ready(page), 'not ready');
    await page.click('#podColourRow .modal-variant-btn:text-is("Navy")'); await page.waitForSelector('#podSizeRow .modal-variant-btn');
    await page.click('#podSizeRow .modal-variant-btn:text-is("L")'); await page.click('#modalAddBtn'); await wait(page, 200);
    const ids = await page.evaluate(() => JSON.parse(localStorage.getItem('cbj_cart_v1')).lines.map(l => l.id).sort());
    ok(JSON.stringify(ids) === JSON.stringify(['bookmark-011', 'coaster-001', 'pod-t-shirt-pier']), 'basket lines: ' + ids);
    const body = await checkoutFromBasket(page, log, {});
    ok(body && body.items.length === 3, 'checkout items ' + (body && body.items.length));
    await page.goto(B + '/store/');
    await page.waitForSelector('#grid .card');
    ok(await page.evaluate(() => document.getElementById('cartCount').textContent) === '3', 'store basket count after visiting product page');
    await ctx.close();
  }

  // 3. After Add to Cart the page starts fresh: no second add with a stale (missing) choice.
  section('No stale second add');
  for (const [id, choose, label] of [['keyring-001', async p => p.click('.modal-variants .modal-variant-btn:text-is("Black")'), 'finish'],
                                      ['pod-t-shirt-pier', async p => { await p.click('#podColourRow .modal-variant-btn:text-is("Sand")'); await p.waitForSelector('#podSizeRow .modal-variant-btn'); await p.click('#podSizeRow .modal-variant-btn:text-is("S")'); }, 'size']]) {
    const { ctx, page } = await open(PHONE, '/products/' + id);
    await ready(page); await choose(page); await page.click('#modalAddBtn'); await wait(page, 250);
    ok(await page.isDisabled('#modalAddBtn'), `${id}: Add still enabled after adding (${label} would be missing)`);
    ok(await page.evaluate(() => JSON.parse(localStorage.getItem('cbj_cart_v1')).lines.length) === 1, id + ': basket lines');
    await ctx.close();
  }

  // 4. SEO: head untouched, one visible h1, summary replaced; crawlable links still there.
  section('SEO metadata and page structure');
  {
    const raw = require('fs').readFileSync(H.ROOT + '/tests/fixtures/product-pages/pod-t-shirt-pier.html', 'utf8');
    const before = require('fs').readFileSync(H.ROOT + '/tests/fixtures/product-page-pod-t-shirt-pier.html', 'utf8');
    const head = s => s.slice(s.indexOf('<head>\n') + 7, s.indexOf('<script type="application/ld+json">'));
    ok(head(raw) === head(before), 'meta tags differ from the live page');
    const ld = s => s.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1];
    ok(ld(raw) === ld(before), 'Product JSON-LD differs');
    const { ctx, page } = await open(DESK, '/products/pod-t-shirt-pier');
    await ready(page); await wait(page, 200);
    const s = await page.evaluate(() => ({
      h1: [...document.querySelectorAll('h1')].filter(h => h.getClientRects().length).map(h => h.textContent),
      canonical: document.querySelector('link[rel=canonical]').href, title: document.title,
      static: !!document.getElementById('pp-static'), links: document.querySelectorAll('nav.related a').length,
      ld: document.querySelectorAll('script[type="application/ld+json"]').length
    }));
    ok(s.h1.length === 1 && s.h1[0] === 'Pier T-Shirt', 'h1: ' + JSON.stringify(s.h1));
    ok(s.canonical === 'https://craftsbyjon.co.uk/products/pod-t-shirt-pier' && /^Pier T-Shirt \| Crafts by Jon - Crafts by Jon, Deal, Kent$/.test(s.title), 'canonical/title ' + s.canonical + ' / ' + s.title);
    ok(!s.static && s.links >= 6 && s.ld === 1, JSON.stringify(s));
    await ctx.close();
  }

  // 5. No JavaScript: the server summary with its shop link.
  section('Without JavaScript: summary and shop link');
  {
    const ctx = await browser.newContext({ ...PHONE, javaScriptEnabled: false }); await H.wire(ctx);
    const page = await ctx.newPage(); await page.goto(B + '/products/mug-005?src=fb-x');
    ok(await page.isVisible('#pp-static h1'), 'summary missing');
    // Test pages are pre-rendered without a source; the server adds ?src= per request (products-api product-page.test.js).
    ok(await page.getAttribute('#pp-static a.buy', 'href') === 'https://craftsbyjon.co.uk/store/#mug-005', 'shop link');
    await ctx.close();
  }

  // 6. Catalogue API down: summary and link stay, no crash.
  section('API down: summary and link stay');
  {
    const ctx = await browser.newContext(PHONE); await H.wire(ctx);
    await ctx.route(/products-api\/products$/, r => r.fulfill({ status: 503, body: 'down' }));
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(B + '/products/mug-005'); await wait(page, 800);
    ok(await page.isVisible('#pp-static a.buy'), 'fallback link not visible');
    ok(!(await page.isVisible('.pp-loading')), '"Loading" still showing');
    ok(!errs.length, errs.join(' '));
    await ctx.close();
  }

  // 7. Sold-out tracked design: no buying controls, a note, summary kept.
  section('Sold out: note, summary kept');
  {
    const { ctx, page } = await open(PHONE, '/products/keyring-014', { patch: { 'keyring-014': { design_stock_tracked: 1, design_stock_qty: 0 } } });
    await wait(page, 800);
    ok(!(await page.$('#modalAddBtn')), 'buying controls shown for a sold-out design');
    ok(/can't be bought right now/.test(await page.textContent('#main')), 'note missing');
    ok(!(await page.isVisible('#pp-static a.buy')), '"View & buy in the shop" still offered for a sold-out design');
    ok(await page.isVisible('#pp-static h1'), 'summary removed');
    await ctx.close();
  }

  // 8. Consent on product pages: nothing before a choice, all three tags after Accept, none after Decline.
  section('Cookie consent');
  for (const choice of ['accept', 'decline']) {
    const { ctx, page, log } = await open(PHONE, '/products/mug-005', { consent: null });
    await ready(page);
    ok(await page.isVisible('#cookieBanner'), 'banner not shown');
    ok(log.analytics.length === 0, 'analytics before consent: ' + log.analytics);
    await page.click(choice === 'accept' ? '#cookieAccept' : '#cookieDecline'); await wait(page, 400);
    const got = log.analytics.map(u => /googletagmanager/.test(u) ? 'ga' : /clarity/.test(u) ? 'clarity' : 'pinterest');
    ok(choice === 'accept' ? ['ga', 'clarity', 'pinterest'].every(t => got.includes(t)) : got.length === 0, choice + ': ' + got);
    ok(await page.evaluate(() => localStorage.getItem('cbj_cookie_consent')) === (choice === 'accept' ? 'accepted' : 'declined'), 'choice not saved (shared with /store/)');
    await ctx.close();
  }

  // 9. Related and same-design cards open their own product page and log the click.
  section('Related and same-design links');
  {
    const { ctx, page, log } = await open(DESK, '/products/pod-t-shirt-pier?src=test-related');
    await ready(page);
    const card = await page.$('#modalRelated .related-card');
    ok(!!card, 'no related cards');
    if (card) {
      await Promise.all([page.waitForURL(/\/products\/[a-z0-9-]+$/), card.click()]);
      ok(log.events.some(e => (e.event === 'design_link_click' || e.event === 'related_click') && /^from:pod-t-shirt-pier$/.test(e.path)), 'click not logged ' + JSON.stringify(log.events.map(e => e.event)));
      ok(await ready(page), 'next product page not buyable');
    }
    await ctx.close();
  }

  // 10. Phone: sticky bar never over buying controls, inert when hidden, and it really adds.
  section('Sticky Add to Cart bar (phone)');
  for (const id of ['mug-005', 'pod-print-deal-castle', 'mug-001', 'keyring-001']) {
    const { ctx, page } = await open({ ...PHONE, viewport: { width: 390, height: 700 } }, '/products/' + id);
    await ready(page); await wait(page, 200);
    const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    let bad = 0, shown = 0;
    for (let y = 0; y <= max; y += 70) {
      await page.evaluate(y => scrollTo(0, y), y); await wait(page, 40);
      const st = await page.evaluate(() => {
        const bar = document.querySelector('.pp-sticky'), on = bar.classList.contains('on'), br = bar.getBoundingClientRect();
        const col = document.querySelector('.modal-details-col');
        const ctrls = [...col.querySelectorAll('button, input, select, #modalPriceVal')].filter(e => !e.closest('.modal-short-desc, .modal-full-desc, .modal-bullets, .modal-testimonial, .pp-more, .pp-crumbs'));
        const vis = ctrls.filter(c => { const r = c.getBoundingClientRect(); return r.height && r.bottom > 0 && r.top < innerHeight; });
        const covered = on ? vis.filter(c => { const r = c.getBoundingClientRect(); return r.bottom > br.top && r.top < br.bottom; }) : [];
        return { on, inert: bar.hasAttribute('inert'), visible: vis.length, covered: covered.length };
      });
      if (st.on) shown++;
      if (st.covered || (!st.on && !st.inert)) bad++;
    }
    ok(bad === 0, `${id}: ${bad} scroll positions with the bar over a control or focusable while hidden`);
    ok(shown > 0, `${id}: bar never appeared`);
    // Using the bar: if a choice is missing it takes you there; otherwise it adds.
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await wait(page, 200);
    const enabled = await page.evaluate(() => !document.getElementById('modalAddBtn').disabled);
    await page.click('.pp-sticky.on button'); await wait(page, 500);
    const lines = await page.evaluate(() => (JSON.parse(localStorage.getItem('cbj_cart_v1') || '{"lines":[]}').lines || []).length);
    ok(enabled ? lines === 1 : lines === 0, `${id}: bar add (enabled=${enabled}) gave ${lines} lines`);
    await ctx.close();
  }

  // 11. Every product page: loads without errors, buyable, no sideways scroll, controls before description.
  section('All product pages load and are buyable (phone)');
  {
    const ids = require('fs').readdirSync(H.ROOT + '/tests/fixtures/product-pages').map(f => f.replace('.html', ''));
    const ctx = await browser.newContext(PHONE); await H.wire(ctx, { patch: { 'mug-birthday-photo': { 'Ready to Go': 'yes' } } });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    let okCount = 0;
    // Sold-out tracked designs are hidden by the shop, so their page shows a note instead of buying controls.
    const soldOut = new Set(H.FIX.products.result.filter(p => Number(p.design_stock_tracked) === 1 && Number(p.design_stock_qty) <= 0).map(p => p['Product ID']));
    for (const id of ids) {
      if (soldOut.has(id)) {
        errs.length = 0; await page.goto(B + '/products/' + id); await wait(page, 700);
        const fine = !(await page.$('#modalAddBtn')) && /can't be bought right now/.test(await page.textContent('#main')) && !(await page.isVisible('#pp-static a.buy')) && !errs.length;
        if (fine) okCount++; else cur.fail.push(id + ': sold-out page wrong');
        continue;
      }
      errs.length = 0;
      await page.goto(B + '/products/' + id);
      const r = await ready(page);
      const m = r && await page.evaluate(() => {
        const col = document.querySelector('.modal-details-col'), y = s => { const e = col.querySelector(s); return e ? e.getBoundingClientRect().top : null; };
        return { sw: document.documentElement.scrollWidth, add: y('.modal-actions'), title: y('h1'), desc: y('.modal-full-desc') ?? y('.modal-short-desc') };
      });
      const good = r && !errs.length && m.sw <= 390 && m.title < m.add && (m.desc == null || m.add < m.desc);
      if (good) okCount++; else cur.fail.push(`${id}: ready=${r} errors=${errs.join(';')} ${JSON.stringify(m)}`);
    }
    ok(okCount === ids.length, `${okCount}/${ids.length} pages fine`);
    await ctx.close();
  }

  await browser.close(); srv.close();
  let total = 0, failed = 0;
  for (const r of results) { total += r.pass + r.fail.length; failed += r.fail.length; console.log(`${r.fail.length ? 'FAIL' : 'pass'}  ${r.n}: ${r.pass}/${r.pass + r.fail.length}`); r.fail.slice(0, 6).forEach(f => console.log('      - ' + f)); }
  console.log(`${total} checks, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
