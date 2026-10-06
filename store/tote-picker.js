/* Crafts by Jon: tote bag picker logic (Colour x Text).
   Pure functions, no DOM. Used by the store product modal for tote bags made by a print partner.
   Variants come from /products/:id/public-variants. A tote variant row has option1_name 'Colour',
   option2_name 'Text' (values 'Yes' or 'No') and NO gelato_variant_id (t-shirts also use Colour
   first but pair it with Size, and carry a gelato_variant_id). */
(function (root) {
  var COLOUR_ORDER = ['Natural Raw', 'White', 'Black', 'Anthracite', 'French Navy'];

  function isToteVariants(vs) {
    return Array.isArray(vs) && vs.length > 0 && vs.some(function (v) {
      return v.option1_name === 'Colour' && v.option2_name === 'Text' && !v.gelato_variant_id;
    });
  }

  function colours(vs) {
    var seen = {};
    vs.forEach(function (v) { seen[v.option1_value] = true; });
    var known = COLOUR_ORDER.filter(function (c) { return seen[c]; });
    var extra = Object.keys(seen).filter(function (c) { return COLOUR_ORDER.indexOf(c) === -1; }).sort();
    return known.concat(extra);
  }

  // Which text options exist for a colour (some colours may only have one).
  function texts(vs, colour) {
    var seen = {};
    vs.forEach(function (v) { if (!colour || v.option1_value === colour) seen[v.option2_value] = true; });
    return ['No', 'Yes'].filter(function (t) { return seen[t]; });
  }

  function find(vs, colour, text) {
    for (var i = 0; i < vs.length; i++) {
      var v = vs[i];
      if (v.option1_value === colour && v.option2_value === text) return v;
    }
    return null;
  }

  function textLabel(t) { return t === 'Yes' ? 'With DEAL · KENT text' : 'No text'; }

  // Pictures for a choice: this colour and text first, then the same colour with the other text.
  // Returns image urls as stored (the page turns them into full urls).
  function imagesFor(vs, colour, text) {
    var out = [];
    var first = find(vs, colour, text);
    if (first && first.image_url) out.push(first.image_url);
    var other = find(vs, colour, text === 'Yes' ? 'No' : 'Yes');
    if (other && other.image_url && out.indexOf(other.image_url) === -1) out.push(other.image_url);
    return out;
  }

  root.CBJTote = {
    isToteVariants: isToteVariants, colours: colours, texts: texts, find: find,
    textLabel: textLabel, imagesFor: imagesFor
  };
})(typeof window !== 'undefined' ? window : globalThis);
