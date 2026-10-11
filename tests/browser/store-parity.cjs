// The split store (shop.js / shop.css / consent.js) must behave exactly like the inline store on main.
// For every scenario: same checkout request body, same saved basket, same funnel events, no page errors.
//   node tests/browser/store-parity.cjs
'use strict';
const { execSync } = require('child_process');
const assert = require('assert');
const H = require('./harness.cjs');
const { SCENARIOS, checkoutFromBasket } = require('./scenarios.cjs');

async function run(browser, port, sc) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const log = await H.wire(ctx, { patch: sc.patch });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  await page.goto(`http://localhost:${port}/store/?src=test-parity#${sc.id}`);
  const opened = await page.waitForSelector('#modalWrap.open #modalAddBtn', { timeout: 8000 }).then(() => true, () => false);
  if (!opened) { await ctx.close(); return { notOpened: true, errors, live: log.live }; }
  await sc.steps(page);
  await page.waitForSelector('#modalAddBtn:not([disabled])', { timeout: 8000 });
  await page.click('#modalAddBtn');
  const body = await checkoutFromBasket(page, log, { promo: 'TEST10', gift: true, optIn: true });
  const saved = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('cbj_cart_v1') || 'null'); if (s) { delete s.saved; s.lines.forEach(l => delete l.added); } return s; });
  await ctx.close();
  return { body, saved, events: log.events.map(e => [e.event, e.source, e.product_id].join('|')), errors, analytics: log.analytics.length, live: log.live };
}

(async () => {
  const oldStore = execSync('git show origin/main:store/index.html', { cwd: H.ROOT }).toString();
  const sOld = await H.startServer(8781, { '/store/index.html': oldStore });
  const sNew = await H.startServer(8782);
  const browser = await H.playwright().chromium.launch();
  let fails = 0;
  for (const sc of SCENARIOS) {
    const a = await run(browser, 8781, sc), b = await run(browser, 8782, sc);
    const problems = [];
    if (sc.brokenOnMain && a.notOpened) {
      // Known live bug: the split store must fail in exactly the same way (or, once fixed, work).
      const same = b.notOpened && JSON.stringify(a.errors) === JSON.stringify(b.errors);
      console.log(`${same || !b.notOpened ? 'pass' : 'FAIL'}  ${sc.name.padEnd(42)} broken on main too ("${sc.brokenOnMain}")${b.notOpened ? ', same failure in the split store' : ', works in the split store'}`);
      if (!same && b.notOpened) fails++;
      continue;
    }
    try { assert.deepStrictEqual(b.body, a.body); } catch (e) { problems.push('checkout body differs'); }
    try { assert.deepStrictEqual(b.saved, a.saved); } catch (e) { problems.push('saved basket differs'); }
    try { assert.deepStrictEqual(b.events, a.events); } catch (e) { problems.push('events differ: ' + JSON.stringify(a.events) + ' vs ' + JSON.stringify(b.events)); }
    if (a.errors.length || b.errors.length) problems.push('errors old=' + JSON.stringify(a.errors) + ' new=' + JSON.stringify(b.errors));
    if (!a.body) problems.push('no checkout captured');
    if (b.live.length) problems.push('unexpected calls ' + b.live);
    const item = a.body && a.body.items && a.body.items[0];
    console.log(`${problems.length ? 'FAIL' : 'pass'}  ${sc.name.padEnd(42)} ${item ? `${item.product_id} £${item.price} gelato=${item.gelato_variant_id ? 'yes' : '-'} variant_id=${item.variant_id || '-'} src=${a.body.source}` : ''}`);
    problems.forEach(p => console.log('      - ' + p));
    if (problems.length) fails++;
  }
  await browser.close(); sOld.close(); sNew.close();
  console.log(fails ? `${fails} scenario(s) differ` : `all ${SCENARIOS.length} scenarios identical (old inline store vs split store)`);
  process.exit(fails ? 1 : 0);
})();
