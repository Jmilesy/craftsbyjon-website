// node --test tests/variant-images.test.cjs   (store/variant-images.js with the real print and tote pickers)
const test = require('node:test');
const assert = require('node:assert/strict');
require('../store/print-picker.js');
require('../store/tote-picker.js');
const V = require('../store/variant-images.js');

const IMG = 'https://images.craftsbyjon.co.uk/products/';
const tee = {
  vars: ['Navy', 'White'].flatMap(c => ['S', 'M'].map((s, i) => ({ id: c.length * 10 + i, option1_name: 'Colour', option1_value: c, option2_name: 'Size', option2_value: s, gelato_variant_id: 'g-' + c + s }))),
  podGallery: { Navy: { front: IMG + 'navy-front.jpeg', lifestyle_male: IMG + 'navy-lifestyle_male.jpeg', size_chart: IMG + 'size-chart.png' } },
  defaults: [IMG + 'natural-front.jpeg']
};
const print = {
  vars: [['None', '25x25 cm', 'No', 1499], ['None', '25x25 cm', 'Yes', 1499], ['None', '30x30 cm', 'Yes', 1599], ['Black', '30x30 cm', 'No', 2999]]
    .map(([f, s, t, p], i) => ({ id: 500 + i, option1_name: 'Frame', option1_value: f, option2_name: 'Size', option2_value: s, option3_name: 'Text', option3_value: t, retail_price_pence: p })),
  printGallery: {
    'None|25x25 cm|No': { flat: IMG + 'n25n-flat.jpeg', lifestyle_living_room: IMG + 'n25n-lifestyle_living_room.jpeg' },
    'None|25x25 cm|Yes': { flat: IMG + 'n25y-flat.jpeg' },
    'None|30x30 cm|Yes': { flat: IMG + 'n30y-flat.jpeg' }
  },
  defaults: [IMG + 'print-flat.jpeg']
};
const tote = {
  vars: [['Black', 'No', 'b-no.png'], ['Black', 'Yes', 'b-yes.png'], ['White', 'No', null], ['White', 'Yes', 'w-yes.png']]
    .map(([c, t, u], i) => ({ id: 800 + i, option1_name: 'Colour', option1_value: c, option2_name: 'Text', option2_value: t, image_url: u && IMG + u, retail_price_pence: 1799 })),
  defaults: [IMG + 'tote-natural.png']
};
const keyring = { vars: [], finishes: ['Clear', 'Black'], finishImages: { black: IMG + 'keyring-001bl.jpg' }, defaults: [IMG + 'keyring-001.jpg'] };

test('kinds come from the data the store already has', () => {
  assert.equal(V.kindOf(tee), 'apparel');
  assert.equal(V.kindOf(print), 'print');
  assert.equal(V.kindOf(tote), 'tote');
  assert.equal(V.kindOf(keyring), 'finish');
  assert.equal(V.kindOf({ vars: [{ id: 1, option1_name: 'Design', option1_value: 'Castle' }] }), 'single');
});

test('t-shirt: the chosen colour\'s own gallery, in the live order', () => {
  const r = V.imagesFor(tee, { Colour: 'Navy' });
  assert.equal(r.exact, true);
  assert.deepEqual(r.urls, [IMG + 'navy-front.jpeg', IMG + 'navy-lifestyle_male.jpeg', IMG + 'size-chart.png']);
});

test('t-shirt: a colour with no photos never shows another colour silently', () => {
  const r = V.imagesFor(tee, { Colour: 'White' });
  assert.equal(r.exact, false);
  assert.match(r.note, /No photo of White/);
  assert.ok(!r.urls.some(u => u.includes('navy')), 'must not show the navy shirt for white');
});

test('print: exact frame, size and text', () => {
  const r = V.imagesFor(print, { Frame: 'None', Size: '25x25 cm', Text: 'No' });
  assert.equal(r.exact, true);
  assert.equal(r.urls[0], IMG + 'n25n-flat.jpeg');
});

test('print: Jon\'s fallback (other text at the same size) is used, and said out loud', () => {
  const r = V.imagesFor(print, { Frame: 'None', Size: '30x30 cm', Text: 'No' });
  assert.equal(r.urls[0], IMG + 'n30y-flat.jpeg');
  assert.equal(r.exact, false);
  assert.match(r.note, /without the DEAL · KENT text/);
});

test('print: a frame with no photos at all falls back to the plain print with a note', () => {
  const r = V.imagesFor(print, { Frame: 'Black', Size: '30x30 cm', Text: 'No' });
  assert.deepEqual(r.urls, print.defaults);
  assert.equal(r.exact, false);
  assert.match(r.note, /black frame/);
});

test('tote: exact picture, and the other-text fallback is flagged', () => {
  assert.equal(V.imagesFor(tote, { Colour: 'Black', Text: 'Yes' }).urls[0], IMG + 'b-yes.png');
  assert.equal(V.imagesFor(tote, { Colour: 'Black', Text: 'Yes' }).exact, true);
  const r = V.imagesFor(tote, { Colour: 'White', Text: 'No' });
  assert.equal(r.urls[0], IMG + 'w-yes.png');
  assert.equal(r.exact, false);
  assert.match(r.note, /White bag without the text/);
});

test('finish: Black shows its own photo; Clear uses the main photo; a missing Black is flagged', () => {
  assert.deepEqual(V.imagesFor(keyring, { Finish: 'Black' }), { urls: [IMG + 'keyring-001bl.jpg', IMG + 'keyring-001.jpg'], exact: true, note: null });
  assert.deepEqual(V.imagesFor(keyring, { Finish: 'Clear' }).urls, [IMG + 'keyring-001.jpg']);
  const noBlack = { ...keyring, finishImages: {} };
  const r = V.imagesFor(noBlack, { Finish: 'Black' });
  assert.equal(r.exact, false);
  assert.match(r.note, /No photo of the black finish/);
});

test('nothing chosen yet shows the normal pictures', () => {
  assert.deepEqual(V.imagesFor(tee, {}).urls, tee.defaults);
  assert.deepEqual(V.imagesFor(keyring, {}).urls, keyring.defaults);
});

test('variantFor returns the exact row, or null until every choice is made', () => {
  assert.equal(V.variantFor(tee, { Colour: 'Navy' }), null);
  assert.equal(V.variantFor(tee, { Colour: 'Navy', Size: 'M' }).gelato_variant_id, 'g-NavyM');
  assert.equal(V.variantFor(print, { Frame: 'None', Size: '30x30 cm', Text: 'Yes' }).id, 502);
  assert.equal(V.variantFor(print, { Frame: 'None', Size: '30x30 cm' }), null);
  assert.equal(V.variantFor(tote, { Colour: 'White', Text: 'No' }).id, 802);
  assert.deepEqual(V.variantFor(keyring, { Finish: 'Black' }), { finish: 'Black' });
  assert.equal(V.variantFor(keyring, {}), null);
});

test('shot names from file names', () => {
  assert.equal(V.shotOf(IMG + '1787-navy-lifestyle_male.jpeg'), 'lifestyle_male');
  assert.equal(V.shotOf(IMG + '1787-navy-front_alt.jpeg'), 'front_alt');
  assert.equal(V.shotOf(IMG + 'size-chart.png'), 'size_chart');
  assert.equal(V.shotOf(IMG + 'mug-005-default.jpeg'), null);
});
