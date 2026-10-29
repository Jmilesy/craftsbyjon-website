// Tests the Prodigi part of staff/orders.html without a browser: the script must parse, each Prodigi state must render
// the right buttons, and the release flow must show the funds check, post the right body, and release nothing on 'No'.
const test = require('node:test');
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'staff', 'orders.html'), 'utf8');
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
new vm.Script(scripts.join('\n;\n')); // throws on a syntax error anywhere in the page script
console.log('syntax ok,', scripts.length, 'inline script block(s)');
const text = scripts.join('\n');
const seg = text.slice(text.indexOf('function renderProdigiBlock'), text.indexOf('async function refreshProdigi'));
assert.ok(seg.includes('async function releaseProdigi'), 'release function is inside the extracted segment');

function sandbox(fetchImpl, confirmAnswer) {
  const log = { confirms: [], alerts: [], toasts: [], posts: [], gets: [] };
  const ctx = {
    API: 'https://x/n8n-proxy/orders-api',
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    window: { confirm: (m) => { log.confirms.push(m); return confirmAnswer; } },
    alert: (m) => log.alerts.push(m), document: { getElementById: () => null },
    showToast: (m) => log.toasts.push(m), loadStats: async () => {}, loadOrders: async () => {},
    fetch: async (url, opts) => { if (opts && opts.method === 'POST') log.posts.push({ url, body: JSON.parse(opts.body) }); else log.gets.push(url); return fetchImpl(url, opts); },
    console, Date, Number, String, Promise, JSON, Array
  };
  vm.createContext(ctx);
  vm.runInContext(seg + '\n;this.renderProdigiBlock = renderProdigiBlock; this.releaseProdigi = releaseProdigi;', ctx);
  return { ctx, log };
}
const json = (code, body) => ({ ok: code < 400, status: code, json: async () => body });
const order = (g, extra = {}) => ({ id: 36, order_ref: 'CBJ-0036', prodigi_fulfilment_status: 'submitted', prodigi_cards: 12, prodigi_orders: [g], ...extra });

