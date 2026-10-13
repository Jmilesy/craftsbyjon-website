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

// Print resolution and option order (13 Oct 2026).
const target = 1180;
test('target comes from recommend_px, defaults to 1000', () => {
  assert.equal(P.targetPx({ personalisation_spec: { photo: { recommend_px: 1180 } } }), 1180);
  assert.equal(P.targetPx({ photo: { recommend_px: 1180 } }), 1180, 'a spec object works too');
  assert.equal(P.targetPx(product), 1000);
});

test('zoom stops at the target: crop never drops below 1180 genuine pixels on an adequate photo', () => {
  for (const [w, h] of [[4000, 3000], [3000, 4000], [8160, 6120], [2400, 2400], [1300, 1200], [1180, 1180]]) {
    const v0 = P.initialView(w, h, 1, target);
    assert.ok(v0.maxZoom >= 1 && v0.maxZoom <= 4, `${w}x${h} maxZoom ${v0.maxZoom}`);
    for (const z of [1, 1.5, 2, 2.5, 3, 3.5, 4, 10]) {
      const v = P.zoomTo(v0, z);
      assert.ok(P.cropPixels(v) >= target, `${w}x${h} zoom ${z}: ${P.cropPixels(v)} px`);
      assert.ok(P.quality(v, target).ok);
    }
    const max = P.zoomTo(v0, 99);
    if (Math.min(w, h) / target < 4) {
      assert.equal(P.cropPixels(max), target, `${w}x${h}: zoomed fully in = exactly ${target}`);
      assert.equal(P.quality(max, target).atLimit, Math.min(w, h) > target, `${w}x${h} at limit`);
    }
  }
  // 12 MP phone photo: about 2.54x allowed, the crop sent to the server is 1180 px on the short side.
  const v = P.zoomTo(P.initialView(4000, 3000, 1, target), 99);
  const c = P.cropOf(v);
  assert.ok(Math.abs(v.maxZoom - 3000 / 1180) < 1e-9);
  assert.ok(Math.abs(c.w * 4000 - 1180) < 0.01 && Math.abs(c.h * 3000 - 1180) < 0.01, JSON.stringify(c));
  // A very large photo still stops at 4x.
  assert.equal(P.initialView(12000, 9000, 1, target).maxZoom, 4);
});

test('photos smaller than the target: no zoom, a warning, still usable', () => {
  for (const [w, h] of [[1000, 1000], [1600, 700], [600, 800]]) {
    const v = P.initialView(w, h, 1, target);
    assert.equal(v.maxZoom, 1, `${w}x${h}`);
    assert.equal(P.zoomTo(v, 3).zoom, 1, 'zoom ignored');
    const q = P.quality(v, target);
    assert.equal(q.ok, false); assert.equal(q.px, Math.min(w, h)); assert.equal(q.atLimit, false);
    const moved = P.pan(v, -50, -50, 300);
    assert.equal(P.cropPixels(moved), Math.min(w, h), 'moving keeps the size');
  }
});

test('without a target the old 4x zoom applies (other photo products unchanged)', () => {
  assert.equal(P.initialView(4000, 3000, 1).maxZoom, 4);
  assert.equal(P.cropPixels(P.zoomTo(P.initialView(4000, 3000, 1), 4)), 750);
});

test('options: Rainbow before Champagne within each age (set-up order), ages in number order', () => {
  const rows = [
    { id: 934, option1_value: '40th Champagne' }, { id: 931, option1_value: '21st Rainbow' }, { id: 929, option1_value: '16th Rainbow' },
    { id: 932, option1_value: '21st Champagne' }, { id: 933, option1_value: '40th Rainbow' }, { id: 930, option1_value: '18th Rainbow' },
    { id: 999, option1_value: '18th Gelato', gelato_variant_id: 'g1' }, { id: 998, option1_value: '50th Off', active: 0 }
  ];
  assert.deepEqual(P.options(rows).map(v => v.option1_value), ['16th Rainbow', '18th Rainbow', '21st Rainbow', '21st Champagne', '40th Rainbow', '40th Champagne']);
  assert.deepEqual(P.options([{ option1_value: '18th' }, { option1_value: '16th' }]).map(v => v.option1_value), ['16th', '18th'], 'rows without ids still sort');
});
