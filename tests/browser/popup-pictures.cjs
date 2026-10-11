// Pictures follow the chosen options, in the store popup and on /products/{id} (11 Oct 2026).
// The note under the main picture must say exactly what store/variant-images.js says (worked out here in Node
// from the same fixture), the picture shown must belong to the choice when one exists, and looking at a
// thumbnail must never change what is chosen.
//   node tests/browser/popup-pictures.cjs
'use strict';
const H = require('./harness.cjs');
require('../../store/print-picker.js');
require('../../store/tote-picker.js');
const V = require('../../store/variant-images.js');
const P = globalThis.CBJPrint, T = globalThis.CBJTote;
const { checkoutFromBasket } = require('./scenarios.cjs');

const PORT = 8786;
const ready = (p, id) => H.FIX.products.result.some(x => x['Product ID'] === id && String(x['Ready to Go']).toLowerCase() === 'yes');
const ids = kind => H.FIX.products.result.filter(p => p.product_type === kind && ready(p, p['Product ID'])).map(p => p['Product ID']);
const vars = id => ((H.FIX.variants[id] || {}).result || []).filter(v => v.active !== 0);
const tail = u => String(u || '').split('/').pop();

let checks = 0, fails = 0;
function check(ok, label, detail) { checks++; if (!ok) fails++; if (!ok || process.env.VERBOSE) console.log(`${ok ? 'pass' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`); }

async function open(browser, mode, id) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const log = await H.wire(ctx);
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  if (mode === 'store') {
    await page.goto(`http://localhost:${PORT}/store/?src=test-pictures#${id}`);
    await page.waitForSelector('#modalWrap.open #modalAddBtn', { timeout: 8000 });
  } else {
    await page.goto(`http://localhost:${PORT}/products/${id}?src=test-pictures`);
    await page.waitForSelector('html.pp-ready #modalAddBtn', { timeout: 8000 });
  }
  return { ctx, page, log, errs };
}
const state = page => page.evaluate(() => {
  const n = document.getElementById('modalImgNote');
  const thumbs = [...document.querySelectorAll('.modal-img-col .modal-thumb')].map(t => t.getAttribute('src'));
  return { note: n && !n.hidden ? n.textContent : null, noteEl: !!n, main: document.getElementById('modalMainImg').getAttribute('src'), thumbs };
});
const clickVal = (page, row, val) => page.evaluate(([r, v]) => {
  const b = [...document.querySelectorAll('#' + r + ' [data-val]')].find(x => x.getAttribute('data-val') === v);
  if (!b || b.disabled) return false; b.click(); return true;
}, [row, val]);

async function prints(browser, mode) {
  for (const id of ids('Print')) {
    const vs = vars(id), gallery = (H.FIX.variantGallery[id] || {}).result || {};
    const { ctx, page, errs } = await open(browser, mode, id);
    await page.waitForSelector('#printFrameRow [data-val]');
    const s0 = await state(page);
    check(s0.noteEl && s0.note === null, `${mode} ${id} no note before choosing`);
    // Every frame and text at each frame's first size, then every size of the first frame.
    const combos = [];
    for (const f of P.frames(vs)) for (const t of P.texts(vs)) combos.push([f, P.sizes(vs, f)[0], t]);
    const f0 = P.frames(vs)[0];
    for (const s of P.sizes(vs, f0).slice(1)) combos.push([f0, s, 'No']);
    for (const [f, s, t] of combos) {
      await clickVal(page, 'printFrameRow', f); await page.waitForTimeout(40);
      await clickVal(page, 'printSizeRow', s); await page.waitForTimeout(40);
      await clickVal(page, 'printTextRow', t); await page.waitForTimeout(60);
      const want = V.imagesFor({ kind: 'print', vars: vs, printGallery: gallery, defaults: [] }, { Frame: f, Size: s, Text: t });
      const got = await state(page);
      const noteOk = (want.exact ? null : want.note) === got.note;
      const picOk = !want.urls.length || want.urls.map(tail).includes(tail(got.main));
      check(noteOk && picOk, `${mode} ${id} ${f} / ${s} / ${t}`, noteOk && picOk ? '' : `note=${JSON.stringify(got.note)} want=${JSON.stringify(want.exact ? null : want.note)} main=${tail(got.main)}`);
    }
    check(!errs.length, `${mode} ${id} no page errors`, errs.join(' | '));
    await ctx.close();
  }
}

