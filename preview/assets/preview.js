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
  function priceLabel(p) {
    var d = data.details[p.id] || {};
    if (d.priceFrom && d.options && (d.options.Size || d.options.Frame) && p.type === 'Print') return '<small>from</small> ' + money(d.priceFrom);
    return money(d.priceFrom || p.price);
  }
  function madeBadge(p) {
    // Cards only flag the handmade pieces. Printed items say "Printed to order" once, on their own page.
    return p.made === 'handmade' ? '<span class="badge hand">Handmade</span>' : '';
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

  // Shorter display names. The original catalogue title stays the product's title for SEO (page <title>, meta,
  // JSON-LD) and in the database; in the real build Jon can override this per product (a display_title field).
  var NOUN = /\b(mug|bookmark|keyring|print|t-shirt|tote bag|coaster set)\b/i;
  var SEP = /\s+[|–—]\s+|,\s+/;
  var DROP = /^(clear or black|crafts by jon|deal, kent)$/i;
  function nameParts(t) {
    return String(t || '').replace(/\s+by Crafts by Jon$/i, '').split(SEP).map(function (x) { return x.trim(); }).filter(function (x) { return x && !DROP.test(x); });
  }
  function shortName(t) {
    var parts = nameParts(t), out = [];
    for (var i = 0; i < parts.length; i++) { out.push(parts[i]); if (NOUN.test(out.join(', '))) break; }
    return out.join(', ');
  }
  var names = {};
  function buildNames() {
    var count = {};
    data.catalogue.forEach(function (p) { var s = shortName(p.title).toLowerCase(); count[s] = (count[s] || 0) + 1; });
    // Where two products would share a short name, show the whole title minus the filler instead.
    data.catalogue.forEach(function (p) { var s = shortName(p.title); names[p.id] = count[s.toLowerCase()] > 1 ? nameParts(p.title).join(', ') : s; });
  }
  function name(p) { return names[p.id] || p.title; }

  // Descriptive alt text from what the picture file is (front, worn, on a wall...). Never guesses beyond that.
  var VIEWS = [[/lifestyle_living_room/, 'on a living room wall'], [/lifestyle_bedroom/, 'on a bedroom wall'], [/lifestyle_male/, 'worn by a man'],
    [/lifestyle_female/, 'worn by a woman'], [/front_alt/, 'front, close up'], [/front/, 'front view'], [/-right\b/, 'side view'], [/wrap/, 'full wraparound design'],
    [/scene0?1/, 'in use'], [/scene0?2/, 'in use, second photo'], [/size-chart/, 'size chart'], [/-flat\b/, 'the artwork'], [/(\d)bl$|-black/, 'black finish'], [/colours/, 'all five colours']];
  var COLOURS = { 'navy': 'navy', 'french-navy': 'French navy', 'sand': 'sand', 'white': 'white', 'natural-raw': 'natural', 'natural': 'natural', 'rs-sport-grey': 'grey', 'anthracite': 'anthracite', 'black': 'black' };
  function altFor(p, url) {
    var k = keyOf(url).toLowerCase(), bits = [name(p)];
    if (/size-chart/.test(k)) return 'T-shirt size chart';
    var colour = Object.keys(COLOURS).filter(function (c) { return k.indexOf('-' + c + '-') !== -1; }).sort(function (a, b) { return b.length - a.length; })[0];
    if (colour && p.type !== 'Print') bits.push(COLOURS[colour]);
    var v = VIEWS.filter(function (x) { return x[0].test(k); })[0];
    if (v && !(v[1] === 'black finish' && colour === 'black')) bits.push(v[1]);
    return bits.join(', ');
  }

  // A card's quick "+" only for products the live store also adds straight from a card (no finish, colour, size,
  // text, photo or personalisation to choose). Everything else opens the product page.
  function canQuickAdd(p) { var d = data.details[p.id]; return !!(d && d.quickAdd) && !p.personalisable; }

  // ---------- card ----------
  function card(p) {
    var plus = !canQuickAdd(p)
      ? '<button class="qv-btn" type="button" data-quickview="' + esc(p.id) + '" aria-label="Choose options for ' + esc(name(p)) + '">Options</button>' :
      '<button class="icon-btn" style="position:absolute;right:8px;top:8px;background:#fff;width:38px;height:38px;box-shadow:var(--shadow)" aria-label="Add ' + esc(name(p)) + ' to basket" data-quickadd="' + esc(p.id) + '">' + ICON.plus + '</button>';
    var low = p.stockLeft != null && p.stockLeft < 2 ? '<span class="low">' + p.stockLeft + ' left</span>' : '';
    return '<div class="card"><a class="card-a" href="product.html?id=' + encodeURIComponent(p.id) + '">'
      + '<div class="ph">' + img(p.image, 400, altFor(p, p.image)) + '</div>'
      + '<div class="bd">' + madeBadge(p)
      + '<div class="tt">' + esc(name(p)) + '</div>'
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
      + '<div class="strip"><b>Free UK postage over £10</b> · <span class="long">Any 3 bookmarks or keyrings for £10</span><span class="short">3 for £10 acrylics</span></div>'
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
      + '<div class="sheet sheet-bottom qv-sheet" id="sh-quick" role="dialog" aria-modal="true" aria-label="Quick view"><div class="sheet-head"><span class="eyebrow" style="margin:0">Quick view</span><button class="icon-btn" data-close aria-label="Close quick view">' + ICON.close + '</button></div><div class="sheet-body" id="qvBody"></div></div>'
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
    var opener = null;
    function closeAll() {
      var was = document.querySelector('.sheet.on');
      document.querySelectorAll('.sheet.on').forEach(function (s) { s.classList.remove('on'); s.setAttribute('inert', ''); }); scrim.classList.remove('on'); document.body.style.overflow = '';
      if (was && was.id === 'sh-quick') setTimeout(function () { $('#qvBody').innerHTML = ''; }, 250);
      if (was && opener && document.contains(opener)) opener.focus({ preventScroll: true });
      opener = null;
    }
    function open(name) {
      var from = document.activeElement;
      closeAll();
      opener = from;
      var s = $('#sh-' + name); if (!s) return;
      s.removeAttribute('inert'); s.classList.add('on'); scrim.classList.add('on'); document.body.style.overflow = 'hidden';
      if (name === 'search') { renderSearch(''); setTimeout(function () { $('#q').focus(); }, 60); }
      if (name === 'basket') renderBasket();
    }
    document.querySelectorAll('.sheet').forEach(function (s) { s.setAttribute('inert', ''); });
    window.CBJPV = { open: open, close: closeAll };
    document.addEventListener('click', function (e) {
      var o = e.target.closest('[data-open]'); if (o) { e.preventDefault(); open(o.getAttribute('data-open')); return; }
      if (e.target.closest('[data-close]') || e.target === scrim) { closeAll(); return; }
      var qv = e.target.closest('[data-quickview]');
      if (qv) { e.preventDefault(); e.stopPropagation(); openQuickView(byId[qv.getAttribute('data-quickview')]); return; }
      var qa = e.target.closest('[data-quickadd]');
      if (qa) {
        e.preventDefault(); e.stopPropagation();
        var p = byId[qa.getAttribute('data-quickadd')];
        // Second guard: never add something that needs a choice; send the shopper to choose instead.
        if (!canQuickAdd(p)) { location.href = 'product.html?id=' + encodeURIComponent(p.id); return; }
        addToBasket(p, {}, '');
      }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });
    $('#q').addEventListener('input', function () { renderSearch(this.value); });
    updateCount();
  }

  // ---------- search ----------
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9£ ]+/g, ' '); }
  // Words customers use for each product type, and a one-letter typo check for longer words.
  var SYNONYMS = {
    'T-Shirt': 'tee tees tshirt tshirts teeshirt teeshirts top tops clothing',
    'Mug': 'cup cups coffee tea', 'Keyring': 'key ring keychain keychains key chain',
    'Bookmark': 'book mark', 'Tote Bag': 'bag bags shopper', 'Coaster Set': 'coaster mat mats',
    'Print': 'poster posters art picture wall frame framed'
  };
  function near(a, b) {
    if (Math.abs(a.length - b.length) > 1 || b.length < 4) return false;
    var i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else if (a[i + 1] === b[j] && a[i] === b[j + 1]) { i += 2; j += 2; } else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  }
  function searchProducts(term) {
    var words = norm(term).trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return data.catalogue.map(function (p) {
      var title = norm(p.title), hay = title + ' ' + norm(p.type) + ' ' + (SYNONYMS[p.type] || '') + ' ' + norm(p.collection) + ' ' + norm(p.tags)
        + (p.personalisable ? ' personalised personalized personalise personalize custom name' : '') + (p.price < 5 ? ' under £5 cheap stocking filler' : '');
      var hayWords = hay.split(/\s+/);
      var score = 0;
      for (var i = 0; i < words.length; i++) {
        var w = words[i], ws = w.replace(/s$/, '');
        if (title.indexOf(ws) !== -1) score += 3;
        else if (hay.indexOf(ws) !== -1) score += 1;
        else if (ws.length >= 5 && hayWords.some(function (h) { return near(ws, h); })) score += 1;  // one-letter typo: castel, bokmark
        else return null;
      }
      return { p: p, s: score };
    }).filter(Boolean).sort(function (a, b) { return b.s - a.s; });
  }
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
    var allHits = searchProducts(term), hits = allHits.slice(0, 12);
    if (types.length || cols.length) out += '<div class="sr-head">Collections</div><div class="chip-row">'
      + types.map(function (x) { return '<a class="chip" href="' + typeLink(x) + '">' + x.name + '</a>'; }).join('')
      + cols.map(function (c) { return '<a class="chip" href="' + collectionLink(c) + '">' + esc(c.name) + ' <small>' + productsFor(c).length + '</small></a>'; }).join('') + '</div>';
    out += '<div class="sr-head">' + (hits.length ? 'Products' : 'No products match "' + esc(term) + '"') + '</div>';
    out += hits.map(function (h) {
      var p = h.p;
      return '<a class="sr-row" href="product.html?id=' + encodeURIComponent(p.id) + '">' + img(p.image, 400, '') + '<div><div class="t">' + esc(name(p)) + '</div><div class="m">' + esc(p.type) + ' · ' + priceLabel(p).replace(/<[^>]+>/g, '') + '</div></div></a>';
    }).join('');
    if (allHits.length > hits.length) out += '<p style="margin:12px 0 0"><a class="btn alt" href="collection.html?q=' + encodeURIComponent(term.trim()) + '">See all ' + allHits.length + ' results</a></p>';
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
      return '<div class="bk-line">' + img(l.opts.__image || p.image, 400, '') + '<div><div class="t">' + esc(name(p)) + '</div><div class="o">' + (o || '') + (l.pers ? (o ? ' · ' : '') + '"' + esc(l.pers) + '"' : '') + '</div>'
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
    var qterm = q('q');
    if (qterm) {
      var found = searchProducts(qterm).map(function (h) { return h.p; });
      var sc = { slug: 'search', name: 'Search: "' + qterm + '"', kind: 'auto', rule: function (p) { return found.indexOf(p) !== -1; }, sort: function (a, b) { return found.indexOf(a) - found.indexOf(b); }, intro: found.length + ' results', image: '' };
      COLLECTIONS.push(sc); slug = 'search';
    }
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
      + '<aside class="sheet sheet-bottom" id="sh-filters" aria-label="Filters" inert><div class="sheet-head"><h2>Filter & sort</h2><button class="icon-btn" data-close aria-label="Close">' + ICON.close + '</button></div><div class="sheet-body" id="filterBody"></div></aside>';

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

  // ---------- product: one component for the full page and the quick view ----------
  // Pictures and the exact variant come from store/variant-images.js (which uses the live print and tote pickers),
  // so both places follow the same rules. Browsing the pictures never changes a choice; changing a choice swaps the
  // pictures straight away and stays on the same kind of shot (e.g. "worn by a man") when the new set has one.
  var uid = 0;
  function optionModel(p, d) {
    var V = window.CBJVariantImages, input = { vars: d.vars || [], podGallery: d.podGallery, printGallery: d.printGallery, finishes: d.finishes, finishImages: d.variantImages, defaults: (d.defaults && d.defaults.length ? d.defaults : [p.image]) };
    // If the picker scripts didn't load, a product with choices must not fall back to "no options".
    var hasChoices = (input.vars || []).length > 1 || (input.finishes || []).length > 1;
    var kind = V && window.CBJPrint && window.CBJTote ? V.kindOf(input) : (hasChoices ? 'unavailable' : 'single');
    input.kind = kind;
    var vs = input.vars, groups = [], choice = {};
    function vals(n, name) { var seen = []; vs.forEach(function (v) { if (v['option' + n + '_name'] === name && seen.indexOf(v['option' + n + '_value']) === -1) seen.push(v['option' + n + '_value']); }); return seen; }
    if (kind === 'print') {
      groups = [{ k: 'Frame', values: function () { return CBJPrint.frames(vs); }, label: CBJPrint.frameLabel },
                { k: 'Size', values: function (c) { return CBJPrint.sizes(vs, c.Frame); } },
                { k: 'Text', values: function () { return CBJPrint.texts(vs); }, label: CBJPrint.textLabel }];
      var fr = CBJPrint.frames(vs), tx = CBJPrint.texts(vs);
      choice.Frame = fr.indexOf('None') >= 0 ? 'None' : fr[0]; choice.Text = tx.indexOf('Yes') >= 0 ? 'Yes' : tx[0];
    } else if (kind === 'tote') {
      groups = [{ k: 'Colour', values: function () { return CBJTote.colours(vs); } },
                { k: 'Text', values: function (c) { return CBJTote.texts(vs, c.Colour); }, label: CBJTote.textLabel }];
      var cs = CBJTote.colours(vs); choice.Colour = cs.indexOf('Natural Raw') >= 0 ? 'Natural Raw' : cs[0];
      var ts = CBJTote.texts(vs, choice.Colour); choice.Text = ts.indexOf('No') >= 0 ? 'No' : ts[0];
    } else if (kind === 'apparel') {
      var withSize = vs.some(function (v) { return v.option2_name === 'Size'; });
      groups = [{ k: 'Colour', values: function () { return vals(1, 'Colour'); } }];
      if (withSize) groups.push({ k: 'Size', values: function (c) {
        return vs.filter(function (v) { return v.option1_value === c.Colour; }).map(function (v) { return v.option2_value; })
          .sort(function (a, b) { return SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b); });
      } });
      choice.Colour = vals(1, 'Colour')[0];
    } else if (kind === 'finish') {
      groups = [{ k: 'Finish', values: function () { return d.finishes; } }];
    }
    return { input: input, kind: kind, groups: groups, choice: choice };
  }

  function mountProduct(root, p, mode) {
    var page = mode === 'page', V = window.CBJVariantImages, n = ++uid;
    var d = data.details[p.id] || { options: {}, bullets: [], description: '', vars: [], defaults: [p.image] };
    var mdl = optionModel(p, d), choice = mdl.choice;
    var isMugPers = p.type === 'Mug' && p.personalisable;
    var isAcrylicPers = p.made === 'handmade' && p.personalisable;
    var col = primaryCollectionOf(p), typ = typeOf(p);
    var fulfil = p.made === 'handmade'
      ? '<div class="fulfil hand">' + ICON.hand + '<div><b>Handmade by Jon in Deal</b><span>Ships within 1 to 2 business days, posted by me. Free UK postage over £10.</span></div></div>'
        + '<div class="fulfil-sub">Any 3 bookmarks or keyrings for £10, mix and match.</div>'
      : '<div class="fulfil print">' + ICON.van + '<div><b>Printed to order</b><span>Ships within 3 to 4 working days, straight from my print partner. Free UK postage over £10.</span></div></div>';

    var galHtml = '<div class="gal"><div class="gal-main" data-r="galMain"></div><div class="gal-dots" data-r="dots" aria-hidden="true"></div>'
      + '<p class="gal-note" data-r="note" role="status" aria-live="polite" hidden></p><div class="gal-thumbs" data-r="thumbs"></div></div>';
    var buyHtml = (page ? '<nav class="crumbs" aria-label="Breadcrumb"><a href="home.html">Home</a>' + (col ? ' › <a href="' + collectionLink(col) + '">' + esc(col.name) + '</a>' : '') + (typ ? ' › <a href="' + typeLink(typ) + '">' + typ.name + '</a>' : '') + '</nav>' : '')
      + (page ? '<h1>' + esc(name(p)) + '</h1>' : '<h2 class="qv-title" id="qvt' + n + '">' + esc(name(p)) + '</h2>')
      + '<div class="price-row"><span class="price-big" data-r="price"></span>' + (p.stockLeft != null && p.stockLeft < 2 ? '<span class="low">' + p.stockLeft + ' left of this design</span>' : '') + '</div>'
      + '<div data-r="opts"></div>'
      + (isAcrylicPers ? '<div class="opt"><label class="opt-h" for="pers' + n + '">Add a name or message <span>optional, +£1.50</span></label><input class="field" id="pers' + n + '" data-r="pers" maxlength="30" placeholder="e.g. Miss Smith" aria-describedby="persN' + n + '"><div class="field-note" id="persN' + n + '" data-r="persN">Up to 30 characters</div></div>' : '')
      + (isMugPers ? '<div class="opt"><label class="opt-h" for="mugName' + n + '">Name on the mug <span>up to 20 characters</span></label><input class="field" id="mugName' + n + '" data-r="mugName" maxlength="20" placeholder="e.g. Miss Smith"></div>'
          + '<div class="opt"><label class="opt-h" for="mugMsg' + n + '">Message</label><select class="field" id="mugMsg' + n + '" data-r="mugMsg">' + (d.mugMessages || []).map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '</select>'
          + '<input class="field" id="mugCustom' + n + '" data-r="mugCustom" maxlength="40" placeholder="Your message (up to 40 characters)" aria-label="Your own message, up to 40 characters" hidden style="margin-top:8px">'
          + '<div class="field-note">Text colour choice stays as it is in the live shop.</div></div>' : '')
      + '<div class="buy"><button class="btn block" data-r="add"></button></div>' + fulfil;

    if (page) {
      var siblings = data.catalogue.filter(function (x) { return p.designKey && x.designKey === p.designKey && x.id !== p.id; });
      var seenTypes = {}; siblings = siblings.filter(function (x) { if (seenTypes[x.type]) return false; seenTypes[x.type] = 1; return true; });
      var related = data.catalogue.filter(function (x) { return x.id !== p.id && x.collection === p.collection && siblings.indexOf(x) === -1; })
        .sort(function (a, b) { return (b.type === p.type) - (a.type === p.type); }).slice(0, 8);
      var made = p.made === 'handmade'
        ? 'I apply the design to the acrylic, then cut, finish and pack it by hand at home in Deal, Kent.'
        : 'My design, printed for you when you order and posted straight to you, so it doesn\'t pass through my hands.';
      root.innerHTML = '<div class="wrap"><div class="pdp"><div>' + galHtml + '</div><div class="pdp-info"><div data-r="buyZone">' + buyHtml + '</div>'
        + (col ? '<div class="fb-hint"><span>More from <b>' + esc(col.name) + '</b></span><a class="link" href="' + collectionLink(col) + '">See all ' + productsFor(col).length + '</a></div>' : '')
        + (siblings.length ? '<div class="opt"><div class="opt-h">Love this design? Also on</div><div class="also">' + siblings.map(function (x) { return '<a href="product.html?id=' + encodeURIComponent(x.id) + '">' + img(x.image, 400, name(x)) + '<span>' + esc((typeOf(x) || {}).name || x.type) + '</span></a>'; }).join('') + '</div></div>' : '')
        + '<details class="acc" open><summary>Description</summary><div class="in">' + esc(d.description || p.short).replace(/\n+/g, '<br><br>') + '</div></details>'
        + '<details class="acc" id="details"><summary>Details</summary><div class="in"><ul>' + (d.bullets || []).map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + (d.material ? '<li>Material: ' + esc(d.material) + '</li>' : '') + '<li>' + made + '</li>' + (p.original ? '<li>Original design by Jon.</li>' : '') + '</ul></div></details>'
        + '<details class="acc"><summary>Delivery & returns</summary><div class="in"><p style="margin-top:0">Royal Mail 2nd Class £1.55, 1st Class £3.30, free 2nd Class over £10. UK only.</p><p style="margin-bottom:0">You can change your mind within 14 days of receiving your order, except for personalised items. Faulty? I\'ll replace it or refund you in full. <a class="link" href="/terms.html#returns">Full terms</a></p></div></details>'
        + '</div></div>'
        + (related.length ? '<section class="sec"><div class="sec-h"><div><h2>You might also like</h2></div>' + (col ? '<a class="link" href="' + collectionLink(col) + '">See all</a>' : '') + '</div><div class="rail">' + related.map(card).join('') + '</div></section>' : '')
        + '</div>'
        + '<div class="sticky-buy" data-r="sticky" role="region" aria-label="Quick add to basket" inert><div class="t"><b>' + esc(name(p)) + '</b><span data-r="stickyPrice"></span></div><button class="btn" data-r="stickyBtn" style="min-height:46px">Add to basket</button></div>';
    } else {
      root.innerHTML = '<div class="qv-grid">' + galHtml + '<div>' + buyHtml + '<p class="qv-more"><a class="link" href="product.html?id=' + encodeURIComponent(p.id) + '">See full details</a></p></div></div>';
      root.setAttribute('aria-labelledby', 'qvt' + n);
    }
    function R(k) { return root.querySelector('[data-r="' + k + '"]'); }
    var gm = R('galMain'), shown = [], shot = null, idx = 0;

    // ----- pictures -----
    function renderGallery(urls, note) {
      var keepShot = shot;
      shown = urls.slice(0, 8);
      gm.innerHTML = shown.map(function (u, i) { return img(u, 800, altFor(p, u), i ? '' : ' fetchpriority="high"').replace(' loading="lazy"', i ? ' loading="lazy"' : ''); }).join('');
      R('dots').innerHTML = shown.length > 1 ? shown.map(function (u, i) { return '<i class="' + (i ? '' : 'on') + '"></i>'; }).join('') : '';
      R('thumbs').innerHTML = shown.length > 1 ? shown.map(function (u, i) { return '<button type="button" data-g="' + i + '" class="' + (i ? '' : 'on') + '" aria-label="Show picture ' + (i + 1) + ' of ' + shown.length + ': ' + esc(altFor(p, u)) + '">' + img(u, 400, '') + '</button>'; }).join('') : '';
      var nt = R('note'); nt.textContent = note || ''; nt.hidden = !note;
      R('thumbs').querySelectorAll('[data-g]').forEach(function (b) { b.onclick = function () { go(+b.getAttribute('data-g'), true); }; });
      var same = keepShot && V ? shown.map(V.shotOf).indexOf(keepShot) : -1;
      go(same > 0 ? same : 0, false);
    }
    function go(i, smooth) {
      idx = i;
      gm.scrollTo({ left: gm.clientWidth * i, behavior: smooth ? 'smooth' : 'auto' });
      mark(i);
    }
    function mark(i) {
      shot = V && shown[i] ? V.shotOf(shown[i]) : null;
      R('dots').querySelectorAll('i').forEach(function (x, j) { x.classList.toggle('on', i === j); });
      R('thumbs').querySelectorAll('button').forEach(function (x, j) { x.classList.toggle('on', i === j); x.setAttribute('aria-current', i === j); });
    }
    gm.addEventListener('scroll', function () { var i = Math.round(gm.scrollLeft / Math.max(1, gm.clientWidth)); if (i !== idx) { idx = i; mark(i); } }, { passive: true });
    var lastKey = null;
    function refreshPictures() {
      var r = V ? V.imagesFor(mdl.input, choice) : { urls: mdl.input.defaults, exact: true, note: null };
      var key = r.urls.join('|') + '#' + (r.note || '');
      if (key === lastKey) return;  // same pictures: leave the gallery (and the picture being looked at) alone
      lastKey = key;
      renderGallery(r.urls.length ? r.urls : mdl.input.defaults, r.note);
    }

    // ----- options -----
    function renderOptions() {
      R('opts').innerHTML = mdl.groups.map(function (g) {
        var vals = g.values(choice) || [];
        if (vals.length < 2 && !(mdl.kind === 'print' && g.k === 'Size')) { if (vals.length === 1) choice[g.k] = vals[0]; return ''; }
        if (choice[g.k] && vals.indexOf(choice[g.k]) === -1) delete choice[g.k];  // e.g. a size the new frame doesn't come in
        var sw = g.k === 'Colour' && vals.every(function (v) { return SWATCH[v]; });
        var lab = function (v) { return g.label ? g.label(v) : v; };
        return '<div class="opt" data-opt="' + esc(g.k) + '" role="group" aria-labelledby="opt' + n + g.k + '"><div class="opt-h" id="opt' + n + g.k + '">' + esc(g.k) + ' <span data-sel>' + esc(choice[g.k] ? lab(choice[g.k]) : 'Choose') + '</span></div><div class="opts">'
          + vals.map(function (v) {
              var on = choice[g.k] === v;
              return sw ? '<button type="button" class="swatch' + (on ? ' on' : '') + '" style="background:' + SWATCH[v] + '" data-v="' + esc(v) + '" aria-label="' + esc(v) + '" aria-pressed="' + on + '"></button>'
                : '<button type="button" class="opt-btn' + (on ? ' on' : '') + '" data-v="' + esc(v) + '" aria-pressed="' + on + '">' + esc(lab(v)) + '</button>';
            }).join('') + '</div>' + (g.k === 'Size' && p.type === 'T-Shirt' ? '<div class="field-note">The size chart is in the pictures.</div>' : '') + '</div>';
      }).join('');
      R('opts').querySelectorAll('[data-opt]').forEach(function (grp) {
        var k = grp.getAttribute('data-opt');
        grp.querySelectorAll('[data-v]').forEach(function (b) {
          b.onclick = function () {
            choice[k] = b.getAttribute('data-v');
            var focusKey = k, focusVal = choice[k];
            renderOptions();  // later groups can depend on this one (sizes per frame, texts per colour)
            var again = R('opts').querySelector('[data-opt="' + focusKey + '"] [data-v="' + CSS.escape(focusVal) + '"]'); if (again) again.focus({ preventScroll: true });
            refreshPictures(); sync();
          };
        });
      });
    }
    function missing() { return mdl.groups.filter(function (g) { return (g.values(choice) || []).length > 0 && !choice[g.k]; }).map(function (g) { return g.k; })[0]; }
    function variant() { return mdl.kind === 'unavailable' ? null : (V ? V.variantFor(mdl.input, choice) : {}); }
    function unitPrice() {
      var v = variant(), unit = v && v.retail_price_pence != null ? v.retail_price_pence / 100 : (d.priceFrom || p.price);
      var pers = R('pers') && R('pers').value.trim();
      return unit + (pers ? PERS_UPLIFT : 0);
    }
    function sync() {
      var miss = missing(), btn = R('add');
      var fromPrice = mdl.kind === 'print' && !variant();
      if (mdl.kind === 'unavailable') { btn.textContent = 'Options are not available right now'; btn.disabled = true; R('opts').innerHTML = '<p class="field-note">Options are not available right now. Please try again in a moment.</p>'; return; }
      btn.textContent = miss ? 'Choose a ' + miss.toLowerCase() : 'Add to basket · ' + money(unitPrice());
      btn.classList.toggle('alt', !!miss);
      R('price').innerHTML = (fromPrice ? '<small style="font-size:15px;font-weight:700">from</small> ' : '') + money(unitPrice());
      if (R('stickyPrice')) { R('stickyPrice').textContent = money(unitPrice()); R('stickyBtn').textContent = miss ? 'Choose ' + miss.toLowerCase() : 'Add to basket'; }
    }
    function add() {
      var miss = missing();
      if (miss) {
        var el = R('opts').querySelector('[data-opt="' + miss + '"]');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.querySelector('.opt-h').style.color = 'var(--coral-ink)';
        var first = el.querySelector('[data-v]'); if (first) first.focus({ preventScroll: true });
        return;
      }
      var v = variant();
      if (!v) return;  // never add something that doesn't match a real variant
      var opts = {};
      mdl.groups.forEach(function (g) { if (choice[g.k]) opts[g.k] = g.label ? g.label(choice[g.k]) : choice[g.k]; });
      if (isMugPers) {
        var nm = R('mugName').value.trim(); if (nm) opts.Name = nm;
        // As in the live modal: "Custom" means the customer's own words from the extra box, never the word "Custom".
        var msg = R('mugMsg').value === 'Custom' ? R('mugCustom').value.trim() : R('mugMsg').value;
        if (R('mugMsg').value === 'Custom' && !msg) { R('mugCustom').focus(); R('mugCustom').setAttribute('aria-invalid', 'true'); return; }
        opts.Message = msg;
      }
      if (v.retail_price_pence != null) opts.__price = v.retail_price_pence / 100;
      opts.__variant = v.id != null ? { id: v.id, gelato_variant_id: v.gelato_variant_id || null, gelato_product_uid: v.gelato_product_uid || null } : (v.finish ? { finish: v.finish } : null);
      opts.__image = shown[0] || p.image;  // the basket line shows the picture of what was chosen
      addToBasket(p, opts, R('pers') ? R('pers').value.trim() : '');
    }
    if (R('pers')) R('pers').addEventListener('input', function () { R('persN').textContent = (30 - this.value.length) + ' characters left'; sync(); });
    if (R('mugMsg')) R('mugMsg').addEventListener('change', function () { var c = this.value === 'Custom'; R('mugCustom').hidden = !c; if (c) R('mugCustom').focus(); });
    R('add').onclick = add;
    renderOptions(); refreshPictures(); sync();

    if (!page) return;
    R('stickyBtn').onclick = add;
    var sb = R('sticky');
    // Sticky bar: only while every buying control is completely off screen. Inert while hidden.
    function setSticky(on) {
      if (window.matchMedia('(min-width: 900px)').matches) on = false;
      sb.classList.toggle('on', on);
      if (on) sb.removeAttribute('inert'); else sb.setAttribute('inert', '');
      document.documentElement.classList.toggle('sticky-on', on);
    }
    new IntersectionObserver(function (es) { setSticky(!es[0].isIntersecting); }).observe(R('buyZone'));
    document.addEventListener('focusin', function (e) {
      if (!sb.classList.contains('on') || sb.contains(e.target)) return;
      var r = e.target.getBoundingClientRect(), barTop = sb.getBoundingClientRect().top;
      if (r.bottom > barTop - 8) window.scrollBy(0, r.bottom - barTop + 16);
    });
  }

  function productPage() {
    var p = byId[q('id') || 'mug-005'], m = $('#main');
    if (!p) {
      m.innerHTML = '<div class="wrap empty"><h1 style="font-size:28px;margin:30px 0 10px">That one isn\'t in the shop any more.</h1><p>It might be sold out or retired. Here are some similar things.</p><div class="grid" style="margin-top:18px">' + PICKS.slice(0, 4).map(function (x) { return card(byId[x]); }).join('') + '</div></div>';
      return;
    }
    // The page <title>, meta description and Product JSON-LD keep the original catalogue title (server-rendered in
    // the real build); only the visible heading uses the shorter display name.
    document.title = p.title + ' | Crafts by Jon (preview)';
    mountProduct(m, p, 'page');
  }

  function openQuickView(p) {
    var body = $('#qvBody');
    window.CBJPV.open('quick');
    mountProduct(body, p, 'quick');
    var t = body.querySelector('.qv-title'); if (t) { t.setAttribute('tabindex', '-1'); t.focus(); }
  }

  // ---------- boot ----------
  fetch('data/snapshot.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
    data = j;
    j.catalogue.forEach(function (p) { byId[p.id] = p; });
    j.collections.forEach(function (c) { monthsByCol[c.name] = c.months; });
    buildNames();
    chrome();
    var page = document.body.getAttribute('data-page');
    if (page === 'home') homePage();
    if (page === 'collection') collectionPage();
    if (page === 'product') productPage();
  }).catch(function (e) {
    document.getElementById('main').innerHTML = '<div class="wrap empty">The preview data did not load (' + esc(e.message) + ').</div>';
  });
})();
