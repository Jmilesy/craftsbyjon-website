/* Crafts by Jon: collection pages (/collections/{slug}), Stage C, 12 Oct 2026.
   The page is complete without this file (server-rendered links to the product pages). This adds:
     - the same analytics the shop sends: collection_view with the same slug (so the funnel report and business
       brief count these pages under the same names as the store's collection filters), and product_card_click,
     - ?src attribution kept for the rest of the visit (same sessionStorage key as the shop),
     - type filter chips and sorting, the basket count in the header. */
(function () {
  'use strict';
  var page = window.CBJ_PAGE;
  if (!page || page.mode !== 'collection') return;
  var API = 'https://craftsbyjon.co.uk/n8n-proxy/products-api';

  try {
    var srcParam = new URLSearchParams(window.location.search).get('src');
    if (srcParam) sessionStorage.setItem('cbj_src', srcParam.slice(0, 100));
  } catch (e) {}
  function getSource() { try { return sessionStorage.getItem('cbj_src') || 'direct'; } catch (e) { return 'direct'; } }

  // Same payloads as store/shop.js (trackCollectionView / trackEvent). The staff preview sends nothing.
  function send(body) {
    if (window.CBJ_PREVIEW) return;
    try { fetch(API + '/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(function () {}); } catch (e) {}
  }
  function trackCollectionView() {
    try { if (typeof window.clarity === 'function') window.clarity('set', 'collection', page.slug); } catch (e) {}
    send({ event: 'collection_view', source: getSource(), product_id: page.slug, path: window.location.pathname + window.location.search });
    if (typeof gtag === 'function') gtag('event', 'collection_view', { collection: page.slug, source: getSource() });
  }
  function trackCardClick(id) {
    send({ event: 'product_card_click', source: getSource(), product_id: id, path: 'collection:' + page.slug });
    if (typeof gtag === 'function') gtag('event', 'product_card_click', { source: getSource(), item_id: id });
  }

  function basketCount() {
    try {
      var c = JSON.parse(localStorage.getItem('cbj_cart_v1') || '{}');
      return (c.lines || []).reduce(function (n, l) { return n + (Number(l.qty) || 1); }, 0);
    } catch (e) { return 0; }
  }

  function init() {
    trackCollectionView();
    var grid = document.querySelector('.cc-grid');
    if (!grid) return;
    grid.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a.cc-link');
      if (a && a.dataset.id) trackCardClick(a.dataset.id);
    });

    var n = basketCount(), basket = document.querySelector('.cc-basket');
    if (basket && n > 0) { document.getElementById('ccBasketCount').textContent = n; basket.hidden = false; }

    var tools = document.querySelector('.cc-tools');
    if (!tools) return;
    tools.hidden = false;
    var cards = Array.prototype.slice.call(grid.children);
    cards.forEach(function (c, i) { c.dataset.order = i; });
    var count = document.querySelector('.cc-count');
    var activeType = '';
    function apply() {
      var sort = (document.getElementById('ccSort') || {}).value || '';
      var shown = 0;
      cards.forEach(function (c) { var on = !activeType || c.dataset.type === activeType; c.hidden = !on; if (on) shown++; });
      var sorted = cards.slice().sort(function (a, b) {
        if (sort === 'price-asc') return a.dataset.price - b.dataset.price || a.dataset.order - b.dataset.order;
        if (sort === 'price-desc') return b.dataset.price - a.dataset.price || a.dataset.order - b.dataset.order;
        return a.dataset.order - b.dataset.order;
      });
      sorted.forEach(function (c) { grid.appendChild(c); });
      if (count) count.textContent = shown + (shown === 1 ? ' product' : ' products');
    }
    tools.addEventListener('click', function (e) {
      var chip = e.target.closest && e.target.closest('.cc-chip');
      if (!chip) return;
      activeType = chip.dataset.type || '';
      tools.querySelectorAll('.cc-chip').forEach(function (b) { var on = b === chip; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      apply();
    });
    var sel = document.getElementById('ccSort');
    if (sel) sel.addEventListener('change', apply);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
