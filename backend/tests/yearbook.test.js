// 年鑑:書的代號、期限、書櫃排序(書櫃排法 2026-11-27 起只在前端)
const path = require('path');
process.env.FIREBASE_SERVICE_ACCOUNT = '';
const Module = require('module');
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, parent, ...rest) { return req.endsWith('config/supabase') ? 'FAKE_SUPABASE' : orig.call(this, req, parent, ...rest); };
require.cache.FAKE_SUPABASE = { id: 'FAKE_SUPABASE', filename: 'FAKE_SUPABASE', loaded: true, exports: {} };
const B = require(path.join(__dirname, '../src/services/monthlyBook.js'));
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
ok(B.isKey('2026') && B.isKey('2026-11') && !B.isKey('2026-13') && !B.isKey('26'), '書的代號：月刊 YYYY-MM、年鑑 YYYY');
ok(B.deadlineOf('2026').toISOString() === '2027-01-07T16:00:00.000Z', '年鑑 1/8 0 點（台灣）定稿');
ok(B.deadlineOf('2026-12').toISOString() === '2027-01-07T16:00:00.000Z', '12 月月刊同一天定稿');
ok(['2027-01', '2026', '2026-12', '2026-11'].sort((a, b) => B.sortKey(a).localeCompare(B.sortKey(b))).join() === '2026-11,2026-12,2026,2027-01', '年鑑排在 12 月月刊後面');
ok(B.messageMax('2026') === 200 && B.messageMax('2026-11') === 60, '給自己的話最多 200 字');
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
