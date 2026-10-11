// The parts of store/index.html that product pages also need (3-for-£10 strip, basket button and panel,
// popup containers, lightbox). store/shop-shell.js carries a copy; tests/browser/shell-drift.cjs fails if the
// two ever differ, and `node tests/browser/shell-blocks.cjs --write` regenerates shop-shell.js.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

function cut(html, start, end) {
  const a = html.indexOf(start);
  if (a === -1) throw new Error('start not found: ' + start);
  const b = html.indexOf(end, a);
  if (b === -1) throw new Error('end not found after: ' + start);
  return html.slice(a, b + end.length);
}
function extract(html) {
  return {
    bundleBanner: cut(html, '<div id="bundleBanner"', '\n</div>'),
    basketAndPopup: cut(html, '<button class="cart-btn" id="cartBtn"', '<div class="modal-related" id="modalRelated"></div>\n  </div>\n</div>'),
    lightbox: cut(html, '<div class="lightbox" id="lightbox"', '\n</div>')
  };
}
function shellSource(blocks) {
  return `/* Crafts by Jon: the shop's basket panel, popup containers, 3-for-£10 strip and lightbox, for pages that
   use store/shop.js outside /store/ (product pages). GENERATED from store/index.html by
   tests/browser/shell-blocks.cjs --write; tests/browser/shell-drift.cjs fails if they differ. Don't edit by hand. */
(function () {
  var BLOCKS = ${JSON.stringify(blocks, null, 2)};
  function insert(html, where) {
    var t = document.createElement('template');
    t.innerHTML = html;
    where(t.content);
  }
  // Called by the product page before shop.js runs. Slots are optional: without them the pieces go at the end of <body>.
  window.CBJShell = {
    BLOCKS: BLOCKS,
    mount: function () {
      if (document.getElementById('cartPanel')) return;
      var strip = document.getElementById('pp-strip-slot'), app = document.getElementById('pp-app'), body = document.body;
      insert(BLOCKS.bundleBanner, function (f) { strip ? strip.appendChild(f) : body.insertBefore(f, body.firstChild); });
      insert(BLOCKS.basketAndPopup, function (f) { (app || body).appendChild(f); });
      insert(BLOCKS.lightbox, function (f) { body.appendChild(f); });
    }
  };
})();
`;
}
if (require.main === module && process.argv.includes('--write')) {
  const blocks = extract(fs.readFileSync(path.join(ROOT, 'store/index.html'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'store/shop-shell.js'), shellSource(blocks));
  console.log('wrote store/shop-shell.js:', Object.keys(blocks).map(k => k + ' ' + blocks[k].length + ' chars').join(', '));
}
module.exports = { extract, shellSource };
