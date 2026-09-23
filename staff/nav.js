// Shared staff nav — injected on every staff page. One file to rule them all.
(function () {
  var pages = [
    ['Dashboard',   '/staff/staff-index.html', '🏠'],
    ['Listings',    '/staff/listings.html',    '📋'],
    ['New Product', '/staff/new-product.html', '➕'],
    ['Collections', '/staff/collections.html', '🗂'],
    ['Orders',      '/staff/orders.html',      '📦'],
    ['Priorities',  '/staff/priorities.html',  '✅'],
    ['Social approval', '/staff/social-plan.html', '📝'],
    ['Reel Studio', '/staff/reel-studio.html', '🎬'],
    ['Traffic',     '/staff/traffic.html',     '📈'],
    ['Stock',       '/staff/stock.html',       '📦'],
    ['Finance',     '/staff/finance.html',     '💷'],
    ['POD Intake',  '/staff/pod-intake.html',  '🖨️'],
    ['Promo Codes', '/staff/promo-codes.html', '🏷']
  ];

  var here = window.location.pathname.replace(/\/$/, '');
  if (here === '/staff' || here === '/staff/index.html') here = '/staff/staff-index.html';

  var bar = document.createElement('nav');
  bar.id = 'cbj-staff-nav';
  bar.innerHTML = pages.map(function (p) {
    var active = here === p[1];
    return '<a href="' + p[1] + '" style="' +
      'text-decoration:none;padding:6px 11px;border-radius:8px;font-size:0.8rem;font-weight:600;' +
      'white-space:nowrap;display:inline-flex;align-items:center;gap:5px;' +
      (active
        ? 'background:#ffffff;color:#1a9992;'
        : 'background:rgba(255,255,255,0.12);color:#ffffff;') +
      '" onmouseover="if(!this.dataset.a)this.style.background=\'rgba(255,255,255,0.25)\'"' +
      ' onmouseout="if(!this.dataset.a)this.style.background=\'rgba(255,255,255,0.12)\'"' +
      (active ? ' data-a="1"' : '') + '>' +
      '<span>' + p[2] + '</span>' + p[0] + '</a>';
  }).join('');

  bar.style.cssText =
    'background:#178a84;padding:8px 16px;display:flex;gap:6px;overflow-x:auto;' +
    '-webkit-overflow-scrolling:touch;font-family:"DM Sans",sans-serif;' +
    'box-shadow:0 1px 6px rgba(0,0,0,0.12);position:sticky;top:0;z-index:9999;';

  document.body.insertBefore(bar, document.body.firstChild);
})();
