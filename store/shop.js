/* Crafts by Jon shop: catalogue, product popup, basket and checkout. Moved out of store/index.html unchanged
   on 11 Oct 2026 so product pages can run exactly the same code. */
  const API = 'https://craftsbyjon.co.uk/n8n-proxy/products-api';

  // ===== Funnel tracking =====
  (function captureSource() {
    try {
      var srcParam = new URLSearchParams(window.location.search).get('src');
      if (srcParam) sessionStorage.setItem('cbj_src', srcParam.slice(0, 100));
    } catch (e) {}
  })();
  function getSource() {
    try { return sessionStorage.getItem('cbj_src') || 'direct'; } catch (e) { return 'direct'; }
  }
  function trackCollectionView(collectionName) {
    var colSlug = (collectionName || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    clarityTrack('collection_view', colSlug);
    if (typeof fetch === 'function') {
      fetch('/n8n-proxy/products-api/event', { method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ event: 'collection_view', source: getSource(), product_id: colSlug, path: window.location.pathname + window.location.search }) }).catch(function(){});
    }
    if (typeof gtag === 'function') {
      gtag('event', 'collection_view', { collection: colSlug, source: getSource() });
    }
  }

  // Basket summary sent with checkout_started (task 177): "cart:productIdxQty+productIdxQty"
  function cartPathFor(items) {
    try { return 'cart:' + items.map(function(i) { return (i.product_id || '?') + 'x' + (i.quantity || 1); }).join('+'); }
    catch (e) { return ''; }
  }

  // Clarity custom events and tags (task 179). window.clarity only exists once cookies are accepted, so every call is
  // guarded. Events show up in Clarity's Recordings filters; tags let recordings be filtered by source, collection, product.
  var CLARITY_EVENTS = { add_to_basket: 'addToBasket', checkout_started: 'checkoutStarted', design_link_click: 'designLinkClick', related_click: 'relatedClick', gifts_strip_click: 'giftsStripClick' };
  function clarityTrack(eventName, productId) {
    try {
      if (typeof window.clarity !== 'function') return;
      if (!window._cbjClaritySource) { window._cbjClaritySource = true; window.clarity('set', 'source', getSource()); }
      if (CLARITY_EVENTS[eventName]) window.clarity('event', CLARITY_EVENTS[eventName]);
      if (eventName === 'product_view' && productId) window.clarity('set', 'product', productId);
      if (eventName === 'collection_view' && productId) window.clarity('set', 'collection', productId);
    } catch (e) {}
  }

  function trackEvent(eventName, productId, detail, checkoutSessionId) {
    clarityTrack(eventName, productId);
    try {
      var body = { event: eventName, source: getSource(), product_id: productId || '', path: detail || '' };
      if (checkoutSessionId) body.checkout_session_id = checkoutSessionId;
      fetch(API + '/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true
      }).catch(function() {});
      if (typeof gtag === 'function') {
        var gaMap = { product_view: 'view_item', add_to_basket: 'add_to_cart', checkout_started: 'begin_checkout' };
        gtag('event', gaMap[eventName] || eventName, { source: getSource(), item_id: productId || '' });
      }
    } catch (e) {}
  }

  function buildImageUrl(storedPath) {
    if (!storedPath) return '';
    if (storedPath.startsWith('https://')) return storedPath;
    var filename = storedPath.split('/').pop();
    var base = filename.indexOf('.') !== -1 ? filename : filename + '.jpg';
    return 'https://images.craftsbyjon.co.uk/products/' + base;
  }

  const MOBILE_BANNER_MAP = {
    'teacherappreciation': '/store/assets/banners/mobile/cbj_teacher_mobile_banner_1440x400.png',
    'summer':              '/store/assets/banners/mobile/cbj_summer_mobile_banner_1440x400.png',
    'summervibes':         '/store/assets/banners/mobile/cbj_summer_mobile_banner_1440x400.png',
    'bees':                '/store/assets/banners/mobile/cbj_bees_mobile_banner_1440x400.png',
    'pride':               '/store/assets/banners/mobile/cbj_pride_mobile_banner_1440x400.png',
  };

  let allProducts = [];
  let allProductsRaw = [];  // unfiltered - includes drafts, used for staff preview links
  let mainProducts = [];
  let availableProducts = [];
  var collectionsMonths = {};  // valid_months per collection name (e.g. '5,6,7,8'), used by the Christmas gifts view
  let products = [];
  let cart = {};
  let selectedVariant = null;
  let collectionsOrder = {};
  let collectionsStatus = {};
  let lightboxImages = [];
  let lightboxIdx = 0;
  let currentModalImages = [];
  let _selectedMugColour = '';
  // POD colour/size selector state
  let _podVariants = [];
  let podSelectedColour = null;
  let podSelectedSize = null;
  let podSelectedVariantId = null;
  let podSelectedProductUid = null;
  let podSelectedPrice = null;  // pence — set when a variant carries its own retail_price_pence (e.g. prints by size), null otherwise (flat product price applies)
  let podGalleryData = {};
  let podSelectedImage = null;  // print picker: main picture of the chosen Frame/Size/Text (used for the cart line)
  let printState = null;        // print picker state, null for every other product
  let toteState = null;         // tote picker state (Colour x Text), null for every other product
  let photoState = null;        // photo personalisation state (photo-personaliser.js), null for every other product
  // Pictures follow the chosen options (store/variant-images.js rules, 11 Oct 2026). When there is no exact
  // picture for a choice the popup says so under the picture instead of showing another option's photo.
  let modalDefaultImages = [];  // the product's own pictures, the fallback when an option has none
  let modalVariantNames = [];   // Clear/Black style variants of the open product

  // Product page mode (/products/{id}, 11 Oct 2026). The server-rendered product page sets
  // window.CBJ_PAGE = { mode: 'product', id: '...' } and loads this same file, so the popup's pickers,
  // personalisation, basket and checkout run unchanged; the popup content is shown as the page.
  // Everything below that checks PRODUCT_PAGE is skipped on /store/.
  var PRODUCT_PAGE = (window.CBJ_PAGE && window.CBJ_PAGE.mode === 'product' && window.CBJ_PAGE.id) ? window.CBJ_PAGE : null;

  // Fixed banner for staff previews (13 Oct 2026).
  function showPreviewNotice(text, isError) {
    var banner = document.createElement('div');
    banner.textContent = text;
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:' + (isError ? '#9b1c1c' : '#b45309') + ';color:#fff;text-align:center;padding:8px;font-size:.85rem;font-weight:600';
    document.body.appendChild(banner);
  }

  async function load() {
    const main = document.getElementById('main');
    try {
      const [prodRes, colRes] = await Promise.all([
        fetch(API + '/products'),
        fetch(API + '/collections')
      ]);
      if (!prodRes.ok) throw new Error('API error');
      const { result } = await prodRes.json();
      const { result: colResult } = await colRes.json();

      collectionsOrder = {};
      collectionsStatus = {};
      (colResult || []).forEach(function(c) {
        collectionsOrder[c.name] = c.sort_order;
        collectionsStatus[c.name] = c.status;
        collectionsMonths[c.name] = c.valid_months;
      });

      allProductsRaw = result || [];

      // Staff preview of a draft (13 Oct 2026): the public list no longer contains drafts, so a ?preview=
      // link for a product that is not in it reads the full list from the staff-protected route, using the
      // staff login cookie of this browser. Without a staff login it just says so. Drafts still cannot be
      // bought by anyone: checkout refuses them on the server.
      var draftPreviewId = new URLSearchParams(window.location.search).get('preview');
      if (draftPreviewId && !allProductsRaw.some(function(p) { return p['Product ID'] === draftPreviewId; })) {
        try {
          var staffRes = await fetch(API + '/products/', { credentials: 'same-origin', cache: 'no-store' });
          if (staffRes.ok) {
            var staffList = ((await staffRes.json()) || {}).result || [];
            var draft = staffList.find(function(p) { return p['Product ID'] === draftPreviewId; });
            if (draft) allProductsRaw.push(draft);
          } else {
            showPreviewNotice('Staff preview: log in to the staff area on this device first, then open this link again.', true);
          }
        } catch (e) { /* the shop still loads */ }
      }

      // Exclude archived-collection products and anything not marked Ready to Go
      allProducts = (result || []).filter(function(p) {
        if (!p || !p['Product ID']) return false;
        // POD products (Gelato) use dynamic Stripe price_data at checkout - they never
        // have a stripe_price_id, that's expected, not a reason to hide them. Found
        // 19 Aug 2026: all 8 t-shirts were correctly Ready to Go but invisible on the
        // store because this filter required stripe_price_id for every product with no
        // exception, before the Ready to Go check even ran.
        var isPodProduct = !!(p.pod_gallery_images && p.pod_gallery_images !== '{}');
        // Tote bags made by a print partner (6 Oct 2026) have no Stripe price either: each colour and
        // text choice is priced at checkout from its own row.
        // Photo personalised products (10 Oct 2026) are also priced at checkout from their option rows.
        var isPhotoListing = !!(window.CBJPhoto && CBJPhoto.isPhotoProduct(p));
        if (!p.stripe_price_id && !isPodProduct && !isToteListing(p) && !isPhotoListing) return false;
        var cs = collectionsStatus[p['Collection']];
        if (p['Collection'] && cs === 'archived') return false;
        if (Number(p.design_stock_tracked) === 1 && Number(p.design_stock_qty) <= 0) return false;
        return String(p['Ready to Go'] || '').trim().toLowerCase() === 'yes';
      });

      // Split: main grid = live or no collection; available section = 'available' status.
      // A hidden or not-yet-published (draft) collection only loses its button: its products stay in the main grid.
      mainProducts = allProducts.filter(function(p) {
        var cs = collectionsStatus[p['Collection']];
        return !p['Collection'] || cs === 'live' || cs === undefined || cs === 'hidden' || cs === 'draft';
      });
      availableProducts = allProducts.filter(function(p) {
        return p['Collection'] && collectionsStatus[p['Collection']] === 'available';
      });

      if (PRODUCT_PAGE) { showProductPage(main); return; }

      if (allProducts.length === 0) {
        main.innerHTML = '<div class="empty-msg">No products set up yet.<br>Use the staff listings page to create Stripe links.</div>';
        return;
      }

      // Collection buttons: live then available (API sort_order), must have products. Archived, hidden and
      // draft (not yet published, 13 Oct 2026 collection management) collections get no button.
      var allProductColNames = new Set(allProducts.map(function(p) { return p['Collection']; }).filter(Boolean));
      const collections = (colResult || [])
        .filter(function(c) { return (c.status === 'live' || c.status === 'available' || !c.status) && allProductColNames.has(c.name); })
        .map(function(c) { return c.name; });
      const prices = [...new Set(mainProducts.map(p => parseFloat(p.price || 3.50)))].sort((a, b) => a - b);
      const showPriceFilter = prices.length > 1;
      const minPrice = prices[0];
      const maxPrice = prices[prices.length - 1];

      // Build collection filter buttons
      var hasPersonalised = allProducts.some(function(p) { return p.personalised === 1; });
      var colBtnsHtml = '<div class="collection-filter-bar" id="collectionFilterBar">';
      colBtnsHtml += '<button class="col-btn active" data-col="" onclick="setCollectionFilter(this)">All</button>';
      if (giftsSeasonActive()) {
        colBtnsHtml += '<button class="col-btn gifts-col" data-col="__gifts__" onclick="setCollectionFilter(this)">&#127876; Christmas gifts</button>';
      }
      collections.forEach(function(cName) {
        var status = collectionsStatus[cName] || 'live';
        var extraClass = status === 'available' ? ' available-col' : '';
        colBtnsHtml += '<button class="col-btn' + extraClass + '" data-col="' + escAttr(cName) + '" onclick="setCollectionFilter(this)">' + escHtml(cName) + '</button>';
      });
      if (hasPersonalised) {
        colBtnsHtml += '<button class="col-btn personalised-col" data-col="__personalised__" onclick="setCollectionFilter(this)">&#10024; Personalised</button>';
      }
      colBtnsHtml += '</div>';

      const priceFilterHtml = showPriceFilter
        ? '<div class="price-slider-wrap" id="priceFilterRow">'
          + '<div class="price-slider-label" id="priceSliderLabel">Price: £' + minPrice.toFixed(2) + ' - £' + maxPrice.toFixed(2) + '</div>'
          + '<div class="price-slider-track">'
          + '<div class="price-slider-range" id="priceSliderFill"></div>'
          + '<input type="range" id="priceMin" class="price-range-input" min="' + minPrice + '" max="' + maxPrice + '" step="0.01" value="' + minPrice + '" oninput="onPriceSlider()" />'
          + '<input type="range" id="priceMax" class="price-range-input" min="' + minPrice + '" max="' + maxPrice + '" step="0.01" value="' + maxPrice + '" oninput="onPriceSlider()" />'
          + '</div>'
          + '</div>'
        : '';

      var mobilePersBtn = hasPersonalised
        ? '<button class="mobile-pers-toggle" id="mobilePersToggle" onclick="onMobilePersToggle()">&#10024; Personalised</button>'
        : '';
      buildDrawerNav(collections, hasPersonalised, colResult);

      var sortSelectHtml =
        '<select id="sortFilter" class="filter-select" onchange="applyFilters()">'
        + '<option value="featured">Featured</option>'
        + '<option value="price-asc">Price: Low to High</option>'
        + '<option value="price-desc">Price: High to Low</option>'
        + '<option value="newest">Newest</option>'
        + '</select>';

      main.innerHTML =
        '<div class="filter-bar">'
        + '<div class="mobile-filter-bar">'
        + '<button class="mobile-hamburger" onclick="openDrawer()">&#9776; Browse</button>'
        + mobilePersBtn
        + '</div>'
        + '<div class="desktop-toolbar" id="desktopToolbar">'
        + '<div class="type-filter-row" id="typeFilterRow"></div>'
        + sortSelectHtml
        + '</div>'
        + '<div class="results-count" id="resultsCount"></div>'
        + '</div>'
        + '<div class="store-body">'
        + '<aside class="store-sidebar" id="storeSidebar">'
        + '<a class="sidebar-home-link" href="https://craftsbyjon.co.uk/">&#127968; Home</a>'
        + colBtnsHtml
        + priceFilterHtml
        + '<div class="sidebar-deals">'
        + '<div class="sidebar-deals-title">Deals &amp; Discounts</div>'
        + '<button class="sidebar-deals-link" onclick="openDealsModal()">Buy More, Save More</button>'
        + '</div>'
        + '</aside>'
        + '<div class="store-content">'
        + '<div class="grid" id="grid"></div>'
        + '<div class="no-results" id="noResults" style="display:none">'
        + 'No products match your filters.<br><br>'
        + '<button class="clear-filters-link" onclick="clearFilters()">Clear all filters</button>'
        + '</div>'
        + '<div id="availableSection"></div>'
        + '</div>'
        + '</div>';

      renderTypeFilterRow();

      applyFilters();

      // SEO: inject ItemList structured data once products are loaded
      try {
        var ldItems = allProducts.slice(0, 50).map(function(p, i) {
          return {
            "@type": "ListItem",
            "position": i + 1,
            "item": {
              "@type": "Product",
              "name": p['Title'],
              "image": buildImageUrl(p['Image URL']) || buildImageUrl((p['Product ID']||'').toLowerCase()),
              "description": p['Short Description'] || p['Title'],
              "url": "https://craftsbyjon.co.uk/products/" + p['Product ID'],
              "offers": {
                "@type": "Offer",
                "price": String(p['Price'] || ''),
                "priceCurrency": "GBP",
                "availability": "https://schema.org/InStock"
              }
            }
          };
        });
        var ldScript = document.createElement('script');
        ldScript.type = 'application/ld+json';
        ldScript.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "ItemList", "itemListElement": ldItems });
        document.head.appendChild(ldScript);
      } catch (e) { /* non-critical */ }

      // A broken saved basket must never stop the shop loading.
      try { restoreCart(); } catch (e) { try { CBJPhoto.clear(window.localStorage); } catch (e2) {} }

      if (window.location.hash) {
        var hashId = window.location.hash.slice(1);
        var hashTarget = allProducts.find(function(p) { return p['Product ID'] === hashId; });
        if (hashTarget) setTimeout(function() { openModal(hashTarget); }, 0);
      }

      // Staff preview deep link - ?preview=<productId>. Looks up the UNFILTERED
      // product list, so this works for draft / not-yet-live products too,
      // unlike the #hash link above which only finds Ready-to-Go products.
      // Never adds the product to the visible grid, search, or allProducts -
      // it only opens the modal directly for whoever has this exact link.
      var previewParams = new URLSearchParams(window.location.search);
      var previewId = previewParams.get('preview');
      if (previewId) {
        var previewTarget = allProductsRaw.find(function(p) { return p['Product ID'] === previewId; });
        if (previewTarget) {
          setTimeout(function() {
            openModal(previewTarget);
            // openModal() rewrites the address bar to a shareable #productId hash, which
            // overwrites the ?preview= URL. For a draft product, a refresh of that hash-only
            // URL then fails silently (the hash handler only searches the Ready-to-Go list) -
            // found 18 Aug 2026 when refreshing a preview closed the modal instead of reopening
            // it. Restore the ?preview= URL immediately after so a refresh keeps working.
            history.replaceState({ previewId: previewId }, '', '/store/?preview=' + encodeURIComponent(previewId));
            document.title = '[PREVIEW] ' + document.title;
            if (String(previewTarget['Ready to Go'] || '').trim().toLowerCase() !== 'yes') {
              showPreviewNotice('⚠ PREVIEW MODE - this product is a draft. You can try the options and photo upload, but it cannot be checked out until it is Ready to Go.', false);
            }
          }, 0);
        }
      }

      // Deep link to collection via ?collection= URL parameter
      var urlParams = new URLSearchParams(window.location.search);
      var colParam = urlParams.get('collection');
      if (colParam) {
        var normCol = function(s) { return s.toLowerCase().replace(/[^a-z0-9]/g, ''); };
        var colBtn = Array.prototype.find.call(
          document.querySelectorAll('#collectionFilterBar .col-btn[data-col]'),
          function(b) { return b.dataset.col && normCol(b.dataset.col) === normCol(colParam); }
        );
        if (colBtn) setTimeout(function() { setCollectionFilter(colBtn); }, 100);

        // Collection hero banner - use colResult already fetched above
        var normColParam = normCol(colParam);
        var matchedCol = (colResult || []).find(function(c) {
          return normCol(c.name) === normColParam && (c.status === 'live' || c.status === 'available' || !c.status);
        });
        if (matchedCol && matchedCol.banner_image) {
          var heroEl = document.getElementById('collectionHero');
          var heroImg = document.getElementById('collectionHeroImg');
          var isMobile = window.matchMedia('(max-width: 600px)').matches;
          var mobileSrc = matchedCol.banner_image_mobile || MOBILE_BANNER_MAP[normCol(matchedCol.name)];
          heroImg.src = (isMobile && mobileSrc) ? mobileSrc : matchedCol.banner_image;
          if (isMobile && mobileSrc) { heroImg.classList.add('mobile-banner'); } else { heroImg.classList.remove('mobile-banner'); }
          heroImg.alt = matchedCol.name + ' collection';
          heroEl.style.display = 'block';
          document.body.classList.add('has-collection-hero');
        }
        // Hide personalised toggle if this collection has no personalised items
        var persToggleInit = document.getElementById('mobilePersToggle');
        if (persToggleInit && colBtn) {
          var colName = colBtn.dataset.col;
          var hasColPers = allProducts.some(function(p) { return p.personalised === 1 && p['Collection'] === colName; });
          if (!hasColPers) persToggleInit.style.display = 'none';
        }
      }

      // Deep link to product type via ?type= URL parameter (combinable with ?collection=,
      // e.g. ?collection=Retro%20Deal&type=Print to share just the Deal prints)
      var typeParam = urlParams.get('type');
      if (typeParam) {
        var normType = function(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); };
        var typeBtn = Array.prototype.find.call(
          document.querySelectorAll('#typeFilterRow .type-link[data-type]'),
          function(b) { return b.dataset.type && normType(b.dataset.type) === normType(typeParam); }
        );
        setTimeout(function() {
          if (typeBtn) { setTypeFilter(typeBtn); }
          else { _activeProductType = typeParam; applyFilters(); }
        }, colParam ? 150 : 100);
      }
    } catch (e) {
      // On a product page the server-rendered summary (with its "View & buy in the shop" link) stays in place.
      if (PRODUCT_PAGE) { document.documentElement.classList.add('pp-failed'); return; }
      main.innerHTML = '<div class="empty-msg">Could not load products. Please try again later.</div>';
    }
  }

  // Product page: restore the saved basket (it needs the whole catalogue, or other lines would be dropped),
  // then show this product's popup content as the page. A product that has sold out, or isn't on sale,
  // keeps the server-rendered summary and gets a short note.
  function showProductPage(main) {
    try { restoreCart(); } catch (e) { try { CBJPhoto.clear(window.localStorage); } catch (e2) {} }
    var p = allProducts.find(function(x) { return x['Product ID'] === PRODUCT_PAGE.id; });
    if (!p) {
      document.documentElement.classList.add('pp-unavailable');
      if (main) main.innerHTML = '<div class="empty-msg">This one can\'t be bought right now. <a href="/store/">Have a look at the rest of the shop</a>.</div>';
      return;
    }
    PRODUCT_PAGE.product = p;
    openModal(p);
    document.documentElement.classList.add('pp-ready');
    document.dispatchEvent(new CustomEvent('cbj:product-ready', { detail: { product: p } }));
  }

  // Set active collection filter button and re-filter
  // ── Christmas gifts view (task 173, 8 Oct 2026) ──
  // A pseudo-collection (like __personalised__) showing everything currently in season. In season =
  // the product's collection has no valid_months, or this month is one of them. The button, the top
  // strip and the link only exist from 1 Oct to 25 Dec. ?collection=gifts deep-links to it, and
  // /src/{source}/collection/gifts is the tracked version (shop-redirect already handles that shape).
  function giftsSeasonActive() {
    var d = new Date(), m = d.getMonth() + 1;
    return m === 10 || m === 11 || (m === 12 && d.getDate() <= 25);
  }
  function isInSeason(p) {
    var vm = collectionsMonths[p['Collection']];
    if (!vm) return true;
    var months = String(vm).split(',').map(function(x) { return parseInt(x, 10); });
    return months.indexOf(new Date().getMonth() + 1) !== -1;
  }
  // Coaster sets first (best seller), then tote bags, then the rest in the normal featured order
  function giftRank(p) {
    var t = getProductType(p);
    return t === 'Coaster Set' ? 0 : (t === 'Tote Bag' ? 1 : 2);
  }
  function giftsIntroHtml(activeCol) {
    if (activeCol !== '__gifts__') return '';
    return '<div style="grid-column:1/-1;background:#fff;border:2px solid #b7e1c1;border-radius:12px;padding:14px 18px;margin-bottom:4px">'
      + '<div style="font-weight:700;font-size:1.15rem;color:#155724">&#127876; Christmas gifts</div>'
      + '<div style="color:#555;font-size:0.95rem;margin-top:4px">Everything that is in season right now, with the coaster sets and tote bags first. Free UK shipping on orders of &pound;10 or more.</div>'
      + '</div>';
  }
  function updateGiftsStrip() {
    var el = document.getElementById('giftsStrip');
    if (!el) return;
    var activeBtn = document.querySelector('#collectionFilterBar .col-btn.active');
    var activeCol = activeBtn ? (activeBtn.dataset.col || '') : '';
    var hasBtn = !!document.querySelector('#collectionFilterBar .col-btn[data-col="__gifts__"]');
    el.style.display = (giftsSeasonActive() && hasBtn && activeCol !== '__gifts__') ? 'block' : 'none';
  }
  function openGiftsView() {
    var btn = document.querySelector('#collectionFilterBar .col-btn[data-col="__gifts__"]');
    if (!btn) return;
    trackEvent('gifts_strip_click', 'gifts');
    _prevCollection = '';
    setCollectionFilter(btn);
    updateCollectionHero('');
    refreshDrawerNav();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setCollectionFilter(btn) {
    document.querySelectorAll('#collectionFilterBar .col-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    var colName = btn.dataset.col || 'all';
    if (colName === '__gifts__') updateCollectionHero('');
    trackCollectionView(colName);
    applyFilters();
    updateBundleBanner();
  }

  // ── Product-type filter (desktop toolbar: Keyrings / Bookmarks / Mugs / etc) ──
  var _activeProductType = '';
  var TYPE_PLURAL = { 'Mug': 'Mugs', 'Keyring': 'Keyrings', 'Bookmark': 'Bookmarks', 'T-Shirt': 'T-Shirts', 'Coaster Set': 'Coasters', 'Greeting Card': 'Cards' };
  function getProductType(p) {
    var t = (p.product_type || '').trim();
    if (t) return t;
    var id = (p['Product ID'] || '').toLowerCase();
    if (id.indexOf('bookmark-') === 0) return 'Bookmark';
    if (id.indexOf('keyring-') === 0) return 'Keyring';
    return '';
  }
  function renderTypeFilterRow() {
    var el = document.getElementById('typeFilterRow');
    var headerGroup = document.getElementById('headerSearchGroup');
    var types = [];
    mainProducts.forEach(function(p) {
      var t = getProductType(p);
      if (t && types.indexOf(t) === -1) types.push(t);
    });

    // Plain-text category links, "All" first
    if (el) {
      if (types.length < 2) {
        el.innerHTML = '';
      } else {
        var h = '<button class="type-link active" data-type="" onclick="setTypeFilter(this)">All</button>';
        types.forEach(function(t) {
          var label = TYPE_PLURAL[t] || (t + 's');
          h += '<button class="type-link" data-type="' + escAttr(t) + '" onclick="setTypeFilter(this)">' + escHtml(label) + '</button>';
        });
        el.innerHTML = h;
      }
    }

    // Header "All" dropdown + search box - single real #searchInput lives here
    if (headerGroup) {
      var opts = '<option value="">All</option>';
      types.forEach(function(t) {
        var label = TYPE_PLURAL[t] || (t + 's');
        opts += '<option value="' + escAttr(t) + '">' + escHtml(label) + '</option>';
      });
      headerGroup.innerHTML =
        '<select id="typeScopeSelect" class="header-scope-select" onchange="onTypeScopeChange()">' + opts + '</select>'
        + '<input type="search" id="searchInput" class="header-search-input" placeholder="Search" oninput="applyFilters()" />';
    }
  }
  function setTypeFilter(btn) {
    document.querySelectorAll('#typeFilterRow .type-link').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    _activeProductType = btn.dataset.type || '';
    var sel = document.getElementById('typeScopeSelect');
    if (sel) sel.value = _activeProductType;
    applyFilters();
  }
  function onTypeScopeChange() {
    var sel = document.getElementById('typeScopeSelect');
    _activeProductType = sel ? (sel.value || '') : '';
    document.querySelectorAll('#typeFilterRow .type-link').forEach(function(b) {
      b.classList.toggle('active', b.dataset.type === _activeProductType);
    });
    applyFilters();
  }

  function openDealsModal() {
    document.getElementById('dealsModalOverlay').classList.add('open');
    document.getElementById('dealsModalWrap').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeDealsModal() {
    document.getElementById('dealsModalOverlay').classList.remove('open');
    document.getElementById('dealsModalWrap').classList.remove('open');
    if (!document.getElementById('modalWrap').classList.contains('open') &&
        !document.getElementById('aboutModalWrap').classList.contains('open') &&
        !document.getElementById('cartPanel').classList.contains('open')) {
      document.body.style.overflow = '';
    }
  }

  function applyFilters() {
    const q = (document.getElementById('searchInput') ? document.getElementById('searchInput').value : '').toLowerCase().trim();
    const sort = document.getElementById('sortFilter') ? document.getElementById('sortFilter').value : 'featured';
    const priceMinEl = document.getElementById('priceMin');
    const priceMaxEl = document.getElementById('priceMax');
    const priceMin = priceMinEl ? parseFloat(priceMinEl.value) : -Infinity;
    const priceMax = priceMaxEl ? parseFloat(priceMaxEl.value) : Infinity;

    // Read active collection from filter buttons
    const activeColBtn = document.querySelector('#collectionFilterBar .col-btn.active');
    const collection = activeColBtn ? activeColBtn.dataset.col : '';
    const isPersonalised = collection === '__personalised__';
    const isGifts = collection === '__gifts__';

    // Determine product pool
    var pool;
    if (isPersonalised) {
      pool = allProducts.filter(function(p) {
        if (!p.personalised) return false;
        // If toggled within a collection, only show personalised from that collection
        if (_prevCollection && _prevCollection !== '__gifts__') return p['Collection'] === _prevCollection;
        return true;
      });
    } else if (isGifts) {
      // Christmas gifts view: everything in season
      pool = allProducts.filter(isInSeason);
    } else if (collection) {
      // Specific collection: pull from all non-archived (includes available-status collections full-size)
      pool = allProducts;
    } else if (q) {
      // All, searching: main products plus the "Also available" ones, so a search for e.g. "teacher" or "bee"
      // finds products in available-status collections too (12 Oct 2026). allProducts has already dropped
      // anything not Ready to Go, sold out, unpriced or in an archived collection, so nothing new is exposed.
      pool = mainProducts.concat(availableProducts);
    } else {
      // All: main (live) products only - available products go in their own section below
      pool = mainProducts;
    }

    var filtered = pool.filter(function(p) {
      // Search filter
      if (q) {
        var searchable = [p['Title'], p['Short Description'], p['Search Tags']].join(' ').toLowerCase();
        if (searchable.indexOf(q) === -1) return false;
      }
      // Collection filter (skip for personalised and all-view)
      if (!isPersonalised && !isGifts && collection && p['Collection'] !== collection) return false;
      // Price filter (skip for personalised)
      if (!isPersonalised) {
        var price = parseFloat(p.price || 3.50);
        if (!isNaN(priceMin) && price < priceMin - 0.001) return false;
        if (!isNaN(priceMax) && price > priceMax + 0.001) return false;
      }
      // Product-type filter (desktop toolbar: Keyrings / Bookmarks / Mugs / etc)
      if (_activeProductType && getProductType(p) !== _activeProductType) return false;
      return true;
    });

    // Sort
    if (sort === 'price-asc') {
      filtered.sort(function(a, b) { return parseFloat(a.price || 3.50) - parseFloat(b.price || 3.50); });
    } else if (sort === 'price-desc') {
      filtered.sort(function(a, b) { return parseFloat(b.price || 3.50) - parseFloat(a.price || 3.50); });
    } else if (sort === 'newest') {
      filtered.sort(function(a, b) { return b['Product ID'].localeCompare(a['Product ID']); });
    } else {
      // Featured: group by collection sort_order ASC, then per-product sort_order, then product_id
      filtered.sort(function(a, b) {
        if (isGifts) {
          var aRank = giftRank(a), bRank = giftRank(b);
          if (aRank !== bRank) return aRank - bRank;
        }
        var aColOrder = collectionsOrder[a['Collection']] !== undefined ? collectionsOrder[a['Collection']] : 99999;
        var bColOrder = collectionsOrder[b['Collection']] !== undefined ? collectionsOrder[b['Collection']] : 99999;
        if (aColOrder !== bColOrder) return aColOrder - bColOrder;
        var aSo = (a['sort_order'] != null && a['sort_order'] !== '') ? parseInt(a['sort_order']) : 9999;
        var bSo = (b['sort_order'] != null && b['sort_order'] !== '') ? parseInt(b['sort_order']) : 9999;
        if (aSo !== bSo) return aSo - bSo;
        return (a['Product ID'] || '').localeCompare(b['Product ID'] || '');
      });
    }

    products = filtered;
    // Results count
    var countEl = document.getElementById('resultsCount');
    if (countEl) {
      var poolSize;
      if (isPersonalised) {
        poolSize = allProducts.filter(function(p) { return p.personalised === 1; }).length;
      } else if (isGifts) {
        poolSize = allProducts.filter(isInSeason).length;
      } else if (collection) {
        poolSize = allProducts.filter(function(p) { return p['Collection'] === collection; }).length;
      } else {
        poolSize = q ? mainProducts.length + availableProducts.length : mainProducts.length;
      }
      countEl.textContent = 'Showing ' + filtered.length + ' of ' + poolSize + ' product' + (poolSize !== 1 ? 's' : '');
    }

    var grid = document.getElementById('grid');
    var noResults = document.getElementById('noResults');
    if (filtered.length === 0) {
      if (grid) grid.innerHTML = '';
      if (noResults) noResults.style.display = 'block';
    } else {
      if (noResults) noResults.style.display = 'none';
      renderGrid();
    }

    // Available section only shows in the "All" view, and not while searching (its products are in the results)
    var avEl = document.getElementById('availableSection');
    if (avEl) {
      if (!collection && !q) {
        renderAvailable();
      } else {
        avEl.innerHTML = '';
      }
    }

    updatePriceSliderFill();
    updateGiftsStrip();
  }

  function clearFilters() {
    var s = document.getElementById('searchInput');
    var so = document.getElementById('sortFilter');
    var mn = document.getElementById('priceMin');
    var mx = document.getElementById('priceMax');
    if (s) s.value = '';
    if (so) so.value = 'featured';
    if (mn) mn.value = mn.min;
    if (mx) mx.value = mx.max;
    updatePriceSliderFill();
    // Reset collection buttons to All
    document.querySelectorAll('#collectionFilterBar .col-btn').forEach(function(b) { b.classList.remove('active'); });
    var allBtn = document.querySelector('#collectionFilterBar .col-btn[data-col=""]');
    if (allBtn) allBtn.classList.add('active');
    // Reset type filter to All
    _activeProductType = '';
    document.querySelectorAll('#typeFilterRow .type-link').forEach(function(b) {
      b.classList.toggle('active', b.dataset.type === '');
    });
    var typeScope = document.getElementById('typeScopeSelect');
    if (typeScope) typeScope.value = '';
    applyFilters();
  }


  function stockNoteHtml(p) {
    // Only show/enforce once a real count has been entered on the staff stock page (task 71).
    if (Number(p.design_stock_tracked) !== 1) return '';
    var qty = Number(p.design_stock_qty);
    if (!Number.isFinite(qty)) return '';
    if (qty <= 0) {
      return '<div class="stock-note stock-low">Backorder - ordering now may add a few extra days to dispatch</div>';
    }
    var low = qty < 2;
    return '<div class="stock-note' + (low ? ' stock-low' : '') + '">' + qty + ' remaining</div>';
  }

  // Shop-card wording for products whose full title is too long for a card (14 Oct 2026). The product page,
  // popup, SEO and checkout keep the real title. `group` is the heading in the "All" view for a product that
  // is not in one of the manual collections (it is still on its automatic collection pages).
  var CARD_DISPLAY = {
    'mug-birthday-photo': { title: 'Birthday Photo Mug', sub: '16th, 18th, 21st & 40th \u2022 6 designs', group: 'Personalised gifts' }
  };

  function renderGrid() {
    var grid = document.getElementById('grid');
    if (!grid) return;

    // Check if we're in "All" unfiltered view
    var activeColBtn = document.querySelector('#collectionFilterBar .col-btn.active');
    var activeCol = activeColBtn ? activeColBtn.dataset.col : '';
    var showHeaders = activeCol === '';

    if (showHeaders && products.length > 0) {
      // Group products by collection
      var groups = {};
      var groupOrder = [];
      products.forEach(function(p) {
        var col = p['Collection'] || (CARD_DISPLAY[p['Product ID']] && CARD_DISPLAY[p['Product ID']].group) || 'Uncollected';
        if (!groups[col]) { groups[col] = []; groupOrder.push(col); }
        groups[col].push(p);
      });
      grid.innerHTML = groupOrder.map(function(col) {
        var cards = groups[col].map(function(p) { return renderCard(p); }).join('');
        return '<div class="collection-section">'
          + '<div class="collection-section-header">' + escHtml(col) + '</div>'
          + '<div class="collection-section-grid">' + cards + '</div>'
          + '</div>';
      }).join('');
      return;
    }

    grid.innerHTML = giftsIntroHtml(activeCol) + products.map(function(p) {
      var id = p['Product ID'];
      var priceId = p.stripe_price_id;
      var imgUrl = buildImageUrl(p['Image URL']) || buildImageUrl(id.toLowerCase());
      var pAttr = escAttr(JSON.stringify(p));
      var displayPrice = '£' + parseFloat(p.price || 3.50).toFixed(2);
      var variants = [];
      try { variants = JSON.parse(p.variants || '[]'); } catch(e) {
        variants = (p.variants || '').split(',').map(function(v) { return v.trim(); }).filter(Boolean);
      }
      var isPodProduct = !!(p.pod_gallery_images && p.pod_gallery_images !== '{}');
      var isPhotoCard = !!(window.CBJPhoto && CBJPhoto.isPhotoProduct(p));
      var needsVariant = variants.length > 1 || isPodProduct || isToteListing(p) || isPhotoCard;
      var inCart = Object.keys(cart).some(function(k) { return k.startsWith(priceId + '|'); });
      var isPersonalisedNonMug = p.personalised === 1;
      var addBtn = (needsVariant || isPersonalisedNonMug)
        ? '<button class="btn-add" onclick="event.stopPropagation(); openModal(' + pAttr + ')">' + (isPhotoCard ? 'Add your photo &rarr;' : 'Choose Options &rarr;') + '</button>'
        : '<button class="btn-add' + (inCart ? ' in-cart' : '') + '" onclick="event.stopPropagation(); addToCart(' + pAttr + ', null)">'
          + (inCart ? '&#10003; In Cart' : 'Add to Cart') + '</button>';
      var persBadge = isPersonalisedNonMug ? '<div><span class="pers-badge">&#9998; Personalisation available</span></div>' : '';
      var isBookmark = id.toLowerCase().startsWith('bookmark-') || (p.product_type || '').toLowerCase() === 'bookmark';
      var cardShow = CARD_DISPLAY[id] || null;
      return '<div class="card"' + (isBookmark ? ' data-product-type="bookmark"' : '') + (isPhotoCard ? ' data-photo-card="1"' : '') + ' onclick="trackEvent(\'product_card_click\', ' + escAttr(JSON.stringify(id)) + '); openModal(' + pAttr + ')">'
        + '<img src="' + escHtml(imgUrl) + '" alt="' + escHtml(p['Title']) + '" loading="lazy">'
        + toteStripHtml(p)
        + '<div class="card-body">'
        + '<div class="card-title"><a class="card-title-link" href="/products/' + encodeURIComponent(id) + '" onclick="event.preventDefault(); event.stopPropagation(); trackEvent(\'product_card_click\', ' + escAttr(JSON.stringify(id)) + '); openModal(' + pAttr + ');">' + escHtml(cardShow && cardShow.title ? cardShow.title : p['Title']) + '</a></div>'
        + (cardShow && cardShow.sub ? '<div class="card-sub">' + escHtml(cardShow.sub) + '</div>' : '')
        + '<div class="card-desc">' + escHtml(p['Short Description']) + '</div>'
        + persBadge
        + stockNoteHtml(p)
        + '<span class="price">' + displayPrice + '</span>'
        + addBtn
        + '<div class="card-view">View details &rarr;</div>'
        + '</div></div>';
    }).join('');
  }

  function renderCard(p) {
    var id = p['Product ID'];
    var priceId = p.stripe_price_id;
    var imgUrl = buildImageUrl(p['Image URL']) || buildImageUrl(id.toLowerCase());
    var pAttr = escAttr(JSON.stringify(p));
    var displayPrice = '£' + parseFloat(p.price || 3.50).toFixed(2);
    var variants = [];
    try { variants = JSON.parse(p.variants || '[]'); } catch(e) {
      variants = (p.variants || '').split(',').map(function(v) { return v.trim(); }).filter(Boolean);
    }
    var isPodProduct = !!(p.pod_gallery_images && p.pod_gallery_images !== '{}');
    var isPhotoCard = !!(window.CBJPhoto && CBJPhoto.isPhotoProduct(p));
    var needsVariant = variants.length > 1 || isPodProduct || isToteListing(p) || isPhotoCard;
    var inCart = Object.keys(cart).some(function(k) { return k.startsWith(priceId + '|'); });
    var isPersonalisedNonMug = p.personalised === 1;
    var addBtn = (needsVariant || isPersonalisedNonMug)
      ? '<button class="btn-add" onclick="event.stopPropagation(); openModal(' + pAttr + ')">' + (isPhotoCard ? 'Add your photo &rarr;' : 'Choose Options &rarr;') + '</button>'
      : '<button class="btn-add' + (inCart ? ' in-cart' : '') + '" onclick="event.stopPropagation(); addToCart(' + pAttr + ', null)">'
        + (inCart ? '&#10003; In Cart' : 'Add to Cart') + '</button>';
    var persBadge = isPersonalisedNonMug ? '<div><span class="pers-badge">&#9998; Personalisation available</span></div>' : '';
    var isBookmark = id.toLowerCase().startsWith('bookmark-') || (p.product_type || '').toLowerCase() === 'bookmark';
    var cardShow = CARD_DISPLAY[id] || null;
    return '<div class="card"' + (isBookmark ? ' data-product-type="bookmark"' : '') + (isPhotoCard ? ' data-photo-card="1"' : '') + ' onclick="trackEvent(\'product_card_click\', ' + escAttr(JSON.stringify(id)) + '); openModal(' + pAttr + ')">'
      + '<img src="' + escHtml(imgUrl) + '" alt="' + escHtml(p['Title']) + '" loading="lazy">'
      + toteStripHtml(p)
      + '<div class="card-body">'
      + '<div class="card-title"><a class="card-title-link" href="/products/' + encodeURIComponent(id) + '" onclick="event.preventDefault(); event.stopPropagation(); trackEvent(\'product_card_click\', ' + escAttr(JSON.stringify(id)) + '); openModal(' + pAttr + ');">' + escHtml(cardShow && cardShow.title ? cardShow.title : p['Title']) + '</a></div>'
        + (cardShow && cardShow.sub ? '<div class="card-sub">' + escHtml(cardShow.sub) + '</div>' : '')
      + '<div class="card-desc">' + escHtml(p['Short Description']) + '</div>'
      + persBadge
      + stockNoteHtml(p)
      + '<span class="price">' + displayPrice + '</span>'
      + addBtn
      + '<div class="card-view">View details &rarr;</div>'
      + '</div></div>';
  }

  function openModal(p, quiet) {
    // quiet: product page re-drawing itself after Add to Cart; not a new view, so nothing is tracked.
    if (!quiet && window.__modalOpenedId) { closeModalTracking(); }
    var id = p['Product ID'];
    if (!quiet) trackEvent('product_view', id);
    window.__modalOpenedAt = Date.now();
    window.__modalOpenedId = PRODUCT_PAGE ? null : id;  // a product page has no popup to close, so no modal_close
    window.__modalImagesViewed = 1;
    if (id && !PRODUCT_PAGE) {
      history.pushState({ productId: id }, '', '/store/#' + id);
      document.title = (p['Title'] || id) + ' - Crafts by Jon';
      var metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', (p['Short Description'] || p['Title'] || '') + ' Handmade in Deal, Kent by Crafts by Jon. From £' + (p.price || '3.50') + '.');
    }
    selectedVariant = null;
    _selectedMugColour = '';
    var id = p['Product ID'];
    var priceId = p.stripe_price_id;
    var inCart = Object.keys(cart).some(function(k) { return k.startsWith(priceId + '|'); });
    var isMug = (p.product_type || '').toLowerCase() === 'mug';

    // POD colour/size selector setup - computed before mainImgUrl so the hero image
    // and thumbnail strip can default to it on first open, not just after a click.
    podSelectedColour = null;
    podSelectedSize = null;
    podSelectedVariantId = null;
    podSelectedProductUid = null;
    podSelectedPrice = null;
    podSelectedImage = null;
    printState = null;
    toteState = null;
    resetPhotoState();
    _podVariants = [];
    podGalleryData = {};
    try { podGalleryData = JSON.parse(p.pod_gallery_images || '{}'); } catch (e) {}
    var isPod = Object.keys(podGalleryData).length > 0;
    var podColourKeys = isPod ? Object.keys(podGalleryData) : [];
    var podDefaultColour = isPod
      ? (podColourKeys.find(function(c) { return c.toLowerCase() === 'natural'; }) || podColourKeys[0])
      : null;
    var podDefaultGallery = podDefaultColour ? (podGalleryData[podDefaultColour] || {}) : {};
    var isPrintProduct = isPod && (p.product_type || '').toLowerCase() === 'print';
    if (isPrintProduct) {
      printState = { vars: [], gallery: {}, frame: 'None', size: null, text: 'Yes', shownKey: null };
      loadPrintData(id);
    } else if (isPod) {
      podSelectedColour = podDefaultColour;
      loadPodVariants(id);
    }
    var isToteProduct = !isPod && isToteListing(p);
    if (isToteProduct) {
      toteState = { vars: [], colour: null, text: null, shownKey: null };
      loadToteData(id);
    }
    var mainImgUrl = buildImageUrl(p['Image URL']) || buildImageUrl(id.toLowerCase());
    var mugFrontUrl = isMug ? buildImageUrl(p.mug_image_front) : null;
    var mugScene1Url = isMug ? buildImageUrl(p.mug_image_scene1) : null;
    var mugScene2Url = isMug ? buildImageUrl(p.mug_image_scene2) : null;
    var mugWrapUrl = isMug ? buildImageUrl(p.mug_image_wrap) : null;
    var mugAllImgs = isMug ? [mugFrontUrl, mugScene1Url, mugScene2Url, mugWrapUrl].filter(Boolean) : [];
    if (isMug && mugAllImgs.length > 0) mainImgUrl = mugAllImgs[0];
    // Shot keys cover both apparel galleries (front/front_alt/lifestyle_female/lifestyle_male
    // /size_chart) and flat-print galleries (flat/lifestyle_living_room/lifestyle_bedroom) -
    // missing the print-specific keys here left prints showing only a single image
    // (found 21 Aug 2026).
    var podDefaultShots = isPod
      ? [podDefaultGallery.front, podDefaultGallery.front_alt, podDefaultGallery.flat,
         podDefaultGallery.lifestyle_female, podDefaultGallery.lifestyle_male,
         podDefaultGallery.lifestyle_living_room, podDefaultGallery.lifestyle_bedroom,
         podDefaultGallery.size_chart]
          .map(buildImageUrl).filter(Boolean)
      : [];
    if (isPod && podDefaultShots.length > 0) mainImgUrl = podDefaultShots[0];
    currentModalImages = podDefaultShots.length > 0 ? podDefaultShots : (mugAllImgs.length > 0 ? mugAllImgs : (mainImgUrl ? [mainImgUrl] : []));
    var ownMain = buildImageUrl(p['Image URL']) || buildImageUrl(id.toLowerCase());
    modalDefaultImages = (mugAllImgs.length > 0 ? mugAllImgs : (ownMain ? [ownMain] : [])).slice();
    var basePrice = parseFloat(p.price || 3.50);
    var displayPrice = '£' + basePrice.toFixed(2);

    if (!quiet) gtag('event', 'view_item', {
      currency: 'GBP',
      value: parseFloat(p.price || 3.50),
      items: [{ item_id: id, item_name: p['Title'], item_category: p['Collection'] || '', price: parseFloat(p.price || 3.50), quantity: 1 }]
    });

    var variants = [];
    try { variants = JSON.parse(p.variants || '[]'); } catch (e) {
      variants = (p.variants || '').split(',').map(function(v) { return v.trim(); }).filter(Boolean);
    }

    var variantImages = {};
    try { variantImages = JSON.parse(p.variant_images || '{}'); } catch (e) {}


    var firstKey = variants.length > 0 ? variants[0].toLowerCase() : '';
    modalVariantNames = variants.slice();
    // Generic per-variant image lookup (any variant name, not just "black") -
    // matches variant_images keys case-insensitively, e.g. {"Natural Raw": "...jpg"}.
    function variantImageUrl(name) {
      if (!name) return '';
      var key = Object.keys(variantImages).find(function(k) { return k.toLowerCase() === name.toLowerCase(); });
      return key ? buildImageUrl(variantImages[key]) : '';
    }
    // The Black thumbnail below used blackUrl without ever defining it, so the popup threw
    // "blackUrl is not defined" and never opened for any Clear/Black product (found 11 Oct 2026;
    // broken since at least 5 Sep 2026, no sale of keyring-001 to -010 since 8 Jul).
    var blackUrl = variantImageUrl('black');

    var bullets = [
      p['Bullet Point 1'], p['Bullet Point 2'], p['Bullet Point 3'],
      p['Bullet Point 4'], p['Bullet Point 5']
    ].filter(function(b) { return b && b.trim(); });

    var pAttr = escAttr(JSON.stringify(p));
    var html = '';

    var persImgUrl = p.personalisation_image_url ? buildImageUrl(p.personalisation_image_url) : null;
    if (persImgUrl) currentModalImages.push(persImgUrl);

    var galleryUrls = [];
    try {
      galleryUrls = JSON.parse(p.gallery_images || '[]').map(buildImageUrl).filter(Boolean);
    } catch (e) { galleryUrls = []; }
    galleryUrls.forEach(function(u) { currentModalImages.push(u); });

    html += '<div class="modal-img-col">';
    html += '<img class="modal-img-main" id="modalMainImg" src="' + escHtml(mainImgUrl) + '" alt="' + escHtml(p['Title']) + '" onclick="openLightbox(this.src, this.alt, currentModalImages)">';
    html += '<p class="modal-img-note" id="modalImgNote" role="status" aria-live="polite" hidden></p>';
    if (persImgUrl) {
      html += '<div class="modal-thumbs">';
      html += '<img class="modal-thumb active" src="' + escHtml(mainImgUrl) + '" alt="Standard" onclick="swapModalImg(\'' + escAttr(mainImgUrl) + '\', this)" title="Standard">';
      html += '<img class="modal-thumb" src="' + escHtml(persImgUrl) + '" alt="Personalised" onclick="swapModalImg(\'' + escAttr(persImgUrl) + '\', this)" title="Personalised example">';
      html += '</div>';
      html += '<div style="font-size:0.78rem;color:#888;text-align:center;margin-top:4px">Standard &nbsp;|&nbsp; Personalised example</div>';
    }
    if (isMug && mugAllImgs.length > 1) {
      var mugThumbLabels = ['Front', 'Scene 1', 'Scene 2', 'Wrap'];
      var rawMugImgs = [mugFrontUrl, mugScene1Url, mugScene2Url, mugWrapUrl];
      html += '<div class="modal-thumbs">';
      var mugThumbFirst = true;
      rawMugImgs.forEach(function(url, i) {
        if (!url) return;
        var activeClass = mugThumbFirst ? ' active' : '';
        mugThumbFirst = false;
        html += '<img class="modal-thumb' + activeClass + '" src="' + escHtml(url) + '" alt="' + mugThumbLabels[i] + '" onclick="swapModalImg(\'' + escAttr(url) + '\', this)" title="' + mugThumbLabels[i] + '">';
      });
      html += '</div>';
    } else if (!isMug && variants.length > 1) {
      html += '<div class="modal-thumbs">';
      html += '<img class="modal-thumb active" data-variant-key="' + escAttr(firstKey) + '" src="' + escHtml(mainImgUrl) + '" alt="' + escHtml(variants[0]) + '" onclick="swapModalImg(\'' + escAttr(mainImgUrl) + '\', this)">';
      if (blackUrl) {
        html += '<img class="modal-thumb" data-variant-key="black" src="' + escHtml(blackUrl) + '" alt="Black" onclick="swapModalImg(\'' + escAttr(blackUrl) + '\', this)">';
      }
      html += '</div>';
    } else if (isPod && podDefaultShots.length > 0) {
      html += '<div class="modal-thumbs">';
      podDefaultShots.forEach(function(u, i) {
        html += '<img class="modal-thumb' + (i === 0 ? ' active' : '') + '" src="' + escHtml(u) + '" alt="' + escHtml(podDefaultColour) + '" onclick="swapModalImg(\'' + escAttr(u) + '\', this)">';
      });
      html += '</div>';
    }
    if (galleryUrls.length > 0) {
      var hadStrip = !!persImgUrl || (isMug && mugAllImgs.length > 1) || (!isMug && variants.length > 1) || (isPod && podDefaultShots.length > 0);
      html += '<div class="modal-thumbs">';
      if (!hadStrip) {
        html += '<img class="modal-thumb active" src="' + escHtml(mainImgUrl) + '" alt="Main" onclick="swapModalImg(\'' + escAttr(mainImgUrl) + '\', this)" title="Main">';
      }
      galleryUrls.forEach(function(u, i) {
        html += '<img class="modal-thumb" src="' + escHtml(u) + '" alt="Photo ' + (i + 2) + '" onclick="swapModalImg(\'' + escAttr(u) + '\', this)" title="Photo ' + (i + 2) + '">';
      });
      html += '</div>';
    }
    html += '</div>';

    html += '<div class="modal-details-col">';
    if (p['Collection']) {
      html += '<div class="modal-collection">' + escHtml(p['Collection']) + ' Collection</div>';
    }
    html += '<div class="modal-title">' + escHtml(p['Title']) + '</div>';
    // The mug note sits inside the price row in the shop popup (so it stays under the price at every width there),
    // and straight after it on product pages (placed by product-page.css).
    var mugDeal = isMugDealProduct(p) ? mugDealHtml() : '';
    html += '<div class="modal-price-row"><span class="price" id="modalPriceVal">' + displayPrice + '</span>' + (PRODUCT_PAGE ? '' : mugDeal) + '</div>';
    html += stockNoteHtml(p);
    if (PRODUCT_PAGE) html += mugDeal;
    html += '<hr class="modal-hr">';

    if (p['Short Description']) {
      html += '<p class="modal-short-desc">' + escHtml(p['Short Description']) + '</p>';
    }
    if (p['Full Description']) {
      html += '<p class="modal-full-desc">' + escHtml(p['Full Description']) + '</p>';
    }
    if (bullets.length > 0) {
      html += '<ul class="modal-bullets">';
      bullets.forEach(function(b) { html += '<li>' + escHtml(b) + '</li>'; });
      html += '</ul>';
    }

    var needsVariantSelection = !isMug && variants.length > 1;
    var isPhotoProduct = !!(window.CBJPhoto && CBJPhoto.isPhotoProduct(p));
    if (isPhotoProduct) {
      photoState = { productId: id, spec: CBJPhoto.spec(p), vars: [], option: null, file: null, objectUrl: null,
        upload: null, uploading: false, view: null, error: null, rights: false, nameOk: true, token: Math.random() };
      html += photoPickerHtml(p);
    }

    if (isMug && p.personalised === 1) {
      var mugMessages = [];
      try { mugMessages = JSON.parse(p.mug_messages || '[]'); } catch {}
      var mugColours = [];
      try { mugColours = JSON.parse(p.mug_text_colours || '[]'); } catch {}
      var displayColours = mugColours.filter(function(c) { return c.toUpperCase() !== '#FFFFFF'; });

      html += '<hr class="modal-hr"><div class="mug-personalisation">';

      html += '<div><div class="mug-field-label">Personalise with a name <span style="color:#aaa;font-weight:400">(max 20 chars)</span></div>';
      html += '<input class="mug-text-input" id="modal-mug-name" type="text" maxlength="20" placeholder="e.g. Miss Smith" oninput="updateMugNameCounter()">';
      html += '<div class="mug-char-counter"><span id="mug-name-count">0</span>/20</div></div>';

      if (mugMessages.length > 0) {
        html += '<div><div class="mug-field-label">Choose a message</div>';
        html += '<select class="mug-select" id="modal-mug-message" onchange="handleMugMessageChange(this)">';
        html += '<option value="">- Select a message -</option>';
        mugMessages.forEach(function(msg) {
          html += '<option value="' + escAttr(msg) + '">' + escHtml(msg) + '</option>';
        });
        html += '</select>';
        html += '<input class="mug-text-input" id="modal-mug-custom-message" type="text" maxlength="40" placeholder="Your message (max 40 chars)" style="display:none;margin-top:6px" oninput="updateMugMsgCounter()">';
        html += '<div class="mug-char-counter" id="mug-msg-counter-row" style="display:none"><span id="mug-msg-count">0</span>/40</div></div>';
      }

      if (displayColours.length > 0) {
        html += '<div><div class="mug-field-label">Text colour</div><div class="mug-store-swatches">';
        displayColours.forEach(function(hex) {
          html += '<button class="mug-store-swatch" style="background:' + escHtml(hex) + '" title="' + escAttr(hex) + '" onclick="selectMugColour(this, \'' + escAttr(hex) + '\')"></button>';
        });
        html += '<label style="display:inline-flex;align-items:center;gap:4px;font-size:0.82rem;cursor:pointer">';
        html += '<input type="checkbox" id="modal-mug-other-colour-cb" onchange="toggleMugOtherColourStore(this)"> Other';
        html += '</label>';
        html += '<input type="color" id="modal-mug-other-colour-picker" value="#000000" style="display:none;width:28px;height:28px;border:none;cursor:pointer;background:none" oninput="selectMugColourOther(this.value)">';
        html += '</div>';
        html += '<div class="mug-colour-selected" id="mug-colour-selected-display"><em>None selected</em></div></div>';
      }

      html += '<div class="mug-lead-time">☕ Personalised mugs are made to order</div>';
      html += '</div>';
    } else if (p.personalised === 1) {
      var persNote = p.personalisation_note || 'Added to the rear of the product';
      html += '<hr class="modal-hr"><div class="mug-personalisation">';
      html += '<div><div class="mug-field-label">Personalise this item <span style="color:#aaa;font-weight:400">(+£1.50)</span></div>';
      html += '<div style="font-size:0.82rem;color:#888;margin-bottom:8px">' + escHtml(persNote) + '</div>';
      html += '<input class="mug-text-input" id="modal-pers-text" type="text" maxlength="30" placeholder="e.g. Miss Smith" oninput="updatePersCounter()">';
      html += '<div class="mug-char-counter"><span id="pers-char-count">0</span>/30</div>';
      html += '<div style="font-size:0.78rem;color:#aaa;margin-top:6px">Leave blank for standard version at £' + basePrice.toFixed(2) + '</div>';
      html += '</div></div>';
    }

    if (needsVariantSelection) {
      html += '<hr class="modal-hr">';
      html += '<div class="modal-variants-label">Options</div>';
      html += '<div class="modal-variants">';
      variants.forEach(function(v) {
        var vImg = variantImageUrl(v) || mainImgUrl;
        html += '<button class="modal-variant-btn" data-img-url="' + escAttr(vImg) + '" onclick="selectVariant(\'' + escAttr(v) + '\', this)">' + escHtml(v) + '</button>';
      });
      html += '</div>';
    }

    if (isPrintProduct) {
      html += printPickerHtml();
    } else if (isPod) {
      html += '<hr class="modal-hr">';
      html += '<div class="modal-variants-label">Colour</div>';
      html += '<div class="modal-variants" id="podColourRow">';
      podColourKeys.forEach(function(colour) {
        var isDefault = colour === podDefaultColour;
        html += '<button class="modal-variant-btn' + (isDefault ? ' selected' : '') + '" onclick="selectPodColour(\'' + escAttr(colour) + '\', this)">' + escHtml(colour) + '</button>';
      });
      html += '</div>';
      html += '<div class="modal-variants-label" id="podSizeLabel" style="display:none">Size</div>';
      html += '<div class="modal-variants" id="podSizeRow"></div>';
    }

    if (isToteProduct) html += totePickerHtml();

    html += '<div class="modal-actions">';
    if (isPhotoProduct) {
      html += '<button class="btn-add" id="modalAddBtn" disabled onclick="modalAddToCart(' + pAttr + ')">Add to Cart</button>';
      html += '<div class="modal-variant-hint" id="modalVariantHint">Choose the birthday, add your photo and tick the box to continue</div>';
    } else if (needsVariantSelection) {
      html += '<button class="btn-add" id="modalAddBtn" disabled onclick="modalAddToCart(' + pAttr + ')">Add to Cart</button>';
      html += '<div class="modal-variant-hint" id="modalVariantHint">Please select a finish before adding to cart</div>';
    } else if (isToteProduct) {
      html += '<button class="btn-add" id="modalAddBtn" disabled onclick="modalAddToCart(' + pAttr + ')">Add to Cart</button>';
      html += '<div class="modal-variant-hint" id="modalVariantHint">Please choose a colour and text option before adding to cart</div>';
    } else if (isPod) {
      html += '<button class="btn-add" id="modalAddBtn" disabled onclick="modalAddToCart(' + pAttr + ')">Add to Cart</button>';
      html += '<div class="modal-variant-hint" id="modalVariantHint">' + (isPrintProduct ? 'Please choose a size before adding to cart' : 'Please select a colour and size before adding to cart') + '</div>';
    } else if (p.personalised === 1 && (p.product_type || '').toLowerCase() !== 'mug') {
      var basePriceStr = '£' + parseFloat(p.price || 3.50).toFixed(2);
      var persPriceStr = '£' + (parseFloat(p.price || 3.50) + 1.50).toFixed(2);
      html += '<button class="btn-add' + (inCart ? ' in-cart' : '') + '" id="modalAddBtn" data-base-price="' + parseFloat(p.price || 3.50).toFixed(2) + '" onclick="modalAddToCart(' + pAttr + ')">'
        + (inCart ? '&#10003; In Cart' : 'Add to Cart - ' + basePriceStr) + '</button>';
      html += '<div class="modal-variant-hint" id="modalPersHint" style="color:#4a6fa5;display:block">Add a name above to personalise (+£1.50 = ' + persPriceStr + ')</div>';
    } else {
      html += '<button class="btn-add' + (inCart ? ' in-cart' : '') + '" id="modalAddBtn" onclick="modalAddToCart(' + pAttr + ')">'
        + (inCart ? '&#10003; In Cart' : 'Add to Cart') + '</button>';
    }
    html += '</div>';
    var modalQuotes = [
      '"Great quality, excellent service, and amazing value for money." - Sally, real customer',
      '"Parcel arrived safe and sound today, the bookmarks are beautiful." - Graham, real customer',
      '"The bookmarks are even better in person! They look fabulous." - Mirjam, real customer',
      '"Am thrilled with it! Very high quality and lovely image." - Tina-Merie, real customer'
    ];
    html += '<div class="modal-testimonial">' + modalQuotes[Math.floor(Math.random() * modalQuotes.length)] + '</div>';
    if (isPhotoProduct) {
      // No dispatch or delivery time is promised for photo products (13 Oct 2026, Jon).
      html += '<div class="modal-shipping">Made to order with your photo &middot; Printed to order and delivered directly to you</div>';
    } else if ((p.application_method || '').indexOf('Print on Demand') === 0) {
      html += '<div class="modal-shipping">Printed to order &middot; Postage included</div>';
    } else {
      html += '<div class="modal-shipping">Handmade in Deal, Kent &middot; Ships within 1&ndash;2 business days &middot; Free UK shipping on orders £10+</div>';
    }
    html += '</div>';

    document.getElementById('modalInner').innerHTML = html;
    if (isPhotoProduct) loadPhotoOptions(id);

    var related = getRelatedProducts(id, p['Collection']);
    var relHtml = '';
    if (related.length > 0) {
      relHtml += '<div class="related-heading">You might also like</div>';
      relHtml += '<div class="related-grid">';
      related.forEach(function(rp) {
        var rid = rp['Product ID'];
        var rpAttr = escAttr(JSON.stringify(rp));
        var rImgUrl = buildImageUrl(rp['Image URL']) || buildImageUrl(rid.toLowerCase());
        var rPrice = '£' + parseFloat(rp.price || 3.50).toFixed(2);
        var rVariants = [];
        try { rVariants = JSON.parse(rp.variants || '[]'); } catch(e) {
          rVariants = (rp.variants || '').split(',').map(function(v) { return v.trim(); }).filter(Boolean);
        }
        var rBtnText = rVariants.length > 1 ? 'Choose Options &rarr;' : 'Add to Cart';
        relHtml += '<div class="related-card" onclick="openModalFrom(\'related_click\', ' + escAttr(JSON.stringify(p['Product ID'])) + ', ' + rpAttr + ')">'
          + '<img src="' + escHtml(rImgUrl) + '" alt="' + escHtml(rp['Title']) + '" loading="lazy">'
          + '<div class="related-card-body">'
          + '<div class="related-card-title">' + escHtml(rp['Title']) + '</div>'
          + '<div class="related-card-price">' + rPrice + '</div>'
          + '<button class="related-card-btn" onclick="event.stopPropagation(); openModalFrom(\'related_click\', ' + escAttr(JSON.stringify(p['Product ID'])) + ', ' + rpAttr + ')">' + rBtnText + '</button>'
          + '</div></div>';
      });
      relHtml += '</div>';
    }
    // Same design in other printed product types (task 174): 'Love this design? Also available as'
    var sameDesign = getDesignLinks(p);
    var designHtml = '';
    if (sameDesign.length > 0) {
      designHtml += '<div class="related-heading">Love this design? Also available as</div>';
      designHtml += '<div class="related-grid">';
      sameDesign.forEach(function(dp) {
        var did = dp['Product ID'];
        var dpAttr = escAttr(JSON.stringify(dp));
        var dImgUrl = buildImageUrl(dp['Image URL']) || buildImageUrl(did.toLowerCase());
        designHtml += '<div class="related-card" onclick="openModalFrom(\'design_link_click\', ' + escAttr(JSON.stringify(p['Product ID'])) + ', ' + dpAttr + ')">'
          + '<img src="' + escHtml(dImgUrl) + '" alt="' + escHtml(dp['Title']) + '" loading="lazy">'
          + '<div class="related-card-body">'
          + '<div class="related-card-title">' + escHtml(DESIGN_LINK_LABELS[dp['product_type']] || dp['product_type']) + '</div>'
          + '<button class="related-card-btn" onclick="event.stopPropagation(); openModalFrom(\'design_link_click\', ' + escAttr(JSON.stringify(p['Product ID'])) + ', ' + dpAttr + ')">View &rarr;</button>'
          + '</div></div>';
      });
      designHtml += '</div><div style="height:22px"></div>';
    }
    document.getElementById('modalRelated').innerHTML = designHtml + relHtml;

    document.getElementById('modalOverlay').classList.add('open');
    document.getElementById('modalWrap').classList.add('open');
    if (!PRODUCT_PAGE) document.body.style.overflow = 'hidden';
    else document.dispatchEvent(new CustomEvent('cbj:product-drawn', { detail: { product: p } }));
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
  }

  // Opens a product from the related or same-design row, recording which product the click came from (task 177)
  function openModalFrom(kind, fromId, product) {
    trackEvent(kind, product['Product ID'], 'from:' + fromId);
    if (PRODUCT_PAGE) { window.location.href = '/products/' + encodeURIComponent(product['Product ID']); return; }
    openModal(product);
  }

  // Same design in other printed product types, matched on design_key (task 174). Printed types only
  // for now: add 'Bookmark' / 'Keyring' here (and in products-api/design-links.js) to include handmade.
  var DESIGN_LINK_TYPES = ['Mug', 'Print', 'T-Shirt', 'Tote Bag'];
  var DESIGN_LINK_LABELS = { 'Mug': 'Mug', 'Print': 'Art print', 'T-Shirt': 'T-shirt', 'Tote Bag': 'Tote bag' };
  function getDesignLinks(p) {
    var key = String(p['design_key'] || '').trim().toLowerCase();
    if (!key) return [];
    var out = [];
    DESIGN_LINK_TYPES.forEach(function(type) {
      if (p['product_type'] === type) return;
      var matches = allProducts.filter(function(x) {
        return x['Product ID'] !== p['Product ID'] && x['product_type'] === type
          && String(x['design_key'] || '').trim().toLowerCase() === key;
      }).sort(function(a, b) { return String(a['Product ID']).localeCompare(String(b['Product ID'])); });
      if (matches.length) out.push(matches[0]);
    });
    return out;
  }

  function getRelatedProducts(currentId, currentCollection) {
    var pool = allProducts.filter(function(p) { return p['Product ID'] !== currentId; });
    var same = pool.filter(function(p) { return currentCollection && p['Collection'] === currentCollection; });
    var others = pool.filter(function(p) { return !currentCollection || p['Collection'] !== currentCollection; });
    shuffle(same);
    shuffle(others);
    var result = same.slice(0, 4);
    if (result.length < 4) {
      result = result.concat(others.slice(0, 4 - result.length));
    }
    return result;
  }

  function renderAvailable() {
    var el = document.getElementById('availableSection');
    if (!el) return;
    if (availableProducts.length === 0) { el.innerHTML = ''; return; }
    var html = '<div class="available-section"><div class="available-heading">Also available</div><div class="available-grid">';
    availableProducts.forEach(function(p) {
      var id = p['Product ID'];
      var pAttr = escAttr(JSON.stringify(p));
      var priceId = p.stripe_price_id;
      var imgUrl = buildImageUrl(p['Image URL']) || buildImageUrl(id.toLowerCase());
      var displayPrice = '£' + parseFloat(p.price || 3.50).toFixed(2);
      var variants = [];
      try { variants = JSON.parse(p.variants || '[]'); } catch(e) {
        variants = (p.variants || '').split(',').map(function(v) { return v.trim(); }).filter(Boolean);
      }
      var isPodProduct = !!(p.pod_gallery_images && p.pod_gallery_images !== '{}');
      var isPhotoCard = !!(window.CBJPhoto && CBJPhoto.isPhotoProduct(p));
      var needsVariant = variants.length > 1 || isPodProduct || isToteListing(p) || isPhotoCard;
      var inCart = Object.keys(cart).some(function(k) { return k.startsWith(priceId + '|'); });
      var isPersonalisedNonMug = p.personalised === 1;
      var addBtn = (needsVariant || isPersonalisedNonMug)
        ? '<button class="btn-add" onclick="event.stopPropagation(); openModal(' + pAttr + ')">' + (isPhotoCard ? 'Add your photo &rarr;' : 'Choose Options &rarr;') + '</button>'
        : '<button class="btn-add' + (inCart ? ' in-cart' : '') + '" onclick="event.stopPropagation(); addToCart(' + pAttr + ', null)">'
          + (inCart ? '&#10003; In Cart' : 'Add to Cart') + '</button>';
      html += '<div class="available-card" onclick="openModal(' + pAttr + ')">'
        + '<img src="' + escHtml(imgUrl) + '" alt="' + escHtml(p['Title']) + '" loading="lazy">'
        + '<div class="available-card-body">'
        + '<div class="available-card-title">' + escHtml(p['Title']) + '</div>'
        + '<div class="available-card-desc">' + escHtml(p['Short Description']) + '</div>'
        + '<span class="price">' + displayPrice + '</span>'
        + addBtn
        + '<div class="card-view">View details &rarr;</div>'
        + '</div></div>';
    });
    html += '</div></div>';
    el.innerHTML = html;
  }

  window.addEventListener('popstate', function(e) {
    var modal = document.getElementById('modal-overlay');
    if (modal && modal.style.display !== 'none') closeModal();
  });

  function closeModalTracking() {
    if (window.__modalOpenedId) {
      var durationMs = Date.now() - (window.__modalOpenedAt || Date.now());
      trackEvent('modal_close', window.__modalOpenedId, JSON.stringify({ duration_ms: durationMs, images_viewed: window.__modalImagesViewed || 1 }));
      window.__modalOpenedId = null;
    }
  }

  function closeModal() {
    if (PRODUCT_PAGE) return;
    closeModalTracking();
    history.pushState({}, '', '/store/');
    document.title = 'Crafts by Jon - Handmade Acrylic Keyrings & Bookmarks';
    document.getElementById('modalOverlay').classList.remove('open');
    document.getElementById('modalWrap').classList.remove('open');
    if (!document.getElementById('cartPanel').classList.contains('open')) {
      document.body.style.overflow = '';
    }
    selectedVariant = null;
    resetPhotoState();
  }

  function openAboutModal() {
    trackEvent('about_modal_open', 'header_avatar');
    document.getElementById('aboutModalOverlay').classList.add('open');
    document.getElementById('aboutModalWrap').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeAboutModal() {
    document.getElementById('aboutModalOverlay').classList.remove('open');
    document.getElementById('aboutModalWrap').classList.remove('open');
    if (!document.getElementById('modalWrap').classList.contains('open') &&
        !document.getElementById('cartPanel').classList.contains('open')) {
      document.body.style.overflow = '';
    }
  }

  function loadPodVariants(productId) {
    fetch(API + '/products/' + encodeURIComponent(productId) + '/public-variants')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        _podVariants = (data && data.result) || [];
        if (podSelectedColour) renderPodSizes(podSelectedColour);
      })
      .catch(function() { _podVariants = []; });
  }

  // ===== Print picker: Frame x Size x Text (30 Sep 2026) =====
  // Logic lives in /store/print-picker.js (CBJPrint). Only prints use this; every other product is untouched.
  function printPickerHtml() {
    var loading = '<span style="font-size:0.85rem;color:#888">Loading&hellip;</span>';
    return '<hr class="modal-hr">'
      + '<div class="modal-variants-label">Frame</div><div class="modal-variants" id="printFrameRow">' + loading + '</div>'
      + '<div id="printFrameNote" style="font-size:0.8rem;color:#888;margin:-2px 0 12px;line-height:1.4"></div>'
      + '<div class="modal-variants-label">Size</div><div class="modal-variants" id="printSizeRow"></div>'
      + '<div class="modal-variants-label">Wording</div><div class="modal-variants" id="printTextRow"></div>';
  }

  function loadPrintData(productId) {
    var st = printState;
    var base = API + '/products/' + encodeURIComponent(productId);
    Promise.all([
      fetch(base + '/public-variants').then(function(r) { return r.json(); }).catch(function() { return {}; }),
      fetch(base + '/public-variant-gallery').then(function(r) { return r.json(); }).catch(function() { return {}; })
    ]).then(function(res) {
      if (printState !== st) return;  // the modal moved on to another product
      st.vars = (res[0] && res[0].result) || [];
      st.gallery = (res[1] && res[1].result) || {};
      var row = document.getElementById('printFrameRow');
      if (!window.CBJPrint || !CBJPrint.isPrintVariants(st.vars)) {
        if (row) row.innerHTML = '<span style="font-size:0.85rem;color:#888">Options are not available right now.</span>';
        return;
      }
      var fr = CBJPrint.frames(st.vars);
      st.frame = fr.indexOf('None') >= 0 ? 'None' : fr[0];
      var tx = CBJPrint.texts(st.vars);
      st.text = tx.indexOf('Yes') >= 0 ? 'Yes' : tx[0];
      renderPrintPicker();
      refreshPrintGallery();
    });
  }

  function renderPrintPicker() {
    var st = printState;
    if (!st || !document.getElementById('printFrameRow')) return;
    function btn(kind, val, label, selected) {
      return '<button class="modal-variant-btn' + (selected ? ' selected' : '') + '" data-val="' + escAttr(val) + '" onclick="printPick(\'' + kind + '\', this)">' + label + '</button>';
    }
    document.getElementById('printFrameRow').innerHTML = CBJPrint.frames(st.vars).map(function(f) {
      return btn('frame', f, escHtml(CBJPrint.frameLabel(f)), f === st.frame);
    }).join('');
    document.getElementById('printSizeRow').innerHTML = CBJPrint.sizes(st.vars, st.frame).map(function(sz) {
      var v = CBJPrint.find(st.vars, st.frame, sz, st.text);
      var price = v && v.retail_price_pence != null ? ' &mdash; £' + (v.retail_price_pence / 100).toFixed(2) : '';
      return btn('size', sz, escHtml(sz) + price, sz === st.size);
    }).join('');
    document.getElementById('printTextRow').innerHTML = CBJPrint.texts(st.vars).map(function(t) {
      return btn('text', t, escHtml(CBJPrint.textLabel(t)), t === st.text);
    }).join('');
    var charges = CBJPrint.frameChargeList(st.vars, st.text);
    var note = document.getElementById('printFrameNote');
    if (note) {
      note.textContent = charges.length
        ? 'Framed prints arrive ready to hang. Add a frame for ' + charges.map(function(c) {
            return '+£' + (c.charge / 100).toFixed(2).replace(/\.00$/, '') + ' at ' + parseInt(c.size, 10) + ' cm';
          }).join(', ') + '.'
        : '';
    }
    updatePrintSelection();
  }

  function printPick(kind, btn) {
    var st = printState;
    if (!st) return;
    var val = btn.getAttribute('data-val');
    if (kind === 'frame') st.frame = val;
    else if (kind === 'size') st.size = val;
    else if (kind === 'text') st.text = val;
    // keep the chosen size only if this Frame and Text still offer it
    if (st.size && !CBJPrint.find(st.vars, st.frame, st.size, st.text)) st.size = null;
    renderPrintPicker();
    refreshPrintGallery();
  }

  // Sets the same cart/price state the other POD products use, once a full combination is chosen.
  function updatePrintSelection() {
    var st = printState;
    var addBtn = document.getElementById('modalAddBtn');
    var hint = document.getElementById('modalVariantHint');
    var priceEl = document.getElementById('modalPriceVal');
    var v = st.size ? CBJPrint.find(st.vars, st.frame, st.size, st.text) : null;
    if (v) {
      var g = CBJPrint.galleryFor(st.gallery, st.vars, st.frame, st.size, st.text);
      podSelectedColour = CBJPrint.cartLabel(st.frame, st.text);
      podSelectedSize = st.size;
      podSelectedVariantId = v.gelato_variant_id;
      podSelectedProductUid = v.gelato_product_uid;
      podSelectedPrice = v.retail_price_pence != null ? v.retail_price_pence : null;
      podSelectedImage = g.urls[0] || null;
      if (addBtn) addBtn.disabled = false;
      if (hint) hint.style.display = 'none';
    } else {
      podSelectedColour = null; podSelectedSize = null; podSelectedVariantId = null;
      podSelectedProductUid = null; podSelectedPrice = null; podSelectedImage = null;
      if (addBtn) addBtn.disabled = true;
      if (hint) hint.style.display = '';
    }
    updatePodPriceDisplay();
    if (priceEl) {
      if (podSelectedPrice != null) {
        priceEl.textContent = '£' + (podSelectedPrice / 100).toFixed(2);
      } else {
        var prices = st.vars.map(function(x) { return x.retail_price_pence; }).filter(function(n) { return n != null; });
        if (prices.length) priceEl.textContent = 'From £' + (Math.min.apply(null, prices) / 100).toFixed(2);
      }
    }
  }

  // The note under the main picture: shown only when the picture isn't exactly the chosen option.
  function showModalImgNote(note) {
    var el = document.getElementById('modalImgNote');
    if (!el) return;
    el.textContent = note || '';
    el.hidden = !note;
  }
  // Main picture + thumbnails for a set of pictures (same markup the pickers already used).
  function showModalPictures(urls, alt) {
    if (!urls.length) return;
    document.getElementById('modalMainImg').src = urls[0];
    currentModalImages = urls;
    var thumbsHtml = urls.length > 1 ? urls.map(function(u, i) {
      return '<img class="modal-thumb' + (i === 0 ? ' active' : '') + '" src="' + escHtml(u) + '" alt="' + escHtml(alt) + '" onclick="swapModalImg(\'' + escAttr(u) + '\', this)">';
    }).join('') : '';
    var existing = document.querySelector('.modal-img-col .modal-thumbs');
    if (existing) {
      existing.innerHTML = thumbsHtml;
    } else if (thumbsHtml) {
      var wrap = document.createElement('div');
      wrap.className = 'modal-thumbs';
      wrap.innerHTML = thumbsHtml;
      document.getElementById('modalImgNote').insertAdjacentElement('afterend', wrap);
    }
  }
  function variantPictureNote(input, sel) {
    var V = window.CBJVariantImages;
    if (!V) return null;
    try { var r = V.imagesFor(input, sel); return r.exact ? null : r.note; } catch (e) { return null; }
  }

  // Pictures follow Frame, Size and Text (see CBJPrint.galleryFor for the fallback order).
  function refreshPrintGallery() {
    var st = printState;
    if (!st) return;
    var g = CBJPrint.galleryFor(st.gallery, st.vars, st.frame, st.size, st.text);
    showModalImgNote(variantPictureNote({ kind: 'print', vars: st.vars, printGallery: st.gallery, defaults: modalDefaultImages }, { Frame: st.frame, Size: st.size, Text: st.text }));
    if (!g.urls.length) {
      if (st.shownKey !== 'own:' + st.frame) { st.shownKey = 'own:' + st.frame; showModalPictures(modalDefaultImages, 'Print'); }
      return;
    }
    if (g.key === st.shownKey) return;
    st.shownKey = g.key;
    var alt = CBJPrint.frameLabel(st.frame) + ' print';
    document.getElementById('modalMainImg').src = g.urls[0];
    currentModalImages = g.urls;
    var thumbsHtml = g.urls.map(function(u, i) {
      return '<img class="modal-thumb' + (i === 0 ? ' active' : '') + '" src="' + escHtml(u) + '" alt="' + escHtml(alt) + '" onclick="swapModalImg(\'' + escAttr(u) + '\', this)">';
    }).join('');
    var existing = document.querySelector('.modal-img-col .modal-thumbs');
    if (existing) {
      existing.innerHTML = thumbsHtml;
    } else {
      var wrap = document.createElement('div');
      wrap.className = 'modal-thumbs';
      wrap.innerHTML = thumbsHtml;
      document.getElementById('modalMainImg').insertAdjacentElement('afterend', wrap);
    }
  }

  // ===== Tote picker: Colour x Text (6 Oct 2026) =====
  // Logic lives in /store/tote-picker.js (CBJTote). Only tote bags made by a print partner use this.
  function isToteListing(p) {
    return !!p && Number(p.made_to_order) === 1 && (p.product_type || '').toLowerCase() === 'tote bag';
  }

  // Strip under a tote card's main picture: the product in all five colours.
  // One shared picture (tote-colours.jpg in the product images folder) showing the bag in all five colours.
  function toteStripHtml(p) {
    if (!isToteListing(p)) return '';
    var url = buildImageUrl('tote-colours.jpg');
    if (!url) return '';
    return '<img class="tote-strip" src="' + escHtml(url) + '" alt="Also available in Natural Raw, White, Black, Anthracite and French Navy" loading="lazy" onerror="this.remove()">';
  }

  function totePickerHtml() {
    var loading = '<span style="font-size:0.85rem;color:#888">Loading&hellip;</span>';
    return '<hr class="modal-hr">'
      + '<div class="modal-variants-label">Colour</div><div class="modal-variants" id="toteColourRow">' + loading + '</div>'
      + '<div class="modal-variants-label">Wording</div><div class="modal-variants" id="toteTextRow"></div>';
  }

  function loadToteData(productId) {
    var st = toteState;
    fetch(API + '/products/' + encodeURIComponent(productId) + '/public-variants')
      .then(function(r) { return r.json(); })
      .catch(function() { return {}; })
      .then(function(res) {
        if (toteState !== st) return;  // the modal moved on to another product
        st.vars = (res && res.result) || [];
        var row = document.getElementById('toteColourRow');
        if (!window.CBJTote || !CBJTote.isToteVariants(st.vars)) {
          if (row) row.innerHTML = '<span style="font-size:0.85rem;color:#888">Options are not available right now.</span>';
          return;
        }
        var cs = CBJTote.colours(st.vars);
        st.colour = cs.indexOf('Natural Raw') >= 0 ? 'Natural Raw' : cs[0];
        var ts = CBJTote.texts(st.vars, st.colour);
        st.text = ts.indexOf('No') >= 0 ? 'No' : ts[0];
        renderTotePicker();
        refreshToteGallery();
      });
  }

  function renderTotePicker() {
    var st = toteState;
    if (!st || !document.getElementById('toteColourRow')) return;
    function btn(kind, val, label, selected) {
      return '<button class="modal-variant-btn' + (selected ? ' selected' : '') + '" data-val="' + escAttr(val) + '" onclick="totePick(\'' + kind + '\', this)">' + label + '</button>';
    }
    document.getElementById('toteColourRow').innerHTML = CBJTote.colours(st.vars).map(function(c) {
      return btn('colour', c, escHtml(c), c === st.colour);
    }).join('');
    document.getElementById('toteTextRow').innerHTML = CBJTote.texts(st.vars, st.colour).map(function(t) {
      return btn('text', t, escHtml(CBJTote.textLabel(t)), t === st.text);
    }).join('');
    var ok = !!CBJTote.find(st.vars, st.colour, st.text);
    var addBtn = document.getElementById('modalAddBtn');
    var hint = document.getElementById('modalVariantHint');
    if (addBtn) addBtn.disabled = !ok;
    if (hint) hint.style.display = ok ? 'none' : '';
  }

  function totePick(kind, btn) {
    var st = toteState;
    if (!st) return;
    var val = btn.getAttribute('data-val');
    if (kind === 'colour') st.colour = val;
    else if (kind === 'text') st.text = val;
    // keep the chosen text only if this colour offers it
    if (!CBJTote.find(st.vars, st.colour, st.text)) st.text = CBJTote.texts(st.vars, st.colour)[0] || null;
    renderTotePicker();
    refreshToteGallery();
  }

  function refreshToteGallery() {
    var st = toteState;
    if (!st) return;
    var raw = CBJTote.imagesFor(st.vars, st.colour, st.text);
    var urls = raw.map(buildImageUrl).filter(Boolean);
    var key = st.colour + '|' + st.text;
    showModalImgNote(variantPictureNote({ kind: 'tote', vars: st.vars, defaults: modalDefaultImages }, { Colour: st.colour, Text: st.text }));
    if (!urls.length) {
      if (st.shownKey !== 'own:' + st.colour) { st.shownKey = 'own:' + st.colour; showModalPictures(modalDefaultImages, 'Tote bag'); }
      return;
    }
    if (key === st.shownKey) return;
    st.shownKey = key;
    document.getElementById('modalMainImg').src = urls[0];
    currentModalImages = urls;
    var thumbsHtml = urls.map(function(u, i) {
      return '<img class="modal-thumb' + (i === 0 ? ' active' : '') + '" src="' + escHtml(u) + '" alt="' + escHtml(st.colour + ' tote bag') + '" onclick="swapModalImg(\'' + escAttr(u) + '\', this)">';
    }).join('');
    var existing = document.querySelector('.modal-img-col .modal-thumbs');
    if (existing) {
      existing.innerHTML = thumbsHtml;
    } else {
      var wrap = document.createElement('div');
      wrap.className = 'modal-thumbs';
      wrap.innerHTML = thumbsHtml;
      document.getElementById('modalMainImg').insertAdjacentElement('afterend', wrap);
    }
  }

  // ── Photo personalisation (10 Oct 2026) ─────────────────────────────────────────────────
  // Logic lives in /store/photo-personaliser.js (CBJPhoto). Only products whose public record has a
  // personalisation_spec with a photo section use this. The photo goes straight to products-api
  // (POST /personalisation/upload), which checks it, strips its metadata and keeps it privately; this
  // page only ever shows the customer their own file from their device. Nothing about the photo or
  // the name is sent to analytics, and the section is masked from Clarity recordings.
  function photoPickerHtml(p) {
    var nf = CBJPhoto.nameField(p);
    var h = '<hr class="modal-hr"><div class="photo-pers" data-clarity-mask="true">';
    h += '<div><div class="modal-variants-label" id="photoOptLabel">Birthday</div><div class="modal-variants" id="photoOptRow"><span style="font-size:0.85rem;color:#888">Loading&hellip;</span></div></div>';
    h += '<div><div class="mug-field-label">Your photo</div>';
    h += '<label class="photo-pick" id="photoPickLabel" for="photoFile">&#128247; <strong>Choose a photo</strong><br><span>JPEG, PNG or WebP, up to 15 MB. The original from your phone camera prints best.</span></label>';
    h += '<input type="file" id="photoFile" accept="image/jpeg,image/png,image/webp" style="display:none" onchange="photoPicked(this)">';
    h += '<div class="photo-status" id="photoStatus" role="status" aria-live="polite"></div>';
    h += '<div id="photoCropWrap" style="display:none">';
    h += '<div class="photo-crop" id="photoCrop"><img id="photoCropImg" alt="Your photo" draggable="false"></div>';
    h += '<div class="photo-zoom"><span aria-hidden="true">&minus;</span><input type="range" id="photoZoom" min="1" max="4" step="0.01" value="1" aria-label="Zoom" oninput="photoZoomed(this.value)"><span aria-hidden="true">+</span></div>';
    h += '<div class="photo-hint">Drag the photo to move it and use the slider to zoom. The square is the photo side of your mug.</div>';
    h += '<div class="photo-status" id="photoQuality" role="status" aria-live="polite"></div>';
    h += '<button type="button" class="photo-change" onclick="document.getElementById(\'photoFile\').click()">Use a different photo</button>';
    h += '</div></div>';
    if (nf) {
      h += '<div><div class="mug-field-label">' + escHtml(nf.label || 'Name') + ' <span style="color:#aaa;font-weight:400">(max ' + (nf.max || 20) + ' characters)</span></div>';
      h += '<input class="mug-text-input" id="photoName" type="text" maxlength="' + (nf.max || 20) + '" placeholder="e.g. Sophie" autocomplete="off" oninput="photoNameInput(this)">';
      h += '<div class="mug-char-counter"><span id="photoNameCount">0</span>/' + (nf.max || 20) + '</div>';
      h += '<div class="photo-error" id="photoNameError"></div></div>';
    }
    h += '<label class="photo-rights"><input type="checkbox" id="photoRights" onchange="photoRightsChanged(this)"> I took this photo or have permission to use it</label>';
    h += '<div class="photo-privacy">Your photo is only used to make your mug. It is kept privately, never shared or posted, and deleted 30 days after your order is posted (or within 48 hours if you do not order). <a href="/privacy.html#customer-photos" target="_blank" rel="noopener">How I look after your photo</a></div>';
    h += '<div class="mug-lead-time">&#127874; I prepare your design by hand and check it before it is printed and sent to you.</div>';
    h += '</div>';
    return h;
  }

  function resetPhotoState() {
    if (photoState && photoState.objectUrl) { try { URL.revokeObjectURL(photoState.objectUrl); } catch (e) {} }
    photoState = null;
  }

  function loadPhotoOptions(productId) {
    var st = photoState;
    fetch(API + '/products/' + encodeURIComponent(productId) + '/public-variants')
      .then(function(r) { return r.json(); })
      .catch(function() { return {}; })
      .then(function(res) {
        if (photoState !== st) return;
        st.vars = CBJPhoto.options((res && res.result) || []);
        var row = document.getElementById('photoOptRow');
        if (!row) return;
        if (!st.vars.length) { row.innerHTML = '<span style="font-size:0.85rem;color:#888">Options are not available right now.</span>'; return; }
        var label = document.getElementById('photoOptLabel');
        if (label && st.vars[0].option1_name && st.vars[0].option1_name !== 'Age') label.textContent = st.vars[0].option1_name;
        if (st.vars.length === 1) st.option = st.vars[0];
        renderPhotoOptions();
      });
  }

  function renderPhotoOptions() {
    var st = photoState;
    var row = document.getElementById('photoOptRow');
    if (!st || !row) return;
    row.innerHTML = st.vars.map(function(v) {
      var sel = st.option && st.option.id === v.id;
      return '<button class="modal-variant-btn' + (sel ? ' selected' : '') + '" data-id="' + escAttr(String(v.id)) + '" onclick="photoPickOption(this)">' + escHtml(v.option1_value) + '</button>';
    }).join('');
    updatePhotoReady();
  }

  function photoPickOption(btn) {
    var st = photoState;
    if (!st) return;
    var id = Number(btn.getAttribute('data-id'));
    st.option = st.vars.filter(function(v) { return v.id === id; })[0] || null;
    if (st.option) {
      if (st.option.retail_price_pence != null) document.getElementById('modalPriceVal').textContent = '£' + (st.option.retail_price_pence / 100).toFixed(2);
      if (st.option.image_url) { var u = buildImageUrl(st.option.image_url); if (u) document.getElementById('modalMainImg').src = u; }
    }
    renderPhotoOptions();
  }

  function setPhotoStatus(msg, kind) {
    var el = document.getElementById('photoStatus');
    if (!el) return;
    el.className = 'photo-status' + (kind ? ' ' + kind : '');
    el.textContent = msg || '';
  }

  function photoPicked(input) {
    var st = photoState;
    var file = input.files && input.files[0];
    input.value = '';
    if (!st || !file) return;
    var problem = CBJPhoto.checkFile(file);
    if (problem) { setPhotoStatus(problem, 'error'); return; }
    if (st.objectUrl) { try { URL.revokeObjectURL(st.objectUrl); } catch (e) {} }
    st.file = file; st.upload = null; st.view = null; st.objectUrl = URL.createObjectURL(file);
    var token = st.token = Math.random();
    var img = document.getElementById('photoCropImg');
    img.onload = function() {
      if (photoState !== st || st.token !== token) return;
      // The zoom stops where the crop would fall below the print target (13 Oct 2026).
      st.view = CBJPhoto.initialView(img.naturalWidth, img.naturalHeight, (st.spec.photo && st.spec.photo.crop_aspect) || 1, CBJPhoto.targetPx(st.spec));
      document.getElementById('photoCropWrap').style.display = '';
      document.getElementById('photoPickLabel').style.display = 'none';
      var zoomInput = document.getElementById('photoZoom');
      zoomInput.max = String(st.view.maxZoom);
      zoomInput.value = 1;
      zoomInput.disabled = st.view.maxZoom <= 1;
      renderPhotoCrop();
      renderPhotoQuality();
      bindPhotoCrop();
    };
    img.onerror = function() {
      if (photoState !== st || st.token !== token) return;
      setPhotoStatus('That photo could not be opened. Please try a different one.', 'error');
    };
    img.src = st.objectUrl;
    st.uploading = true;
    setPhotoStatus('Uploading your photo…', 'busy');
    updatePhotoReady();
    var fd = new FormData();
    fd.append('product_id', st.productId);
    fd.append('photo', file, 'photo');
    fetch(API + '/personalisation/upload', { method: 'POST', body: fd })
      .then(function(r) { return r.json().catch(function() { return r.status === 413 ? { error: 'That photo is bigger than 15 MB. Please choose a smaller photo.' } : {}; }).then(function(j) { return { ok: r.ok, j: j }; }); })
      .catch(function() { return { ok: false, j: { error: 'The photo could not be uploaded. Please check your connection and try again.' } }; })
      .then(function(res) {
        if (photoState !== st || st.token !== token) return;
        st.uploading = false;
        if (!res.ok || !res.j || !res.j.result) {
          st.upload = null;
          document.getElementById('photoCropWrap').style.display = 'none';
          document.getElementById('photoPickLabel').style.display = '';
          setPhotoStatus((res.j && res.j.error) || 'The photo could not be uploaded. Please try again.', 'error');
        } else {
          st.upload = res.j.result;
          setPhotoStatus(st.upload.low_resolution
            ? 'Photo added. It is smaller than I would like for printing; see the note under the photo.'
            : 'Photo added.', st.upload.low_resolution ? 'warn' : 'ok');
        }
        updatePhotoReady();
      });
  }

  function renderPhotoCrop() {
    var st = photoState;
    var box = document.getElementById('photoCrop');
    var img = document.getElementById('photoCropImg');
    if (!st || !st.view || !box || !img) return;
    var size = box.clientWidth || 280;
    var l = CBJPhoto.layout(st.view, size);
    img.style.width = l.width + 'px';
    img.style.height = l.height + 'px';
    img.style.transform = 'translate(' + l.left + 'px,' + l.top + 'px)';
  }

  function bindPhotoCrop() {
    var box = document.getElementById('photoCrop');
    if (!box || box.__bound) return;
    box.__bound = true;
    var drag = null;
    box.addEventListener('pointerdown', function(e) {
      if (!photoState || !photoState.view) return;
      drag = { x: e.clientX, y: e.clientY };
      try { box.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    box.addEventListener('pointermove', function(e) {
      if (!drag || !photoState || !photoState.view) return;
      photoState.view = CBJPhoto.pan(photoState.view, e.clientX - drag.x, e.clientY - drag.y, box.clientWidth || 280);
      drag = { x: e.clientX, y: e.clientY };
      renderPhotoCrop();
    });
    var end = function() { drag = null; };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
    window.addEventListener('resize', renderPhotoCrop);
  }

  function photoZoomed(v) {
    if (!photoState || !photoState.view) return;
    photoState.view = CBJPhoto.zoomTo(photoState.view, Number(v));
    renderPhotoCrop();
    renderPhotoQuality();
  }

  // Print quality under the crop (13 Oct 2026): a warning when the crop keeps fewer genuine photo pixels than
  // the print target (only possible when the photo itself is that small, since the zoom stops at the target).
  function renderPhotoQuality() {
    var st = photoState;
    var el = document.getElementById('photoQuality');
    if (!st || !st.view || !el) return;
    var q = CBJPhoto.quality(st.view, CBJPhoto.targetPx(st.spec));
    if (!q.ok) {
      el.className = 'photo-status warn';
      el.textContent = 'Print quality: this photo gives ' + q.px + ' pixels across, and I print at ' + q.target + ', so your mug may look a little soft. A larger original photo will print sharper.';
    } else if (q.atLimit) {
      el.className = 'photo-status';
      el.textContent = 'This is as far as the photo can zoom in and still print sharply.';
    } else {
      el.className = 'photo-status';
      el.textContent = '';
    }
  }

  function photoNameInput(inp) {
    var st = photoState;
    if (!st) return;
    var c = document.getElementById('photoNameCount');
    if (c) c.textContent = Array.from(inp.value).length;
    var r = CBJPhoto.checkName(inp.value, CBJPhoto.nameField({ personalisation_spec: st.spec }));
    st.nameOk = r.ok;
    var err = document.getElementById('photoNameError');
    if (err) err.textContent = r.ok ? '' : r.error;
    updatePhotoReady();
  }

  function photoRightsChanged(cb) {
    if (!photoState) return;
    photoState.rights = !!cb.checked;
    updatePhotoReady();
  }

  function updatePhotoReady() {
    var st = photoState;
    var addBtn = document.getElementById('modalAddBtn');
    var hint = document.getElementById('modalVariantHint');
    if (!st || !addBtn) return;
    var ready = !!(st.option && st.upload && st.view && !st.uploading && st.rights && st.nameOk);
    addBtn.disabled = !ready;
    if (hint) {
      hint.style.display = ready ? 'none' : '';
      hint.textContent = !st.option ? 'Choose the birthday to continue'
        : st.uploading ? 'Waiting for your photo to finish uploading…'
        : !st.upload ? 'Add your photo to continue'
        : !st.nameOk ? 'Please check the name'
        : !st.rights ? 'Tick the box to confirm you can use this photo' : '';
    }
  }

  // Everything the basket line needs, or null if something is missing. The small picture shown in
  // the basket is made here, in the browser, from the customer's own file.
  function buildPhotoMeta() {
    var st = photoState;
    if (!st || !st.option || !st.upload || !st.view || !st.rights || !st.nameOk) return null;
    var nameInp = document.getElementById('photoName');
    var name = nameInp ? CBJPhoto.checkName(nameInp.value, CBJPhoto.nameField({ personalisation_spec: st.spec })).value || '' : '';
    var thumb = null;
    try {
      var img = document.getElementById('photoCropImg');
      var c = document.createElement('canvas');
      c.width = 160; c.height = 160;
      var v = st.view;
      c.getContext('2d').drawImage(img, v.cx - v.w / 2, v.cy - v.h / 2, v.w, v.h, 0, 0, 160, 160);
      thumb = c.toDataURL('image/jpeg', 0.7);
    } catch (e) { thumb = null; }
    return {
      variant_id: st.option.id,
      label: st.option.option1_value,
      price_pence: st.option.retail_price_pence != null ? st.option.retail_price_pence : null,
      upload_id: st.upload.upload_id,
      crop: CBJPhoto.cropOf(st.view),
      name: name,
      thumb: thumb
    };
  }

  // Puts back the basket saved in this browser (refresh, or coming back from Stripe without paying).
  function restoreCart() {
    if (!window.CBJPhoto) return;
    var data = CBJPhoto.load(window.localStorage);
    if (!data) return;
    var previewId = new URLSearchParams(window.location.search).get('preview');
    var byId = function(id) {
      return allProducts.find(function(p) { return p['Product ID'] === id; })
        || (previewId && previewId === id ? allProductsRaw.find(function(p) { return p['Product ID'] === id; }) : null)
        || null;
    };
    var r = CBJPhoto.fromStored(data, byId, Date.now());
    Object.keys(r.cart).forEach(function(k) { if (!cart[k]) cart[k] = r.cart[k]; });
    updateCartUI();
    var expired = r.dropped.filter(function(d) { return d.reason === 'photo_expired'; });
    if (expired.length) {
      setTimeout(function() {
        alert('Your photo for "' + (expired[0].title || 'your personalised item') + '" was only kept for 48 hours, so it has been taken out of your basket. Please add it again with your photo.');
      }, 300);
    }
  }

  function selectPodColour(colour, btn) {
    podSelectedColour = colour;
    podSelectedSize = null;
    podSelectedVariantId = null;
    podSelectedProductUid = null;
    podSelectedPrice = null;
    updatePodPriceDisplay();
    document.querySelectorAll('#podColourRow .modal-variant-btn').forEach(function(b) { b.classList.remove('selected'); });
    btn.classList.add('selected');

    // Swap main image + thumbs to this colour's gallery
    var gallery = podGalleryData[colour] || {};
    var shots = [gallery.front, gallery.front_alt, gallery.flat, gallery.lifestyle_female,
                 gallery.lifestyle_male, gallery.lifestyle_living_room, gallery.lifestyle_bedroom,
                 gallery.size_chart]
      .map(buildImageUrl).filter(Boolean);
    showModalImgNote(shots.length ? null : (variantPictureNote({ kind: 'apparel', vars: _podVariants, podGallery: podGalleryData, defaults: modalDefaultImages }, { Colour: colour }) || ('No photo of ' + colour + ' yet, so this shows another colour.')));
    if (!shots.length) showModalPictures(modalDefaultImages, colour);
    if (shots.length > 0) {
      document.getElementById('modalMainImg').src = shots[0];
      currentModalImages = shots;
      var thumbsHtml = shots.map(function(u, i) {
        return '<img class="modal-thumb' + (i === 0 ? ' active' : '') + '" src="' + escHtml(u) + '" alt="' + escHtml(colour) + '" onclick="swapModalImg(\'' + escAttr(u) + '\', this)">';
      }).join('');
      var existingThumbs = document.querySelector('.modal-img-col .modal-thumbs');
      if (existingThumbs) {
        existingThumbs.innerHTML = thumbsHtml;
      } else {
        var wrap = document.createElement('div');
        wrap.className = 'modal-thumbs';
        wrap.innerHTML = thumbsHtml;
        document.getElementById('modalMainImg').insertAdjacentElement('afterend', wrap);
      }
    }

    var addBtn = document.getElementById('modalAddBtn');
    if (addBtn) addBtn.disabled = true;
    renderPodSizes(colour);
  }

  function renderPodSizes(colour) {
    var sizeLabel = document.getElementById('podSizeLabel');
    var sizeRow = document.getElementById('podSizeRow');
    if (!sizeRow) return;

    // Size-only POD products (e.g. prints) never get a real option1_value saved -
    // matching on colour would always fail and leave sizes stuck on "Loading..."
    // forever (found 21 Aug 2026). Detect that case and match on size alone.
    var hasColourDimension = _podVariants.some(function(v) { return v.option1_value; });
    var matches = hasColourDimension
      ? _podVariants.filter(function(v) { return v.option1_value === colour; })
      : _podVariants.slice();
    if (matches.length === 0) {
      sizeRow.innerHTML = '<span style="font-size:0.85rem;color:#888">Loading…</span>';
      if (sizeLabel) sizeLabel.style.display = 'block';
      return;
    }

    var hasSize = matches.some(function(v) { return v.option2_value; });
    if (!hasSize) {
      // Single-dimension POD product (e.g. tote bags) - colour alone selects the variant
      if (sizeLabel) sizeLabel.style.display = 'none';
      sizeRow.innerHTML = '';
      podSelectedVariantId = matches[0].gelato_variant_id;
      podSelectedProductUid = matches[0].gelato_product_uid;
      podSelectedPrice = matches[0].retail_price_pence != null ? matches[0].retail_price_pence : null;
      updatePodPriceDisplay();
      var addBtn2 = document.getElementById('modalAddBtn');
      if (addBtn2) addBtn2.disabled = false;
      var hint2 = document.getElementById('modalVariantHint');
      if (hint2) hint2.style.display = 'none';
      return;
    }

    if (sizeLabel) sizeLabel.style.display = 'block';
    var sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
    var sortedMatches = matches.slice().sort(function(a, b) {
      var ai = sizeOrder.indexOf(a.option2_value);
      var bi = sizeOrder.indexOf(b.option2_value);
      if (ai === -1 && bi === -1) return a.option2_value.localeCompare(b.option2_value);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    sizeRow.innerHTML = sortedMatches.map(function(v) {
      var priceLabel = v.retail_price_pence != null ? ' &mdash; £' + (v.retail_price_pence / 100).toFixed(2) : '';
      return '<button class="modal-variant-btn" onclick="selectPodSize(\'' + escAttr(v.option2_value) + '\', this)">' + escHtml(v.option2_value) + priceLabel + '</button>';
    }).join('');
  }

  function selectPodSize(size, btn) {
    podSelectedSize = size;
    document.querySelectorAll('#podSizeRow .modal-variant-btn').forEach(function(b) { b.classList.remove('selected'); });
    btn.classList.add('selected');

    var hasColourDimension2 = _podVariants.some(function(v) { return v.option1_value; });
    var match = _podVariants.find(function(v) {
      return (hasColourDimension2 ? v.option1_value === podSelectedColour : true) && v.option2_value === size;
    });
    if (match) {
      podSelectedVariantId = match.gelato_variant_id;
      podSelectedProductUid = match.gelato_product_uid;
      podSelectedPrice = match.retail_price_pence != null ? match.retail_price_pence : null;
      updatePodPriceDisplay();
      var addBtn = document.getElementById('modalAddBtn');
      if (addBtn) addBtn.disabled = false;
      var hint = document.getElementById('modalVariantHint');
      if (hint) hint.style.display = 'none';
    }
  }

  // Updates the Add to Cart button to show the selected variant's own price when one
  // exists (e.g. prints priced by size) - falls back to the flat product price otherwise.
  function updatePodPriceDisplay() {
    var addBtn = document.getElementById('modalAddBtn');
    if (!addBtn) return;
    if (podSelectedPrice != null) {
      addBtn.textContent = 'Add to Cart - £' + (podSelectedPrice / 100).toFixed(2);
    } else {
      addBtn.textContent = 'Add to Cart';
    }
  }

  function selectVariant(v, btn) {
    selectedVariant = v;
    // Each finish button carries its picture (or the main picture when it has none of its own): say so when
    // the chosen finish has none, rather than showing the other finish as if it were this one.
    var ownImgs = {};
    Array.prototype.forEach.call(btn.parentNode.querySelectorAll('.modal-variant-btn'), function(b) {
      var u = b.dataset.imgUrl;
      if (u && modalDefaultImages.indexOf(u) === -1) ownImgs[b.textContent.trim().toLowerCase()] = u;
    });
    showModalImgNote(variantPictureNote({ kind: 'finish', finishes: modalVariantNames, finishImages: ownImgs, defaults: modalDefaultImages }, { Finish: v }));
    document.querySelectorAll('.modal-variant-btn').forEach(function(b) { b.classList.remove('selected'); });
    btn.classList.add('selected');
    var addBtn = document.getElementById('modalAddBtn');
    if (addBtn) addBtn.disabled = false;
    var hint = document.getElementById('modalVariantHint');
    if (hint) hint.style.display = 'none';
    var imgUrl = btn.dataset.imgUrl;
    if (imgUrl) {
      document.getElementById('modalMainImg').src = imgUrl;
      var key = v.toLowerCase();
      document.querySelectorAll('.modal-thumb').forEach(function(t) {
        t.classList.toggle('active', t.dataset.variantKey === key);
      });
    }
  }

  function swapModalImg(url, thumbEl) {
    window.__modalImagesViewed = (window.__modalImagesViewed || 1) + 1;
    trackEvent('image_switch', window.__modalOpenedId);
    document.getElementById('modalMainImg').src = url;
    document.querySelectorAll('.modal-thumb').forEach(function(t) { t.classList.remove('active'); });
    thumbEl.classList.add('active');
    // Looking at a picture never changes a choice (11 Oct 2026): tapping the Black thumbnail used to select
    // Black. The finish is chosen with its own button, which also swaps the picture.
  }

  function modalAddToCart(p) {
    document.getElementById('modalOverlay').classList.remove('open');
    document.getElementById('modalWrap').classList.remove('open');
    var variant = selectedVariant;
    selectedVariant = null;
    var mugName = null, mugMessage = null, mugTextColour = null, persText = null;
    if ((p.product_type || '').toLowerCase() === 'mug') {
      var nameInp = document.getElementById('modal-mug-name');
      mugName = nameInp ? nameInp.value.trim() : '';
      var msgSel = document.getElementById('modal-mug-message');
      var customMsg = document.getElementById('modal-mug-custom-message');
      mugMessage = (msgSel && msgSel.value === 'Custom') ? (customMsg ? customMsg.value.trim() : '') : (msgSel ? msgSel.value : '');
      mugTextColour = _selectedMugColour || '';
    } else if (p.personalised === 1) {
      var persInp = document.getElementById('modal-pers-text');
      persText = persInp ? persInp.value.trim() : '';
    }
    var podMeta = null;
    if (podSelectedVariantId) {
      podMeta = {
        colour: podSelectedColour,
        size: podSelectedSize,
        gelato_variant_id: podSelectedVariantId,
        gelato_product_uid: podSelectedProductUid,
        image_url: podSelectedImage || buildImageUrl((podGalleryData[podSelectedColour] || {}).front),
        price_pence: podSelectedPrice
      };
    }
    var toteMeta = null;
    if (toteState && toteState.colour && toteState.text) {
      var tv = CBJTote.find(toteState.vars, toteState.colour, toteState.text);
      if (tv) {
        toteMeta = {
          variant_id: tv.id,
          label: toteState.colour + ', ' + (toteState.text === 'Yes' ? 'with text' : 'no text'),
          image_url: tv.image_url ? buildImageUrl(tv.image_url) : null,
          price_pence: tv.retail_price_pence != null ? tv.retail_price_pence : null
        };
      }
    }
    if (isToteListing(p) && !toteMeta) return;  // button is disabled until a full choice is made
    var photoMeta = null;
    if (window.CBJPhoto && CBJPhoto.isPhotoProduct(p)) {
      photoMeta = buildPhotoMeta();
      if (!photoMeta) return;  // button is disabled until option, photo and the rights box are done
      mugName = null; mugMessage = null; mugTextColour = null;
    }
    addToCart(p, variant, mugName, mugMessage, mugTextColour, persText, podMeta, toteMeta, photoMeta);
    if (photoMeta) resetPhotoState();
    // Product page: the popup would have closed here. Draw the page again so every choice starts fresh
    // (otherwise a second tap could add the item again without the finish, size or photo it needs).
    if (PRODUCT_PAGE) openModal(p, true);
  }

  function addToCart(p, variant, mugName, mugMessage, mugTextColour, persText, podMeta, toteMeta, photoMeta) {
    trackEvent('add_to_basket', p['Product ID']);
    mugName = mugName || null;
    mugMessage = mugMessage || null;
    mugTextColour = mugTextColour || null;
    persText = persText || null;
    // Single-variant POD auto-attach (25 Sep 2026, Retro Deal mugs): these products have
    // no colour/size choice - the product IS the design - so they never go through the
    // modal/podMeta picker path. GET /products attaches gelato_variant_id/gelato_product_uid
    // directly onto the product object for this case (see products-api's
    // attachSingleVariantGelatoIds). If nothing already built a podMeta (the modal picker
    // path for t-shirts/prints), and the product carries one of these, attach it here so
    // even a plain grid "Add to Cart" click carries the Gelato variant through to checkout.
    // image_url and price_pence are deliberately left unset - the existing mug-image and
    // flat-price logic below already handles those correctly for this product type.
    if (!podMeta && p.gelato_variant_id) {
      podMeta = { colour: null, size: null, gelato_variant_id: p.gelato_variant_id, gelato_product_uid: p.gelato_product_uid };
    }
    var basePrice = parseFloat(p.price || 3.50);
    // A variant with its own retail_price_pence (e.g. a print priced by size) overrides
    // the flat product price entirely - it's not a surcharge on top, it IS the price.
    if (podMeta && podMeta.price_pence != null) basePrice = podMeta.price_pence / 100;
    if (toteMeta) { variant = toteMeta.label; if (toteMeta.price_pence != null) basePrice = toteMeta.price_pence / 100; }
    if (photoMeta) { variant = photoMeta.label; if (photoMeta.price_pence != null) basePrice = photoMeta.price_pence / 100; }
    var itemPrice = persText && p.personalised === 1 ? basePrice + 1.50 : basePrice;
    gtag('event', 'add_to_cart', {
      currency: 'GBP',
      value: itemPrice,
      items: [{ item_id: p['Product ID'], item_name: p['Title'], item_category: p['Collection'] || '', item_variant: variant || '', price: itemPrice, quantity: 1 }]
    });
    var priceId = p.stripe_price_id;
    var cartKey = photoMeta
      ? CBJPhoto.cartKey(p['Product ID'], photoMeta.variant_id, photoMeta.upload_id, photoMeta.name)
      : toteMeta
      ? (p['Product ID'] + '|sv:' + toteMeta.variant_id)
      : podMeta
      ? (p['Product ID'] + '|pod:' + podMeta.gelato_variant_id)
      : priceId + '|' + (variant || '') + (mugName ? '|mug:' + mugName : '') + (persText ? '|pers:' + persText : '');
    var heroUrl = buildImageUrl(p['Image URL']) || buildImageUrl((p['Product ID'] || '').toLowerCase());
    var imageUrl = heroUrl;
    if (variant) {
      try {
        var vi = JSON.parse(p.variant_images || '{}');
        var viKey = Object.keys(vi).find(function(k) { return k.toLowerCase() === variant.toLowerCase(); });
        if (viKey) imageUrl = buildImageUrl(vi[viKey]);
      } catch (e) {}
    }
    if ((p.product_type || '').toLowerCase() === 'mug') {
      var mugFront = buildImageUrl(p.mug_image_front);
      if (mugFront) imageUrl = mugFront;
    }
    if (podMeta && podMeta.image_url) imageUrl = podMeta.image_url;
    if (toteMeta && toteMeta.image_url) imageUrl = toteMeta.image_url;
    if (photoMeta && photoMeta.thumb) imageUrl = photoMeta.thumb;
    if (cart[cartKey]) {
      cart[cartKey].qty++;
    } else {
      cart[cartKey] = { product: p, qty: 1, variant: variant || null, image_url: imageUrl,
                        mug_name: mugName, mug_message: mugMessage, mug_text_colour: mugTextColour,
                        personalisation_text: persText,
                        pod_colour: podMeta ? podMeta.colour : null,
                        pod_size: podMeta ? podMeta.size : null,
                        gelato_variant_id: podMeta ? podMeta.gelato_variant_id : null,
                        gelato_product_uid: podMeta ? podMeta.gelato_product_uid : null,
                        variant_id: toteMeta ? toteMeta.variant_id : (photoMeta ? photoMeta.variant_id : null),
                        photo: photoMeta ? { upload_id: photoMeta.upload_id, crop: photoMeta.crop, name: photoMeta.name } : null,
                        added: Date.now(),
                        // The +£1.50 personalisation uplift is added on top of this wherever a price is
                        // shown (basket) or charged (server), so the stored price is the base price.
                        // Storing itemPrice here showed £6.50 for a £5.00 item (fixed 10 Oct 2026).
                        price: basePrice };
    }
    updateCartUI();
    renderGrid();
    openCart();
  }

  function changeQty(cartKey, delta) {
    if (!cart[cartKey]) return;
    cart[cartKey].qty += delta;
    if (cart[cartKey].qty <= 0) delete cart[cartKey];
    updateCartUI();
    renderGrid();
  }

  function getBundleInfo() {
    var eligibleQty = 0;
    Object.values(cart).forEach(function(data) {
      if (Math.round(parseFloat(data.product.price || 3.50) * 100) === 350) {
        eligibleQty += data.qty;
      }
    });
    var bundleCount = Math.floor(eligibleQty / 3);
    return { eligibleQty: eligibleQty, bundleCount: bundleCount, discountPence: bundleCount * 50 };
  }

  // Mug multibuy note under the price, on mug product pages and in the shop popup (12 Oct 2026). Only says what
  // checkout already does: products-api's create-checkout-session takes £1.99 off each pair (and £7.97 off each set
  // of 4) of lines priced exactly £11.99, the same rule as getMugBundleInfo() below. Shown on mugs at that price
  // only, so the £14.99 photo mug and anything else at another price never show it. Pricing is unchanged; the link
  // goes to the mugs range page. Product pages style it in product-page.css; the shop popup (which doesn't load
  // that file) gets the same look inline.
  function isMugDealProduct(p) {
    return (p.product_type || '').toLowerCase() === 'mug' && Math.round(parseFloat(p.price || 0) * 100) === 1199;
  }
  function mugDealHtml() {
    var st = PRODUCT_PAGE ? {} : {
      box: 'margin:10px 0 4px;padding:12px 14px;border-radius:14px;background:#fff1d6;border:1px solid #f2dfb5;color:#1a1a2e;display:flex;flex-direction:column;gap:3px;text-align:left',
      head: 'font-size:16px;font-weight:800;line-height:1.25',
      text: 'font-size:14px;line-height:1.45;color:#4a4a5e',
      link: 'align-self:flex-start;margin-top:4px;font-weight:800;font-size:14.5px;color:#1a1a2e;text-decoration:underline;text-underline-offset:3px;min-height:44px;display:inline-flex;align-items:center'
    };
    var at = function(k) { return st[k] ? ' style="' + st[k] + '"' : ''; };
    return '<div class="mug-deal" role="note"' + at('box') + '>'
      + '<strong class="mug-deal-head"' + at('head') + '>Buy 2 mugs for £21.99 — save £1.99!</strong>'
      + '<span class="mug-deal-text"' + at('text') + '>Mix and match eligible mugs. Discount applied automatically at checkout.</span>'
      + '<a class="mug-deal-link" href="/collections/mugs"' + at('link') + '>Choose your second mug &rarr;</a>'
      + '</div>';
  }

  // Christmas cards (Oct 2026). Each card is a 3.99 line and the basket is charged the cheapest way of covering the
  // number of cards with the 1/3/6/12 tiers (3.99 / 10.00 / 12.99 / 22.00), so a basket never costs more than the next
  // tier up. Display only: products-api/card-tiers.js is what is actually charged and must stay in step with this.
  var CARD_LIST_PENCE = 399;
  var CARD_TIERS = [[1, 399], [3, 1000], [6, 1299], [12, 2200]];
  function isCardProduct(p) {
    return !!p && (p.product_type || '').trim().toLowerCase() === 'greeting card';
  }
  function cardBasketPence(n) {
    if (!(n > 0)) return 0;
    var best = [0];
    for (var i = 1; i <= n; i++) {
      best[i] = Infinity;
      for (var t = 0; t < CARD_TIERS.length; t++) {
        var cost = best[Math.max(0, i - CARD_TIERS[t][0])] + CARD_TIERS[t][1];
        if (cost < best[i]) best[i] = cost;
      }
    }
    return best[n];
  }
  function getCardBundleInfo() {
    var cardQty = 0;
    Object.values(cart).forEach(function(data) {
      if (isCardProduct(data.product)) cardQty += data.qty;
    });
    var discountPence = cardQty > 0 ? Math.max(0, cardQty * CARD_LIST_PENCE - cardBasketPence(cardQty)) : 0;
    return { cardQty: cardQty, discountPence: discountPence };
  }
  function cardBannerText(info) {
    var n = info.cardQty;
    if (n <= 0) return null;
    if (info.discountPence > 0) {
      var saved = info.discountPence >= 100 ? '£' + (info.discountPence / 100).toFixed(2) : info.discountPence + 'p';
      var text = 'Card mix & match applied - you\'re saving ' + saved;
      if (n === 4 || n === 5) text += ' (up to 6 cards cost the same)';
      return text;
    }
    return 'Cards: add ' + (3 - n) + ' more for 3 for £10, mix any designs';
  }

  function getMugBundleInfo() {
    var mugQty = 0;
    Object.values(cart).forEach(function(data) {
      if (Math.round(parseFloat(data.product.price || 0) * 100) === 1199) {
        mugQty += data.qty;
      }
    });
    var fours = Math.floor(mugQty / 4);
    var remainder = mugQty % 4;
    var hasPair = remainder === 2 || remainder === 3;
    var discountPence = (fours * 797) + (hasPair ? 199 : 0);
    return { mugQty: mugQty, fours: fours, remainder: remainder, discountPence: discountPence };
  }

  function mugBannerText(mugInfo) {
    var mq = mugInfo.mugQty;
    if (mq >= 4 && mugInfo.discountPence > 0) {
      var savingStr = mugInfo.discountPence >= 100 ? '£' + (mugInfo.discountPence / 100).toFixed(2) : mugInfo.discountPence + 'p';
      return 'Mug mix & match applied - you\'re saving ' + savingStr;
    } else if (mq === 3) {
      return 'Mugs: add 1 more for a set of 4 at £10 each';
    } else if (mq === 2) {
      return 'Mugs: 2 for £21.99 applied - add 2 more for a set of 4 at £10 each';
    } else if (mq === 1) {
      return 'Mugs: add 1 more for 2 for £21.99';
    }
    return null;
  }

  function updateBundleBanner() {
    var banner = document.getElementById('bundleBanner');
    var bannerText = document.getElementById('bundleBannerText');
    if (!banner || !bannerText) return;
    var info = getBundleInfo();
    var mugInfo = getMugBundleInfo();
    var eq = info.eligibleQty;
    var cardInfo = getCardBundleInfo();
    var mugText = [mugBannerText(mugInfo), cardBannerText(cardInfo)].filter(Boolean).join(' \u2666 ') || null;
    if (eq >= 3) {
      var savingStr = info.discountPence >= 100 ? '£' + (info.discountPence / 100).toFixed(2) : info.discountPence + 'p';
      banner.className = 'bundle-banner qualified';
      bannerText.textContent = '3 for £10 applied - you\'re saving ' + savingStr + ' (and free shipping!)' + (mugText ? ' \u2666 ' + mugText : '');
    } else if (eq === 2) {
      banner.className = 'bundle-banner';
      bannerText.textContent = 'Bundle deal: add 1 more to get 3 for £10' + (mugText ? ' \u2666 ' + mugText : '');
    } else if (eq === 1) {
      banner.className = 'bundle-banner';
      bannerText.textContent = 'Bundle deal: add 2 more to get 3 for £10' + (mugText ? ' \u2666 ' + mugText : '');
    } else if (mugText) {
      banner.className = (mugInfo.mugQty >= 4 || cardInfo.discountPence > 0) ? 'bundle-banner qualified' : 'bundle-banner';
      bannerText.innerHTML = mugText;
    } else {
      banner.className = 'bundle-banner';
      var activeColBtn = document.querySelector('#collectionFilterBar .col-btn.active');
      var activeColName = activeColBtn ? (activeColBtn.dataset.col || '').toLowerCase() : '';
      var tagline = activeColName.indexOf('teacher') !== -1 ? 'Mix and match teacher gifts' : 'Mix and match your favourites';
      bannerText.innerHTML = 'Any 3 bookmarks or keyrings for £10, or 2/4 mugs for a better price &#9830; ' + tagline;
    }
  }

  function updateCartUI() {
    syncGiftOption();
    if (window.CBJPhoto) { try { CBJPhoto.save(window.localStorage, cart, Date.now()); } catch (e) {} }
    var entries = Object.entries(cart);
    var totalItems = entries.reduce(function(s, e) { return s + e[1].qty; }, 0);
    var totalPence = entries.reduce(function(s, e) {
      var d = e[1];
      var unitPriceNum = parseFloat((d.price != null ? d.price : d.product.price) || 3.50);
      if (d.personalisation_text && d.product.personalised === 1) unitPriceNum += 1.50;
      return s + d.qty * Math.round(unitPriceNum * 100);
    }, 0);

    var bundleInfo = getBundleInfo();
    var mugInfo = getMugBundleInfo();
    var discountPence = bundleInfo.discountPence + mugInfo.discountPence + getCardBundleInfo().discountPence;
    var displayTotal = totalPence - discountPence;

    document.getElementById('cartCount').textContent = totalItems;
    document.getElementById('cartBtn').style.display = totalItems > 0 ? 'block' : 'none';
    document.getElementById('cartTotal').textContent = '£' + (displayTotal / 100).toFixed(2);
    document.getElementById('checkoutBtn').disabled = totalItems === 0;

    var shippingNote = document.getElementById('shippingNote');
    if (shippingNote) {
      if (cartIsAllPod()) {
        shippingNote.textContent = 'Postage included · UK only';
      } else if (displayTotal >= 1000) {
        shippingNote.textContent = '🎉 Free UK shipping applied!';
      } else {
        var awayStr = ((1000 - displayTotal) / 100).toFixed(2);
        shippingNote.textContent = 'Free UK shipping on orders £10+ (you\'re £' + awayStr + ' away) · UK only';
      }
    }

    var discountRow = document.getElementById('bundleDiscountRow');
    var discountAmt = document.getElementById('bundleDiscountAmt');
    if (discountRow && discountAmt) {
      if (discountPence > 0) {
        var savingStr = discountPence >= 100 ? '£' + (discountPence / 100).toFixed(2) : discountPence + 'p';
        discountAmt.textContent = '−' + savingStr;
        discountRow.style.display = 'flex';
      } else {
        discountRow.style.display = 'none';
      }
    }
    updateBundleBanner();

    var itemsEl = document.getElementById('cartItems');
    if (entries.length === 0) {
      itemsEl.innerHTML = '<div class="cart-empty">Your cart is empty.</div>';
      return;
    }

    itemsEl.innerHTML = entries.map(function(entry) {
      var cartKey = entry[0], data = entry[1];
      var p = data.product, qty = data.qty, variant = data.variant;
      var id = p['Product ID'];
      var imgUrl = data.image_url || buildImageUrl(p['Image URL']) || buildImageUrl(id.toLowerCase());
      var basePriceNum = parseFloat((data.price != null ? data.price : p.price) || 3.50);
      var linePriceNum = (data.personalisation_text && p.personalised === 1) ? basePriceNum + 1.50 : basePriceNum;
      var unitPrice = '£' + linePriceNum.toFixed(2);
      return '<div class="cart-item">'
        + '<img src="' + escHtml(imgUrl) + '" alt="' + escHtml(p['Title']) + '"' + (data.photo ? ' data-clarity-mask="true"' : '') + '>'
        + '<div class="cart-item-info">'
        + '<div class="cart-item-title">' + escHtml(p['Title']) + '</div>'
        + (data.gelato_variant_id ? '<div class="cart-item-variant">' + escHtml([data.pod_colour, data.pod_size].filter(Boolean).join(' / ')) + '</div>' : '')
        + (!data.gelato_variant_id && variant ? '<div class="cart-item-variant">' + (data.variant_id ? '' : 'Finish: ') + escHtml(variant) + '</div>' : '')
        + (data.mug_name ? '<div class="cart-item-variant">Name: ' + escHtml(data.mug_name) + '</div>' : '')
        + (data.photo ? '<div class="cart-item-variant">&#128247; Your photo added' + (data.photo.name ? ', name: ' + escHtml(data.photo.name) : '') + '</div>' : '')
        + (data.personalisation_text ? '<div class="cart-item-variant">Personalised: ' + escHtml(data.personalisation_text) + '</div>' : '')
        + (data.mug_message ? '<div class="cart-item-variant">Message: ' + escHtml(data.mug_message) + '</div>' : '')
        + (data.mug_text_colour ? '<div class="cart-item-variant" style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:10px;height:10px;background:' + escHtml(data.mug_text_colour) + ';border-radius:50%;border:1px solid #ccc"></span>' + escHtml(data.mug_text_colour) + '</div>' : '')
        + '<div class="cart-item-price">' + unitPrice + ' each</div>'
        + (Number(p.design_stock_tracked) === 1 && qty > Number(p.design_stock_qty) ? '<div class="stock-note stock-low">Ordering ' + qty + ' may add a few extra days to dispatch</div>' : '')
        + '</div>'
        + '<div class="qty-controls">'
        + '<button class="qty-btn" onclick="changeQty(' + escAttr(JSON.stringify(cartKey)) + ', -1)">&minus;</button>'
        + '<span class="qty-num">' + qty + '</span>'
        + '<button class="qty-btn" onclick="changeQty(' + escAttr(JSON.stringify(cartKey)) + ', 1)">+</button>'
        + '</div>'
        + '</div>';
    }).join('');

  }

  function openCart() {
    document.getElementById('cartPanel').classList.add('open');
    document.getElementById('overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeCart() {
    document.getElementById('cartPanel').classList.remove('open');
    document.getElementById('overlay').classList.remove('open');
    document.body.style.overflow = '';
  }

  // Print-on-demand items ship direct from the print partner, so no gift option for all-POD carts.
  function cartIsAllPod() {
    var vals = Object.values(cart);
    // made_to_order is a yes/no set by products-api for products another print partner makes (30 Sep 2026).
    return vals.length > 0 && vals.every(function(d) { return !!d.gelato_variant_id || !!(d.product && d.product.made_to_order); });
  }
  function syncGiftOption() {
    var box = document.getElementById('giftOption');
    if (!box) return;
    var hide = cartIsAllPod();
    box.style.display = hide ? 'none' : '';
    if (hide) {
      document.getElementById('giftCheckbox').checked = false;
      document.getElementById('giftNoteText').style.display = 'none';
    }
  }

  function toggleGiftNote() {
    var cb = document.getElementById('giftCheckbox');
    var note = document.getElementById('giftNoteText');
    note.style.display = cb.checked ? 'block' : 'none';
  }

  async function checkout() {
    var btn = document.getElementById('checkoutBtn');
    btn.disabled = true;
    btn.textContent = 'Redirecting…';

    var items = Object.entries(cart).map(function(entry) {
      var data = entry[1];
      // A variant-specific price (e.g. a print priced by size) set at add-to-cart time
      // always wins over the flat product price - falls back cleanly for every other
      // product type, which never sets data.price and keeps using data.product.price.
      var resolvedPrice = (data.price != null ? data.price : data.product.price) || 3.50;
      return {
        product_id: data.product['Product ID'] || '',
        stripe_price_id: data.product.stripe_price_id,
        quantity: data.qty,
        title: data.product['Title'] || '',
        variant: data.variant || null,
        price: resolvedPrice,
        // A photo line's picture is the customer's own photo, which must not leave the browser.
        image_url: data.photo ? '' : (data.image_url || ''),
        personalised: data.product.personalised === 1,
        personalisation_text: data.personalisation_text || '',
        name: data.product['Title'] || '',
        unit_amount: Math.round(resolvedPrice * 100),
        mug_name: data.mug_name || null,
        mug_message: data.mug_message || null,
        mug_text_colour: data.mug_text_colour || null,
        gelato_variant_id: data.gelato_variant_id || null,
        gelato_product_uid: data.gelato_product_uid || null,
        variant_id: data.variant_id || null,
        personalisation: data.photo ? { upload_id: data.photo.upload_id, crop: data.photo.crop, fields: { name: data.photo.name || '' } } : undefined,
        pod_colour: data.pod_colour || null,
        pod_size: data.pod_size || null
      };
    });

    try {
      var res = await fetch(API + '/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items,
          source: getSource(),
          is_gift: cartIsAllPod() ? false : document.getElementById('giftCheckbox').checked,
          gift_message: cartIsAllPod() ? '' : document.getElementById('giftNoteText').value.trim(),
          promo_code: document.getElementById('promoCodeInput').value.trim() || null,
          marketing_opt_in: document.getElementById('marketingOptIn').checked === true
        })
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      // Fired here (not at the top of this function) so the beacon can carry the exact
      // Stripe checkout session id for an exact diagnostics join — keepalive:true still
      // guarantees delivery through the redirect immediately below.
      trackEvent('checkout_started', '', cartPathFor(items), data.id);
      window.location.href = data.url;
    } catch (e) {
      // Session creation failed before an id ever existed — logged exactly as it always
      // was (no session id), preserving today's behaviour for a failed checkout attempt.
      trackEvent('checkout_started', '', cartPathFor(items));
      alert('Checkout error: ' + e.message);
      btn.disabled = false;
      btn.textContent = 'Checkout →';
    }
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function openLightbox(src, alt, images) {
    if (images && images.length > 0) {
      lightboxImages = images;
      lightboxIdx = images.indexOf(src);
      if (lightboxIdx === -1) lightboxIdx = 0;
    } else {
      lightboxImages = [src];
      lightboxIdx = 0;
    }
    var lb = document.getElementById('lightbox');
    document.getElementById('lightboxImg').src = lightboxImages[lightboxIdx];
    document.getElementById('lightboxImg').alt = alt || '';
    lb.classList.add('open');
    var showArrows = lightboxImages.length > 1;
    var prev = document.getElementById('lightboxPrev');
    var next = document.getElementById('lightboxNext');
    if (prev) prev.style.display = showArrows ? 'flex' : 'none';
    if (next) next.style.display = showArrows ? 'flex' : 'none';
  }

  function lightboxNav(dir) {
    if (lightboxImages.length <= 1) return;
    lightboxIdx = (lightboxIdx + dir + lightboxImages.length) % lightboxImages.length;
    document.getElementById('lightboxImg').src = lightboxImages[lightboxIdx];
  }

  function closeLightbox() {
    document.getElementById('lightbox').classList.remove('open');
  }

  function updatePersCounter() {
    var inp = document.getElementById('modal-pers-text');
    var ctr = document.getElementById('pers-char-count');
    if (inp && ctr) ctr.textContent = inp.value.length;
    // Update add to cart button dynamically
    var btn = document.getElementById('modalAddBtn');
    var hint = document.getElementById('modalPersHint');
    if (btn && inp) {
      var hasText = inp.value.trim().length > 0;
      var basePrice = parseFloat(btn.dataset.basePrice || 3.50);
      var persPrice = (basePrice + 1.50).toFixed(2);
      if (hasText) {
        btn.textContent = 'Add to Cart with Personalisation - £' + persPrice;
        btn.style.background = '#4a6fa5';
        if (hint) hint.style.display = 'none';
      } else {
        btn.textContent = 'Add to Cart - £' + basePrice.toFixed(2);
        btn.style.background = '';
        if (hint) hint.style.display = 'block';
      }
    }
  }

  function updateMugNameCounter() {
    var inp = document.getElementById('modal-mug-name');
    var ctr = document.getElementById('mug-name-count');
    if (inp && ctr) ctr.textContent = inp.value.length;
  }

  function updateMugMsgCounter() {
    var inp = document.getElementById('modal-mug-custom-message');
    var ctr = document.getElementById('mug-msg-count');
    if (inp && ctr) ctr.textContent = inp.value.length;
  }

  function handleMugMessageChange(sel) {
    var customInp = document.getElementById('modal-mug-custom-message');
    var ctrRow = document.getElementById('mug-msg-counter-row');
    var isCustom = sel.value === 'Custom';
    if (customInp) customInp.style.display = isCustom ? 'block' : 'none';
    if (ctrRow) ctrRow.style.display = isCustom ? 'block' : 'none';
  }

  function selectMugColour(btn, hex) {
    _selectedMugColour = hex;
    document.querySelectorAll('.mug-store-swatch').forEach(function(s) { s.classList.remove('selected'); });
    btn.classList.add('selected');
    var otherCb = document.getElementById('modal-mug-other-colour-cb');
    if (otherCb) otherCb.checked = false;
    var picker = document.getElementById('modal-mug-other-colour-picker');
    if (picker) picker.style.display = 'none';
    var disp = document.getElementById('mug-colour-selected-display');
    if (disp) disp.innerHTML = '<span style="display:inline-block;width:14px;height:14px;background:' + hex + ';border-radius:50%;border:1px solid #ccc;vertical-align:middle;flex-shrink:0"></span><span>' + hex + '</span>';
  }

  function toggleMugOtherColourStore(cb) {
    var picker = document.getElementById('modal-mug-other-colour-picker');
    if (!picker) return;
    picker.style.display = cb.checked ? 'inline-block' : 'none';
    if (cb.checked) {
      document.querySelectorAll('.mug-store-swatch').forEach(function(s) { s.classList.remove('selected'); });
      selectMugColourOther(picker.value);
    } else {
      _selectedMugColour = '';
      var disp = document.getElementById('mug-colour-selected-display');
      if (disp) disp.innerHTML = '<em>None selected</em>';
    }
  }

  function selectMugColourOther(hex) {
    _selectedMugColour = hex;
    document.querySelectorAll('.mug-store-swatch').forEach(function(s) { s.classList.remove('selected'); });
    var disp = document.getElementById('mug-colour-selected-display');
    if (disp) disp.innerHTML = '<span style="display:inline-block;width:14px;height:14px;background:' + hex + ';border-radius:50%;border:1px solid #ccc;vertical-align:middle;flex-shrink:0"></span><span>' + hex + '</span>';
  }

  document.addEventListener('keydown', function(e) {
    var lb = document.getElementById('lightbox');
    var lbOpen = lb && lb.classList.contains('open');
    if (e.key === 'Escape') {
      if (lbOpen) { closeLightbox(); return; }
      closeModal();
    }
    if (e.key === 'ArrowLeft'  && lbOpen) { lightboxNav(-1); }
    if (e.key === 'ArrowRight' && lbOpen) { lightboxNav(1); }
  });

  window.addEventListener('pageshow', function() {
    var btn = document.getElementById('checkoutBtn');
    if (btn) {
      btn.textContent = 'Checkout →';
      btn.disabled = Object.keys(cart).length === 0;
    }
  });

  function onPriceSlider() {
    var minEl = document.getElementById('priceMin');
    var maxEl = document.getElementById('priceMax');
    if (!minEl || !maxEl) return;
    if (parseFloat(minEl.value) > parseFloat(maxEl.value)) {
      minEl.value = maxEl.value;
    }
    updatePriceSliderFill();
    applyFilters();
  }

  function updatePriceSliderFill() {
    var minEl = document.getElementById('priceMin');
    var maxEl = document.getElementById('priceMax');
    var fill  = document.getElementById('priceSliderFill');
    var label = document.getElementById('priceSliderLabel');
    if (!minEl || !maxEl) return;
    var absMin = parseFloat(minEl.min);
    var absMax = parseFloat(minEl.max);
    var low  = parseFloat(minEl.value);
    var high = parseFloat(maxEl.value);
    if (fill) {
      var range = absMax - absMin;
      if (range <= 0) { fill.style.left = '0%'; fill.style.width = '100%'; }
      else {
        fill.style.left  = ((low  - absMin) / range * 100) + '%';
        fill.style.width = (Math.max(0, high - low) / range * 100) + '%';
      }
    }
    if (label) {
      label.textContent = 'Price: £' + low.toFixed(2) + ' - £' + high.toFixed(2);
    }
  }

  // ── Hamburger drawer ──────────────────────────
  var _dc = [], _dHP = false, _colData = [];
  function buildDrawerNav(cols, hp, colData) { _dc = cols || []; _dHP = !!hp; _colData = colData || []; refreshDrawerNav(); }
  function refreshDrawerNav() {
    var nav = document.getElementById('drawerNav');
    if (!nav) return;
    var ab = document.querySelector('#collectionFilterBar .col-btn.active');
    var av = ab ? (ab.dataset.col || '') : '';
    var curSearch = (document.getElementById('searchInput') || {}).value || '';
    var curSort = (document.getElementById('sortFilter') || {}).value || 'featured';
    var h = '<a class="drawer-item home-link" href="https://craftsbyjon.co.uk/">&#127968; Home</a>';
    h += '<div class="drawer-divider"></div>';
    h += '<button class="drawer-item' + (av === '' ? ' active' : '') + '" data-col="" onclick="drawerSelectThis(this)">All Products</button>';
    if (giftsSeasonActive()) {
      h += '<button class="drawer-item' + (av === '__gifts__' ? ' active' : '') + '" data-col="__gifts__" onclick="drawerSelectGifts()">&#127876; Christmas gifts</button>';
    }
    _dc.forEach(function(c) {
      var esc = escHtml(c);
      var active = av === c ? ' active' : '';
      h += '<button class="drawer-item' + active + '" data-col="' + esc + '" onclick="drawerSelectThis(this)">' + esc + '</button>';
    });
    if (_dHP) {
      h += '<div class="drawer-divider"></div>';
      var persActive = av === '__personalised__' ? ' active' : '';
      h += '<button class="drawer-item' + persActive + '" data-col="__personalised__" onclick="drawerSelectAllPers()">&#10024; All Personalised</button>';
    }
    h += '<div class="drawer-divider"></div>';
    h += '<div style="padding:12px 16px 4px;font-size:0.72rem;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.06em">Search</div>';
    h += '<div style="padding:4px 16px 8px"><input type="search" value="' + escHtml(curSearch) + '" placeholder="Search products…" style="width:100%;padding:8px 10px;border:1.5px solid #d0e4f7;border-radius:8px;font-family:inherit;font-size:0.9rem;box-sizing:border-box" oninput="syncDrawerSearch(this.value)" /></div>';
    h += '<div style="padding:0 16px 16px"><select style="width:100%;padding:8px 10px;border:1.5px solid #d0e4f7;border-radius:8px;font-family:inherit;font-size:0.9rem;background:#fff;box-sizing:border-box" onchange="syncDrawerSort(this.value)">';
    h += '<option value="featured"' + (curSort==="featured"?" selected":"") + '>Featured</option>';
    h += '<option value="price-asc"' + (curSort==="price-asc"?" selected":"") + '>Price: Low to High</option>';
    h += '<option value="price-desc"' + (curSort==="price-desc"?" selected":"") + '>Price: High to Low</option>';
    h += '<option value="newest"' + (curSort==="newest"?" selected":"") + '>Newest</option>';
    h += '</select></div>';
    nav.innerHTML = h;
  }
  function drawerSelectGifts() {
    _prevCollection = '';
    var btn = document.querySelector('#collectionFilterBar .col-btn[data-col="__gifts__"]');
    if (btn) setCollectionFilter(btn);
    updateCollectionHero('');
    closeDrawer(); refreshDrawerNav();
  }
  function drawerSelectAllPers() {
    // Select personalised across all collections (no _prevCollection scope)
    _prevCollection = '';
    var btn = document.querySelector('#collectionFilterBar .col-btn[data-col="__personalised__"]');
    if (btn) setCollectionFilter(btn);
    var pt = document.getElementById('mobilePersToggle'); if (pt) { pt.classList.add('active'); pt.style.display = ''; }
    updateCollectionHero('');
    closeDrawer(); refreshDrawerNav();
  }
  function drawerSelectThis(btn) {
    var col = btn.dataset.col || '';
    drawerSelect(col);
  }
  function drawerSelect(col) {
    var selector = col ? '#collectionFilterBar .col-btn[data-col="' + col.replace(/"/g, '\"') + '"]'
                       : '#collectionFilterBar .col-btn[data-col=""]';
    var btn = document.querySelector(selector) || document.querySelector('#collectionFilterBar .col-btn[data-col=""]');
    if (btn) setCollectionFilter(btn);
    var pt = document.getElementById('mobilePersToggle'); if (pt) pt.classList.remove('active');
    _prevCollection = col || '';
    updateCollectionHero(col);
    // Show/hide personalised toggle based on whether this collection has personalised items
    var persToggle = document.getElementById('mobilePersToggle');
    if (persToggle) {
      var hasCollPers = col
        ? allProducts.some(function(p) { return p.personalised === 1 && p['Collection'] === col; })
        : allProducts.some(function(p) { return p.personalised === 1; });
      persToggle.style.display = hasCollPers ? '' : 'none';
    }
    closeDrawer(); refreshDrawerNav();
  }
  function updateCollectionHero(colName) {
    var heroEl = document.getElementById('collectionHero');
    var heroImg = document.getElementById('collectionHeroImg');
    if (!heroEl || !heroImg) return;
    var normCol = function(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); };
    if (!colName) {
      // No collection selected - hide hero, show pride banner
      heroEl.style.display = 'none';
      document.body.classList.remove('has-collection-hero');
      return;
    }
    var matched = _colData.find(function(c) { return normCol(c.name) === normCol(colName); });
    if (matched && matched.banner_image) {
      heroImg.src = matched.banner_image;
      heroImg.alt = matched.name + ' collection';
      heroEl.style.display = 'block';
      document.body.classList.add('has-collection-hero');
    } else {
      // Collection has no banner - hide hero
      heroEl.style.display = 'none';
      document.body.classList.remove('has-collection-hero');
    }
  }

  var _prevCollection = '';
  function onMobilePersToggle() {
    var toggle = document.getElementById('mobilePersToggle');
    var isActive = toggle && toggle.classList.contains('active');
    var btn;
    if (isActive) {
      // Turning OFF - restore previous collection
      var restoreCol = _prevCollection;
      btn = restoreCol
        ? document.querySelector('#collectionFilterBar .col-btn[data-col="' + restoreCol.replace(/"/g,'\"') + '"]')
        : document.querySelector('#collectionFilterBar .col-btn[data-col=""]');
      if (!btn) btn = document.querySelector('#collectionFilterBar .col-btn[data-col=""]');
    } else {
      // Turning ON - remember current collection
      var curBtn = document.querySelector('#collectionFilterBar .col-btn.active');
      _prevCollection = curBtn ? (curBtn.dataset.col || '') : '';
      btn = document.querySelector('#collectionFilterBar .col-btn[data-col="__personalised__"]');
    }
    if (btn) setCollectionFilter(btn);
    if (toggle) toggle.classList.toggle('active', !isActive);
    refreshDrawerNav();
  }
  function syncDrawerSearch(val) {
    var si = document.getElementById('searchInput');
    if (si) { si.value = val; applyFilters(); }
  }
  function syncDrawerSort(val) {
    var sf = document.getElementById('sortFilter');
    if (sf) { sf.value = val; applyFilters(); }
  }
  function openDrawer() {
    refreshDrawerNav();
    document.getElementById('collectionDrawer').classList.add('open');
    document.getElementById('drawerOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    document.getElementById('collectionDrawer').classList.remove('open');
    document.getElementById('drawerOverlay').classList.remove('open');
    document.body.style.overflow = '';
  }

  load();

