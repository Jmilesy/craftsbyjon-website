// node --test tests/photo-personaliser.test.cjs   (store/photo-personaliser.js, pure logic only)
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../store/photo-personaliser.js');

const product = { 'Product ID': 'mug-birthday-photo', Title: 'Birthday Mug', personalisation_spec: { version: 1, photo: { required: true, crop_aspect: 1 }, fields: [{ key: 'name', label: 'Name', max: 20 }] } };

test('photo product detection and fields', () => {
  assert.equal(P.isPhotoProduct(product), true);
  assert.equal(P.isPhotoProduct({ personalisation_spec: null }), false);
  assert.equal(P.isPhotoProduct({}), false);
  assert.equal(P.nameField(product).max, 20);
});

test('options sort by number and skip Gelato rows', () => {
  const o = P.options([{ id: 3, option1_value: '21st' }, { id: 1, option1_value: '16th' }, { id: 2, option1_value: '18th' }, { id: 9, option1_value: 'x', gelato_variant_id: 'g' }]);
  assert.deepEqual(o.map(r => r.id), [1, 2, 3]);
});

test('file checks', () => {
  assert.equal(P.checkFile({ name: 'a.jpg', type: 'image/jpeg', size: 1000 }), null);
  assert.match(P.checkFile({ name: 'IMG_1.HEIC', type: 'image/heic', size: 1000 }), /HEIC/);
  assert.match(P.checkFile({ name: 'a.gif', type: 'image/gif', size: 1000 }), /JPEG, PNG or WebP/);
  assert.match(P.checkFile({ name: 'a.jpg', type: 'image/jpeg', size: 16 * 1024 * 1024 }), /15 MB/);
});

test('name checks mirror the server', () => {
  assert.deepEqual(P.checkName('  Zoë  ', { max: 20 }), { ok: true, value: 'Zoë' });
  assert.equal(P.checkName('<b>', { max: 20 }).ok, false);
  assert.equal(P.checkName('x'.repeat(21), { max: 20 }).ok, false);
  assert.equal(P.checkName('', { max: 20 }).value, '');
});

test('crop: landscape photo starts centred square, zoom and pan stay inside', () => {
  let v = P.initialView(1600, 1200, 1);
  assert.deepEqual(P.cropOf(v), { x: 0.125, y: 0, w: 0.75, h: 1 });
  v = P.pan(v, 10000, 0, 300);  // drag far right: shows the left edge
  assert.equal(P.cropOf(v).x, 0);
  v = P.zoomTo(v, 2);
  const c = P.cropOf(v);
  assert.equal(c.w, 0.375); assert.equal(c.h, 0.5);
  assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.w <= 1 && c.y + c.h <= 1);
  // aspect in pixels is 1 (what the server checks)
  assert.ok(Math.abs((c.w * 1600) / (c.h * 1200) - 1) < 1e-6);
  assert.equal(P.cropPixels(v), 600);
  v = P.zoomTo(v, 99);
  assert.equal(v.zoom, 4);
  const l = P.layout(P.initialView(1600, 1200, 1), 300);
  assert.equal(l.width, 400); assert.equal(l.height, 300); assert.equal(l.left, -50); assert.equal(l.top, 0);
});

test('crop: portrait photo', () => {
  const c = P.cropOf(P.initialView(1000, 1500, 1));
  assert.deepEqual(c, { x: 0, y: 0.166667, w: 1, h: 0.666667 });
});

test('basket save and restore', () => {
  const mem = { s: {}, getItem(k) { return this.s[k] || null; }, setItem(k, v) { this.s[k] = v; }, removeItem(k) { delete this.s[k]; } };
  const now = Date.UTC(2026, 9, 10, 12);
  const bm = { 'Product ID': 'bookmark-001', Title: 'Bee Bookmark' };
  const cart = {
    'price_x|': { product: bm, qty: 2, price: 3.5 },
    [P.cartKey('mug-birthday-photo', 927, 'a'.repeat(64), 'Sam')]: { product, qty: 1, variant: '18th', variant_id: 927, price: 14.99, photo: { upload_id: 'a'.repeat(64), crop: { x: 0, y: 0, w: 1, h: 1 }, name: 'Sam' }, added: now }
  };
  assert.equal(P.save(mem, cart, now), true);
  const stored = JSON.parse(mem.s[P.STORE_KEY]);
  assert.equal(stored.lines.length, 2);
  assert.ok(!('Full Description' in stored.lines[0]), 'only ids and choices are kept, not whole product records');
  const byId = id => ({ 'bookmark-001': bm, 'mug-birthday-photo': product }[id] || null);
  let r = P.fromStored(P.load(mem), byId, now + 3600e3);
  assert.equal(Object.keys(r.cart).length, 2);
  assert.equal(r.cart['price_x|'].qty, 2);
  r = P.fromStored(P.load(mem), byId, now + 47 * 3600e3);
  assert.equal(Object.keys(r.cart).length, 1, 'the photo line expires before the server deletes the photo');
  assert.equal(r.dropped[0].reason, 'photo_expired');
  r = P.fromStored(P.load(mem), id => (id === 'bookmark-001' ? null : product), now);
  assert.equal(r.dropped[0].reason, 'gone');
  P.save(mem, {}, now);
  assert.equal(mem.s[P.STORE_KEY], undefined);
  assert.deepEqual(P.fromStored({ v: 1, saved: now - 15 * 86400e3, lines: stored.lines }, byId, now).cart, {}, 'old baskets are not restored');
});
