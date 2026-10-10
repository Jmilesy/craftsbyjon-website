/* Storefront redesign mockups (preview only).
 * Safety: this file only reads ./data/snapshot.json. It never calls products-api, never sends funnel
 * or analytics events, and never starts a checkout. Its pretend basket uses its own localStorage key
 * (cbjPreviewBasket), so it cannot touch the live shop's basket on the same domain. */
(function () {
  'use strict';

  var IMG = 'https://images.craftsbyjon.co.uk';
  var BASKET_KEY = 'cbjPreviewBasket';
  var FREE_POST = 10;
  var PERS_UPLIFT = 1.5;
  var MONTH = new Date().getMonth() + 1;

  // Product types: automatic, straight from product_type.
  var TYPES = [
    { slug: 'mugs', name: 'Mugs', type: 'Mug' },
    { slug: 't-shirts', name: 'T-shirts', type: 'T-Shirt' },
    { slug: 'prints', name: 'Prints', type: 'Print' },
    { slug: 'tote-bags', name: 'Tote bags', type: 'Tote Bag' },
    { slug: 'coasters', name: 'Coasters', type: 'Coaster Set' },
    { slug: 'bookmarks', name: 'Bookmarks', type: 'Bookmark' },
    { slug: 'keyrings', name: 'Keyrings', type: 'Keyring' }
  ];

  // Collections as the new admin would hold them. "manual" ones use today's single collection as a
  // stand-in for the many-to-many assignments Jon would make; "auto" ones follow a fixed rule.
  // Birthday and Christmas have no products assigned yet, so they are hidden everywhere.
  var COLLECTIONS = [
    { slug: 'personalised-gifts', name: 'Personalised gifts', kind: 'auto', home: 1,
      rule: function (p) { return p.personalisable; },
      intro: 'Add a name or a message and it becomes theirs. Bookmarks, keyrings and teacher mugs you can personalise before you order.',
      image: IMG + '/products/mug-001-scene01.png' },
    { slug: 't-shirts-clothing', name: 'T-shirts & clothing', kind: 'auto', home: 2,
      rule: function (p) { return p.type === 'T-Shirt'; },
      intro: 'Soft cotton tees with my Deal designs on the front. Printed to order in your size and colour.',
      image: IMG + '/products/1787131922917-navy-lifestyle_male.jpeg' },
    { slug: 'handmade-gifts', name: 'Handmade gifts', kind: 'auto', home: 3,
      rule: function (p) { return p.made === 'handmade'; },
      intro: 'Acrylic bookmarks and keyrings I put together by hand at home in Deal. Any 3 for £10.',
      image: IMG + '/products/bookmark-001.jpg' },
    { slug: 'retro-deal', name: 'Retro Deal', kind: 'manual', home: 4,
      rule: function (p) { return p.collection === 'Retro Deal'; },
      intro: "Deal's landmarks in 1940s travel-poster style: the pier, the castle, the Timeball Tower, Middle Street and more. On mugs, prints, tees, totes, coasters, bookmarks and keyrings.",
      image: IMG + '/products/1787347223862-pier-lifestyle_living_room.jpeg' },
    { slug: 'birthday-gifts', name: 'Birthday gifts', kind: 'manual', home: 5,
      rule: function () { return false; }, intro: '', image: '' },
    { slug: 'christmas', name: 'Christmas & seasonal', kind: 'manual', home: 6,
      rule: function () { return false; }, intro: '', image: '' },
    { slug: 'teachers', name: 'For teachers', kind: 'manual', home: 7,
      rule: function (p) { return p.collection === 'Teacher Appreciation'; },
      intro: 'Thank-you gifts for teachers and teaching assistants, from a £3.50 bookmark to a mug with their name on.',
      image: IMG + '/products/mug-001-scene01.png' },
    { slug: 'book-lovers', name: 'For book lovers', kind: 'manual', home: 8,
      rule: function (p) { return p.type === 'Bookmark'; },
      intro: 'Acrylic bookmarks that don\'t crease, tear or get used as a coaster. Well, not often.',
      image: IMG + '/products/bookmark-004.jpg' },
    { slug: 'bees', name: 'Bees & flowers', kind: 'manual',
      rule: function (p) { return p.collection === 'Bee Collection'; },
      intro: 'Where it all started: the Bee Collection, made while I was laid up after ankle surgery.',
      image: IMG + '/products/keyring-001.jpg' },
    { slug: 'pride', name: 'Pride', kind: 'manual',
      rule: function (p) { return p.collection === 'Pride'; },
      intro: 'Rainbow bookmarks and keyrings.', image: '' },
    { slug: 'under-5', name: 'Gifts under £5', kind: 'auto',
      rule: function (p) { return p.price < 5; },
      intro: 'Small gifts, stocking fillers and "saw this and thought of you" presents.', image: '' },
    { slug: 'gift-ideas', name: 'Christmas gift ideas', kind: 'auto',
      rule: function (p) { return inSeason(p); },
      sort: function (a, b) { return giftRank(a) - giftRank(b); },
      intro: 'Everything in the shop that is ready to give this Christmas. Coaster sets and tote bags first.',
      image: IMG + '/products/coaster-001-coaster-mockup.png' },
    { slug: 'new-in', name: 'New in', kind: 'auto',
      // Mock: there is no "listed on" date yet. Totes (6 Oct) and coaster set B (30 Sep) are the newest per the handbook.
      rule: function (p) { return p.type === 'Tote Bag' || p.id === 'coaster-002'; },
      intro: 'The latest additions.', image: '' },
    { slug: 'all', name: 'Everything', kind: 'auto', rule: function () { return true; }, intro: 'The whole shop.', image: '' }
  ];
  var PICKS = ['coaster-001', 'mug-005', 'pod-print-pier', 'keyring-014', 'pod-t-shirt-deal-castle', 'bookmark-011', 'totebag002', 'mug-001'];
  var REVIEWS = [
    { q: 'I couldn\'t be happier with my acrylic bookmarks! From start to finish, the whole process was brilliant. Communication was fantastic, Jon was really responsive, answered my questions quickly, and came up with a design...', n: 'Sally', s: 'via Facebook recommendation' },
    { q: 'Parcel arrived safe and sound today, the bookmarks are beautiful. Thanks for all your hard work.', n: 'Graham', s: 'real customer' },
    { q: 'The bookmarks are even better in person! They look fabulous, and all the extra touches too, so impressed.', n: 'Mirjam', s: 'real customer' },
    { q: 'Received a keyring (Deal Pier design) as a gift from my sister. Am thrilled with it! Very high quality and lovely image.', n: 'Tina-Merie', s: 'via Facebook recommendation' }
  ];
  var SWATCH = { 'Sand': '#d9c7a3', 'White': '#ffffff', 'Navy': '#1f2a44', 'Rs Sport Grey': '#b7b9bc', 'Natural': '#efe6d2',
    'Natural Raw': '#e8dcc2', 'Anthracite': '#3d3f42', 'French Navy': '#1d2846', 'Black': '#121212' };
  var SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];

  var data = null, byId = {}, monthsByCol = {};

  function inSeason(p) {
    var m = monthsByCol[p.collection];
    if (!m) return true;
    return m.split(',').map(Number).indexOf(MONTH) !== -1;
  }
  function giftRank(p) { return p.type === 'Coaster Set' ? 0 : p.type === 'Tote Bag' ? 1 : 2; }

  // ---------- helpers ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return '£' + Number(n).toFixed(2); }
  function q(name) { return new URLSearchParams(location.search).get(name); }
  function keyOf(url) { return String(url || '').split('/').pop().replace(/\.[^.]+$/, ''); }
  function thumbUrl(url, w) { return IMG + '/thumbs/' + w + '/' + keyOf(url) + '.webp'; }
  // Thumbnail first; falls back to the original picture if a thumbnail has not been made yet.
  function img(url, w, alt, extra) {
    if (!url) return '<img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">';
    return '<img src="' + esc(thumbUrl(url, w)) + '" data-fallback="' + esc(url) + '" alt="' + esc(alt || '') + '" loading="lazy" decoding="async" onerror="if(this.dataset.fallback&&this.src!==this.dataset.fallback){this.src=this.dataset.fallback}"' + (extra || '') + '>';
  }
  function cleanTitle(t) { return String(t || '').split(/\s[|–]\s|,\s(?=\d{4}s|Vintage|Retro|Historic|Kent|Clear)/)[0]; }
  function priceLabel(p) {
    var d = data.details[p.id] || {};
    if (d.priceFrom && d.options && (d.options.Size || d.options.Frame) && p.type === 'Print') return '<small>from</small> ' + money(d.priceFrom);
    return money(d.priceFrom || p.price);
  }
  function madeBadge(p) {
    return p.made === 'handmade' ? '<span class="badge hand">Handmade</span>' : '<span class="badge print">Printed to order</span>';
  }
  function needsChoice(p) {
    var d = data.details[p.id] || {};
    var multi = Object.keys(d.options || {}).some(function (k) { return d.options[k].length > 1; });
    return multi || p.personalisable;
  }
  function collectionLink(c) { return 'collection.html?c=' + c.slug; }
  function typeLink(t) { return 'collection.html?t=' + t.slug; }
  function productsFor(c) {
    var list = data.catalogue.filter(function (p) { return c.rule(p); });
    if (c.sort) list.sort(c.sort);
    return list;
  }
  function visibleCollections() { return COLLECTIONS.filter(function (c) { return productsFor(c).length > 0; }); }
  function primaryCollectionOf(p) {
    return COLLECTIONS.filter(function (c) { return c.kind === 'manual' && c.rule(p); })[0] || null;
  }
  function typeOf(p) { return TYPES.filter(function (t) { return t.type === p.type; })[0] || null; }

  // ---------- card ----------
  function card(p) {
    var plus = needsChoice(p) ? '' :
      '<button class="icon-btn" style="position:absolute;right:8px;top:8px;background:#fff;width:38px;height:38px;box-shadow:var(--shadow)" aria-label="Add ' + esc(cleanTitle(p.title)) + ' to basket" data-quickadd="' + esc(p.id) + '">' + ICON.plus + '</button>';
    var low = p.stockLeft != null && p.stockLeft < 2 ? '<span class="low">' + p.stockLeft + ' left</span>' : '';
    return '<div class="card"><a class="card-a" href="product.html?id=' + encodeURIComponent(p.id) + '">'
      + '<div class="ph">' + img(p.image, 400, '') + '</div>'
      + '<div class="bd">' + madeBadge(p)
      + '<div class="tt">' + esc(cleanTitle(p.title)) + '</div>'
      + (p.personalisable ? '<span class="badge pers">Personalise it</span>' : '') + low
      + '<div class="pr">' + priceLabel(p) + '</div></div></a>' + plus + '</div>';
  }

  var ICON = {
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    van: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7z"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17.5" cy="17.5" r="1.6"/></svg>',
    hand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-6.5a1.5 1.5 0 0 1 3 0V11m0-5a1.5 1.5 0 0 1 3 0v7.5c0 4-2.5 6.5-6 6.5s-5-1.6-6.6-4.2L3.2 13a1.5 1.5 0 0 1 2.5-1.6L8 14"/></svg>',
    ret: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4"/></svg>'
  };

  // ---------- chrome: ribbon, header, sheets, footer ----------
  function chrome() {
    var cols = visibleCollections().filter(function (c) { return c.kind === 'manual' || ['personalised-gifts', 'handmade-gifts', 'under-5'].indexOf(c.slug) !== -1; });
    var typeLinks = TYPES.map(function (t) {
      var n = data.catalogue.filter(function (p) { return p.type === t.type; }).length;
      return n ? '<a href="' + typeLink(t) + '">' + t.name + ' <span>' + n + '</span></a>' : '';
    }).join('');
    var colLinks = cols.map(function (c) { return '<a href="' + collectionLink(c) + '">' + esc(c.name) + ' <span>' + productsFor(c).length + '</span></a>'; }).join('');

    document.body.insertAdjacentHTML('afterbegin',
      '<div class="pv-ribbon">Preview only, not the live shop. <a href="index.html">Review notes</a></div>'
      + '<header class="hdr"><div class="wrap hdr-in">'
      + '<span class="menu-btn-wrap"><button class="icon-btn" data-open="menu" aria-label="Menu">' + ICON.menu + '</button></span>'
      + '<a class="logo" href="home.html"><span class="logo-dot" aria-hidden="true">✂</span>Crafts by Jon</a>'
      + '<nav class="nav-desk" aria-label="Shop">'
      + '<div><button class="nav-top" aria-haspopup="true">Shop by product</button><div class="dd">' + typeLinks + '</div></div>'
      + '<div><button class="nav-top" aria-haspopup="true">Shop by theme</button><div class="dd">' + colLinks + '</div></div>'
      + '<div><a class="nav-top" href="home.html#gifts">Gift finder</a></div>'
      + '<div><a class="nav-top" href="collection.html?c=new-in">New in</a></div>'
      + '<div><a class="nav-top" href="home.html#about">About Jon</a></div>'
      + '</nav><span class="spacer"></span>'
      + '<button class="search-desk" data-open="search">' + ICON.search.replace('<svg', '<svg width="20" height="20"') + 'Search mugs, Deal, teacher...</button>'
      + '<button class="icon-btn search-mob" data-open="search" aria-label="Search">' + ICON.search + '</button>'
      + '<button class="icon-btn" data-open="basket" aria-label="Basket">' + ICON.bag + '<span class="count" id="bkCount" hidden>0</span></button>'
      + '</div></header>'
      + '<div class="strip"><b>Free UK postage over £10</b> · Any 3 bookmarks or keyrings for £10</div>'
      + '<div class="scrim" id="scrim"></div>'
      // menu
      + '<aside class="sheet sheet-left" id="sh-menu" aria-label="Menu"><div class="sheet-head"><h2>Shop</h2><button class="icon-btn" data-close aria-label="Close">' + ICON.close + '</button></div><div class="sheet-body">'
      + '<button class="search-bar" data-open="search" style="width:100%;border:0;padding:0 0 14px;background:none"><span class="field" style="display:flex;align-items:center;gap:8px;color:var(--ink-3)">' + ICON.search.replace('<svg', '<svg width="20" height="20"') + 'Search the shop</span></button>'
      + '<div class="menu-group"><h3>Shop by product</h3>' + TYPES.map(function (t) {
          var n = data.catalogue.filter(function (p) { return p.type === t.type; }).length;
          return n ? '<a class="menu-link" href="' + typeLink(t) + '">' + t.name + '<span>' + n + '</span></a>' : ''; }).join('') + '</div>'
      + '<div class="menu-group"><h3>Shop by theme</h3>' + cols.map(function (c) { return '<a class="menu-link" href="' + collectionLink(c) + '">' + esc(c.name) + '<span>' + productsFor(c).length + '</span></a>'; }).join('') + '</div>'
      + '<div class="menu-group"><h3>More</h3><a class="menu-link" href="home.html#gifts">Gift finder</a><a class="menu-link" href="collection.html?c=new-in">New in</a><a class="menu-link" href="home.html#about">About Jon</a><a class="menu-link" href="home.html#delivery">Delivery & returns</a><a class="menu-link" href="/custom-orders.html">Custom orders</a></div>'
      + '</div></aside>'
      // search
      + '<div class="sheet search-sheet" id="sh-search" role="dialog" aria-label="Search"><div class="search-bar"><input id="q" type="search" placeholder="Search mugs, Deal, teacher, bee..." autocomplete="off" aria-label="Search the shop"><button class="icon-btn" data-close aria-label="Close search">' + ICON.close + '</button></div><div class="search-results" id="sr"></div></div>'
      // basket
      + '<aside class="sheet sheet-right" id="sh-basket" aria-label="Basket"><div class="sheet-head"><h2>Your basket</h2><button class="icon-btn" data-close aria-label="Close">' + ICON.close + '</button></div><div class="sheet-body" id="bk"></div></aside>'
      + '<div class="added" id="added" role="status"></div>'
    );

    document.body.insertAdjacentHTML('beforeend',
      '<footer class="foot"><div class="wrap foot-grid">'
      + '<div><div class="logo"><span class="logo-dot" aria-hidden="true">✂</span>Crafts by Jon</div><p style="margin:0;max-width:34ch">Original gifts from Deal, Kent. Handmade acrylic, and my designs printed to order. One person, plenty of chaos.</p></div>'
      + '<div><h3>Shop</h3><ul>' + TYPES.slice(0, 4).map(function (t) { return '<li><a href="' + typeLink(t) + '">' + t.name + '</a></li>'; }).join('') + '<li><a href="collection.html?c=all">Everything</a></li></ul></div>'
      + '<div><h3>Help</h3><ul><li><a href="home.html#delivery">Delivery & returns</a></li><li><a href="/custom-orders.html">Custom orders</a></li><li><a href="/terms.html">Terms</a></li><li><a href="/privacy.html">Privacy</a></li></ul></div>'
      + '<div><h3>Say hello</h3><ul><li><a href="mailto:jon@craftsbyjon.co.uk">jon@craftsbyjon.co.uk</a></li><li>Deal, Kent</li></ul></div>'
      + '</div></footer>');

    var scrim = $('#scrim');
    function closeAll() { document.querySelectorAll('.sheet.on').forEach(function (s) { s.classList.remove('on'); }); scrim.classList.remove('on'); document.body.style.overflow = ''; }
    function open(name) {
      closeAll();
      var s = $('#sh-' + name); if (!s) return;
      s.classList.add('on'); scrim.classList.add('on'); document.body.style.overflow = 'hidden';
      if (name === 'search') { renderSearch(''); setTimeout(function () { $('#q').focus(); }, 60); }
      if (name === 'basket') renderBasket();
    }
    window.CBJPV = { open: open, close: closeAll };
    document.addEventListener('click', function (e) {
      var o = e.target.closest('[data-open]'); if (o) { e.preventDefault(); open(o.getAttribute('data-open')); return; }
      if (e.target.closest('[data-close]') || e.target === scrim) { closeAll(); return; }
      var qa = e.target.closest('[data-quickadd]');
      if (qa) { e.preventDefault(); e.stopPropagation(); var p = byId[qa.getAttribute('data-quickadd')]; addToBasket(p, {}, ''); }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });
    $('#q').addEventListener('input', function () { renderSearch(this.value); });
    updateCount();
  }

  // ---------- search ----------
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9£ ]+/g, ' '); }
  function renderSearch(term) {
    var t = norm(term).trim(), out = '';
    if (!t) {
      out = '<div class="sr-head">Popular searches</div><div class="chip-row">'
        + ['Deal Castle', 'Pier', 'Teacher', 'Mug', 'Bee', 'T-shirt', 'Personalised', 'Under £5'].map(function (s) { return '<button class="chip" data-term="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>'
        + '<div class="sr-head">Shop by product</div><div class="chip-row">' + TYPES.map(function (x) { return '<a class="chip" href="' + typeLink(x) + '">' + x.name + '</a>'; }).join('') + '</div>';
      $('#sr').innerHTML = out; bindTerms(); return;
    }
    var words = t.split(/\s+/).filter(Boolean);
    var cols = visibleCollections().filter(function (c) { return words.every(function (w) { return norm(c.name).indexOf(w) !== -1; }); });
    var types = TYPES.filter(function (x) { return words.every(function (w) { return norm(x.name).indexOf(w.replace(/s$/, '')) !== -1; }); });
    var hits = data.catalogue.map(function (p) {
      var title = norm(p.title), hay = title + ' ' + norm(p.type) + ' ' + norm(p.collection) + ' ' + norm(p.tags) + (p.personalisable ? ' personalised personalise name' : '') + (p.price < 5 ? ' under £5 cheap stocking filler' : '');
      var score = 0;
      for (var i = 0; i < words.length; i++) {
        var w = words[i], ws = w.replace(/s$/, '');
        if (title.indexOf(ws) !== -1) score += 3; else if (hay.indexOf(ws) !== -1) score += 1; else return null;
      }
      return { p: p, s: score };
    }).filter(Boolean).sort(function (a, b) { return b.s - a.s; }).slice(0, 12);
    if (types.length || cols.length) out += '<div class="sr-head">Collections</div><div class="chip-row">'
      + types.map(function (x) { return '<a class="chip" href="' + typeLink(x) + '">' + x.name + '</a>'; }).join('')
      + cols.map(function (c) { return '<a class="chip" href="' + collectionLink(c) + '">' + esc(c.name) + ' <small>' + productsFor(c).length + '</small></a>'; }).join('') + '</div>';
    out += '<div class="sr-head">' + (hits.length ? 'Products' : 'No products match "' + esc(term) + '"') + '</div>';
    out += hits.map(function (h) {
      var p = h.p;
      return '<a class="sr-row" href="product.html?id=' + encodeURIComponent(p.id) + '">' + img(p.image, 400, '') + '<div><div class="t">' + esc(cleanTitle(p.title)) + '</div><div class="m">' + esc(p.type) + ' · ' + priceLabel(p).replace(/<[^>]+>/g, '') + '</div></div></a>';
    }).join('');
    if (!hits.length) out += '<p style="color:var(--ink-2)">Try "mug", "Deal" or "bee", or <a class="link" href="collection.html?c=all">browse everything</a>. Looking for something I don\'t make yet? <a class="link" href="/custom-orders.html">Ask about a custom order</a>.</p>';
    $('#sr').innerHTML = out; bindTerms();
  }
  function bindTerms() { document.querySelectorAll('[data-term]').forEach(function (b) { b.onclick = function () { $('#q').value = b.getAttribute('data-term'); renderSearch($('#q').value); }; }); }

  // ---------- pretend basket ----------
  function loadBasket() { try { return JSON.parse(localStorage.getItem(BASKET_KEY) || '[]'); } catch (e) { return []; } }
  function saveBasket(b) { try { localStorage.setItem(BASKET_KEY, JSON.stringify(b)); } catch (e) {} updateCount(); }
  function updateCount() {
    var n = loadBasket().reduce(function (a, l) { return a + l.qty; }, 0), el = $('#bkCount');
    if (el) { el.textContent = n; el.hidden = !n; }
  }
  function addToBasket(p, opts, pers) {
    var b = loadBasket(), key = p.id + '|' + JSON.stringify(opts) + '|' + pers;
    var line = b.filter(function (l) { return l.key === key; })[0];
    var unit = (data.details[p.id] && data.details[p.id].unit) || p.price;
    if (opts.__price) unit = opts.__price;
    if (pers && p.made === 'handmade') unit += PERS_UPLIFT;
    if (line) line.qty++; else b.push({ key: key, id: p.id, opts: opts, pers: pers, qty: 1, unit: unit });
    saveBasket(b);
    var a = $('#added');
    a.innerHTML = '✓ Added to basket <a href="#" data-open="basket">View basket</a>';
    a.classList.add('on'); clearTimeout(a._t); a._t = setTimeout(function () { a.classList.remove('on'); }, 3200);
  }
  function renderBasket() {
    var b = loadBasket(), el = $('#bk');
    if (!b.length) { el.innerHTML = '<div class="empty"><p style="font-size:18px;font-weight:800;margin:0 0 6px">Your basket is empty</p><p style="margin:0 0 16px">Have a look at Jon\'s picks or search for something.</p><a class="btn" href="collection.html?c=all">Browse the shop</a></div>'; return; }
    var sub = 0, acrylic = 0;
    var rows = b.map(function (l, i) {
      var p = byId[l.id]; if (!p) return '';
      sub += l.unit * l.qty;
      if (p.made === 'handmade' && !l.pers) acrylic += l.qty;
      var o = Object.keys(l.opts).filter(function (k) { return k.indexOf('__') !== 0; }).map(function (k) { return esc(l.opts[k]); }).join(', ');
      return '<div class="bk-line">' + img(p.image, 400, '') + '<div><div class="t">' + esc(cleanTitle(p.title)) + '</div><div class="o">' + (o || '') + (l.pers ? (o ? ' · ' : '') + '"' + esc(l.pers) + '"' : '') + '</div>'
        + '<div class="qty"><button data-q="' + i + '" data-d="-1" aria-label="One fewer">−</button><span>' + l.qty + '</span><button data-q="' + i + '" data-d="1" aria-label="One more">+</button></div></div><div style="font-weight:800">' + money(l.unit * l.qty) + '</div></div>';
    }).join('');
    var bundle = Math.floor(acrylic / 3) * (3 * 3.5 - 10);
    var total = sub - bundle;
    var left = Math.max(0, FREE_POST - total);
    var toBundle = (3 - (acrylic % 3)) % 3;
    el.innerHTML = rows
      + '<div style="margin-top:14px">'
      + (left > 0 ? '<div class="bk-note">Spend <b>' + money(left) + '</b> more for free UK postage</div>' : '<div class="bk-note"><b>Free UK postage</b> on this order</div>')
      + '<div class="progress"><i style="width:' + Math.min(100, total / FREE_POST * 100) + '%"></i></div>'
      + (acrylic ? '<div class="bk-note" style="margin-top:8px">' + (toBundle ? 'Add ' + toBundle + ' more bookmark' + (toBundle > 1 ? 's or keyrings' : ' or keyring') + ' for 3 for £10' : '3 for £10 applied') + '</div>' : '')
      + (bundle ? '<div class="bk-note" style="display:flex;justify-content:space-between"><span>3 for £10 saving</span><b>−' + money(bundle) + '</b></div>' : '')
      + '<div class="bk-total"><span>Total</span><span>' + money(total) + '</span></div>'
      + '<button class="btn block" disabled>Checkout is switched off in the preview</button>'
      + '<p class="bk-note" style="text-align:center;margin-top:8px">In the real shop: promo code, gift message and the new-products email box stay here, then secure payment with Stripe.</p></div>';
    el.querySelectorAll('[data-q]').forEach(function (btn) {
      btn.onclick = function () {
        var bb = loadBasket(), i = +btn.getAttribute('data-q'); bb[i].qty += +btn.getAttribute('data-d');
        if (bb[i].qty <= 0) bb.splice(i, 1); saveBasket(bb); renderBasket();
      };
    });
  }

  // ---------- pages ----------
  function homePage() {
    var m = $('#main');
    var picks = PICKS.map(function (id) { return byId[id]; }).filter(Boolean);
    var newIn = productsFor(COLLECTIONS.filter(function (c) { return c.slug === 'new-in'; })[0]);
    var tiles = COLLECTIONS.filter(function (c) { return c.home; }).sort(function (a, b) { return a.home - b.home; })
      .filter(function (c) { return productsFor(c).length; }).slice(0, 6);
    var gift = COLLECTIONS.filter(function (c) { return c.slug === 'gift-ideas'; })[0];
    var seasonOn = MONTH >= 10 && MONTH <= 12;
    m.innerHTML =
      '<section class="hero"><div class="wrap hero-grid"><div>'
      + '<div class="eyebrow">Made in Deal, Kent</div>'
      + '<h1>Original gifts, <em>designed in Deal.</em></h1>'
      + '<p class="lede">Acrylic bookmarks and keyrings I make by hand, plus mugs, tees, prints and totes with my designs, printed to order.</p>'
      + '<div class="ctas"><a class="btn" href="collection.html?c=all">Shop gifts</a><a class="btn alt" href="collection.html?c=personalised-gifts">Personalise something</a></div>'
      + '<div class="trust"><div><b>Free UK post</b>over £10</div><div><b>3 for £10</b>bookmarks & keyrings</div><div><b>From £3.50</b>made in Deal, Kent</div></div>'
      + '</div><div class="collage">'
      + '<a href="product.html?id=pod-print-pier">' + img(IMG + '/products/1787347223862-pier-lifestyle_living_room.jpeg', 800, 'Pier art print on a living room wall') + '<span class="tag">Pier print</span></a>'
      + '<a href="product.html?id=mug-010">' + img(IMG + '/products/mug-010-scene01.jpeg', 400, 'Deal Pier mug') + '<span class="tag">Mugs</span></a>'
      + '<a href="product.html?id=bookmark-011">' + img(IMG + '/products/bookmark-011.jpg', 400, 'Deal Pier Sunrise acrylic bookmark') + '<span class="tag">Handmade</span></a>'
      + '</div></div></section>'

      + '<section class="sec"><div class="wrap"><div class="sec-h"><div><h2>Shop by collection</h2></div><a class="link" href="collection.html?c=all">See everything</a></div><div class="tiles">'
      + tiles.map(function (c) {
          var n = productsFor(c).length;
          var pic = c.image || (productsFor(c)[0] || {}).image;
          return '<a class="tile" href="' + collectionLink(c) + '">' + img(pic, 800, '') + '<div class="lbl"><b>' + esc(c.name) + '</b><span>' + n + ' ' + (n === 1 ? 'gift' : 'gifts') + '</span></div></a>';
        }).join('') + '</div></div></section>'

      + (seasonOn && gift ? '<section class="wrap"><a class="season" href="' + collectionLink(gift) + '"><div><b>🎄 Christmas gift ideas</b><span>Everything ready to give, coaster sets and totes first</span></div><span aria-hidden="true" style="font-size:26px">→</span></a></section>' : '')

      + '<section class="sec"><div class="wrap"><div class="sec-h"><div><h2>Jon\'s picks</h2><p>The ones I\'d buy if I didn\'t already own them.</p></div></div><div class="rail">' + picks.map(card).join('') + '</div></div></section>'

      + '<section class="sec" id="gifts" style="background:var(--card)"><div class="wrap"><div class="sec-h"><div><h2>Find a gift</h2><p>Pick a budget, a person or a thing they love.</p></div></div>'
      + giftFinder() + '</div></section>'

      + (newIn.length ? '<section class="sec"><div class="wrap"><div class="sec-h"><div><h2>New in</h2></div><a class="link" href="collection.html?c=new-in">See all</a></div><div class="rail">' + newIn.map(card).join('') + '</div></div></section>' : '')

      + '<section class="sec"><div class="wrap"><div class="sec-h"><div><h2>What\'s made where</h2><p>Straight answer, because you should know what you\'re buying.</p></div></div><div class="made">'
      + '<div class="h">' + img(IMG + '/products/keyring-014.jpg', 400, '') + '<div><h3>Handmade by me</h3><p>Bookmarks and keyrings. I apply the design to the acrylic, then cut, finish and pack each one by hand at home in Deal. Posted by me within 1 to 2 business days.</p><p style="margin-top:8px"><a class="link" href="collection.html?c=handmade-gifts">Shop handmade</a></p></div></div>'
      + '<div class="p">' + img(IMG + '/products/mug-005-default.jpeg', 400, '') + '<div><h3>Printed to order</h3><p>Mugs, t-shirts, prints, totes and coasters. My designs, printed by my print partner when you order and sent straight to you. Dispatched within 3 to 4 working days.</p><p style="margin-top:8px"><a class="link" href="collection.html?c=retro-deal">Shop Retro Deal</a></p></div></div>'
      + '</div></div></section>'

      + '<section class="sec" id="about"><div class="wrap"><div class="about">' + '<img src="' + IMG + '/image-7.JPG" alt="Jon, the person behind Crafts by Jon" loading="lazy">'
      + '<div><div class="eyebrow">Who\'s behind this?</div><h2>I make things. In Deal. In chaos.</h2>'
      + '<p>I\'m Jon, based in Deal, Kent, and this is my outlet for what I like doing best: designing and making things.</p>'
      + '<p>It started in spring 2026, flat on my back after ankle surgery, needing something to do that wasn\'t staring at the ceiling. The Bee Collection came first. Then I couldn\'t stop.</p>'
      + '<p style="margin:0">One person, not a team. Just me, a mostly-better ankle and a slightly manic grin.</p></div></div></div></section>'

      + '<section class="sec"><div class="wrap"><div class="sec-h"><div><h2>What customers said</h2><p>Real messages and Facebook recommendations. First names only.</p></div></div><div class="quotes">'
      + REVIEWS.map(function (r) { return '<blockquote class="quote"><p>"' + esc(r.q) + '"</p><footer><b>' + esc(r.n) + '</b>, ' + esc(r.s) + '</footer></blockquote>'; }).join('') + '</div></div></section>'

      + '<section class="sec" id="delivery"><div class="wrap"><div class="sec-h"><div><h2>Delivery & returns</h2></div></div><div class="facts">'
      + '<div><b>£1.55</b>Royal Mail 2nd Class</div><div><b>£3.30</b>Royal Mail 1st Class</div><div><b>Free</b>2nd Class on orders over £10</div><div><b>UK only</b>for now</div>'
      + '<div><b>1 to 2 business days</b>handmade items dispatched</div><div><b>3 to 4 working days</b>printed items dispatched</div><div><b>14 days</b>to change your mind (not personalised items)</div><div><b>Faulty?</b>replacement or full refund</div>'
      + '</div></div></section>';
    bindGiftFinder();
  }

  function giftFinder() {
    var groups = [
      ['Budget', [['Under £5', 'under-5'], ['Under £15', null, 'price15'], ['All gifts', 'all']]],
      ['Who for', [['Teachers', 'teachers'], ['Book lovers', 'book-lovers'], ['Deal locals & leavers', 'retro-deal'], ['Birthdays', 'birthday-gifts']]],
      ['What kind', [['Personalised', 'personalised-gifts'], ['Handmade', 'handmade-gifts'], ['Something to wear', 't-shirts-clothing'], ['For the wall', null, 'prints']]]
    ];
    return groups.map(function (g) {
      var chips = g[1].map(function (c) {
        var col = c[1] && COLLECTIONS.filter(function (x) { return x.slug === c[1]; })[0];
        if (col && !productsFor(col).length) return '';
        var href = col ? collectionLink(col) : c[2] === 'prints' ? 'collection.html?t=prints' : 'collection.html?c=all&max=15';
        return '<a class="chip" href="' + href + '">' + esc(c[0]) + '</a>';
      }).join('');
      return '<div style="margin-bottom:14px"><div class="sr-head" style="margin-top:0">' + g[0] + '</div><div class="chip-row">' + chips + '</div></div>';
    }).join('');
  }
  function bindGiftFinder() {}

  function collectionPage() {
    var slug = q('c'), tslug = q('t'), max = parseFloat(q('max')) || null;
    var c = slug ? COLLECTIONS.filter(function (x) { return x.slug === slug; })[0] : null;
    var t = tslug ? TYPES.filter(function (x) { return x.slug === tslug; })[0] : null;
    if (!c && !t) c = COLLECTIONS.filter(function (x) { return x.slug === 'all'; })[0];
    var base = c ? productsFor(c) : data.catalogue.filter(function (p) { return p.type === t.type; });
    if (max) base = base.filter(function (p) { return p.price <= max; });
    var title = c ? c.name : t.name, intro = c ? c.intro : typeIntro(t);
    var hero = (c && c.image) || (base[0] && (data.details[base[0].id].images[1] || base[0].image));
    document.title = title + ' | Crafts by Jon (preview)';
    var state = { type: '', made: '', pers: false, sort: 'jon', shown: 24, price: '' };

    var m = $('#main');
    m.innerHTML = '<section class="col-hero">' + (hero ? img(hero, 800, '') : '') + '<div class="in"><div class="crumbs"><a href="home.html">Home</a> › ' + (t ? '<a href="collection.html?c=all">Shop</a> › ' : '') + esc(title) + '</div>'
      + '<h1>' + esc(title) + (max ? ' under £' + max : '') + '</h1>' + (intro ? '<p>' + esc(intro) + '</p>' : '') + '</div></section>'
      + '<div class="tools"><div class="wrap tools-in"><div class="chip-row" id="typeChips"></div>'
      + '<button class="chip" id="filterBtn" data-open="filters">Filter</button></div></div>'
      + '<div class="wrap"><div class="result-n" id="resN"></div><div class="grid" id="grid"></div><div class="more" id="more"></div></div>'
      + '<aside class="sheet sheet-bottom" id="sh-filters" aria-label="Filters"><div class="sheet-head"><h2>Filter & sort</h2><button class="icon-btn" data-close aria-label="Close">' + ICON.close + '</button></div><div class="sheet-body" id="filterBody"></div></aside>';

    function filtered() {
      var list = base.filter(function (p) {
        if (state.type && p.type !== state.type) return false;
        if (state.made && p.made !== state.made) return false;
        if (state.pers && !p.personalisable) return false;
        if (state.price === 'u5' && p.price >= 5) return false;
        if (state.price === '5-15' && (p.price < 5 || p.price > 15)) return false;
        if (state.price === 'o15' && p.price <= 15) return false;
        return true;
      });
      if (state.sort === 'low') list = list.slice().sort(function (a, b) { return a.price - b.price; });
      if (state.sort === 'high') list = list.slice().sort(function (a, b) { return b.price - a.price; });
      if (state.sort === 'new') list = list.slice().sort(function (a, b) { return (b.type === 'Tote Bag') - (a.type === 'Tote Bag'); });
      return list;
    }
    function activeCount() { return (state.made ? 1 : 0) + (state.pers ? 1 : 0) + (state.price ? 1 : 0) + (state.sort !== 'jon' ? 1 : 0); }
    function draw() {
      var list = filtered();
      var types = {};
      base.forEach(function (p) { types[p.type] = (types[p.type] || 0) + 1; });
      var tk = Object.keys(types);
      $('#typeChips').innerHTML = t ? '' : (tk.length > 1 ? '<button class="chip' + (!state.type ? ' on' : '') + '" data-type="">All <small>' + base.length + '</small></button>'
        + TYPES.filter(function (x) { return types[x.type]; }).map(function (x) { return '<button class="chip' + (state.type === x.type ? ' on' : '') + '" data-type="' + esc(x.type) + '">' + x.name + ' <small>' + types[x.type] + '</small></button>'; }).join('') : '');
      if (t) $('#typeChips').innerHTML = ['handmade', 'printed'].filter(function (k) { return base.some(function (p) { return p.made === k; }); }).length > 1 ? '' : '<span class="result-n" style="margin:0">' + base.length + ' designs</span>';
      var n = activeCount();
      $('#filterBtn').innerHTML = 'Filter' + (n ? ' (' + n + ')' : '');
      $('#resN').textContent = list.length + (list.length === 1 ? ' gift' : ' gifts');
      if (!list.length) {
        $('#grid').innerHTML = '';
        $('#more').innerHTML = '<div class="empty" style="padding:20px 0"><p style="font-size:18px;font-weight:800;color:var(--ink);margin:0 0 6px">Nothing matches that yet.</p><p style="margin:0 0 14px">Try clearing a filter. Or here are a few of Jon\'s picks.</p><button class="btn alt" id="clearAll">Clear filters</button></div><div class="grid">' + PICKS.slice(0, 4).map(function (id) { return card(byId[id]); }).join('') + '</div>';
        $('#clearAll').onclick = function () { state = { type: '', made: '', pers: false, sort: 'jon', shown: 24, price: '' }; draw(); drawFilters(); };
        return;
      }
      $('#grid').innerHTML = list.slice(0, state.shown).map(card).join('');
      $('#more').innerHTML = list.length > state.shown
        ? 'Showing ' + state.shown + ' of ' + list.length + '<button class="btn alt" id="moreBtn">Show more</button>'
        : (list.length > 8 ? 'That\'s all ' + list.length + '. <a class="link" href="collection.html?c=all">Browse everything</a>' : '');
      var mb = $('#moreBtn'); if (mb) mb.onclick = function () { state.shown += 24; draw(); };
      document.querySelectorAll('[data-type]').forEach(function (b) { b.onclick = function () { state.type = b.getAttribute('data-type'); state.shown = 24; draw(); }; });
    }
    function opt(group, val, label, on) { return '<button class="chip' + (on ? ' on' : '') + '" data-f="' + group + '" data-v="' + val + '">' + label + '</button>'; }
    function drawFilters() {
      $('#filterBody').innerHTML =
        '<div class="filter-group"><h3>Sort</h3><div class="chip-row">' + opt('sort', 'jon', 'Jon\'s order', state.sort === 'jon') + opt('sort', 'new', 'Newest', state.sort === 'new') + opt('sort', 'low', 'Price: low to high', state.sort === 'low') + opt('sort', 'high', 'Price: high to low', state.sort === 'high') + '</div></div>'
        + '<div class="filter-group"><h3>Price</h3><div class="chip-row">' + opt('price', '', 'Any', !state.price) + opt('price', 'u5', 'Under £5', state.price === 'u5') + opt('price', '5-15', '£5 to £15', state.price === '5-15') + opt('price', 'o15', 'Over £15', state.price === 'o15') + '</div></div>'
        + '<div class="filter-group"><h3>How it\'s made</h3><div class="chip-row">' + opt('made', '', 'Both', !state.made) + opt('made', 'handmade', 'Handmade by Jon', state.made === 'handmade') + opt('made', 'printed', 'Printed to order', state.made === 'printed') + '</div></div>'
        + '<div class="filter-group"><h3>Personalisation</h3><div class="chip-row">' + opt('pers', '', 'Show all', !state.pers) + opt('pers', '1', 'Can be personalised', state.pers) + '</div></div>'
        + '<button class="btn block" data-close>Show ' + filtered().length + ' gifts</button>';
      document.querySelectorAll('[data-f]').forEach(function (b) {
        b.onclick = function () {
          var f = b.getAttribute('data-f'), v = b.getAttribute('data-v');
          state[f] = f === 'pers' ? !!v : v; state.shown = 24; draw(); drawFilters();
        };
      });
    }
    draw(); drawFilters();
  }
  function typeIntro(t) {
    return {
      'Mug': 'White ceramic mugs with my designs, printed to order. Retro Deal landmarks, plus teacher mugs with a name on.',
      'T-Shirt': 'Cotton tees with my Deal designs on the front. Printed to order in your size and colour.',
      'Print': 'Square art prints of my Deal designs, framed or unframed, in sizes from 25 cm to 70 cm.',
      'Tote Bag': 'Cotton tote bags in five colours, with or without the place name.',
      'Coaster Set': 'Sets of four cork-backed coasters with Deal landmarks.',
      'Bookmark': 'Acrylic bookmarks I make by hand. Any 3 bookmarks or keyrings for £10.',
      'Keyring': 'Acrylic keyrings I make by hand. Any 3 bookmarks or keyrings for £10.'
    }[t.type] || '';
  }

  function productPage() {
    var id = q('id') || 'mug-005';
    var p = byId[id];
    var m = $('#main');
    if (!p) {
      m.innerHTML = '<div class="wrap empty"><h1 style="font-size:28px;margin:30px 0 10px">That one isn\'t in the shop any more.</h1><p>It might be sold out or retired. Here are some similar things.</p><div class="grid" style="margin-top:18px">' + PICKS.slice(0, 4).map(function (x) { return card(byId[x]); }).join('') + '</div></div>';
      return;
    }
    var d = data.details[id] || { images: [p.image], options: {}, bullets: [], description: '' };
    var col = primaryCollectionOf(p), typ = typeOf(p);
    var images = d.images.length ? d.images : [p.image];
    document.title = cleanTitle(p.title) + ' | Crafts by Jon (preview)';
    var choice = {};
    var optNames = Object.keys(d.options).filter(function (k) { return d.options[k].length > 1; });
    optNames.forEach(function (k) { if (k === 'Size' && p.type === 'T-Shirt') d.options[k].sort(function (a, b) { return SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b); }); });
    // Defaults the live pickers use: first colour and "No" text are preselected; size is left for the customer.
    optNames.forEach(function (k) { if (k !== 'Size') choice[k] = d.options[k][0]; });
    var isMugPers = p.type === 'Mug' && p.personalisable;
    var isAcrylicPers = p.made === 'handmade' && p.personalisable;

    var siblings = data.catalogue.filter(function (x) { return p.designKey && x.designKey === p.designKey && x.id !== p.id; });
    var seenTypes = {}; siblings = siblings.filter(function (x) { if (seenTypes[x.type]) return false; seenTypes[x.type] = 1; return true; });
    var related = data.catalogue.filter(function (x) { return x.id !== p.id && x.collection === p.collection && siblings.indexOf(x) === -1; });
    related = related.sort(function (a, b) { return (b.type === p.type) - (a.type === p.type); }).slice(0, 8);

    var madeBox = p.made === 'handmade'
      ? '<div class="made-box hand"><b>Handmade by Jon in Deal</b>I apply the design to the acrylic, then cut, finish and pack it by hand at home in Deal, Kent.' + (p.original ? ' Original design by me.' : '') + '</div>'
      : '<div class="made-box print"><b>Printed to order</b>My design, printed for you by my print partner when you order, and posted straight to you.' + (p.original ? '' : '') + '</div>';
    var ship = p.made === 'handmade'
      ? 'Ships within <b>1 to 2 business days</b>, posted by me. Free UK postage over £10.'
      : 'Printed to order, ships within <b>3 to 4 working days</b>. Free UK postage over £10.';

    m.innerHTML = '<div class="wrap"><div class="pdp">'
      + '<div><div class="gal"><div class="gal-main" id="galMain">' + images.map(function (u, i) { return img(u, 800, cleanTitle(p.title) + ' picture ' + (i + 1), i ? '' : ' fetchpriority="high"').replace(' loading="lazy"', i ? ' loading="lazy"' : ''); }).join('') + '</div>'
      + (images.length > 1 ? '<div class="gal-dots" id="galDots">' + images.map(function (u, i) { return '<i class="' + (i ? '' : 'on') + '"></i>'; }).join('') + '</div><div class="gal-thumbs">' + images.map(function (u, i) { return '<button data-g="' + i + '" class="' + (i ? '' : 'on') + '" aria-label="Picture ' + (i + 1) + '">' + img(u, 400, '') + '</button>'; }).join('') + '</div>' : '')
      + '</div></div>'
      + '<div class="pdp-info">'
      + '<div class="crumbs"><a href="home.html">Home</a>' + (col ? ' › <a href="' + collectionLink(col) + '">' + esc(col.name) + '</a>' : '') + (typ ? ' › <a href="' + typeLink(typ) + '">' + typ.name + '</a>' : '') + '</div>'
      + '<h1>' + esc(p.title) + '</h1>'
      + '<div class="price-row"><span class="price-big" id="price">' + money(d.priceFrom || p.price) + '</span>' + madeBadge(p) + (p.stockLeft != null && p.stockLeft < 2 ? '<span class="low">' + p.stockLeft + ' left of this design</span>' : '') + '</div>'
      + madeBox
      + optNames.map(function (k) {
          var vals = d.options[k];
          var sw = k === 'Colour' && vals.every(function (v) { return SWATCH[v]; });
          return '<div class="opt" data-opt="' + esc(k) + '"><div class="opt-h">' + esc(k) + ' <span data-sel>' + esc(choice[k] || 'Choose') + '</span></div><div class="opts">'
            + vals.map(function (v) {
                var on = choice[k] === v ? ' on' : '';
                return sw ? '<button class="swatch' + on + '" style="background:' + SWATCH[v] + '" data-v="' + esc(v) + '" aria-label="' + esc(v) + '"></button>'
                  : '<button class="opt-btn' + on + '" data-v="' + esc(v) + '">' + esc(k === 'Text' ? (v === 'Yes' ? 'With place name' : 'Design only') : v) + '</button>';
              }).join('') + '</div>' + (k === 'Size' && p.type === 'T-Shirt' ? '<div class="field-note"><a class="link" href="#details">Size guide</a></div>' : '') + '</div>';
        }).join('')
      + (isAcrylicPers ? '<div class="opt"><label class="opt-h" for="pers">Add a name or message <span>optional, +£1.50</span></label><input class="field" id="pers" maxlength="30" placeholder="e.g. Miss Smith"><div class="field-note" id="persN">Up to 30 characters</div></div>' : '')
      + (isMugPers ? '<div class="opt"><label class="opt-h" for="mugName">Name on the mug <span>up to 20 characters</span></label><input class="field" id="mugName" maxlength="20" placeholder="e.g. Miss Smith"></div>'
          + '<div class="opt"><label class="opt-h" for="mugMsg">Message</label><select class="field" id="mugMsg">' + d.mugMessages.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '</select><div class="field-note">Text colour choice stays as it is in the live shop.</div></div>' : '')
      + '<div class="buy"><button class="btn block" id="addBtn"></button></div>'
      + '<div class="ship-line">' + ICON.van + '<span>' + ship + '</span></div>'
      + (p.made === 'handmade' ? '<div class="ship-line">' + ICON.hand + '<span>Any 3 bookmarks or keyrings for £10, mix and match.</span></div>' : '')
      + (col ? '<div class="fb-hint"><span>More from <b>' + esc(col.name) + '</b></span><a class="link" href="' + collectionLink(col) + '">See all ' + productsFor(col).length + '</a></div>' : '')
      + (siblings.length ? '<div class="opt"><div class="opt-h">Love this design? Also on</div><div class="also">' + siblings.map(function (x) { return '<a href="product.html?id=' + encodeURIComponent(x.id) + '">' + img(x.image, 400, '') + '<span>' + esc((typeOf(x) || {}).name || x.type) + '</span></a>'; }).join('') + '</div></div>' : '')
      + '<details class="acc" open><summary>Description</summary><div class="in">' + esc(d.description || p.short).replace(/\n+/g, '<br><br>') + '</div></details>'
      + '<details class="acc" id="details"><summary>Details</summary><div class="in"><ul>' + d.bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + (d.material ? '<li>Material: ' + esc(d.material) + '</li>' : '') + '</ul></div></details>'
      + '<details class="acc"><summary>Delivery & returns</summary><div class="in"><p style="margin-top:0">Royal Mail 2nd Class £1.55, 1st Class £3.30, free 2nd Class over £10. UK only.</p><p>' + (p.made === 'handmade' ? 'Handmade items are dispatched by me within 1 to 2 business days.' : 'Printed items are made when you order and dispatched within 3 to 4 working days, straight from my print partner.') + '</p><p style="margin-bottom:0">You can change your mind within 14 days of receiving your order, except for personalised items. Faulty? I\'ll replace it or refund you in full. <a class="link" href="/terms.html#returns">Full terms</a></p></div></details>'
      + '</div></div>'
      + (related.length ? '<section class="sec"><div class="sec-h"><div><h2>You might also like</h2></div>' + (col ? '<a class="link" href="' + collectionLink(col) + '">See all</a>' : '') + '</div><div class="rail">' + related.map(card).join('') + '</div></section>' : '')
      + '</div>'
      + '<div class="sticky-buy" id="stickyBuy"><div class="t"><b>' + esc(cleanTitle(p.title)) + '</b><span id="stickyPrice"></span></div><button class="btn" id="stickyBtn" style="min-height:46px">Add to basket</button></div>';

    function price() {
      var unit = d.priceFrom || p.price;
      var pers = $('#pers') && $('#pers').value.trim();
      if (pers) unit += PERS_UPLIFT;
      return unit;
    }
    function missing() { return optNames.filter(function (k) { return !choice[k]; })[0]; }
    function sync() {
      var miss = missing(), btn = $('#addBtn');
      btn.textContent = miss ? 'Choose a ' + miss.toLowerCase() : 'Add to basket · ' + money(price());
      btn.classList.toggle('alt', !!miss);
      $('#price').textContent = money(price());
      $('#stickyPrice').textContent = money(price());
      $('#stickyBtn').textContent = miss ? 'Choose ' + miss.toLowerCase() : 'Add to basket';
    }
    function add() {
      var miss = missing();
      if (miss) { var el = document.querySelector('[data-opt="' + miss + '"]'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.querySelector('.opt-h').style.color = 'var(--coral-ink)'; return; }
      var opts = {}; optNames.forEach(function (k) { opts[k] = choice[k]; });
      if (isMugPers) { var nm = $('#mugName').value.trim(); if (nm) opts.Name = nm; opts.Message = $('#mugMsg').value; }
      addToBasket(p, opts, $('#pers') ? $('#pers').value.trim() : '');
    }
    document.querySelectorAll('[data-opt]').forEach(function (g) {
      var k = g.getAttribute('data-opt');
      g.querySelectorAll('[data-v]').forEach(function (b) {
        b.onclick = function () {
          choice[k] = b.getAttribute('data-v');
          g.querySelectorAll('[data-v]').forEach(function (x) { x.classList.toggle('on', x === b); });
          g.querySelector('[data-sel]').textContent = choice[k];
          g.querySelector('.opt-h').style.color = '';
          sync();
        };
      });
    });
    if ($('#pers')) $('#pers').addEventListener('input', function () { $('#persN').textContent = (30 - this.value.length) + ' characters left'; sync(); });
    $('#addBtn').onclick = add; $('#stickyBtn').onclick = add;
    sync();

    var gm = $('#galMain');
    if (gm && images.length > 1) {
      gm.addEventListener('scroll', function () {
        var i = Math.round(gm.scrollLeft / gm.clientWidth);
        document.querySelectorAll('#galDots i').forEach(function (x, j) { x.classList.toggle('on', i === j); });
        document.querySelectorAll('.gal-thumbs button').forEach(function (x, j) { x.classList.toggle('on', i === j); });
      }, { passive: true });
      document.querySelectorAll('[data-g]').forEach(function (b) { b.onclick = function () { gm.scrollTo({ left: gm.clientWidth * +b.getAttribute('data-g'), behavior: 'smooth' }); }; });
    }
    var sb = $('#stickyBuy');
    // On a phone the Add button is usually below the first screen, so the bar shows whenever the button is off screen.
    new IntersectionObserver(function (es) { sb.classList.toggle('on', !es[0].isIntersecting); }).observe($('#addBtn'));
  }

  // ---------- boot ----------
  fetch('data/snapshot.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
    data = j;
    j.catalogue.forEach(function (p) { byId[p.id] = p; });
    j.collections.forEach(function (c) { monthsByCol[c.name] = c.months; });
    chrome();
    var page = document.body.getAttribute('data-page');
    if (page === 'home') homePage();
    if (page === 'collection') collectionPage();
    if (page === 'product') productPage();
  }).catch(function (e) {
    document.getElementById('main').innerHTML = '<div class="wrap empty">The preview data did not load (' + esc(e.message) + ').</div>';
  });
})();
