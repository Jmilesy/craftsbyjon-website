/* Crafts by Jon: which pictures to show for the options a customer has chosen, and which variant row
   those options mean. Pure functions, no DOM. Written for the storefront redesign (11 Oct 2026) so the
   full product page and the quick view use one set of rules; the live product modal can move to it later.

   It does not replace the existing pickers, it uses them:
     prints  -> CBJPrint.galleryFor / CBJPrint.find  (print-picker.js, Jon's fallback order of 30 Sep 2026)
     totes   -> CBJTote.imagesFor / CBJTote.find     (tote-picker.js)
   and adds the two rules that lived only inside store/index.html:
     t-shirts (and any Gelato product with a per-colour gallery) -> pod_gallery_images[colour]
     Clear/Black acrylics (products.variants + variant_images)  -> variant_images[finish]

   The one new rule: never show another option's picture as if it were the chosen one. When there is no
   exact picture, the result says so (exact: false) and carries a short note for the page to show. */
(function (root) {
  var APPAREL_SHOTS = ['front', 'front_alt', 'flat', 'lifestyle_female', 'lifestyle_male', 'lifestyle_living_room', 'lifestyle_bedroom', 'size_chart'];
  var ALL_SHOTS = ['lifestyle_living_room', 'lifestyle_bedroom_2', 'lifestyle_bedroom', 'lifestyle_female', 'lifestyle_male', 'front_alt', 'front', 'flat', 'size_chart', 'size-chart'];

  function P() { return root.CBJPrint; }
  function T() { return root.CBJTote; }

  function hasKeys(o) { return !!o && typeof o === 'object' && Object.keys(o).length > 0; }

  // input: { vars, podGallery, printGallery, finishes, finishImages }
  function kindOf(input) {
    var vs = input.vars || [];
    if (P() && P().isPrintVariants(vs)) return 'print';
    if (T() && T().isToteVariants(vs)) return 'tote';
    if (hasKeys(input.podGallery) && vs.some(function (v) { return v.option1_name === 'Colour'; })) return 'apparel';
    if ((input.finishes || []).length > 1) return 'finish';
    return 'single';
  }

  // Which kind of shot a picture is, from its file name (used to stay on "worn by a man" when the colour changes).
  function shotOf(url) {
    var s = String(url || '').toLowerCase();
    for (var i = 0; i < ALL_SHOTS.length; i++) if (s.indexOf(ALL_SHOTS[i]) !== -1) return ALL_SHOTS[i].replace('size-chart', 'size_chart');
    return null;
  }

  function result(urls, exact, note) { return { urls: urls, exact: exact, note: note || null }; }

  // input also carries defaults: the product's normal pictures, shown when nothing is chosen yet
  // or when there is no picture for the choice at all.
  function imagesFor(input, sel) {
    sel = sel || {};
    var kind = input.kind || kindOf(input), defaults = (input.defaults || []).filter(Boolean), vs = input.vars || [];

    if (kind === 'apparel') {
      if (!sel.Colour) return result(defaults, true);
      var g = (input.podGallery || {})[sel.Colour];
      if (hasKeys(g)) {
        var urls = APPAREL_SHOTS.map(function (k) { return g[k]; }).filter(Boolean);
        Object.keys(g).forEach(function (k) { if (APPAREL_SHOTS.indexOf(k) === -1 && g[k]) urls.push(g[k]); });
        return result(urls, true);
      }
      return result(defaults, false, 'No photo of ' + sel.Colour + ' yet, so this shows another colour.');
    }

    if (kind === 'print') {
      if (!sel.Frame) return result(defaults, true);
      var text = sel.Text || 'No';
      var pg = P().galleryFor(input.printGallery || {}, vs, sel.Frame, sel.Size || null, text);
      if (!pg.urls.length) return result(defaults, false, 'No photo of the ' + P().frameLabel(sel.Frame).toLowerCase() + ' yet, so this shows the print on its own.');
      var shown = pg.key.split('|'), notes = [];
      if (shown[2] !== text) notes.push('No photo of this one ' + (text === 'Yes' ? 'with' : 'without') + ' the DEAL · KENT text yet, so this shows it ' + (shown[2] === 'Yes' ? 'with' : 'without') + ' the text.');
      if (sel.Size && shown[1] !== sel.Size) notes.push('The photo shows the ' + shown[1] + ' size.');
      return result(pg.urls, notes.length === 0, notes.join(' '));
    }

    if (kind === 'tote') {
      if (!sel.Colour) return result(defaults, true);
      var tt = sel.Text || 'No';
      var urls2 = T().imagesFor(vs, sel.Colour, tt);
      var row = T().find(vs, sel.Colour, tt);
      if (!urls2.length) return result(defaults, false, 'No photo of the ' + sel.Colour + ' bag yet, so this shows another colour.');
      var exact = !!(row && row.image_url && urls2[0] === row.image_url);
      return result(urls2, exact, exact ? null : 'No photo of the ' + sel.Colour + ' bag ' + (tt === 'Yes' ? 'with' : 'without') + ' the text yet, so this shows it ' + (tt === 'Yes' ? 'without' : 'with') + ' the text.');
    }

    if (kind === 'finish') {
      if (!sel.Finish) return result(defaults, true);
      var key = String(sel.Finish).toLowerCase(), imgs = input.finishImages || {};
      var mine = imgs[key];
      var others = Object.keys(imgs).filter(function (k) { return k !== key; }).map(function (k) { return imgs[k]; });
      var rest = defaults.filter(function (u) { return u !== mine && others.indexOf(u) === -1; });
      if (mine) return result([mine].concat(rest), true);
      // The listing's own main picture is the first finish (Clear) by the store's convention: keyring-001.jpg is
      // clear, keyring-001bl.jpg is black. Any other finish without its own picture gets an honest note.
      var first = String((input.finishes || [])[0] || '').toLowerCase();
      if (key === first) return result(rest.length ? rest : defaults, true);
      return result(rest.length ? rest : defaults, false, 'No photo of the ' + key + ' finish yet, so this shows the ' + first + ' one.');
    }

    return result(defaults, true);
  }

  // The exact variant row the choices mean, or null while something is still to choose.
  function variantFor(input, sel) {
    sel = sel || {};
    var kind = input.kind || kindOf(input), vs = input.vars || [];
    if (kind === 'print') return sel.Frame && sel.Size && sel.Text ? P().find(vs, sel.Frame, sel.Size, sel.Text) : null;
    if (kind === 'tote') return sel.Colour && sel.Text ? T().find(vs, sel.Colour, sel.Text) : null;
    if (kind === 'apparel') {
      if (!sel.Colour) return null;
      var withSize = vs.some(function (v) { return v.option2_name === 'Size'; });
      if (withSize && !sel.Size) return null;
      for (var i = 0; i < vs.length; i++) {
        if (vs[i].option1_value === sel.Colour && (!withSize || vs[i].option2_value === sel.Size)) return vs[i];
      }
      return null;
    }
    if (kind === 'finish') return sel.Finish ? { finish: sel.Finish } : null;
    return vs.length === 1 ? vs[0] : (vs.length === 0 ? {} : null);
  }

  var api = { kindOf: kindOf, imagesFor: imagesFor, variantFor: variantFor, shotOf: shotOf, APPAREL_SHOTS: APPAREL_SHOTS };
  root.CBJVariantImages = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
