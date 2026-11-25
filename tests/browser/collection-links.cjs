// Product page breadcrumb and "See all" links go to /collections/{slug} (25 Nov 2026).
//   node tests/browser/collection-links.cjs
// Uses the real store code with the 11 Oct product fixture and the 25 Nov /collections capture (which has slugs and
// season_months). Checks every collection the catalogue uses, the Christmas cards, a product with no collection,
// out-of-season and non-public collections, and the old /collections data without slugs.
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('./harness.cjs');
const COLS = JSON.parse(fs.readFileSync(path.join(H.ROOT, 'tests/fixtures/collections-2026-11-25.json'), 'utf8'));
const B = 'http://localhost:8787';
const results = []; let cur;
const section = n => { cur = { n, pass: 0, fail: [] }; results.push(cur); };
const ok = (c, m) => { if (c) cur.pass++; else cur.fail.push(m); };

(async () => {
  const srv = await H.startServer(8787);
  const browser = await H.playwright().chromium.launch();
  // collections: the /collections body to serve (null = the harness's 11 Oct fixture); at: the date the page sees.
  async function links(id, { collections = COLS, at = '2026-11-25T12:00:00Z', patch } = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await H.wire(ctx, { patch });
    if (collections) await ctx.route(/products-api\/collections$/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(collections) }));
    const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.clock.setFixedTime(new Date(at));
    await page.goto(B + '/products/' + id);
    await page.waitForSelector('#modalWrap.open #modalAddBtn', { timeout: 10000 }).catch(() => {});
    const r = await page.evaluate(() => {
      const crumbs = [...document.querySelectorAll('.pp-crumbs a')].map(a => a.getAttribute('href'));
      const more = document.querySelector('.pp-more a');
      return { crumbs, more: more && more.getAttribute('href'), moreText: more && more.textContent, crumbText: document.querySelector('.pp-crumbs') && document.querySelector('.pp-crumbs').textContent };
    });
    await ctx.close();
    return { ...r, errors };
  }

  section('Every collection in use links to its own page (25 Nov 2026)');
  for (const [id, slug] of [['totebag001', 'retro-deal'], ['bookmark-023', 'teacher-appreciation'], ['bookmark-001', 'bee-collection'],
    ['bookmark-005', 'easter-collection'], ['bookmark-016', 'pride']]) {
    const r = await links(id);
    ok(r.crumbs.includes('/collections/' + slug), id + ' crumbs ' + JSON.stringify(r.crumbs));
    ok(r.more === '/collections/' + slug, id + ' see all ' + r.more);
    ok(!r.crumbs.some(h => /\?collection=/.test(h)), id + ' still has a store filter link');
    ok(r.crumbs[0] === '/' && r.crumbs[1] === '/store/', id + ' Home and Shop crumbs ' + JSON.stringify(r.crumbs));
    ok(!r.errors.length, id + ' errors ' + r.errors.join(' '));
  }

  section('Christmas cards: /collections/deal-christmas');
  {
    const r = await links('bookmark-011', { patch: { 'bookmark-011': { Collection: 'Deal Christmas' } } });
    ok(r.crumbs.includes('/collections/deal-christmas'), 'crumbs ' + JSON.stringify(r.crumbs));
    ok(r.more === '/collections/deal-christmas', 'see all ' + r.more);
    ok(/Deal Christmas/.test(r.crumbText), 'crumb text ' + r.crumbText);
    ok(!r.errors.length, r.errors.join(' '));
  }

  section('Seasonal collection: store link out of season, own page in season');
  {
    const nov = await links('keyring-022');
    ok(nov.more === '/store/?collection=summer-vibes', 'November see all ' + nov.more);
    ok(nov.crumbs.includes('/store/?collection=summer-vibes'), 'November crumbs ' + JSON.stringify(nov.crumbs));
    const jul = await links('keyring-022', { at: '2026-07-15T12:00:00Z' });
    ok(jul.more === '/collections/summer-vibes', 'July see all ' + jul.more);
    // Teacher Appreciation has valid_months (store filtering) but no season_months: its page is always open.
    const teach = await links('bookmark-023', { at: '2026-09-15T12:00:00Z' });
    ok(teach.more === '/collections/teacher-appreciation', 'valid_months alone must not close the page: ' + teach.more);
  }

  section('Collections without a public page keep the old store link');
  {
    const hidden = JSON.parse(JSON.stringify(COLS)); hidden.result.find(c => c.name === 'Pride').status = 'draft';
    const r1 = await links('bookmark-016', { collections: hidden });
    ok(r1.more === '/store/?collection=pride', 'draft status ' + r1.more);
    // Archived: the shop already hides the products of an archived collection (no page to decorate). Same before
    // and after this change: no collection link of either kind.
    const archived = JSON.parse(JSON.stringify(COLS)); archived.result.find(c => c.name === 'Pride').status = 'archived';
    const ra = await links('bookmark-016', { collections: archived });
    ok(ra.more === null && !ra.crumbs.some(h => /collection/.test(h)), 'archived: ' + JSON.stringify(ra));
    const missing = JSON.parse(JSON.stringify(COLS)); missing.result = missing.result.filter(c => c.name !== 'Bee Collection');
    ok((await links('bookmark-001', { collections: missing })).more === '/store/?collection=bee-collection', 'not in the public list');
    const noslug = JSON.parse(JSON.stringify(COLS)); delete noslug.result.find(c => c.name === 'Retro Deal').slug;
    ok((await links('totebag001', { collections: noslug })).more === '/store/?collection=retro-deal', 'no slug');
  }

  section('The real slug is used, not one made from the name');
  {
    const renamed = JSON.parse(JSON.stringify(COLS)); renamed.result.find(c => c.name === 'Bee Collection').slug = 'bees';
    const r = await links('bookmark-001', { collections: renamed });
    ok(r.more === '/collections/bees' && r.crumbs.includes('/collections/bees'), 'slug bees: ' + r.more + ' ' + JSON.stringify(r.crumbs));
  }

  section('Old /collections data without slugs: every link unchanged (store filter)');
  for (const [id, slug] of [['totebag001', 'retro-deal'], ['bookmark-001', 'bee-collection']]) {
    const r = await links(id, { collections: null });
    ok(r.more === '/store/?collection=' + slug, id + ' ' + r.more);
  }

  section('Product with no collection: no collection crumb, no See all');
  {
    const r = await links('mug-birthday-photo', { patch: { 'mug-birthday-photo': { 'Ready to Go': 'yes' } } });
    ok(JSON.stringify(r.crumbs) === JSON.stringify(['/', '/store/']), 'crumbs ' + JSON.stringify(r.crumbs));
    ok(r.more === null, 'see all ' + r.more);
    ok(!r.errors.length, r.errors.join(' '));
  }

  await browser.close(); srv.close();
  let failed = 0;
  for (const s of results) { console.log((s.fail.length ? 'FAIL ' : 'ok   ') + s.n + ' (' + s.pass + ' passed' + (s.fail.length ? ', ' + s.fail.length + ' failed' : '') + ')'); s.fail.forEach(f => console.log('       - ' + f)); failed += s.fail.length; }
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
