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

  // Option rows (e.g. Age: 16th, 18th, 21st), in number order.
  function options(vars) {
    var rows = (Array.isArray(vars) ? vars : []).filter(function (v) { return v && v.option1_value && !v.gelato_variant_id && Number(v.active) !== 0; });
    var num = function (v) { var m = /\d+/.exec(String(v.option1_value)); return m ? Number(m[0]) : 9999; };
    return rows.sort(function (a, b) { return num(a) - num(b) || String(a.option1_value).localeCompare(String(b.option1_value)); });
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
  function initialView(natW, natH, aspect) {
    return clampView({ natW: natW, natH: natH, aspect: aspect || 1, zoom: 1, cx: natW / 2, cy: natH / 2 });
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
  // Short side of the cropped area in photo pixels (for the "may look soft" warning).
  function cropPixels(v) { return Math.round(Math.min(v.w, v.h)); }

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
    spec: spec, isPhotoProduct: isPhotoProduct, nameField: nameField, options: options,
    checkFile: checkFile, checkName: checkName,
    initialView: initialView, clampView: clampView, cropOf: cropOf, layout: layout, pan: pan, zoomTo: zoomTo, cropPixels: cropPixels,
    cartKey: cartKey, toStored: toStored, fromStored: fromStored, save: save, load: load, clear: clear
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CBJPhoto = api;
})(typeof window !== 'undefined' ? window : this);
