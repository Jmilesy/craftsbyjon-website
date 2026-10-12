/* Crafts by Jon: the site header's menus (phone menu + desktop dropdowns), shared by pages that use the new
   header (the shop, H4). Same behaviour as the homepage's (store/home.js): the menus are filled from the public
   collections feed, so they list exactly the collections and product types the admin has published (in season,
   not empty), in the admin's order. Nothing about collections is written here. If the feed can't load, the
   menu keeps its fixed links (Shop everything, About, Custom orders, Contact).
   Fires "cbj:collections" on document with the feed, for page-specific use. */
(function () {
  'use strict';
  var FEED = 'https://craftsbyjon.co.uk/n8n-proxy/products-api/collections-list';
  var TIMEOUT_MS = 8000;
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function sameSite(u) { return typeof u === 'string' && /^\/(?!\/)/.test(u) ? u : null; }

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
    sheet.addEventListener('click', function (e) {
      var a = e.target.closest('a'); if (!a || !a.hasAttribute('data-close')) return;
      var target = document.getElementById((a.getAttribute('href') || '').replace(/^.*#/, ''));
      if (!target || a.getAttribute('href').charAt(0) !== '#') { shut(false); return; }
      e.preventDefault(); shut(false); target.scrollIntoView();
    });
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
    window.addEventListener('resize', function () { if (window.innerWidth >= 960) shut(false); });
  }

  function groupsOf(pages) {
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
  function render(pages) {
    var mg = $('#menuGroups');
    if (mg) mg.innerHTML = groupsOf(pages).map(function (g) {
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

  function load() {
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, TIMEOUT_MS);
    fetch(FEED, ctl ? { signal: ctl.signal } : undefined)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (feed) {
        clearTimeout(timer);
        var pages = feed && Array.isArray(feed.result) ? feed.result : [];
        if (pages.length) render(pages);
        document.dispatchEvent(new CustomEvent('cbj:collections', { detail: pages.length ? feed : null }));
      })
      .catch(function () { clearTimeout(timer); document.dispatchEvent(new CustomEvent('cbj:collections', { detail: null })); });
  }
  function init() { menu(); load(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