async function totes(browser, mode) {
  for (const id of ids('Tote Bag')) {
    const vs = vars(id);
    const { ctx, page, errs } = await open(browser, mode, id);
    await page.waitForSelector('#toteColourRow [data-val]');
    for (const c of T.colours(vs)) for (const t of T.texts(vs, c)) {
      await clickVal(page, 'toteColourRow', c); await page.waitForTimeout(40);
      await clickVal(page, 'toteTextRow', t); await page.waitForTimeout(60);
      const want = V.imagesFor({ kind: 'tote', vars: vs, defaults: [] }, { Colour: c, Text: t });
      const got = await state(page);
      const noteOk = (want.exact ? null : want.note) === got.note;
      const picOk = !want.urls.length || want.urls.map(tail).includes(tail(got.main));
      check(noteOk && picOk, `${mode} ${id} ${c} / ${t}`, noteOk && picOk ? '' : `note=${JSON.stringify(got.note)} want=${JSON.stringify(want.exact ? null : want.note)} main=${tail(got.main)}`);
    }
    check(!errs.length, `${mode} ${id} no page errors`, errs.join(' | '));
    await ctx.close();
  }
}

async function tees(browser, mode) {
  for (const id of ids('T-Shirt')) {
    const p = H.FIX.products.result.find(x => x['Product ID'] === id);
    const pg = JSON.parse(p.pod_gallery_images || '{}');
    const { ctx, page, errs } = await open(browser, mode, id);
    await page.waitForSelector('#podColourRow .modal-variant-btn');
    const colours = await page.$$eval('#podColourRow .modal-variant-btn', bs => bs.map(b => b.textContent.trim()));
    for (const c of colours) {
      await page.click(`#podColourRow .modal-variant-btn:text-is("${c}")`); await page.waitForTimeout(50);
      const want = V.imagesFor({ kind: 'apparel', podGallery: pg, defaults: [] }, { Colour: c });
      const got = await state(page);
      const noteOk = (want.exact ? null : want.note) === got.note;
      const picOk = !want.exact || want.urls.map(tail).includes(tail(got.main));
      check(noteOk && picOk, `${mode} ${id} ${c}`, noteOk && picOk ? '' : `note=${JSON.stringify(got.note)} main=${tail(got.main)}`);
    }
    // Looking at another picture keeps the colour chosen.
    const c0 = colours[0];
    await page.click(`#podColourRow .modal-variant-btn:text-is("${c0}")`);
    const thumbs = await page.$$('.modal-img-col .modal-thumb');
    if (thumbs.length > 1) {
      await thumbs[1].click();
      const sel = await page.$eval('#podColourRow .modal-variant-btn.selected', b => b.textContent.trim()).catch(() => null);
      check(sel === c0, `${mode} ${id} thumbnail keeps ${c0} chosen`, `selected=${sel}`);
    }
    check(!errs.length, `${mode} ${id} no page errors`, errs.join(' | '));
    await ctx.close();
  }
}

async function finishes(browser, mode) {
  const list = H.FIX.products.result.filter(p => /Black/.test(p.variants || '') && ready(p, p['Product ID']));
  for (const p of list) {
    const id = p['Product ID'], vi = JSON.parse(p.variant_images || '{}');
    const { ctx, page, log, errs } = await open(browser, mode, id);
    const s0 = await state(page);
    check(s0.note === null, `${mode} ${id} no note before choosing`);
    await page.click('.modal-variants .modal-variant-btn:text-is("Black")'); await page.waitForTimeout(40);
    const b = await state(page);
    const wantNote = vi.black ? null : 'No photo of the black finish yet, so this shows the clear one.';
    check(b.note === wantNote && (!vi.black || tail(b.main) === tail(vi.black)), `${mode} ${id} Black`, `note=${JSON.stringify(b.note)} main=${tail(b.main)}`);
    await page.click('.modal-variants .modal-variant-btn:text-is("Clear")'); await page.waitForTimeout(40);
    const c = await state(page);
    check(c.note === null && (!vi.black || tail(c.main) !== tail(vi.black)), `${mode} ${id} Clear`, `note=${JSON.stringify(c.note)} main=${tail(c.main)}`);
    // Tapping the black photo while Clear is chosen: the picture changes, the choice (and the basket) don't.
    if (vi.black) {
      const t = await page.$(`.modal-img-col .modal-thumb[src$="${tail(vi.black)}"]`);
      if (t) {
        await t.click();
        const sel = await page.$eval('.modal-variants .modal-variant-btn.selected', x => x.textContent.trim()).catch(() => null);
        await page.click('#modalAddBtn');
        const body = await checkoutFromBasket(page, log, {});
        const item = body && body.items[0];
        check(sel === 'Clear' && item && item.variant === 'Clear', `${mode} ${id} black thumbnail keeps Clear`, `selected=${sel} basket=${item && item.variant}`);
      }
    }
    check(!errs.length, `${mode} ${id} no page errors`, errs.join(' | '));
    await ctx.close();
  }
}

(async () => {
  const srv = await H.startServer(PORT);
  const browser = await H.playwright().chromium.launch();
  for (const mode of ['store', 'product-page']) {
    const before = [checks, fails];
    await prints(browser, mode); await totes(browser, mode); await tees(browser, mode); await finishes(browser, mode);
    console.log(`${mode}: ${checks - before[0]} checks, ${fails - before[1]} failed`);
  }
  await browser.close(); srv.close();
  console.log(`${checks} checks, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})();
