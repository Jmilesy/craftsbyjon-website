// Fails if store/shop-shell.js no longer matches the blocks in store/index.html.   node tests/browser/shell-drift.cjs
'use strict';
const fs = require('fs'), path = require('path');
const { extract, shellSource } = require('./shell-blocks.cjs');
const ROOT = path.resolve(__dirname, '../..');
const want = shellSource(extract(fs.readFileSync(path.join(ROOT, 'store/index.html'), 'utf8')));
const have = fs.readFileSync(path.join(ROOT, 'store/shop-shell.js'), 'utf8');
if (want !== have) { console.log('FAIL store/shop-shell.js differs from store/index.html: run node tests/browser/shell-blocks.cjs --write'); process.exit(1); }
console.log('pass  store/shop-shell.js matches store/index.html');
