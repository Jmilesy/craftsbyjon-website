/* Crafts by Jon: cookie consent and analytics loader, shared by the shop (/store/) and product pages
   (/products/{id}). Moved out of store/index.html unchanged on 11 Oct 2026, so both pages ask once with the
   same wording and load the same tags. The banner text is the one privacy.html section 3.1 describes:
   change them together. */
  (function() {
    var CONSENT_KEY = 'cbj_cookie_consent';
    // Safe no-op stub so any gtag() call elsewhere on the page (e.g. in openModal)
    // never throws before real analytics has loaded, such as before cookie
    // consent is given, or if it's declined. Real GA4 script below upgrades this.
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
    function loadAnalytics() {
      // Staff preview builds of product pages set CBJ_PREVIEW: never send their visits to analytics.
      if (window.CBJ_PREVIEW) return;
      var ga = document.createElement('script');
      ga.async = true;
      ga.src = 'https://www.googletagmanager.com/gtag/js?id=G-299D45HZTC';
      document.head.appendChild(ga);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function(){ dataLayer.push(arguments); };
      gtag('js', new Date());
      gtag('config', 'G-299D45HZTC');

      (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "xjwf8ndu7r");
      // Tell Clarity the visitor has accepted. Since 31 Oct 2025 Clarity needs this signal for UK/EEA/CH
      // visitors; without it each page view gets its own ID and sessions are not tracked across pages.
      // This code only runs after Accept, and the banner covers analytics and the Pinterest tag, so both are granted.
      window.clarity('consentv2', { ad_Storage: 'granted', analytics_Storage: 'granted' });

      // Pinterest Tag (base code) -- same consent gate as GA4/Clarity above.
      !function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
      pintrk('load', '2613856981486');
      pintrk('page');
    }
    function getConsent() { try { return localStorage.getItem(CONSENT_KEY); } catch(e) { return null; } }
    function setConsent(v) { try { localStorage.setItem(CONSENT_KEY, v); } catch(e) {} }
    window.cbjConsent = { get: getConsent, set: setConsent, loadAnalytics: loadAnalytics };

    var existing = getConsent();
    if (existing === 'accepted') {
      loadAnalytics();
    } else if (existing !== 'declined') {
      document.addEventListener('DOMContentLoaded', function() {
        var banner = document.getElementById('cookieBanner');
        if (!banner) return;
        banner.style.display = 'flex';
        // While the banner is up, the page keeps its height free (--cbj-consent-h) so it never sits on top of
        // Add to Cart, the basket's Checkout button or the sticky bar (11 Oct 2026).
        var root = document.documentElement;
        function reserve() { root.style.setProperty('--cbj-consent-h', banner.offsetHeight + 'px'); }
        reserve();
        root.classList.add('cbj-consent-open');
        var ro = window.ResizeObserver ? new ResizeObserver(reserve) : null;
        if (ro) ro.observe(banner); else window.addEventListener('resize', reserve);
        function hide() {
          banner.style.display = 'none';
          root.classList.remove('cbj-consent-open');
          root.style.removeProperty('--cbj-consent-h');
          if (ro) ro.disconnect(); else window.removeEventListener('resize', reserve);
        }
        document.getElementById('cookieAccept').addEventListener('click', function() {
          setConsent('accepted');
          hide();
          loadAnalytics();
        });
        document.getElementById('cookieDecline').addEventListener('click', function() {
          setConsent('declined');
          hide();
        });
      });
    }
  })();
(function () {
  // The banner markup now lives here (it was static HTML in store/index.html), so every page shows the same words.
  var BANNER_HTML = "<div class=\"cookie-banner\" id=\"cookieBanner\" role=\"dialog\" aria-label=\"Cookie consent\">\n  <div class=\"cookie-banner-text\">\n    I use cookies for site analytics (Google Analytics &amp; Microsoft Clarity) and for the Pinterest tag, which shares visit data with Pinterest to measure and support my Pinterest listings and any Pinterest advertising. See my <a href=\"/privacy.html\" target=\"_blank\">Privacy Policy</a>.\n  </div>\n  <div class=\"cookie-banner-actions\">\n    <button class=\"cookie-btn\" id=\"cookieDecline\" type=\"button\">Decline</button>\n    <button class=\"cookie-btn cookie-btn-accept\" id=\"cookieAccept\" type=\"button\">Accept</button>\n  </div>\n</div>";
  function ensureBanner() {
    if (document.getElementById('cookieBanner')) return;
    var holder = document.createElement('div');
    holder.innerHTML = BANNER_HTML;
    document.body.insertBefore(holder.firstElementChild, document.body.firstChild);
  }
  // Registered before the handler above runs (capture phase), so the banner exists when it is looked up.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureBanner, true);
  else ensureBanner();
})();
