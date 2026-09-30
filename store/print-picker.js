/* Crafts by Jon: print picker logic (Frame x Size x Text).
   Pure functions, no DOM. Used by the store product modal for print products.
   Variants come from /public-variants; gallery from /public-variant-gallery
   ({ "Frame|Size|Text": { shot: url } }). */
(function (root) {
  var FRAME_ORDER = ['None', 'Black', 'Dark wood', 'White', 'Wood'];
  var SHOT_ORDER = ['flat', 'lifestyle_living_room', 'lifestyle_bedroom', 'lifestyle_bedroom_2'];

  function cm(size) { var n = parseInt(size, 10); return isNaN(n) ? 0 : n; }

  // A print product has the Frame / Size / Text option names (set 30 Sep 2026).
  function isPrintVariants(vs) {
    return Array.isArray(vs) && vs.some(function (v) { return v.option1_name === 'Frame' && v.option3_name === 'Text'; });
  }

  function frames(vs) {
    var seen = {};
    vs.forEach(function (v) { seen[v.option1_value] = true; });
    var known = FRAME_ORDER.filter(function (f) { return seen[f]; });
    var extra = Object.keys(seen).filter(function (f) { return FRAME_ORDER.indexOf(f) === -1; }).sort();
    return known.concat(extra);
  }

  function texts(vs) {
    var seen = {};
    vs.forEach(function (v) { seen[v.option3_value] = true; });
    return ['Yes', 'No'].filter(function (t) { return seen[t]; });
  }

  // Sizes offered for a frame, smallest first. None offers 7, a real frame offers 4.
  function sizes(vs, frame) {
    var seen = {};
    vs.forEach(function (v) { if (v.option1_value === frame) seen[v.option2_value] = true; });
    return Object.keys(seen).sort(function (a, b) { return cm(a) - cm(b); });
  }

  function find(vs, frame, size, text) {
    for (var i = 0; i < vs.length; i++) {
      var v = vs[i];
      if (v.option1_value === frame && v.option2_value === size && v.option3_value === text) return v;
    }
    return null;
  }

  // Extra cost of a frame at a size (framed price minus unframed price). Same for all frame colours.
  function frameCharge(vs, size, text) {
    var none = find(vs, 'None', size, text);
    if (!none || none.retail_price_pence == null) return null;
    var fs = frames(vs).filter(function (f) { return f !== 'None'; });
    for (var i = 0; i < fs.length; i++) {
      var v = find(vs, fs[i], size, text);
      if (v && v.retail_price_pence != null) return v.retail_price_pence - none.retail_price_pence;
    }
    return null;
  }

  // Sizes that have a real frame, with the charge at each (for the "add a frame" note).
  function frameChargeList(vs, text) {
    var fs = frames(vs).filter(function (f) { return f !== 'None'; });
    if (!fs.length) return [];
    return sizes(vs, fs[0]).map(function (s) { return { size: s, charge: frameCharge(vs, s, text) }; })
      .filter(function (x) { return x.charge != null; });
  }

  function key(frame, size, text) { return frame + '|' + size + '|' + text; }
  function other(text) { return text === 'Yes' ? 'No' : 'Yes'; }

  // Pictures for a combination. Order of preference (Jon, 30 Sep 2026):
  //   1. exactly this Frame, Size, Text
  //   2. same Frame and Size with the other Text (used for the four missing white 30 cm no-text sets)
  //   3. same Frame, nearest size that has pictures (same Text first, then other Text)
  // If size is not chosen yet, the smallest size for that frame is used.
  function galleryFor(gallery, vs, frame, size, text) {
    gallery = gallery || {};
    var szs = sizes(vs, frame);
    var useSize = size || szs[0];
    var tries = [];
    if (useSize) { tries.push(key(frame, useSize, text)); tries.push(key(frame, useSize, other(text))); }
    var byDistance = szs.slice().sort(function (a, b) { return Math.abs(cm(a) - cm(useSize)) - Math.abs(cm(b) - cm(useSize)); });
    [text, other(text)].forEach(function (t) {
      byDistance.forEach(function (s) { tries.push(key(frame, s, t)); });
    });
    for (var i = 0; i < tries.length; i++) {
      var g = gallery[tries[i]];
      if (g && Object.keys(g).length) {
        var urls = SHOT_ORDER.map(function (s) { return g[s]; }).filter(Boolean);
        Object.keys(g).forEach(function (s) { if (SHOT_ORDER.indexOf(s) === -1 && g[s]) urls.push(g[s]); });
        return { key: tries[i], exact: i === 0, urls: urls };
      }
    }
    return { key: null, exact: false, urls: [] };
  }

  function frameLabel(f) { return f === 'None' ? 'No frame' : f + ' frame'; }
  function textLabel(t) { return t === 'Yes' ? 'With DEAL · KENT text' : 'No text'; }
  // Goes into the cart line and order emails as the "colour" part, e.g. "Black frame, with text".
  function cartLabel(frame, text) { return frameLabel(frame) + ', ' + (text === 'Yes' ? 'with text' : 'no text'); }

  root.CBJPrint = {
    isPrintVariants: isPrintVariants, frames: frames, texts: texts, sizes: sizes, find: find,
    frameCharge: frameCharge, frameChargeList: frameChargeList, galleryFor: galleryFor,
    frameLabel: frameLabel, textLabel: textLabel, cartLabel: cartLabel
  };
})(typeof window !== 'undefined' ? window : globalThis);
