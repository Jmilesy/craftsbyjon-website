// Staff collection management (staff/collections.html), 13 Oct 2026. Runs the page in a browser against a SANDBOX
// products-api (copies of the databases, see vps-app tools/stripe-sandbox), never the live one: every request the
// page makes to the products API is sent to SANDBOX_API instead.
//   phase 1, before the collections migration on the sandbox copy:  PHASE=legacy  node tests/browser/staff-collections.cjs
//   phase 2, after it:                                               PHASE=managed node tests/browser/staff-collections.cjs
// Env: SANDBOX_API (default http://127.0.0.1:19879), CHROME (executable path, optional), OUT (screenshots folder, optional).
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('./harness.cjs');
const PORT = 8796;
const SANDBOX = process.env.SANDBOX_API || 'http://127.0.0.1:19879';
const PHASE = process.env.PHASE || 'managed';
const OUT = process.env.OUT || '';
const BEFORE = path.join(OUT || require('os').tmpdir(), 'staff-collections-before.json');
const LIVE_API = 'https://craftsbyjon.co.uk/n8n-proxy/products-api';
let checks = 0, fails = 0;
function check(ok, label, detail) { checks++; if (!ok) fails++; console.log(`${ok ? 'pass' : 'FAIL'}  ${label}${detail && !ok ? '  ' + detail : ''}`); }
const get = async (p) => { const r = await fetch(SANDBOX + p); return { status: r.status, text: await r.text() }; };
const json = async (p) => JSON.parse((await get(p)).text);
const linksIn = html => [...new Set([...html.matchAll(/href="\/products\/([^"?#]+)"/g)].map(m => decodeURIComponent(m[1])))];
const cardIds = html => [...html.matchAll(/class="cc-link"[^>]*data-id="([^"]+)"/g)].map(m => m[1]);

async function wire(ctx) {
  await ctx.route('**/*', async route => {
    const u = route.request().url();
    if (u.startsWith(LIVE_API)) {
      const q = route.request();
      const r = await fetch(SANDBOX + u.slice(LIVE_API.length), { method: q.method(), headers: { 'content-type': q.headers()['content-type'] || 'application/json' }, body: ['GET', 'HEAD'].includes(q.method()) ? undefined : q.postDataBuffer() });
      return route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'text/plain', location: r.headers.get('location') || '' }, body: Buffer.from(await r.arrayBuffer()) });
    }
    if (u.startsWith(`http://localhost:${PORT}/`) || u.startsWith('https://cdnjs.cloudflare.com/')) return route.continue();
    return route.fulfill({ status: 204, body: '' }); // images, fonts, analytics: nothing leaves the machine
  });
}

(async () => {
  const srv = await H.startServer(PORT);
  const browser = await H.playwright().chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await wire(ctx);
  ctx.on('dialog', d => d.accept());
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  const shot = async name => { if (OUT) await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false }); };

  if (PHASE === 'legacy') {
    // Unmigrated database: the page falls back to the original collections page, which still works.
    const sc = await get('/staff-collections');
    check(sc.status === 409, 'API says the database update is not applied yet (409)', String(sc.status));
    await page.goto(`http://localhost:${PORT}/staff/collections.html`);
    await page.waitForSelector('#collections-list .col-row');
    const r = await page.evaluate(() => ({ legacy: !document.getElementById('legacy').hidden, managed: !document.getElementById('managed').hidden, rows: document.querySelectorAll('.col-row').length }));
    const cols = (await json('/collections')).result;
    check(r.legacy && !r.managed && r.rows === cols.length, 'original page shown, with every collection', JSON.stringify(r));
    await shot('staff-collections-legacy');
    // What the public collection pages show now, to compare after the migration.
    const list = await json('/collections-list');
    const before = {};
    for (const c of list.result) before[c.slug] = cardIds((await get('/collection-page/' + c.slug)).text);
    fs.writeFileSync(BEFORE, JSON.stringify(before));
    check(Object.keys(before).length > 5, `recorded ${Object.keys(before).length} public collection pages for comparison`);
    check(!errs.length, 'no page errors', errs.join(' | '));
    await browser.close(); srv.close();
    console.log(`${checks} checks, ${fails} failed`); process.exit(fails ? 1 : 0);
  }

  // ── Managed (migration applied to the sandbox copy) ──
  if (fs.existsSync(BEFORE)) {
    const before = JSON.parse(fs.readFileSync(BEFORE, 'utf8'));
    const diffs = [];
    for (const [slug, ids] of Object.entries(before)) { const now = cardIds((await get('/collection-page/' + slug)).text); if (now.join() !== ids.join()) diffs.push(slug); }
    check(!diffs.length, `after the migration, all ${Object.keys(before).length} public collection pages show the same products in the same order`, diffs.join(','));
  }
  const storeColsBefore = (await json('/collections')).result.map(c => c.name + ':' + c.status).join('|');

  await page.goto(`http://localhost:${PORT}/staff/collections.html`);
  await page.waitForSelector('#list-collections .item');
  const ov = await json('/staff-collections');
  const r1 = await page.evaluate(() => ({ managed: !document.getElementById('managed').hidden, legacy: !document.getElementById('legacy').hidden,
    c: document.querySelectorAll('#list-collections .item').length, a: document.querySelectorAll('#list-auto .item').length, t: document.querySelectorAll('#list-types .item').length }));
  check(r1.managed && !r1.legacy && r1.c === ov.result.collections.length && r1.a === ov.result.auto.length && r1.t === ov.result.types.length && r1.a >= 4 && r1.t >= 5,
    'managed page: collections, automatic collections and product type pages listed', JSON.stringify(r1));
  await shot('staff-collections-list');

  // 1. Create a new theme without code: Motorcycling, in the Interests menu group. It starts as a draft (not public).
  await page.fill('#new-name', 'Motorcycling');
  await page.selectOption('#new-group', 'Interests');
  await page.click('#new-btn');
  await page.waitForSelector('#editor-wrap:not([hidden])');
  const created = (await json('/staff-collections')).result.collections.find(c => c.name === 'Motorcycling');
  check(created && created.status === 'draft' && created.nav_group === 'Interests' && created.slug === 'motorcycling', 'new theme created as a draft in Interests', JSON.stringify(created && { s: created.status, g: created.nav_group, slug: created.slug }));
  check((await get('/collection-page/motorcycling')).status === 404, 'a draft collection has no public page yet');

  // 2. Bulk add: filter the picker to one type, tick all shown, add.
  const types = await page.$$eval('#p-type option', o => o.map(x => x.value).filter(Boolean));
  const pickType = types.includes('Keyring') ? 'Keyring' : types[0];
  await page.selectOption('#p-type', pickType);
  const shown = await page.$$eval('.p-tick', x => x.map(i => i.value));
  const want = shown.slice(0, 4);
  for (const id of want) await page.check(`.p-tick[value="${id}"]`);
  await page.click('#p-add');
  await page.waitForFunction(n => document.querySelectorAll('#m-list li.pending-add').length === n, want.length);
  check(true, `bulk add: ${want.length} ${pickType} product(s) waiting as "to add"`);

  // 3. Description, homepage, then Preview (opens the draft page; the shop is unchanged).
  await page.fill('#f-desc', 'Gifts for bikers and anyone who loves the open road.');
  await page.check('#f-home');
  await page.fill('#f-homeorder', '3');
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.click('#ed-preview')]);
  await popup.waitForLoadState();
  const pv = await popup.content();
  check(sameSet(linksIn(pv).filter(id => want.includes(id)), want) && pv.includes('open road'), 'Preview shows the draft products and description', `${linksIn(pv).length} links`);
  await popup.close();
  await shot('staff-collections-editor');
  check((await get('/collection-page/motorcycling')).status === 404 && !(await json('/collections-list')).homepage.some(h => h.slug === 'motorcycling'), 'before Publish: still not public, not on the homepage');

  // 4. Publish: public page, homepage list, store data.
  await page.click('#ed-publish');
  await page.waitForFunction(() => /Published/.test(document.getElementById('ed-msg').textContent));
  const pub = await get('/collection-page/motorcycling');
  check(pub.status === 200 && sameSet(cardIds(pub.text), want), 'after Publish: /collections/motorcycling shows exactly those products', `${pub.status} ${cardIds(pub.text).length}`);
  const cl = await json('/collections-list');
  check(cl.homepage.some(h => h.slug === 'motorcycling'), 'it is on the homepage list');
  const mrow = (await json('/staff-collections')).result.collections.find(c => c.name === 'Motorcycling');
  check(mrow.status === 'live' && !mrow.draft && mrow.published_at, 'published as Live, no draft left', JSON.stringify({ s: mrow.status, d: !!mrow.draft }));

  // 5. Reorder products: move the last to the top, Save this order, Publish.
  await page.evaluate(() => { const ul = document.getElementById('m-list'); ul.insertBefore(ul.lastElementChild, ul.firstElementChild); });
  const newOrder = await page.$$eval('#m-list li[data-id]', l => l.map(x => x.dataset.id));
  await page.click('#m-order');
  await page.waitForFunction(() => /draft/i.test(document.getElementById('ed-msg').textContent));
  await page.click('#ed-publish');
  await page.waitForFunction(() => /Published/.test(document.getElementById('ed-msg').textContent));
  check(cardIds((await get('/collection-page/motorcycling')).text).join() === newOrder.join(), 'product order saved and published', newOrder.join());

  // 6. Bulk remove one, publish.
  await page.check(`.m-tick[value="${newOrder[0]}"]`);
  await page.click('#m-remove');
  await page.waitForSelector('#m-list li.pending-remove');
  await page.click('#ed-publish');
  await page.waitForFunction(() => /Published/.test(document.getElementById('ed-msg').textContent));
  const afterRemove = cardIds((await get('/collection-page/motorcycling')).text);
  check(afterRemove.length === want.length - 1 && !afterRemove.includes(newOrder[0]), 'bulk remove published');

  // 7. A product in several collections, from the product side (#product=ID, as linked from Listings).
  const pid = afterRemove[0];
  const page2 = await ctx.newPage(); page2.on('pageerror', e => errs.push(e.message));
  await page2.goto(`http://localhost:${PORT}/staff/collections.html#product=${encodeURIComponent(pid)}`);
  await page2.waitForSelector('#lookup-result .lk');
  const lk = await page2.$$eval('#lookup-result .lk', l => l.map(x => ({ id: x.value, on: x.checked, main: x.disabled })));
  const moto = lk.find(x => x.id === String(mrow.id));
  const other = lk.find(x => !x.on && !x.main && x.id !== String(mrow.id));
  check(moto && moto.on && lk.some(x => x.main), 'Find a product: shows its main collection and that it is in Motorcycling', JSON.stringify(lk.filter(x => x.on)));
  await page2.check(`#lookup-result .lk[value="${other.id}"]`);
  await page2.click('#lk-save');
  await page2.waitForFunction(() => /drafts/.test(document.getElementById('add-msg').textContent));
  const otherRow = (await json('/staff-collections')).result.collections.find(c => String(c.id) === other.id);
  check(otherRow.draft && (otherRow.draft.members.add || []).includes(pid), `added to "${otherRow.name}" as a draft (shop unchanged until published)`);
  if (OUT) await page2.screenshot({ path: path.join(OUT, 'staff-collections-product.png') });
  // Discard that draft so the other collection is left as it was.
  await page2.click('.tab[data-tab="collections"]');
  await page2.click(`#list-collections .item[data-key="${other.id}"]`);
  await page2.click('#ed-discard');
  await page2.waitForFunction(() => /discarded/.test(document.getElementById('ed-msg').textContent));
  check(!(await json('/staff-collections')).result.collections.find(c => String(c.id) === other.id).draft, 'Discard throws the draft away');
  await page2.close();

  // 8. Automatic collection: change Gifts Under £5's limit as a draft, preview differs, discard.
  await page.click('#ed-close');
  await page.click('.tab[data-tab="auto"]');
  const auto = (await json('/staff-collections')).result.auto;
  const under = auto.find(a => a.preset === 'price_under');
  await page.click(`#list-auto .item[data-key="${under.key}"]`);
  await page.fill('#f-max', '12');
  await page.click('#ed-save');
  await page.waitForFunction(() => /Draft saved/.test(document.getElementById('ed-msg').textContent));
  const pvAuto = await get(`/staff-collections/preview/auto/${under.key}`);
  const liveAuto = await get(`/collection-page/${under.slug}`);
  check(cardIds(pvAuto.text).length > cardIds(liveAuto.text).length, `automatic "${under.name}": draft limit £12 previews more products than the live page (${cardIds(pvAuto.text).length} vs ${cardIds(liveAuto.text).length})`);
  await page.click('#ed-discard');
  await page.waitForFunction(() => /discarded/.test(document.getElementById('ed-msg').textContent));
  await page.click('#ed-close');

  // 9. Product type pages (T-shirts, Mugs…) are their own list, separate from themed collections.
  const tpages = (await json('/staff-collections')).result.types;
  check(tpages.some(t => /shirt/i.test(t.name)) && tpages.every(t => t.product_type), 'product type pages (incl. T-shirts) listed separately from collections', tpages.map(t => t.name).join(','));

  // 10. Hide Motorcycling: public page gone, the store shows no button for it.
  await page.click('.tab[data-tab="collections"]');
  await page.click(`#list-collections .item[data-key="${mrow.id}"]`);
  await page.selectOption('#f-status', 'hidden');
  await page.click('#ed-publish');
  await page.waitForFunction(() => /Published/.test(document.getElementById('ed-msg').textContent));
  check((await get('/collection-page/motorcycling')).status === 404, 'hidden: the public page is gone');
  const shop = await ctx.newPage(); shop.on('pageerror', e => errs.push('store: ' + e.message));
  await shop.goto(`http://localhost:${PORT}/store/?collection=motorcycling`);
  await shop.waitForSelector('#grid .card');
  const btns = await shop.$$eval('#collectionFilterBar .col-btn[data-col]', b => b.map(x => x.dataset.col));
  check(!btns.includes('Motorcycling') && btns.length > 3, 'hidden: the store has no Motorcycling button (other collection buttons still there)', btns.join(','));
  await shop.close();

  // 11. Archive it, then check the store's own collection data for everything else is untouched.
  await page.click('#ed-close');
  await page.click(`#list-collections .item[data-key="${mrow.id}"]`);
  await page.selectOption('#f-status', 'archived');
  await page.click('#ed-publish');
  await page.waitForFunction(() => /Published/.test(document.getElementById('ed-msg').textContent));
  const storeColsAfter = (await json('/collections')).result.filter(c => c.name !== 'Motorcycling').map(c => c.name + ':' + c.status).join('|');
  check(storeColsAfter === storeColsBefore, 'every other collection unchanged in the store data');
  if (OUT) { await page.click('#ed-close'); await page.screenshot({ path: path.join(OUT, 'staff-collections-final.png') }); }
  check(!errs.length, 'no page errors', errs.join(' | '));
  await browser.close(); srv.close();
  console.log(`${checks} checks, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})();
function sameSet(a, b) { return a.length === b.length && a.every(x => b.includes(x)); }
