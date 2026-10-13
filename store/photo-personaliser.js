/* Crafts by Jon: customer photo personalisation, pure logic (no DOM). 10 Oct 2026.
   Used by the store product modal and basket for products whose public record carries a
   personalisation_spec with a photo section (first: Personalised Birthday Photo Mug).
   The server (products-api personalisation.js) checks everything again; this file only makes the
   page behave. It also saves and restores the basket in this browser (localStorage), for every
   product, so a refresh or a return from Stripe keeps the basket. */
(function (root) {
  var STORE_KEY = 'cbj_cart_v1';
  var PHOTO_MAX_AGE_MS = 46 * 3600 * 1000;   // the server keeps an unordered photo for 48 hours
  var CART_MAX_AGE_MS = 14 * 24 * 3600 * 1000;
  var MAX_BYTES = 15 * 1024 * 1024;
  var TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  var NAME_RE;
  try { NAME_RE = new RegExp("^[\\p{L}\\p{M}\\p{N} .,'’!?&()\\-]*$", 'u'); } catch (e) { NAME_RE = /^[A-Za-z0-9À-ɏ .,'’!?&()\-]*$/; }

  function spec(p) {
    var s = p && p.personalisation_spec;
    if (typeof s === 'string') { try { s = JSON.parse(s); } catch (e) { s = null; } }
    return s && typeof s === 'object' ? s : null;
  }
  function isPhotoProduct(p) { var s = spec(p); return !!(s && s.photo); }
  function nameField(p) {
    var s = spec(p);
    var f = s && Array.isArray(s.fields) ? s.fields.filter(function (x) { return x && x.key === 'name'; })[0] : null;
    return f || null;
  }

  // Option rows (e.g. Birthday: 16th Rainbow, 21st Rainbow, 21st Champagne), in number order; options with the
  // same number keep the order they were set up in (row id), so Rainbow comes before Champagne (13 Oct 2026).
  function options(vars) {
    var rows = (Array.isArray(vars) ? vars : []).filter(function (v) { return v && v.option1_value && !v.gelato_variant_id && Number(v.active) !== 0; });
    var num = function (v) { var m = /\d+/.exec(String(v.option1_value)); return m ? Number(m[0]) : 9999; };
    var id = function (v) { var n = Number(v.id); return Number.isFinite(n) ? n : Infinity; };
    return rows.sort(function (a, b) { return num(a) - num(b) || id(a) - id(b) || String(a.option1_value).localeCompare(String(b.option1_value)); });
  }

  // Print resolution (13 Oct 2026): the crop's short side should keep this many genuine photo pixels. It is the
  // spec's recommend_px (1180 for the birthday mug: Jon prints the photo at 1180 x 1180 px, 300 DPI).
  var DEFAULT_TARGET_PX = 1000;
  function targetPx(specOrProduct) {
    var s = specOrProduct && specOrProduct.photo ? specOrProduct : spec(specOrProduct);
    var t = s && s.photo && Number(s.photo.recommend_px);
    return t > 0 ? t : DEFAULT_TARGET_PX;
  }

  function checkFile(file) {
    if (!file) return 'Please choose a photo.';
    var t = String(file.type || '').toLowerCase();
    var n = String(file.name || '').toLowerCase();
    if (/\.(heic|heif)$/.test(n) || /hei[cf]/.test(t)) return 'That photo is in HEIC format, which I cannot use. On an iPhone, choose it from the Photos library (it is sent as a JPEG), or set Camera > Formats to Most Compatible.';
    if (t && TYPES.indexOf(t) === -1) return 'Please choose a JPEG, PNG or WebP photo.';
    if (file.size > MAX_BYTES) return 'That photo is bigger than 15 MB. Please choose a smaller photo.';
    return null;
  }

  function checkName(v, field) {
    var s = String(v || '').replace(/\s+/g, ' ').trim();
    var max = field && field.max ? field.max : 20;
    if (!s) return { ok: true, value: '' };
    if (Array.from(s).length > max) return { ok: false, error: 'Up to ' + max + ' characters, please.' };
    if (!NAME_RE.test(s)) return { ok: false, error: 'Letters, numbers, spaces and simple punctuation only, please.' };
    return { ok: true, value: s };
  }

  // Crop model: the largest rectangle of the wanted aspect that fits the photo, divided by zoom,
  // centred on (cx, cy) in photo pixels and kept inside the photo.
  function baseRect(natW, natH, aspect) {
    return natW / natH > aspect ? { w: natH * aspect, h: natH } : { w: natW, h: natW / aspect };
  }
  function clampView(v) {
    var b = baseRect(v.natW, v.natH, v.aspect);
    var zoom = Math.min(Math.max(Number(v.zoom) || 1, 1), v.maxZoom || 4);
    var w = b.w / zoom, h = b.h / zoom;
    var cx = Math.min(Math.max(v.cx, w / 2), v.natW - w / 2);
    var cy = Math.min(Math.max(v.cy, h / 2), v.natH - h / 2);
    return { natW: v.natW, natH: v.natH, aspect: v.aspect, maxZoom: v.maxZoom || 4, zoom: zoom, cx: cx, cy: cy, w: w, h: h };
  }
  // How far the customer may zoom: until the crop's short side reaches `target` photo pixels, never past 4x.
  // A photo that is already smaller than the target cannot be zoomed into at all (it can still be moved).
  function maxZoomFor(natW, natH, aspect, target) {
    var b = baseRect(natW, natH, aspect || 1);
    return Math.max(1, Math.min(4, Math.min(b.w, b.h) / (target || DEFAULT_TARGET_PX)));
  }
  // `target` (genuine pixels) caps the zoom; without it the old 4x limit applies.
  function initialView(natW, natH, aspect, target) {
    return clampView({ natW: natW, natH: natH, aspect: aspect || 1, maxZoom: target ? maxZoomFor(natW, natH, aspect, target) : 4, zoom: 1, cx: natW / 2, cy: natH / 2 });
  }
  function cropOf(v) {
    var r = function (n) { return (Math.round(n * 1e6) / 1e6) || 0; };
    return { x: r((v.cx - v.w / 2) / v.natW), y: r((v.cy - v.h / 2) / v.natH), w: r(v.w / v.natW), h: r(v.h / v.natH) };
  }
  // How the <img> sits inside a square viewport `size` px wide showing this view.
  function layout(v, size) {
    var scale = size / v.w;
    return { scale: scale, width: v.natW * scale, height: v.natH * scale, left: (-(v.cx - v.w / 2) * scale) || 0, top: (-(v.cy - v.h / 2) * scale) || 0 };
  }
  function pan(v, dxScreen, dyScreen, size) {
    var s = size / v.w;
    return clampView({ natW: v.natW, natH: v.natH, aspect: v.aspect, maxZoom: v.maxZoom, zoom: v.zoom, cx: v.cx - dxScreen / s, cy: v.cy - dyScreen / s });
  }
  function zoomTo(v, zoom) {
    return clampView({ natW: v.natW, natH: v.natH, aspect: v.aspect, maxZoom: v.maxZoom, zoom: zoom, cx: v.cx, cy: v.cy });
  }
  // Short side of the cropped area in genuine photo pixels (for the "may look soft" warning).
  function cropPixels(v) { return Math.round(Math.min(v.w, v.h)); }
  // { px, target, ok, atLimit }: ok when the crop keeps the target; atLimit when the zoom cap has been reached.
  function quality(v, target) {
    var px = cropPixels(v), t = target || DEFAULT_TARGET_PX;
    return { px: px, target: t, ok: px >= t, atLimit: v.maxZoom > 1 && v.maxZoom < 4 && v.zoom >= v.maxZoom - 1e-6 };
  }

  function cartKey(productId, variantId, uploadId, name) {
    return productId + '|v:' + variantId + '|ph:' + uploadId + '|n:' + (name || '');
  }

  // ── Basket saved in this browser ─────────────────────────────────────────────────────────
  var KEEP = ['qty', 'variant', 'image_url', 'mug_name', 'mug_message', 'mug_text_colour', 'personalisation_text',
    'pod_colour', 'pod_size', 'gelato_variant_id', 'gelato_product_uid', 'variant_id', 'price', 'photo', 'added'];
  function toStored(cart, now) {
    var lines = [];
    Object.keys(cart || {}).forEach(function (k) {
      var d = cart[k];
      if (!d || !d.product) return;
      var o = { k: k, id: d.product['Product ID'] };
      KEEP.forEach(function (f) { if (d[f] != null) o[f] = d[f]; });
      if (!o.added) o.added = now;
      lines.push(o);
    });
    return { v: 1, saved: now, lines: lines };
  }
  // productById(id) -> the live, visible product or null. Returns { cart, dropped: [{title, reason}] }.
  function fromStored(data, productById, now) {
    var cart = {}, dropped = [];
    if (!data || data.v !== 1 || !Array.isArray(data.lines) || now - (data.saved || 0) > CART_MAX_AGE_MS) return { cart: cart, dropped: dropped };
    data.lines.forEach(function (o) {
      var p = o && productById(o.id);
      if (!p) { if (o && o.id) dropped.push({ id: o.id, reason: 'gone' }); return; }
      if (o.photo && (now - (o.added || 0) > PHOTO_MAX_AGE_MS)) { dropped.push({ id: o.id, title: p['Title'], reason: 'photo_expired' }); return; }
      var qty = Math.min(Math.max(parseInt(o.qty, 10) || 1, 1), 50);
      var d = { product: p };
      KEEP.forEach(function (f) { if (o[f] != null) d[f] = o[f]; });
      d.qty = qty;
      cart[o.k] = d;
    });
    return { cart: cart, dropped: dropped };
  }
  function save(storage, cart, now) {
    try {
      if (!cart || Object.keys(cart).length === 0) { storage.removeItem(STORE_KEY); return true; }
      storage.setItem(STORE_KEY, JSON.stringify(toStored(cart, now)));
      return true;
    } catch (e) { return false; }
  }
  function load(storage) {
    try { return JSON.parse(storage.getItem(STORE_KEY) || 'null'); } catch (e) { return null; }
  }
  function clear(storage) { try { storage.removeItem(STORE_KEY); } catch (e) {} }

  var api = {
    STORE_KEY: STORE_KEY, MAX_BYTES: MAX_BYTES, PHOTO_MAX_AGE_MS: PHOTO_MAX_AGE_MS,
    spec: spec, isPhotoProduct: isPhotoProduct, nameField: nameField, options: options, targetPx: targetPx,
    checkFile: checkFile, checkName: checkName,
    initialView: initialView, clampView: clampView, cropOf: cropOf, layout: layout, pan: pan, zoomTo: zoomTo, cropPixels: cropPixels,
    maxZoomFor: maxZoomFor, quality: quality,
    cartKey: cartKey, toStored: toStored, fromStored: fromStored, save: save, load: load, clear: clear
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CBJPhoto = api;
})(typeof window !== 'undefined' ? window : this);
