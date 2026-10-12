// Shop search finds every product a shopper can buy from /store/ (12 Oct 2026). Before this, searching the
// "All" view only looked at the main grid, so "teacher" or "bee" found nothing even though those products sit
// under "Also available" on the same page. The search must find them, and nothing a shopper can't buy (not
// Ready to Go, sold out, archived collection) may appear. Collection filters, deep links, the popup, events and
// ?src are unchanged.
//   node tests/browser/shop-search.cjs            (this repo's store/shop.js)
//   OLD_SHOP=<path> node tests/browser/shop-search.cjs   (any other shop.js, e.g. the one before the fix)
'use strict';
const fs = require('fs');
const H = require('./harness.cjs');
const PORT = 8794;
const FIX = JSON.parse(fs.readFileSync(require('path').join(__dirname, '../fixtures/live-api-20261011.json'), 'utf8'));
const BY_ID = {}; FIX.products.result.forEach(p => { BY_ID[p['Product ID']] = p; });
let checks = 0, fails = 0;
function check(ok, label, detail) { checks++; if (!ok) fails++; console.log(`${ok ? 'pass' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`); }
const matches = (p, q) => [p['Title'], p['Short Description'], p['Search Tags']].join(' ').toLowerCase().indexOf(q) !== -1;
const same = (a, b) => a.length === b.length && a.every(x => b.includes(x));

// IDs on show: main grid cards and "Also available" cards (both carry the product in their onclick).
function shown() {
  const id = el => { const m = (el.getAttribute('onclick') || '').match(/"Product ID":"([^"]+)"/); return m && m[1]; };
  return {
    grid: [...document.querySelectorAll('#grid .card')].map(id),
    avail: [...document.querySelectorAll('#availableSection .available-card')].map(id),
    count: (document.getElementById('resultsCount') || {}).textContent || '',
    noResults: (document.getElementById('noResults') || {}).style ? document.getElementById('noResults').style.display : '',
  };
}
async function search(page, q) {
  await page.fill('#searchInput', q);
  await page.waitForTimeout(150);
  return page.evaluate(shown);
}

