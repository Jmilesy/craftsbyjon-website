// The ten Clear/Black keyrings: the popup opens, Add waits for a finish, the chosen finish (and its photo when
// there is one) reaches the basket and the checkout request. Regression test for the blackUrl crash.
//   node tests/browser/finish-keyrings.cjs
'use strict';
const H = require('./harness.cjs');
const { checkoutFromBasket } = require('./scenarios.cjs');
(async () => {
  const srv = await H.startServer(8784);
  const browser = await H.playwright().chromium.launch();
  const ids = H.FIX.products.result.filter(p => /Black/.test(p.variants || '') && String(p['Ready to Go']).toLowerCase() === 'yes').map(p => p['Product ID']);
  let fails = 0;
  for (const id of ids) for (const finish of ['Clear', 'Black']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const log = await H.wire(ctx); const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(`http://localhost:8784/store/?src=test-finish#${id}`);
    const opened = await page.waitForSelector('#modalWrap.open #modalAddBtn', { timeout: 6000 }).then(() => true, () => false);
    const disabledFirst = opened && await page.isDisabled('#modalAddBtn');
    if (opened) { await page.click(`.modal-variants .modal-variant-btn:text-is("${finish}")`); }
    const img = opened && await page.getAttribute('#modalMainImg', 'src');
    let body = null;
    if (opened) { await page.click('#modalAddBtn'); body = await checkoutFromBasket(page, log, {}); }
    const item = body && body.items[0];
    const p = H.FIX.products.result.find(x => x['Product ID'] === id);
    const vi = JSON.parse(p.variant_images || '{}');
    const wantImg = finish === 'Black' && vi.black ? vi.black.split('/').pop() : null;
    const ok = opened && disabledFirst && item && item.variant === finish && !errs.length && (!wantImg || (img || '').endsWith(wantImg) && (item.image_url || '').endsWith(wantImg));
    if (!ok) fails++;
    console.log(`${ok ? 'pass' : 'FAIL'}  ${id} ${finish.padEnd(5)} opened=${opened} addWaited=${disabledFirst} basket=${item && item.variant} photo=${wantImg ? ((img || '').endsWith(wantImg) ? 'black photo' : 'WRONG') : 'main'} ${errs.join(' ')}`);
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(fails ? `${fails} failed` : `all ${ids.length * 2} keyring/finish combinations work`);
  process.exit(fails ? 1 : 0);
})();