test('staff orders page: Prodigi block states, and the release flow with its funds check', async () => {
  const { ctx } = sandbox(async () => json(200, {}), true);
  // 1. waiting for release
  let h = ctx.renderProdigiBlock(order({ prodigi_order_id: '1', status: 'on_hold', totals: { total: '16.98' }, issues: [], allowed: ['resume', 'update', 'cancel'], parcels: [] }));
  assert.ok(h.includes('Release and pay &pound;16.98'), 'release button shown');
  assert.ok(h.includes('waiting at Prodigi') && h.includes('Nothing has been charged yet'));
  assert.ok(h.includes('Cancel at Prodigi'), 'cancel is offered while held');
  assert.ok(!h.includes('not offering a release'));
  assert.ok(h.includes('#FFF8E1'), 'amber box, not red');
  // 1b. waiting but cost not shown yet
  h = ctx.renderProdigiBlock(order({ prodigi_order_id: '1', status: 'on_hold', totals: null, issues: [], allowed: ['resume'], parcels: [] }));
  assert.ok(!h.includes('Release and pay') && h.includes('Press Refresh to see the cost'));
  // 2. a hold Prodigi will not let us release
  h = ctx.renderProdigiBlock(order({ prodigi_order_id: '1', status: 'on_hold', totals: { total: '16.98' }, issues: [{ code: 'payment_required', severity: 'error', message: 'x' }], allowed: ['update', 'cancel'], parcels: [] }));
  assert.ok(!h.includes('Release and pay') && h.includes('not offering a release') && h.includes('#FFEBEE'));
  // 3. in production: no release button, no cancel
  h = ctx.renderProdigiBlock(order({ prodigi_order_id: '1', status: 'in_production', totals: { total: '16.98' }, issues: [], allowed: ['update'], parcels: [] }));
  assert.ok(!h.includes('Release and pay') && !h.includes('Cancel at Prodigi') && h.includes('Sent to Prodigi'));
  // 3b. an older row with no `allowed` field at all must not break or offer a release
  h = ctx.renderProdigiBlock(order({ prodigi_order_id: '1', status: 'on_hold', totals: { total: '16.98' }, issues: [], parcels: [] }));
  assert.ok(!h.includes('Release and pay'));
  // 4. approval wording
  h = ctx.renderProdigiBlock(order({ prodigi_order_id: '1', status: 'draft', totals: { total: '16.98' }, issues: [], parcels: [] }, { prodigi_fulfilment_status: 'pending_approval' }));
  assert.ok(h.includes('Approving sends it to Prodigi, where it waits on hold'), 'approve box wording');
  console.log('render cases ok');

  // 5. release flow, funds fine
  const funds = { ok: true, status: 'on_hold', thisRelease: '16.98', warnBelow: '75.00', bank: { ok: true, name: 'HSBC', available: '300.00', refreshAt: '2026-10-29T05:08:57.000Z' },
    sinceRefresh: { known: true, total: '2.46', orders: [{ ref: 'CBJ-0035', total: '2.46' }] }, otherHeld: { count: 1, total: '2.46' }, after: '278.56', warn: false, notes: [] };
  let t = sandbox(async (url, opts) => (opts && opts.method === 'POST') ? json(200, { total: '16.98' }) : json(200, funds), true);
  await t.ctx.releaseProdigi(36, 'CBJ-0036', '16.98');
  assert.deepStrictEqual(t.log.gets, ['https://x/n8n-proxy/orders-api/staff-only/prodigi/36/funds']);
  const msg = t.log.confirms[0];
  for (const bit of ['HSBC available balance: £300.00', 'Prodigi charges since then: £2.46 (CBJ-0035)', 'This release: £16.98', 'about £278.56 left, before your other bills', 'Other orders still held at Prodigi: 1 (£2.46)', 'Release CBJ-0036 and pay Prodigi £16.98 now?'])
    assert.ok(msg.includes(bit), 'confirm text has: ' + bit + '\n' + msg);
  assert.ok(!msg.includes('WARNING'), 'no warning when funds are fine');
  assert.deepStrictEqual(t.log.posts, [{ url: 'https://x/n8n-proxy/orders-api/staff-only/prodigi/36/release', body: { expected_total: '16.98' } }]);
  assert.ok(t.log.toasts[0].includes('released to Prodigi'));
  // 6. warning case leads the message
  t = sandbox(async (url, opts) => (opts && opts.method === 'POST') ? json(200, { total: '16.98' }) : json(200, { ...funds, after: '60.00', warn: true }), true);
  await t.ctx.releaseProdigi(36, 'CBJ-0036', '16.98');
  assert.ok(t.log.confirms[0].startsWith('WARNING: this would leave you below your £75.00 level.'));
  // 7. Jon says no: nothing is posted
  t = sandbox(async () => json(200, funds), false);
  await t.ctx.releaseProdigi(36, 'CBJ-0036', '16.98');
  assert.strictEqual(t.log.posts.length, 0, 'cancelled confirm releases nothing');
  // 8. funds endpoint down: still asks, with the page's own cost, and says the check is unavailable
  t = sandbox(async (url, opts) => { if (opts && opts.method === 'POST') return json(200, { total: '16.98' }); throw new Error('network down'); }, true);
  await t.ctx.releaseProdigi(36, 'CBJ-0036', '16.98');
  assert.ok(t.log.confirms[0].includes('Funds check unavailable (network down). This release is £16.98.'));
  assert.deepStrictEqual(t.log.posts[0].body, { expected_total: '16.98' });
  // 9. bank unavailable but Prodigi fine
  t = sandbox(async (url, opts) => (opts && opts.method === 'POST') ? json(200, { total: '16.98' }) : json(200, { ok: true, thisRelease: '16.98', warnBelow: '75.00', bank: { ok: false, error: 'penny-api /balance answered HTTP 502' }, notes: [] }), true);
  await t.ctx.releaseProdigi(36, 'CBJ-0036', '16.98');
  assert.ok(t.log.confirms[0].includes('Funds check unavailable (penny-api /balance answered HTTP 502)'));
  // 10. the server refuses (cost moved): shown to Jon, nothing assumed
  t = sandbox(async (url, opts) => (opts && opts.method === 'POST') ? json(409, { error: 'The cost has changed: you were shown 16.98 and Prodigi now says 17.50. Nothing was released.' }) : json(200, funds), true);
  await t.ctx.releaseProdigi(36, 'CBJ-0036', '16.98');
  assert.ok(t.log.alerts[0].includes('The cost has changed'));
  // 11. no cost known anywhere: refuses to ask
  t = sandbox(async () => json(409, { error: 'Prodigi has not shown the cost yet.' }), true);
  await t.ctx.releaseProdigi(36, 'CBJ-0036', null);
  assert.strictEqual(t.log.confirms.length, 0);
  assert.ok(t.log.alerts[0].includes('cost is not known'));
  console.log('release flow cases ok');
});
