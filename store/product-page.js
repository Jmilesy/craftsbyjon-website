/* Crafts by Jon: product page extras (/products/{id}, 11 Oct 2026).
   shop.js does the real work (pickers, personalisation, basket, checkout) by drawing its product popup
   into the page. This file only adds what a page needs and a popup doesn't:
     - the short display name as the <h1> (the <title>, meta and Product data keep the catalogue title),
     - a breadcrumb and a "More from …" link,
     - the server-rendered summary removed once the buying controls are there (it stays if anything fails),
     - a sticky Add to Cart bar on phones, shown only while every buying control is off screen.
   It never builds a basket line itself: the bar presses the real Add to Cart button. */
(function () {
  'use strict';
  var page = window.CBJ_PAGE;
  if (!page || page.mode !== 'product') return;

  // Shorter display names: same rules as the approved mockup (preview/assets/preview.js).
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
  function displayName(p, all) {
    var s = shortName(p['Title']), key = s.toLowerCase();
    var clash = (all || []).some(function (x) { return x !== p && shortName(x['Title']).toLowerCase() === key; });
    return clash ? nameParts(p['Title']).join(', ') : s;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function typeName(p) {
    var t = (p.product_type || '').trim(), id = (p['Product ID'] || '').toLowerCase();
    if (!t && id.indexOf('bookmark-') === 0) t = 'Bookmark';
    if (!t && id.indexOf('keyring-') === 0) t = 'Keyring';
    return { 'Mug': 'Mugs', 'T-Shirt': 'T-shirts', 'Print': 'Prints', 'Tote Bag': 'Tote bags', 'Coaster Set': 'Coasters', 'Bookmark': 'Bookmarks', 'Keyring': 'Keyrings' }[t] || '';
  }
  function collectionUrl(name) { return '/store/?collection=' + encodeURIComponent(String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }

  // The basket button sits in the page header rather than floating over the page.
  function placeBasketButton() {
    var slot = document.getElementById('pp-cart-slot'), btn = document.getElementById('cartBtn');
    if (slot && btn && btn.parentNode !== slot) slot.appendChild(btn);
  }

  // Runs every time shop.js draws (or redraws, after Add to Cart) the product.
  function decorate(p) {
    var all = (typeof allProducts !== 'undefined') ? allProducts : [];
    var col = document.querySelector('.modal-details-col');
    var oldTitle = col && col.querySelector('.modal-title');
    if (oldTitle && oldTitle.tagName !== 'H1') {
      var h1 = document.createElement('h1');
      h1.className = 'modal-title';
      h1.textContent = displayName(p, all);
      oldTitle.replaceWith(h1);
    }
    if (col && !col.querySelector('.pp-crumbs')) {
      var crumbs = document.createElement('nav');
      crumbs.className = 'pp-crumbs';
      crumbs.setAttribute('aria-label', 'Breadcrumb');
      var t = typeName(p);
      crumbs.innerHTML = '<a href="/">Home</a> › <a href="/store/">Shop</a>'
        + (p['Collection'] ? ' › <a href="' + esc(collectionUrl(p['Collection'])) + '">' + esc(p['Collection']) + '</a>' : '')
        + (t ? ' › <span>' + esc(t) + '</span>' : '');
      col.insertBefore(crumbs, col.firstChild);
    }
    var actions = col && col.querySelector('.modal-actions');
    if (actions && p['Collection'] && !col.querySelector('.pp-more')) {
      var more = document.createElement('div');
      more.className = 'pp-more';
      var n = all.filter(function (x) { return x['Collection'] === p['Collection']; }).length;
      more.innerHTML = '<span>More from <b>' + esc(p['Collection']) + '</b></span><a href="' + esc(collectionUrl(p['Collection'])) + '">See all ' + n + '</a>';
      actions.parentNode.insertBefore(more, actions.nextSibling);
    }
    var mi = document.getElementById('modalMainImg');
    if (mi) { mi.setAttribute('fetchpriority', 'high'); mi.alt = displayName(p, all); }
    watchBuyingControls();
    syncSticky();
  }

  // ----- sticky Add to Cart bar (phones) -----
  var bar, observer, onScreen = new Set();
  // Everything in the details column except the description, bullets, testimonial and links counts as
  // "buying controls": the bar shows only while none of them is on screen, so it can never cover one.
  var NOT_BUYING = '.modal-short-desc, .modal-full-desc, .modal-bullets, .modal-testimonial, .pp-more, .modal-hr';
  function buildBar() {
    if (bar) return;
    bar = document.createElement('div');
    bar.className = 'pp-sticky';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Add to basket');
    bar.setAttribute('inert', '');
    bar.innerHTML = '<div class="pp-sticky-t"><b></b><span></span></div><button type="button" class="btn-add pp-sticky-btn"></button>';
    document.body.appendChild(bar);
    bar.querySelector('button').addEventListener('click', function () {
      var add = document.getElementById('modalAddBtn');
      if (!add) return;
      if (add.disabled) {
        // Take the shopper to what still needs choosing; the popup's own hint explains what.
        var actions = document.querySelector('.modal-actions');
        (actions || add).scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      add.click();
    });
  }
  function syncSticky() {
    if (!bar) return;
    var add = document.getElementById('modalAddBtn'), price = document.getElementById('modalPriceVal'), title = document.querySelector('.modal-details-col h1');
    bar.querySelector('b').textContent = title ? title.textContent : '';
    bar.querySelector('span').textContent = price ? price.textContent : '';
    var btn = bar.querySelector('button');
    btn.textContent = add ? (add.disabled ? 'Choose options' : 'Add to Cart') : '';
    var show = onScreen.size === 0 && !!add && window.matchMedia('(max-width: 899px)').matches;
    bar.classList.toggle('on', show);
    if (show) bar.removeAttribute('inert'); else bar.setAttribute('inert', '');
    document.documentElement.classList.toggle('pp-sticky-on', show);
  }
  function watchBuyingControls() {
    buildBar();
    if (observer) observer.disconnect();
    onScreen = new Set();
    var col = document.querySelector('.modal-details-col');
    if (!col) return;
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) onScreen.add(e.target); else onScreen.delete(e.target); });
      syncSticky();
    });
    Array.prototype.forEach.call(col.children, function (el) { if (!el.matches(NOT_BUYING)) observer.observe(el); });
    // Keep the bar's label in step with the real button (it is enabled/disabled as choices are made).
    var add = document.getElementById('modalAddBtn');
    if (add) new MutationObserver(syncSticky).observe(add, { attributes: true, childList: true, characterData: true, subtree: true });
    var price = document.getElementById('modalPriceVal');
    if (price) new MutationObserver(syncSticky).observe(price, { childList: true, characterData: true, subtree: true });
  }
  // Anything focused with the keyboard is scrolled clear of the bar.
  document.addEventListener('focusin', function (e) {
    if (!bar || !bar.classList.contains('on') || bar.contains(e.target)) return;
    var r = e.target.getBoundingClientRect(), top = bar.getBoundingClientRect().top;
    if (r.bottom > top - 8) window.scrollBy(0, r.bottom - top + 16);
  });
  window.addEventListener('resize', syncSticky);

  document.addEventListener('cbj:product-ready', function () {
    var s = document.getElementById('pp-static');
    if (s) s.remove();
    placeBasketButton();
  });
  document.addEventListener('cbj:product-drawn', function (e) { decorate(e.detail.product); });
  if (document.readyState !== 'loading') placeBasketButton(); else document.addEventListener('DOMContentLoaded', placeBasketButton);

  window.CBJProductPage = { shortName: shortName, displayName: displayName };
})();
