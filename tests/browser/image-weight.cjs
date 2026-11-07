// Pictures in the shop are the small WebP copies, not the multi-megabyte originals (7 Nov 2026).
// Grid cards use /thumbs/800/, the popup's main picture /thumbs/1200/, its thumbnail strip /thumbs/400/. Each keeps
// the original in data-orig; the zoom view opens the original; a missing WebP copy falls back to the original.
//   node tests/browser/image-weight.cjs
'use strict';
const H = require('./harness.cjs');
const PORT = 8796;
let checks = 0, fails = 0;
function check(ok, label, detail) { checks++; if (!ok) fails++; console.log(`${ok ? 'pass' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`); }
const stem = u => String(u || '').split('/').pop().replace(/\.[^.]+$/, '');

(async () => {
  const srv = await H.startServer(PORT);
  const browser = await H.playwright().chromium.launch();
  const ids = H.FIX.products.result.filter(p => String(p['Ready to Go']).toLowerCase() === 'yes' && /^(keyring|mug|bookmark)-/.test(p['Product ID'])).map(p => p['Product ID']);
  const id = ids[0];

  // 1. grid cards
  let ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await H.wire(ctx); let page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(`http://localhost:${PORT}/store/?src=test-weight`);
  await page.waitForSelector('.card img', { timeout: 8000 });
  const cards = await page.$$eval('.card > img', els => els.map(e => ({ src: e.getAttribute('src'), orig: e.getAttribute('data-orig') })));
  const onHost = cards.filter(c => (c.orig || '').startsWith('https://images.craftsbyjon.co.uk/products/'));
  check(cards.length > 5, 'shop grid shows cards', `cards=${cards.length}`);
  check(onHost.length > 0 && onHost.every(c => /^https:\/\/images\.craftsbyjon\.co\.uk\/thumbs\/800\/[^/]+\.webp$/.test(c.src) && stem(c.src) === stem(c.orig)),
    'grid card pictures are the 800 px WebP of their own original', `${onHost.length} of ${cards.length} on the images host`);
  check(!cards.some(c => c.orig && /\.(png|jpe?g)$/i.test(c.src || '') && (c.src || '').includes('/products/')), 'no product card loads an original PNG/JPEG (the shared tote-colours strip is not a product picture)');
  await ctx.close();

  // 2. popup: main picture, strip, zoom
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await H.wire(ctx); page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
  await page.goto(`http://localhost:${PORT}/store/?src=test-weight#${id}`);
  await page.waitForSelector('#modalWrap.open #modalMainImg', { timeout: 8000 });
  const main = await page.$eval('#modalMainImg', e => ({ src: e.getAttribute('src'), orig: e.getAttribute('data-orig') }));
  check(/\/thumbs\/1200\/[^/]+\.webp$/.test(main.src) && /\/products\/[^/]+\.(png|jpe?g)$/i.test(main.orig) && stem(main.src) === stem(main.orig),
    `popup main picture is the 1200 px WebP (${id})`, `src=${main.src} orig=${main.orig}`);
  const strip = await page.$$eval('.modal-thumb', els => els.map(e => ({ src: e.getAttribute('src'), orig: e.getAttribute('data-orig') })));
  check(strip.every(t => /\/thumbs\/400\/[^/]+\.webp$/.test(t.src) && stem(t.src) === stem(t.orig)), 'popup thumbnail strip uses the 400 px WebP', `thumbs=${strip.length}`);
  await page.click('#modalMainImg');
  const zoom = await page.$eval('#lightboxImg', e => e.getAttribute('src'));
  check(zoom === main.orig, 'zoom view opens the original', `zoom=${zoom}`);
  check(!errs.length, 'no page errors', errs.join(' | '));
  await ctx.close();

  // 2b. a product with several pictures: strip thumbnails are 400 px WebP, clicking one swaps the main picture to its 1200 px copy
  const mugId = H.FIX.products.result.filter(p => String(p['Ready to Go']).toLowerCase() === 'yes' && /^mug-\d+$/.test(p['Product ID']) && p.mug_image_front).map(p => p['Product ID'])[0];
  if (mugId) {
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await H.wire(ctx); page = await ctx.newPage(); page.on('pageerror', e => errs.push(e.message));
    await page.goto(`http://localhost:${PORT}/store/?src=test-weight#${mugId}`);
    await page.waitForSelector('#modalWrap.open #modalMainImg', { timeout: 8000 });
    const ms = await page.$$eval('.modal-thumb', els => els.map(e => ({ src: e.getAttribute('src'), orig: e.getAttribute('data-orig') })));
    check(ms.length > 1 && ms.every(t => /\/thumbs\/400\/[^/]+\.webp$/.test(t.src) && stem(t.src) === stem(t.orig)), `multi-picture popup strip uses 400 px WebP (${mugId})`, `thumbs=${ms.length}`);
    if (ms.length > 1) {
      await page.click('.modal-thumb >> nth=1');
      const m2 = await page.$eval('#modalMainImg', e => ({ src: e.getAttribute('src'), orig: e.getAttribute('data-orig') }));
      check(m2.orig === ms[1].orig && /\/thumbs\/1200\/[^/]+\.webp$/.test(m2.src) && stem(m2.src) === stem(m2.orig), 'clicking a strip picture shows its 1200 px copy, original kept in data-orig', `src=${m2.src}`);
      await page.click('#modalMainImg');
      const z2 = await page.$eval('#lightboxImg', e => e.getAttribute('src'));
      check(z2 === m2.orig, 'zoom opens the picture that was selected, at full size', `zoom=${z2}`);
    }
    await ctx.close();
  } else check(false, 'found a mug with several pictures in the fixture');

  // 3. fallback when the WebP copy is missing
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await H.wire(ctx);
  await ctx.route(/images\.craftsbyjon\.co\.uk\/thumbs\//, r => r.fulfill({ status: 404, body: 'nope' }));
  page = await ctx.newPage();
  await page.goto(`http://localhost:${PORT}/store/?src=test-weight#${id}`);
  await page.waitForSelector('#modalWrap.open #modalMainImg', { timeout: 8000 });
  await page.waitForFunction(() => { const e = document.getElementById('modalMainImg'); return e && e.getAttribute('src') === e.getAttribute('data-orig'); }, null, { timeout: 5000 }).catch(() => {});
  const fb = await page.$eval('#modalMainImg', e => ({ src: e.getAttribute('src'), orig: e.getAttribute('data-orig') }));
  check(fb.src === fb.orig && /\/products\//.test(fb.src), 'popup falls back to the original when the WebP copy is missing', `src=${fb.src}`);
  await page.goto(`http://localhost:${PORT}/store/?src=test-weight`);
  await page.waitForSelector('.card > img', { timeout: 8000 });
  // images are loading="lazy": scroll the whole grid past so every one is requested (and falls back)
  for (let y = 0; y < 40; y++) { await page.evaluate(() => window.scrollBy(0, 700)); await page.waitForTimeout(60); }
  await page.waitForTimeout(800);
  const fbCards = await page.$$eval('.card > img', els => els.map(e => ({ src: e.getAttribute('src'), orig: e.getAttribute('data-orig') })).filter(c => (c.orig || '').includes('/products/')));
  check(fbCards.length > 0 && fbCards.every(c => c.src === c.orig), 'grid cards fall back to the originals when the WebP copies are missing', `${fbCards.length} cards`);
  await ctx.close();

  await browser.close(); srv.close();
  console.log(fails ? `${fails} of ${checks} failed` : `all ${checks} checks pass`);
  process.exit(fails ? 1 : 0);
})();
