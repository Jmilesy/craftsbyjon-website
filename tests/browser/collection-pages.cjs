// Collection pages (/collections/{slug}), Stage C, 12 Oct 2026. Uses the pages rendered from products.db by
// preview/tools/build-collection-pages.mjs, and the store with the dated API fixture.
//   node tests/browser/collection-pages.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('./harness.cjs');
const PORT = 8795;
const INDEX = JSON.parse(fs.readFileSync(path.join(H.ROOT, 'tests/fixtures/collection-pages/_index.json'), 'utf8'));
const FIX_IDS = new Set(H.FIX.products.result.map(p => p['Product ID']));
let checks = 0, fails = 0;
function check(ok, label, detail) { checks++; if (!ok) fails++; if (!ok || process.env.VERBOSE) console.log(`${ok ? 'pass' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`); }
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));

(async () => {
  const srv = await H.startServer(PORT);
  const browser = await H.playwright().chromium.launch();

  // 1. Every page: loads at phone and desktop size, one h1, the right products as links, no sideways scroll.
  for (const vp of [{ width: 360, height: 740 }, { width: 1366, height: 900 }]) {
    const ctx = await browser.newContext({ viewport: vp, isMobile: vp.width < 900 });
    await H.wire(ctx);
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    let ok = 0;
    for (const c of INDEX) {
      await page.goto(`http://localhost:${PORT}/collections/${c.slug}`);
      await page.waitForSelector('.cc-grid');
      const r = await page.evaluate(() => ({
        h1: document.querySelectorAll('h1').length,
        ids: [...document.querySelectorAll('.cc-grid a.cc-link')].map(a => a.getAttribute('href').replace('/products/', '')),
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        cols: getComputedStyle(document.querySelector('.cc-grid')).gridTemplateColumns.split(' ').length,
        canonical: (document.querySelector('link[rel=canonical]') || {}).href
      }));
      const good = r.h1 === 1 && sameSet(r.ids, c.products) && !r.overflow && r.canonical === `https://craftsbyjon.co.uk/collections/${c.slug}` && (vp.width < 600 ? r.cols === 2 : r.cols === 4);
      if (good) ok++; else check(false, `${vp.width}px /collections/${c.slug}`, JSON.stringify({ h1: r.h1, n: r.ids.length, want: c.count, overflow: r.overflow, cols: r.cols, canonical: r.canonical }));
    }
    check(ok === INDEX.length && !errs.length, `${vp.width}px: all ${INDEX.length} collection pages load with the right products, one h1, canonical, ${vp.width < 600 ? '2' : '4'} columns, no sideways scroll`, errs.join(' | '));
    await ctx.close();
  }

  // 2. Parity with the store: the store's own filter for the same collection shows the same products. (The store
  //    reads the 11 Oct API fixture and the pages were rendered from today's products.db, so only products present
  //    in both are compared.)
  for (const [slug, storeParam] of [['retro-deal', 'retro-deal'], ['bee-collection', 'Bee Collection'], ['teacher-appreciation', 'Teacher+Appreciation'], ['pride', 'Pride'], ['gifts', 'gifts'], ['personalised', 'personalised']]) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    await H.wire(ctx);
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${PORT}/store/?collection=${storeParam}`);
    await page.waitForSelector('#grid .card');
    await page.waitForTimeout(400);
    const storeIds = await page.$$eval('#grid .card .card-title-link', as => [...new Set(as.map(a => a.getAttribute('href').replace('/products/', '')))]);
    const pageIds = INDEX.find(c => c.slug === slug).products;
    const s = storeIds.filter(id => FIX_IDS.has(id)).sort(), p = pageIds.filter(id => FIX_IDS.has(id)).sort();
    check(sameSet(s, p), `store ?collection=${storeParam} and /collections/${slug} list the same products`, sameSet(s, p) ? '' : `store only: ${s.filter(x => !p.includes(x)).join(',')} | page only: ${p.filter(x => !s.includes(x)).join(',')}`);
    await ctx.close();
  }

  // 3. Analytics: the page sends the same collection_view as the store's filter for that collection; card clicks
  //    are tracked; ?src is kept onto the product page.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const log = await H.wire(ctx);
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${PORT}/store/?collection=retro-deal&src=test-cc-store`);
    await page.waitForSelector('#grid .card'); await page.waitForTimeout(500);
    const storeView = log.events.find(e => e.event === 'collection_view' && e.product_id === 'retro-deal');
    await page.goto(`http://localhost:${PORT}/collections/retro-deal?src=test-cc-page`);
    await page.waitForSelector('.cc-grid'); await page.waitForTimeout(300);
    const pageView = log.events.find(e => e.event === 'collection_view' && e.source === 'test-cc-page');
    check(storeView && pageView && pageView.product_id === storeView.product_id && Object.keys(pageView).sort().join() === Object.keys(storeView).sort().join(),
      'collection_view: same event name, same slug and same fields as the store filter', JSON.stringify({ store: storeView, page: pageView }));
    const first = await page.$eval('.cc-grid a.cc-link', a => a.dataset.id);
    await page.click('.cc-grid a.cc-link >> nth=0');
    await page.waitForSelector('html.pp-ready, html.pp-unavailable', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(400);
    const click = log.events.find(e => e.event === 'product_card_click' && e.product_id === first);
    const view = log.events.find(e => e.event === 'product_view' && e.product_id === first);
    check(click && click.source === 'test-cc-page' && click.path === 'collection:retro-deal', 'card click tracked with the source and the collection', JSON.stringify(click));
    check(view && view.source === 'test-cc-page', 'the source arrives on the product page (and on to checkout from there)', JSON.stringify(view));
    await ctx.close();
  }

  // 4. Filters, sort and basket count.
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    await H.wire(ctx);
    await ctx.addInitScript(() => { try { localStorage.setItem('cbj_cart_v1', JSON.stringify({ v: 1, saved: Date.now(), lines: [{ k: 'x', id: 'keyring-014', qty: 2, price: 3.5 }] })); } catch (e) {} });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(`http://localhost:${PORT}/collections/retro-deal`);
    await page.waitForSelector('.cc-tools:not([hidden])');
    const total = await page.$$eval('.cc-grid .cc-card', c => c.length);
    await page.click('.cc-chip[data-type="Mug"]');
    const mugs = await page.evaluate(() => ({ shown: [...document.querySelectorAll('.cc-grid .cc-card')].filter(c => !c.hidden).map(c => c.dataset.type), text: document.querySelector('.cc-count').textContent }));
    check(mugs.shown.length > 0 && mugs.shown.every(t => t === 'Mug') && mugs.text === `${mugs.shown.length} products`, 'type chip shows only that type and updates the count', JSON.stringify(mugs));
    await page.click('.cc-chip[data-type=""]');
    await page.selectOption('#ccSort', 'price-asc');
    const prices = await page.$$eval('.cc-grid .cc-card', c => c.filter(x => !x.hidden).map(x => Number(x.dataset.price)));
    check(prices.length === total && prices.every((p, i) => i === 0 || prices[i - 1] <= p), 'All again, sorted by price low to high', `${prices.length}/${total}`);
    await page.selectOption('#ccSort', 'price-desc');
    const desc = await page.$$eval('.cc-grid .cc-card', c => c.map(x => Number(x.dataset.price)));
    check(desc.every((p, i) => i === 0 || desc[i - 1] >= p), 'sorted by price high to low');
    const basket = await page.evaluate(() => { const b = document.querySelector('.cc-basket'); return b && !b.hidden ? b.textContent.trim() : null; });
    check(basket === 'Basket 2', 'header shows the basket count from the saved basket', basket);
    check(!errs.length, 'no page errors', errs.join(' | '));
    await ctx.close();
  }

  // 5. Without JavaScript the page still lists every product as a link.
  {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(`http://localhost:${PORT}/collections/personalised`);
    const n = await page.$$eval('.cc-grid a.cc-link', a => a.length);
    check(n === INDEX.find(c => c.slug === 'personalised').count, 'no JavaScript: every product is still a link', String(n));
    await ctx.close();
  }

  await browser.close(); srv.close();
  console.log(`${checks} checks, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})();
