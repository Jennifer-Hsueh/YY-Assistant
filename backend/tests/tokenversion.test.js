// 改密碼後,舊的登入憑證(帶舊密碼版本 pv)失效;沒有 pv 的舊憑證照常可用
const path = require('path');
const Module = require('module');
process.env.JWT_SECRET = 'test-secret';
let row = { id: 'u1', email: 'a@b.co', password_hash: 'HASH-1', is_disabled: false, role: 'user', plan: 'full' };
const q = () => { const b = { select: () => b, eq: () => b, update: () => b, upsert: () => Promise.resolve({}), maybeSingle: async () => ({ data: row, error: null }), then: (r) => Promise.resolve({ data: null, error: null }).then(r) }; return b; };
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, parent, ...rest) { return req.endsWith('config/supabase') ? 'FAKE_SUPABASE' : orig.call(this, req, parent, ...rest); };
require.cache.FAKE_SUPABASE = { id: 'FAKE_SUPABASE', filename: 'FAKE_SUPABASE', loaded: true, exports: { from: q } };
const jwt = require('jsonwebtoken');
const A = require(path.join(__dirname, '../src/middleware/auth.js'));
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const run = (token) => new Promise((resolve) => {
  const res = { status(s) { this.s = s; return this; }, json() { resolve(this.s); } };
  A.requireAuth({ headers: { authorization: 'Bearer ' + token } }, res, () => resolve(200));
});
(async () => {
  const sign = (pv) => jwt.sign({ id: 'u1', email: 'a@b.co', ...(pv ? { pv } : {}) }, 'test-secret');
  ok(await run(sign(A.pwVersion('HASH-1'))) === 200, '密碼版本相符：可以使用');
  ok(await run(sign(null)) === 200, '沒有 pv 的舊憑證：照常可用');
  row = { ...row, password_hash: 'HASH-2' }; A.forgetUserStatus('u1');
  ok(await run(sign(A.pwVersion('HASH-1'))) === 401, '改密碼後舊憑證失效');
  ok(await run(sign(A.pwVersion('HASH-2'))) === 200, '新憑證可以使用');
  ok(A.pwVersion('HASH-2').length === 12 && !A.pwVersion('HASH-2').includes('HASH'), '憑證裡只有雜湊指紋，看不出密碼雜湊');
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
