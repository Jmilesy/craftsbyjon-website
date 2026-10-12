/* Crafts by Jon shop (/store/): small additions for the new site header (H4). store/shop.js is unchanged and
   still does everything else (products, filters, deep links, popup, basket, checkout, analytics).
     - The basket button sits in the header (as on product pages), always visible, with its count shown once
       there is something in it.
     - The shop's own collection buttons (sidebar and Browse panel) follow the collections admin: a collection
       that isn't public right now (hidden, archived, draft, out of season or empty) has its button hidden, and
       the Christmas gifts and Personalised buttons show only while those pages are public. The buttons stay in
       the page, so old links such as /store/?collection=summer-vibes still filter as before. If the
       collections feed can't load, nothing is hidden (the shop behaves exactly as it did). */
(function () {
  'use strict';
  function placeBasket() {
    var slot = document.getElementById('hdrCartSlot'), btn = document.getElementById('cartBtn'), n = document.getElementById('cartCount');
    if (!slot || !btn) return;
    if (btn.parentNode !== slot) slot.appendChild(btn);
    btn.setAttribute('aria-label', 'Basket');
    function sync() { var c = parseInt(n && n.textContent, 10) || 0; btn.classList.toggle('has-items', c > 0); }
    sync();
    if (n && window.MutationObserver) new MutationObserver(sync).observe(n, { childList: true, characterData: true, subtree: true });
  }
  function cssString(s) { return '"' + String(s).replace(/["\\]/g, '\\$&').replace(/\n/g, ' ') + '"'; }
  function hideNonPublic(feed) {
    if (!feed || !Array.isArray(feed.result)) return;
    var pub = {}, presets = {};
    feed.result.forEach(function (p) { if (p.source === 'collection') pub[String(p.name).toLowerCase()] = 1; if (p.preset) presets[p.preset] = 1; });
    var names = {};
    document.querySelectorAll('#collectionFilterBar .col-btn[data-col]').forEach(function (b) { var c = b.getAttribute('data-col'); if (c) names[c] = 1; });
    var hide = Object.keys(names).filter(function (c) {
      if (c === '__gifts__') return !presets.christmas_gifts;
      if (c === '__personalised__') return !presets.personalised;
      return !pub[c.toLowerCase()];
    });
    if (!hide.length) return;
    var sel = [];
    hide.forEach(function (c) { sel.push('.col-btn[data-col=' + cssString(c) + ']', '.drawer-item[data-col=' + cssString(c) + ']'); });
    if (hide.indexOf('__personalised__') !== -1) sel.push('#mobilePersToggle');
    var st = document.createElement('style'); st.id = 'shopAlignHide';
    st.textContent = sel.join(',\n') + ' { display: none !important; }';
    document.head.appendChild(st);
  }
  var feed = null, ready = false;
  document.addEventListener('cbj:collections', function (e) { feed = e.detail; if (ready) hideNonPublic(feed); });
  function init() {
    placeBasket();
    // The collection buttons are drawn by shop.js once products have loaded.
    var main = document.getElementById('main');
    var done = function () { if (document.getElementById('collectionFilterBar')) { ready = true; if (feed) hideNonPublic(feed); return true; } return false; };
    if (!done() && main && window.MutationObserver) {
      var mo = new MutationObserver(function () { if (done()) mo.disconnect(); });
      mo.observe(main, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
