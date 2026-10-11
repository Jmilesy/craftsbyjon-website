// Buying on /products/{id} must send exactly what buying through the /store/ popup sends.
// For every scenario: same checkout request, same saved basket, same funnel events, no errors.
//   node tests/browser/product-page-parity.cjs
'use strict';
const assert = require('assert');
const H = require('./harness.cjs');
const { SCENARIOS, checkoutFromBasket } = require('./scenarios.cjs');

async function run(browser, url, sc, vp) {
  const ctx = await browser.newContext(vp);
  const log = await H.wire(ctx, { patch: sc.patch });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  await page.goto(url);
  const opened = await page.waitForSelector('#modalWrap.open #modalAddBtn', { timeout: 10000 }).then(() => true, () => false);
  if (!opened) { const r = { notOpened: true, errors }; await ctx.close(); return r; }
  await sc.steps(page);
  await page.waitForSelector('#modalAddBtn:not([disabled])', { timeout: 8000 });
  await page.click('#modalAddBtn');
  const body = await checkoutFromBasket(page, log, { promo: 'TEST10', gift: true, optIn: true });
  const saved = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('cbj_cart_v1') || 'null'); if (s) { delete s.saved; s.lines.forEach(l => delete l.added); } return s; });
  await ctx.close();
  return { body, saved, events: log.events.map(e => [e.event, e.source, e.product_id].join('|')), errors, live: log.live };
}

(async () => {
  const srv = await H.startServer(8785);
  const browser = await H.playwright().chromium.launch();
  let fails = 0;
  for (const vp of [{ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, n: 'phone' }, { viewport: { width: 1280, height: 900 }, n: 'desktop' }]) {
    for (const sc of SCENARIOS) {
      const a = await run(browser, `http://localhost:8785/store/?src=test-parity#${sc.id}`, sc, vp);
      const b = await run(browser, `http://localhost:8785/products/${sc.id}?src=test-parity`, sc, vp);
      const problems = [];
      if (a.notOpened || b.notOpened) problems.push(`did not open: store=${!a.notOpened} page=${!b.notOpened} ${JSON.stringify(b.errors)}`);
      else {
        try { assert.deepStrictEqual(b.body, a.body); } catch (e) { problems.push('checkout body differs\n' + e.message.split('\n').slice(0, 30).join('\n')); }
        try { assert.deepStrictEqual(b.saved, a.saved); } catch (e) { problems.push('saved basket differs'); }
        try { assert.deepStrictEqual(b.events, a.events); } catch (e) { problems.push('events differ: ' + JSON.stringify(a.events) + ' vs ' + JSON.stringify(b.events)); }
        if (a.errors.length || b.errors.length) problems.push('errors store=' + JSON.stringify(a.errors) + ' page=' + JSON.stringify(b.errors));
      }
      const it = !a.notOpened && a.body && a.body.items[0];
      console.log(`${problems.length ? 'FAIL' : 'pass'}  ${vp.n.padEnd(7)} ${sc.name.padEnd(42)} ${it ? `£${it.price} ${it.variant || ''} gelato=${it.gelato_variant_id || '-'} variant_id=${it.variant_id || '-'}` : ''}`);
      problems.forEach(p => console.log('      - ' + p));
      if (problems.length) fails++;
    }
  }
  await browser.close(); srv.close();
  console.log(fails ? `${fails} differ` : `all ${SCENARIOS.length * 2} product-page purchases identical to the store popup`);
  process.exit(fails ? 1 : 0);
})();
