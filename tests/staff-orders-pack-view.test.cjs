// Tests the Pack view popup on staff/orders.html without a browser: the page script must parse, and for a real order
// (CBJ-0037, four single bookmarks) and a card order with a full image URL, the popup must show the right pictures,
// quantities and address. Products come from tests/fixtures/products-list-2026-10-31.json (a copy of the live list).
const test = require('node:test');
const fs = require('fs'), vm = require('vm'), assert = require('assert'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'staff', 'orders.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
new vm.Script(scripts.join('\n;\n')); // throws on a syntax error anywhere in the page script
const text = scripts.join('\n');
const seg = text.slice(text.indexOf('// ---- Pack view'), text.indexOf('function openManualOrderModal'));
assert.ok(seg.includes('function openPackView') && seg.includes('function closePackView'), 'pack view code extracted');
const products = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'products-list-2026-10-31.json'), 'utf8')).result;

function run(orders, id) {
  const els = {}; const el = (k) => els[k] || (els[k] = { innerHTML: '', classList: { add() { this.on = true; }, remove() { this.on = false; } } });
  const ctx = {
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    formatDate: () => '30 Oct 2026', alert: (m) => { ctx.alerted = m; },
    document: { getElementById: el, addEventListener() {} }, console, Number, String, Object, JSON, Array,
    allOrders: orders, priceIdToProductId: {}, productsById: {}
  };
  products.forEach(p => { if (p.stripe_price_id) ctx.priceIdToProductId[p.stripe_price_id] = p['Product ID']; ctx.productsById[p['Product ID']] = p; });
  vm.createContext(ctx);
  vm.runInContext(seg + '\n;this.openPackView = openPackView; this.closePackView = closePackView;', ctx);
  ctx.openPackView(id);
  return { ctx, body: el('packBody').innerHTML, modal: el('packModal') };
}

test('order 37: four bookmarks show their pictures, x1 each, and the address', () => {
  const o = { id: 37, order_ref: 'CBJ-0037', status: 'pending', created_at: '2026-10-30 16:31:35', shipping_name: 'A Elkind', shipping_line1: '22 Bent Fold Drive', shipping_city: 'Bury', shipping_postal_code: 'BL9 8NG', shipping_method: '2nd Class (Free)',
    items: [
      { name: 'Deal Pier Sunrise Acrylic Bookmark, 1940s Travel Poster Style', quantity: 1, stripe_price_id: 'price_1TUSVZA0ggEysgGA46FMRyoS' },
      { name: 'Deal Castle Acrylic Bookmark, 1940s Poster Style', quantity: 1, stripe_price_id: 'price_1TUSVOA0ggEysgGARrKco4tD' },
      { name: 'Bee & Honeycomb Clear Acrylic Bookmark', quantity: 1, stripe_price_id: 'price_1TUSW8A0ggEysgGABUpzfiRB' },
      { name: 'Deal Timeball Tower Acrylic Bookmark, 1940s Poster Style', quantity: 1, stripe_price_id: 'price_1TUSVWA0ggEysgGAI7BowSLZ' }] };
  const { body, modal } = run([o], 37);
  assert.ok(modal.classList.on, 'popup opened');
  for (const id of ['bookmark-011', 'bookmark-014', 'bookmark-002', 'bookmark-012'])
    assert.ok(body.includes('https://images.craftsbyjon.co.uk/products/' + id + '.jpg'), id + ' picture present');
  assert.strictEqual((body.match(/class="pack-qty "/g) || []).length, 4, 'four single-quantity badges');
  assert.ok(body.includes('4 lines, 4 items to pack'));
  assert.ok(body.includes('22 Bent Fold Drive') && body.includes('BL9 8NG'));
  assert.ok(!body.includes('No image found'));
});

test('multi-quantity card order: full image URLs kept, quantity badge highlighted', () => {
  const o = { id: 36, order_ref: 'CBJ-0036', status: 'dispatched', created_at: '2026-10-29 12:18:59', items: [
    { name: 'Deal Middle Street Christmas Card', quantity: 6, stripe_price_id: 'price_1UUTxBA0ggEysgGAvyG80VzJ' }] };
  const { body } = run([o], 36);
  assert.ok(body.includes('https://images.craftsbyjon.co.uk/products/card-002-middle_street_front.jpg'));
  assert.ok(body.includes('class="pack-qty multi"'));
  assert.ok(body.includes('1 line, 6 items to pack'));
});

test('unknown item shows a clear no-image message and notes are shown', () => {
  const o = { id: 1, order_ref: 'CBJ-0001', status: 'pending', is_gift: 1, gift_message: 'Happy birthday', items: [{ name: 'Mystery thing', quantity: 2 }] };
  const { body } = run([o], 1);
  assert.ok(body.includes('No image found for this item'));
  assert.ok(body.includes('GIFT ORDER') && body.includes('Happy birthday'));
});

test('order not in view alerts instead of opening', () => {
  const { ctx, modal } = run([], 99);
  assert.ok(ctx.alerted && !modal.classList.on);
});
