// Birthday photo mug print resolution and popup wording (13 Oct 2026). Real popup, real JPEGs made in the
// browser, phone and desktop sizes: the zoom stops at 1180 genuine pixels, a small photo gets a clear warning
// and can still be bought, the crop sent at checkout keeps the pixels, options run Rainbow before Champagne,
// no name box, no delivery-time promise. The fixture's mug (11 Oct copy) is patched to the 13 Oct set-up.
//   node tests/browser/photo-quality.cjs
'use strict';
const H = require('./harness.cjs');
const PORT = 8795, ID = 'mug-birthday-photo', T = 1180;
let checks = 0, fails = 0;
function check(ok, label, detail) { checks++; if (!ok) fails++; console.log(`${ok ? 'pass' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`); }
const SPEC = { version: 1, photo: { required: true, crop_aspect: 1, min_short_px: 600, recommend_px: T }, fields: [] };
const OPTS = [[929, '16th Rainbow'], [930, '18th Rainbow'], [931, '21st Rainbow'], [932, '21st Champagne'], [933, '40th Rainbow'], [934, '40th Champagne']];
const VARIANTS = { result: OPTS.slice().reverse().map(([id, v]) => ({ id, product_id: ID, option1_name: 'Birthday', option1_value: v, retail_price_pence: 1499, active: 1, image_url: null })) };

async function jpeg(page, w, h) {
  const b64 = await page.evaluate(([w, h]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.fillStyle = '#4a90e2'; g.fillRect(0, 0, w, h); g.fillStyle = '#f5a623'; g.fillRect(w / 4, h / 4, w / 2, h / 2); return c.toDataURL('image/jpeg', 0.8).split(',')[1]; }, [w, h]);
  return Buffer.from(b64, 'base64');
}

(async () => {
  const srv = await H.startServer(PORT);
  const browser = await H.playwright().chromium.launch();
  const sizes = [[4000, 3000, 'phone 12 MP'], [1300, 1200, 'just above target'], [1000, 1000, 'small'], [700, 900, 'small portrait']];
  for (const [vw, vh, mobile, vname] of [[390, 844, true, 'phone'], [1366, 900, false, 'desktop']]) for (const [w, h, what] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, hasTouch: mobile, isMobile: mobile });
    const log = await H.wire(ctx, { patch: { [ID]: { 'Ready to Go': 'yes', personalisation_spec: JSON.stringify(SPEC), 'Bullet Point 5': 'Printed to order and delivered directly to you' } } });
    await ctx.route(/public-variants$/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(VARIANTS) }));
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    const tag = `${vname} ${w}x${h} (${what})`;
    await page.goto(`http://localhost:${PORT}/store/?src=test-quality#${ID}`);
    await page.waitForSelector('#photoOptRow .modal-variant-btn', { timeout: 8000 });
    if (w === 4000) {
      const btns = await page.$$eval('#photoOptRow .modal-variant-btn', x => x.map(b => b.textContent.trim()));
      check(JSON.stringify(btns) === JSON.stringify(OPTS.map(o => o[1])), `${vname}: Rainbow before Champagne`, btns.join(' | '));
      const txt = await page.evaluate(() => document.getElementById('modalInner').innerText);
      check(!/working day|3\s*(to|–|-)\s*5|£10\+/i.test(txt), `${vname}: no delivery-time promise or £10+ note in the popup`);
      check(/delivered directly to you/.test(txt) && /check it before it is printed and sent to you/.test(txt), `${vname}: new wording shown`);
      check(!(await page.$('#photoName')), `${vname}: no name box`);
    }
    await page.click('#photoOptRow .modal-variant-btn >> nth=3');
    await page.setInputFiles('#photoFile', { name: 'p.jpg', mimeType: 'image/jpeg', buffer: await jpeg(page, w, h) });
    await page.waitForSelector('#photoCropWrap:not([style*="none"])', { timeout: 8000 });
    await page.waitForFunction(() => /Photo added/.test((document.getElementById('photoStatus') || {}).textContent || ''));
    const short = Math.min(w, h), expMax = Math.max(1, Math.min(4, short / T));
    const zoom = await page.$eval('#photoZoom', z => ({ max: Number(z.max), disabled: z.disabled }));
    check(Math.abs(zoom.max - expMax) < 1e-6 && zoom.disabled === (expMax <= 1), `${tag}: slider max ${expMax.toFixed(3)}${expMax <= 1 ? ', disabled' : ''}`, JSON.stringify(zoom));
    // Push the slider past its end (as a forged value would); the view must clamp.
    await page.$eval('#photoZoom', z => { z.disabled = false; z.value = z.max; z.dispatchEvent(new Event('input')); z.value = '4'; photoZoomed('4'); });
    const q = await page.$eval('#photoQuality', e => ({ cls: e.className, text: e.textContent }));
    if (short >= T) check(!/warn/.test(q.cls) && (short > T * 1.001 ? /as far as the photo can zoom/.test(q.text) : true), `${tag}: no warning at full zoom`, q.text);
    else check(/warn/.test(q.cls) && q.text.includes(`gives ${short} pixels across`) && q.text.includes(`print at ${T}`), `${tag}: clear warning`, q.text);
    await page.check('#photoRights');
    const addOk = await page.$eval('#modalAddBtn', b => !b.disabled);
    check(addOk, `${tag}: can still add to basket`);
    await page.click('#modalAddBtn'); await page.waitForTimeout(300);
    await page.evaluate(() => { if (typeof openCart === 'function') openCart(); }); await page.waitForTimeout(300);
    await page.click('#checkoutBtn', { timeout: 4000 }).catch(() => {});
    for (let i = 0; i < 40 && !log.checkouts.length; i++) await page.waitForTimeout(60);
    const item = log.checkouts[0] && log.checkouts[0].items.find(x => x.product_id === ID);
    const crop = item && item.personalisation && item.personalisation.crop;
    const px = crop ? Math.min(crop.w * w, crop.h * h) : -1;
    check(!!crop && px >= Math.min(T, short) - 0.5 && Math.abs(crop.w * w - crop.h * h) < 1, `${tag}: crop sent keeps ${Math.min(T, short)} genuine px`, crop ? px.toFixed(2) + ' px, variant ' + item.variant_id : 'no checkout');
    check(item && item.variant_id === 932, `${tag}: chosen option (21st Champagne) sent`);
    check(errs.length === 0, `${tag}: no page errors`, errs.join('; '));
    await ctx.close();
  }
  await browser.close(); srv.close();
  console.log(`\n${checks - fails}/${checks} checks passed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
