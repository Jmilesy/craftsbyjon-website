// Staff orders page, photo lines (13 Oct 2026): genuine-pixel crop size against the 1180 px print size, and no
// "Name on mug" row for photo-only products (a product with a name field still shows it, blank or not).
//   node tests/browser/staff-photo-lines.cjs
'use strict';
const H = require('./harness.cjs');
const PORT = 8797; let checks = 0, fails = 0;
function check(ok, label, detail) { checks++; if (!ok) fails++; console.log(`${ok ? 'pass' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`); }
const UP = 'a'.repeat(64);
const line = (n, extra) => Object.assign({ line_no: n, line_id: 'l' + n, product_id: 'mug-birthday-photo', title: 'Personalised Birthday Photo Mug', quantity: 1, upload_id: UP, claimed: true, artwork_status: 'awaiting_artwork' }, extra);
const order = {
  id: 77, order_ref: 'CBJ-0077', status: 'pending', customer_name: 'Test Customer', created_at: '2026-10-13 20:00:00', items: [{ title: 'Personalised Birthday Photo Mug', quantity: 1, price: 14.99 }], total: 14.99,
  pod_fulfilment_status: 'needs_manual_file', personalisation_stage: 'awaiting_artwork',
  personalisations: [
    line(1, { option_label: '21st Champagne', fields: {}, photo_width: 4000, photo_height: 3000, crop: { x: 0.3, y: 0.2, w: 0.295, h: 0.393333 } }),   // 1180 px
    line(2, { option_label: '40th Rainbow', fields: {}, photo_width: 1000, photo_height: 1000, crop: { x: 0, y: 0, w: 1, h: 1 } }),                   // 1000 px
    line(3, { option_label: '18th', fields: { name: 'Sam' }, photo_width: 1600, photo_height: 1200, crop: { x: 0.125, y: 0, w: 0.75, h: 1 } }),       // older spec with a name
    line(4, { option_label: '16th', fields: { name: '' }, photo_width: 1600, photo_height: 1200, crop: { x: 0.125, y: 0, w: 0.75, h: 1 } })
  ]
};
(async () => {
  const srv = await H.startServer(PORT);
  const browser = await H.playwright().chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Playwright tries the most recently added route first, so the catch-alls go in first.
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.route(/orders-api\//, r => r.fulfill({ contentType: 'application/json', body: '{"result":[]}' }));
  await ctx.route(/products-api\//, r => r.fulfill({ contentType: 'application/json', body: '{"result":[]}' }));
  await ctx.route(/orders-api\/orders\/stats/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: {} }) }));
  await ctx.route(/orders-api\/orders(\?.*)?$/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: [order] }) }));
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(`http://localhost:${PORT}/staff/orders.html`);
  await page.waitForSelector('.ph-line', { state: 'attached', timeout: 8000 });
  const lines = await page.$$eval('.ph-line .ph-info', x => x.map(e => e.textContent.replace(/\s+/g, ' ')));
  check(/crop 1180 px square of genuine photo pixels/.test(lines[0]) && /meets 1180 px/.test(lines[0]), 'line 1: 1180 px meets the print size', lines[0].slice(0, 200));
  check(/crop 1000 px square/.test(lines[1]) && /below the 1180 px print size: may print soft; enlarging adds no detail/.test(lines[1]), 'line 2: 1000 px flagged, upscaling not counted', lines[1].slice(0, 220));
  check(!/Name on mug/.test(lines[0]) && !/Name on mug/.test(lines[1]), 'photo-only lines: no name row');
  check(/Name on mug: Sam/.test(lines[2]) && /Name on mug: no name/.test(lines[3]), 'products with a name field: unchanged');
  check(errs.length === 0, 'no page errors', errs.join('; '));
  await browser.close(); srv.close();
  console.log(`\n${checks - fails}/${checks} checks passed`); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
