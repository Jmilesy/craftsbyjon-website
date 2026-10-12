// Browser test harness for the shop and product pages (11 Oct 2026).
//
// Serves this repo on localhost and answers every products-api call from tests/fixtures/live-api-20261011.json
// (a dated copy of the public API). Nothing reaches the live site: checkout requests are captured instead of
// sent, events are recorded, analytics scripts are stubbed, pictures are grey squares.
//
// Needs Playwright with a Chromium build (in Claude's cloud sessions: PLAYWRIGHT_BROWSERS_PATH is preset).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const FIX = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures/live-api-20261011.json'), 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const GREY = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#c9bfae"/></svg>');

function playwright() {
  try { return require('playwright'); } catch (e) {
    return require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
  }
}

// overrides: { '/store/index.html': '<html>…' } to serve a different version of a file (e.g. the old store).
function startServer(port, overrides) {
  overrides = overrides || {};
  const server = http.createServer((req, res) => {
    let u = decodeURIComponent(req.url.split('?')[0]);
    if (u.endsWith('/')) u += 'index.html';
    if (overrides[u] != null) { res.writeHead(200, { 'Content-Type': TYPES[path.extname(u)] || 'text/html' }); return res.end(overrides[u]); }
    // /products/{id}: the page products-api would send (rendered by preview/tools/build-product-pages.mjs).
    const pm = u.match(/^\/products\/([a-z0-9-]+)$/i);
    if (pm) {
      const pf = path.join(ROOT, 'tests/fixtures/product-pages', pm[1] + '.html');
      if (!fs.existsSync(pf)) { res.writeHead(404, { 'Content-Type': 'text/html' }); return res.end('<h1>Product not found</h1>'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return fs.createReadStream(pf).pipe(res);
    }
    const f = path.join(ROOT, u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => server.listen(port, () => r(server)));
}

// Fixture products, optionally changed (e.g. make the draft photo mug Ready to Go for its test).
function productsFixture(patch) {
  const copy = JSON.parse(JSON.stringify(FIX.products));
  if (patch) copy.result.forEach(p => { if (patch[p['Product ID']]) Object.assign(p, patch[p['Product ID']]); });
  return copy;
}

// Routes every API call; returns a log the test can inspect.
async function wire(ctx, opts) {
  opts = opts || {};
  const log = { events: [], checkouts: [], uploads: 0, analytics: [], live: [] };
  const products = productsFixture(opts.patch);
  // The cookie banner covers the basket's Checkout button on phones until answered; tests answer it up front
  // ('declined' by default) unless a test is about consent itself (opts.consent === null).
  if (opts.consent !== null) await ctx.addInitScript(c => { try { if (!sessionStorage.getItem('__cbjTestInit')) { localStorage.setItem('cbj_cookie_consent', c); sessionStorage.setItem('__cbjTestInit', '1'); } } catch (e) {} }, opts.consent || 'declined');
  const json = (route, body, status) => route.fulfill({ status: status || 200, contentType: 'application/json', body: JSON.stringify(body) });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.route(/images\.craftsbyjon\.co\.uk/, r => r.fulfill({ body: GREY, contentType: 'image/svg+xml' }));
  await ctx.route(/googletagmanager|clarity\.ms|pinimg\.com/, r => { log.analytics.push(r.request().url()); r.fulfill({ body: '', contentType: 'text/javascript' }); });
  await ctx.route(/products-api\//, async route => {
    const req = route.request(), u = new URL(req.url()), p = u.pathname.replace(/^.*products-api/, '');
    if (p === '/products') return json(route, products);
    if (p === '/collections') return json(route, FIX.collections);
    // The new site header's menus (store/site-nav.js) read this feed; not in the fixture, so the menus keep their
    // fixed links and no collection buttons are hidden, as when the feed can't load.
    if (p === '/collections-list') return json(route, { error: 'not in fixture' }, 404);
    let m;
    if ((m = p.match(/^\/products\/([^/]+)\/public-variants$/))) return json(route, FIX.variants[m[1]] || { result: [] });
    if ((m = p.match(/^\/products\/([^/]+)\/public-variant-gallery$/))) return json(route, FIX.variantGallery[m[1]] || { result: {} });
    if (p === '/event') { try { log.events.push(JSON.parse(req.postData() || '{}')); } catch (e) {} return json(route, { ok: true }); }
    if (p === '/create-checkout-session') { log.checkouts.push(JSON.parse(req.postData() || '{}')); return json(route, { id: 'cs_test_' + log.checkouts.length, url: '#stripe-checkout-test' }); }
    if (p === '/personalisation/upload') { log.uploads++; return json(route, { result: { upload_id: 'up_test_' + log.uploads, low_resolution: false } }); }
    log.live.push(req.method() + ' ' + p);
    return json(route, { error: 'not in fixture' }, 404);
  });
  return log;
}

// A genuine JPEG made by the browser (a 1200x1200 colour block), for the photo upload test.
async function makeJpeg(page) {
  const b64 = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 1200; const g = c.getContext('2d'); g.fillStyle = '#4a90e2'; g.fillRect(0, 0, 1200, 1200); g.fillStyle = '#f5a623'; g.fillRect(300, 300, 600, 600); return c.toDataURL('image/jpeg', 0.8).split(',')[1]; });
  return Buffer.from(b64, 'base64');
}

module.exports = { ROOT, FIX, playwright, startServer, wire, productsFixture, makeJpeg };