(async () => {
  const overrides = process.env.OLD_SHOP ? { '/store/shop.js': fs.readFileSync(process.env.OLD_SHOP, 'utf8') } : {};
  const srv = await H.startServer(PORT, overrides);
  const browser = await H.playwright().chromium.launch();

  async function open(url, opts, viewport) {
    const ctx = await browser.newContext({ viewport: viewport || { width: 1280, height: 900 } });
    const log = await H.wire(ctx, opts);
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(`http://localhost:${PORT}${url}`);
    await page.waitForSelector('#grid .card');
    await page.waitForTimeout(200);
    return { ctx, log, page, errs };
  }

  // 1. Every term: results are exactly the purchasable products (main grid + Also available) that match.
  {
    const { ctx, log, page, errs } = await open('/store/');
    const base = await page.evaluate(shown);
    const buyable = base.grid.concat(base.avail);
    check(base.avail.length > 0 && !base.grid.some(id => base.avail.includes(id)), 'unsearched page: main grid and Also available, no overlap', `grid=${base.grid.length} avail=${base.avail.length}`);
    for (const q of ['teacher', 'bee', 'pride', 'easter', 'mug', 'keyring', 'retro', 'TEACHER', '  bee  ', 'zzqx-nothing']) {
      const t = q.toLowerCase().trim();
      const r = await search(page, q);
      const want = buyable.filter(id => matches(BY_ID[id], t));
      const excluded = FIX.products.result.filter(p => matches(p, t) && !buyable.includes(p['Product ID'])).map(p => p['Product ID']);
      const dupes = r.grid.length !== new Set(r.grid).size;
      const countOk = r.count === `Showing ${want.length} of ${buyable.length} products`;
      check(same(r.grid, want) && !dupes && r.avail.length === 0 && countOk && (want.length ? r.noResults === 'none' : r.noResults === 'block'),
        `search "${q}": ${want.length} result(s), all purchasable, none hidden or doubled`,
        `got=${r.grid.length} want=${want.length} count="${r.count}" alsoAvailableWhileSearching=${r.avail.length} notBuyableMatching=${excluded.length}${same(r.grid, want) ? '' : ' missing=' + want.filter(x => !r.grid.includes(x)).join(',') + ' extra=' + r.grid.filter(x => !want.includes(x)).join(',')}`);
      if (t === 'teacher' || t === 'bee') check(want.length > 0 && r.grid.length > 0, `search "${q}" finds products (it found 0 before the fix)`, `got=${r.grid.length}`);
      if (excluded.length) check(!r.grid.some(id => excluded.includes(id)), `search "${q}": the ${excluded.length} matching product(s) not for sale stay out`, excluded.join(','));
    }
    // Clearing the search puts the page back exactly as it was.
    const back = await search(page, '');
    check(same(back.grid, base.grid) && same(back.avail, base.avail) && back.count === base.count, 'clearing the search restores the grid, Also available and the count', `count="${back.count}"`);
    check(!errs.length && log.live.every(l => /collections-list/.test(l)) && !log.checkouts.length, 'no page errors, no unexpected API calls, no checkout', errs.join(' | ') + ' ' + log.live.join(','));
    await ctx.close();
  }

  // 2. Products made unavailable after load never come back through search: sold out, not Ready to Go, archived.
  {
    const teacher = FIX.products.result.filter(p => p['Collection'] === 'Teacher Appreciation' && String(p['Ready to Go']).toLowerCase() === 'yes' && matches(p, 'teacher')).map(p => p['Product ID']);
    const patch = {};
    if (teacher[0]) patch[teacher[0]] = { design_stock_tracked: 1, design_stock_qty: 0 };
    if (teacher[1]) patch[teacher[1]] = { 'Ready to Go': 'no' };
    const { ctx, page, errs } = await open('/store/', { patch });
    const r = await search(page, 'teacher');
    check(teacher.length >= 2 && !r.grid.includes(teacher[0]) && !r.grid.includes(teacher[1]) && r.grid.length > 0, 'sold-out and not-Ready products are not found by search', `soldOut=${teacher[0]} notReady=${teacher[1]} got=${r.grid.join(',')}`);
    await ctx.close();
    // A collection archived in the admin: its products are not on sale and must not be found.
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await H.wire(ctx2);
    await ctx2.route(/products-api\/collections$/, r2 => {
      const c = JSON.parse(JSON.stringify(FIX.collections));
      c.result.forEach(x => { if (x.name === 'Bee Collection') x.status = 'archived'; });
      r2.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(c) });
    });
    const p2 = await ctx2.newPage(); const e2 = [];
    p2.on('pageerror', e => e2.push(e.message));
    await p2.goto(`http://localhost:${PORT}/store/`);
    await p2.waitForSelector('#grid .card');
    const r2 = await search(p2, 'bee');
    const beeIds = FIX.products.result.filter(p => p['Collection'] === 'Bee Collection').map(p => p['Product ID']);
    check(!r2.grid.some(id => beeIds.includes(id)) && !e2.length && !errs.length, 'archived collection: its products are not found by search', `got=${r2.grid.join(',')}`);
    await ctx2.close();
  }

  // 3. Inside a collection, search still only looks in that collection; deep links unchanged.
  for (const [url, col] of [['/store/?collection=bee-collection', 'Bee Collection'], ['/store/?collection=teacher-appreciation', 'Teacher Appreciation'], ['/store/?collection=retro-deal', 'Retro Deal']]) {
    const { ctx, page, errs } = await open(url);
    const active = await page.evaluate(() => { const b = document.querySelector('#collectionFilterBar .col-btn.active'); return b && b.dataset.col; });
    const before = await page.evaluate(shown);
    const r = await search(page, 'mug');
    const want = before.grid.filter(id => matches(BY_ID[id], 'mug'));
    check(active === col && before.grid.every(id => BY_ID[id]['Collection'] === col) && same(r.grid, want) && r.avail.length === 0 && !errs.length,
      `${url}: opens ${col}, search stays inside it`, `active=${active} shown=${before.grid.length} mugs=${r.grid.length}/${want.length}`);
    await ctx.close();
  }

  // 4. A found "Also available" product opens its popup, records the card click, keeps ?src.
  {
    const { ctx, log, page, errs } = await open('/store/?src=test-search');
    const r = await search(page, 'teacher');
    const target = r.grid.find(id => BY_ID[id]['Collection'] === 'Teacher Appreciation');
    if (target) await page.click(`#grid .card .card-title-link[href="/products/${encodeURIComponent(target)}"]`);
    await page.waitForTimeout(400);
    const st = await page.evaluate(() => ({
      modal: !!document.querySelector('#modalWrap.open'),
      hash: location.hash,
      src: sessionStorage.getItem('cbj_src'),
    }));
    const click = log.events.find(e => e.event_type === 'product_card_click' || e.event === 'product_card_click' || e.type === 'product_card_click');
    check(!!target && st.modal && st.hash === '#' + target && st.src === 'test-search' && !!click && JSON.stringify(click).includes(target) && !errs.length,
      'a found Teacher Appreciation product opens its popup, logs product_card_click, ?src kept', `target=${target} modal=${st.modal} hash=${st.hash} src=${st.src} event=${click ? 'yes' : 'no'} ${errs.join(' | ')}`);
    await ctx.close();
  }

  // 5. Phone width: search is in the Browse panel (as on the live shop); same results.
  {
    const { ctx, page, errs } = await open('/store/', {}, { width: 390, height: 844 });
    await page.click('.mobile-hamburger');
    await page.fill('#drawerNav input[type=search]', 'bee');
    await page.waitForTimeout(150);
    const r = await page.evaluate(shown);
    check(r.grid.length > 0 && r.avail.length === 0 && !errs.length, 'phone 390px: search "bee" from the Browse panel finds products', `got=${r.grid.length}`);
    await ctx.close();
  }

  await browser.close(); srv.close();
  console.log(`${checks} checks, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})();
