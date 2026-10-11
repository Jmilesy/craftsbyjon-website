// One scenario per kind of product, driven through the real controls (the popup in /store/, and the same
// controls on /products/{id}). Each ends with a click on Add to Cart; the runner then checks out.
'use strict';
const { makeJpeg } = require('./harness.cjs');

const wait = (page, ms) => page.waitForTimeout(ms || 120);
const SCENARIOS = [
  { name: 'bookmark, plain', id: 'bookmark-011', steps: async () => {} },
  { name: 'bookmark, personalised (+£1.50)', id: 'bookmark-025', steps: async page => { await page.fill('#modal-pers-text', 'Miss Smith'); } },
  // brokenOnMain: the live popup throws "blackUrl is not defined" for Clear/Black products (bug since at least
  // 5 Sep 2026), so on main this scenario can't get past opening the popup.
  { name: 'keyring, Black finish', id: 'keyring-001', brokenOnMain: 'blackUrl is not defined', steps: async page => { await page.click('.modal-variants .modal-variant-btn:text-is("Black")'); } },
  { name: 'keyring, plain', id: 'keyring-014', steps: async () => {} },
  { name: 'retro mug (single Gelato variant)', id: 'mug-005', steps: async () => {} },
  { name: 'teacher mug, name + message + colour', id: 'mug-001', steps: async page => {
      await page.fill('#modal-mug-name', 'Mrs Patel');
      await page.selectOption('#modal-mug-message', { index: 2 });
      await page.click('.mug-store-swatch >> nth=0');
    } },
  { name: 'teacher mug, custom message', id: 'mug-003', steps: async page => {
      await page.selectOption('#modal-mug-message', 'Custom');
      await page.fill('#modal-mug-custom-message', 'Best TA in Deal');
    } },
  { name: 't-shirt, Navy M', id: 'pod-t-shirt-pier', steps: async page => {
      await page.click('#podColourRow .modal-variant-btn:text-is("Navy")');
      await page.waitForSelector('#podSizeRow .modal-variant-btn');
      await page.click('#podSizeRow .modal-variant-btn:text-is("M")');
    } },
  { name: 'print, Black frame 40 cm no text', id: 'pod-print-deal-castle', steps: async page => {
      await page.waitForSelector('#printFrameRow [data-val="Black"]');
      await page.click('#printFrameRow [data-val="Black"]'); await wait(page);
      await page.click('#printSizeRow [data-val="40x40 cm / 16x16″"]'); await wait(page);
      await page.click('#printTextRow [data-val="No"]');
    } },
  { name: 'tote, Black with text', id: 'totebag002', steps: async page => {
      await page.waitForSelector('#toteColourRow [data-val="Black"]');
      await page.click('#toteColourRow [data-val="Black"]'); await wait(page);
      await page.click('#toteTextRow [data-val="Yes"]');
    } },
  { name: 'coaster set', id: 'coaster-001', steps: async () => {} },
  { name: 'photo mug: option, photo, name, rights', id: 'mug-birthday-photo', patch: { 'mug-birthday-photo': { 'Ready to Go': 'yes' } }, steps: async page => {
      await page.waitForSelector('#photoOptRow .modal-variant-btn');
      await page.click('#photoOptRow .modal-variant-btn >> nth=1');
      await page.setInputFiles('#photoFile', { name: 'me.jpg', mimeType: 'image/jpeg', buffer: await makeJpeg(page) });
      await page.waitForSelector('#photoCropWrap:not([style*="none"])');
      await page.waitForFunction(() => /Photo added/.test((document.getElementById('photoStatus') || {}).textContent || ''));
      const nm = await page.$('#photoName'); if (nm) await page.fill('#photoName', 'Ellie');
      await page.check('#photoRights');
    } }
];

// After Add to Cart: fill the basket extras and press Checkout; returns the captured request body.
async function checkoutFromBasket(page, log, extras) {
  extras = extras || {};
  await page.waitForSelector('#cartPanel.open, #cartPanel.active, #checkoutBtn:not([disabled])', { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => { if (typeof openCart === 'function') openCart(); });
  if (extras.promo) await page.fill('#promoCodeInput', extras.promo);
  if (extras.gift && await page.isVisible('#giftCheckbox')) { await page.check('#giftCheckbox'); await page.fill('#giftNoteText', 'Happy birthday!'); }
  if (extras.optIn) await page.check('#marketingOptIn');
  const before = log.checkouts.length;
  await page.click('#checkoutBtn');
  for (let i = 0; i < 50 && log.checkouts.length === before; i++) await wait(page, 60);
  return log.checkouts[log.checkouts.length - 1];
}

module.exports = { SCENARIOS, checkoutFromBasket, wait };
