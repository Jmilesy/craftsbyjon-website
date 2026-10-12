/* Crafts by Jon homepage (homepage stage H3). The page is complete without this file: hero, About, reviews,
   contact and footer are plain HTML, and every way into the shop is a normal link. This adds:
     - ?src attribution kept for the rest of the visit (same sessionStorage key as the shop, product and collection
       pages), so a tagged link that lands here still reaches checkout with its source,
     - the collections, menus and product rows, from the public collections feed (/collections-list). That feed
       shows only what the collections admin has published, in season and not empty, and only products the shop
       sells (Ready to Go, not sold out). Nothing about collections is written in this file,
     - the phone menu,
     - the basket count, read (never written) from the basket the shop saves in this browser,
     - product_card_click, the same event the collection pages send, with path "home:<collection>". */
(function () {
  'use strict';
  var API = 'https://craftsbyjon.co.uk/n8n-proxy/products-api';
  var FEED = API + '/collections-list';
  var TIMEOUT_MS = 8000;

  try {
    var srcParam = new URLSearchParams(window.location.search).get('src');
    if (srcParam) sessionStorage.setItem('cbj_src', srcParam.slice(0, 100));
  } catch (e) {}
  function getSource() { try { return sessionStorage.getItem('cbj_src') || 'direct'; } catch (e) { return 'direct'; } }

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return '£' + Number(n).toFixed(2); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  // Only our own pages and pictures: anything else in the feed is ignored.
  function sameSite(u) { return typeof u === 'string' && /^\/(?!\/)/.test(u) ? u : null; }
  function imgUrl(u) { return typeof u === 'string' && u.indexOf('https://images.craftsbyjon.co.uk/') === 0 ? u : null; }

  function send(body) {
    try { fetch(API + '/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(function () {}); } catch (e) {}
  }

  // ---------- basket count: the shop's saved basket (store/photo-personaliser.js, key cbj_cart_v1) ----------
  // The shop keeps a basket for 14 days and drops anything no longer sold when it opens, so this count can be
  // higher than the basket for a moment if a product has just been withdrawn. It is only a number on a link.
  var CART_MAX_AGE_MS = 14 * 24 * 3600 * 1000;
  function basketCount() {
    try {
      var c = JSON.parse(localStorage.getItem('cbj_cart_v1') || 'null');
      if (!c || c.v !== 1 || !Array.isArray(c.lines) || Date.now() - (c.saved || 0) > CART_MAX_AGE_MS) return 0;
      return c.lines.reduce(function (n, l) { return n + Math.min(Math.max(parseInt(l && l.qty, 10) || 1, 1), 50); }, 0);
    } catch (e) { return 0; }
  }
  function showBasket() {
    var n = basketCount(), el = $('#basketCount'), link = $('#basketLink');
    if (!el || !link) return;
    el.hidden = n === 0; el.textContent = n;
    link.setAttribute('aria-label', n ? 'Basket, ' + plural(n, 'item', 'items') + ', in the shop' : 'Basket, in the shop');
  }

  // ---------- phone menu ----------
  function menu() {
    var btn = $('#menuBtn'), sheet = $('#menu'), scrim = $('#scrim'), close = $('#menuClose');
    if (!btn || !sheet) return;
    var root = document.documentElement;
    function isOpen() { return sheet.classList.contains('on'); }
    function open() {
      sheet.removeAttribute('inert'); sheet.classList.add('on'); scrim.classList.add('on'); root.classList.add('menu-open');
      btn.setAttribute('aria-expanded', 'true');
      setTimeout(function () { close.focus(); }, 30);
    }
    function shut(back) {
      if (!isOpen()) return;
      sheet.classList.remove('on'); sheet.setAttribute('inert', ''); scrim.classList.remove('on'); root.classList.remove('menu-open');
      btn.setAttribute('aria-expanded', 'false');
      if (back !== false) btn.focus({ preventScroll: true });
    }
    btn.addEventListener('click', function () { isOpen() ? shut() : open(); });
    close.addEventListener('click', function () { shut(); });
    scrim.addEventListener('click', function () { shut(); });
    sheet.addEventListener('click', function (e) { var a = e.target.closest('a'); if (a && a.hasAttribute('data-close')) shut(false); });
    document.addEventListener('keydown', function (e) {
      if (!isOpen()) return;
      if (e.key === 'Escape') { shut(); return; }
      if (e.key !== 'Tab') return;
      var f = sheet.querySelectorAll('a[href], button:not([disabled])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    // Going back to desktop width with the menu open: close it so the page can scroll.
    window.addEventListener('resize', function () { if (window.innerWidth >= 960) shut(false); });
  }

  // ---------- rendering from the feed ----------
  function groupsOf(pages) {
    // The admin's groups, in the admin's order: product types, the gift pages, then each collection group.
    var out = [], byName = {};
    pages.forEach(function (p) {
      var g = p.source === 'type' ? 'Shop by product' : (p.group || 'Collections');
      if (!byName[g]) { byName[g] = { name: g, pages: [] }; out.push(byName[g]); }
      byName[g].pages.push(p);
    });
    var gifts = (pages.filter(function (p) { return p.source === 'auto'; })[0] || {}).group;
    var rank = function (g) { return g.name === 'Shop by product' ? 0 : g.name === gifts ? 1 : 2; };
    return out.sort(function (a, b) { return rank(a) - rank(b); });
  }
  function pageLink(p, cls) {
    var url = sameSite(p.url); if (!url) return '';
    return '<a class="' + cls + '" href="' + esc(url) + '">' + esc(p.name) + '<span>' + esc(p.count) + '</span></a>';
  }
  function renderMenus(pages) {
    var groups = groupsOf(pages);
    $('#menuGroups').innerHTML = groups.map(function (g) {
      return '<div class="menu-group"><h3>' + esc(g.name) + '</h3>' + g.pages.map(function (p) { return pageLink(p, 'menu-link'); }).join('') + '</div>';
    }).join('');
    var desk = { type: [], collections: [], gifts: [] };
    pages.forEach(function (p) { (p.source === 'type' ? desk.type : p.source === 'auto' ? desk.gifts : desk.collections).push(p); });
    Object.keys(desk).forEach(function (k) {
      var holder = document.querySelector('.nav-desk [data-group="' + k + '"]');
      if (!holder || !desk[k].length) return;
      holder.querySelector('.dd').innerHTML = desk[k].map(function (p) { return pageLink(p, ''); }).join('');
      holder.hidden = false;
    });
  }

  function picture(src, src2x, full, alt, sizes, eager) {
    var a = imgUrl(src), b = imgUrl(src2x), f = imgUrl(full) || a;
    if (!a && !f) return '';
    return '<img src="' + esc(a || f) + '"' + (a && b ? ' srcset="' + esc(a) + ' 400w, ' + esc(b) + ' 800w" sizes="' + sizes + '"' : '')
      + ' alt="' + esc(alt) + '" width="400" height="400"' + (eager ? '' : ' loading="lazy"') + ' decoding="async"'
      + (f && f !== a ? ' data-fallback="' + esc(f) + '"' : '') + '>';
  }
  // A thumbnail that hasn't been made yet falls back to the original photo; a missing original is just removed.
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG') return;
    if (t.dataset.fallback && t.src !== t.dataset.fallback) { t.removeAttribute('srcset'); t.src = t.dataset.fallback; return; }
    if (t.closest('.tile, .collage, .card, .made')) t.style.visibility = 'hidden';
  }, true);

  function tile(p) {
    var url = sameSite(p.url); if (!url) return '';
    return '<a class="tile" href="' + esc(url) + '">' + picture(p.cover_thumb, null, p.cover, '', '(max-width: 900px) 50vw, 33vw')
      + '<span class="lbl"><b>' + esc(p.name) + '</b><span>' + esc(plural(p.count, 'product', 'products')) + '</span></span></a>';
  }
  function card(pr, slug) {
    var url = sameSite(pr.url); if (!url) return '';
    var badges = (pr.made === 'handmade' ? '<span class="badge hand">Handmade</span>' : '') + (pr.personalised ? '<span class="badge pers">Personalised</span>' : '');
    return '<a class="card" href="' + esc(url) + '" data-id="' + esc(pr.id) + '" data-from="' + esc(slug) + '">'
      + '<span class="ph">' + picture(pr.image, pr.image_2x, pr.image_full, pr.name, '(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 25vw') + (badges ? '<span class="badges">' + badges + '</span>' : '') + '</span>'
      + '<span class="bd"><span class="tt">' + esc(pr.name) + '</span>'
      + '<span class="pr">' + (pr.price_from ? '<small>from</small> ' : '') + money(pr.price) + '</span></span></a>';
  }
  function row(p, i) {
    var url = sameSite(p.url);
    if (!url || !p.products || !p.products.length) return '';
    var id = 'row-' + i;
    return '<section class="sec" aria-labelledby="' + id + '"><div class="wrap">'
      + '<div class="sec-h"><div><h2 id="' + id + '">' + esc(p.name) + '</h2>' + (p.description ? '<p>' + esc(p.description) + '</p>' : '') + '</div>'
      + '<a class="link" href="' + esc(url) + '">See all ' + esc(p.count) + '</a></div>'
      + '<div class="rail">' + p.products.map(function (pr) { return card(pr, p.slug); }).join('') + '</div></div></section>';
  }
  function chips(pages) {
    return '<div class="chip-row">' + pages.map(function (p) {
      var url = sameSite(p.url); return url ? '<a class="chip" href="' + esc(url) + '">' + esc(p.name) + ' <small>' + esc(p.count) + '</small></a>' : '';
    }).join('') + '</div>';
  }

  function render(feed) {
    var pages = Array.isArray(feed.result) ? feed.result : [];
    var home = Array.isArray(feed.homepage) ? feed.homepage : [];
    if (!pages.length) return false;
    renderMenus(pages);

    var everything = pages.filter(function (p) { return p.preset === 'all'; })[0];
    if (everything && sameSite(everything.url)) $('#seeEverything').href = everything.url;
    var pers = pages.filter(function (p) { return p.preset === 'personalised'; })[0];
    if (pers && sameSite(pers.url)) { var hp = $('#heroPersonalise'); hp.href = pers.url; hp.hidden = false; }

    // Collection tiles: the homepage choices (or the fallback the feed picked), in that order.
    $('#tiles').innerHTML = home.map(tile).join('');
    var col = $('#collage');
    var three = home.filter(function (p) { return imgUrl(p.cover); }).slice(0, 3);
    if (three.length === 3) {
      col.innerHTML = three.map(function (p, i) {
        return '<a href="' + esc(sameSite(p.url)) + '">' + picture(p.cover_thumb, null, p.cover, '', i ? '25vw' : '50vw', true) + '<span class="tag">' + esc(p.name) + '</span></a>';
      }).join('');
      col.hidden = false;
    }
    // Product rows for the first two homepage collections.
    $('#rows').innerHTML = home.slice(0, 2).map(row).join('');

    // Find a gift: every group from the admin, as chips.
    var groups = groupsOf(pages);
    $('#finder').innerHTML = groups.map(function (g) { return '<h3>' + esc(g.name) + '</h3>' + chips(g.pages); }).join('');
    $('#find').hidden = false;

    // What's made where: the product types the feed says are handmade or printed (from the products themselves).
    var types = pages.filter(function (p) { return p.source === 'type'; });
    [['handmade', '#madeHand', '#madeHandImg', '#madeHandLinks'], ['printed', '#madePrint', '#madePrintImg', '#madePrintLinks']].forEach(function (m) {
      var list = types.filter(function (p) { return p.made === m[0]; });
      if (!list.length) return;
      var pic = list.filter(function (p) { return imgUrl(p.cover_thumb || p.cover); })[0];
      if (pic) { var im = $(m[2]); im.src = imgUrl(pic.cover_thumb) || imgUrl(pic.cover); im.dataset.fallback = imgUrl(pic.cover) || ''; }
      else $(m[2]).remove();
      $(m[3]).innerHTML = list.map(function (p) { return '<a class="chip" href="' + esc(sameSite(p.url)) + '">' + esc(p.name) + '</a>'; }).join('');
      $(m[1]).hidden = false;
      $('#made').hidden = false;
    });
    return true;
  }

  function unavailable() {
    // Visitors still get the whole page and every way into the shop; only the collection parts go.
    $('#collections').hidden = true;
    $('#homeNotice').hidden = false;
  }

  function load() {
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, TIMEOUT_MS);
    fetch(FEED, ctl ? { signal: ctl.signal } : undefined)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (feed) { clearTimeout(timer); if (!render(feed || {})) unavailable(); })
      .catch(function () { clearTimeout(timer); unavailable(); });
  }

  function init() {
    menu();
    showBasket();
    window.addEventListener('pageshow', showBasket);
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a.card');
      if (!a || !a.dataset.id) return;
      send({ event: 'product_card_click', source: getSource(), product_id: a.dataset.id, path: 'home:' + (a.dataset.from || '') });
      if (typeof gtag === 'function') gtag('event', 'product_card_click', { source: getSource(), item_id: a.dataset.id });
    });
    load();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
