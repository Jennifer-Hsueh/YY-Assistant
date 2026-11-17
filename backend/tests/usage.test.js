// 後台用量:資料庫與檔案大小、70%/90% 提醒
const path = require('path');
const Module = require('module');
const orig = Module._resolveFilename;
let rpcResult = { data: null, error: null };
Module._resolveFilename = function (req, parent, ...rest) { return req.endsWith('config/supabase') ? 'FAKE_SUPABASE' : orig.call(this, req, parent, ...rest); };
require.cache.FAKE_SUPABASE = { id: 'FAKE_SUPABASE', filename: 'FAKE_SUPABASE', loaded: true, exports: { rpc: async () => rpcResult } };
const U = require(path.join(__dirname, '../src/lib/usage.js'));
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const MB = 1024 * 1024;
const quiet = console.error; console.error = () => {};
(async () => {
  rpcResult = { data: { db_bytes: 50 * MB, buckets: { 'yy-community': { bytes: 300 * MB, files: 900 }, 'yy-backups': { bytes: 20 * MB, files: 8 } } }, error: null };
  let u = await U.getUsage();
  ok(u.db.pct === 10 && u.db.level === 'ok', '資料庫 50/500 MB = 10%');
  ok(u.storage.bytes === 320 * MB && u.storage.pct === 31.3 && u.level === 'ok', '檔案加總各 bucket（320 MB / 1 GB）');
  rpcResult = { data: { db_bytes: 360 * MB, buckets: {} }, error: null };
  u = await U.getUsage();
  ok(u.db.level === 'warn' && u.level === 'warn', '超過 70% 提醒');
  rpcResult = { data: { db_bytes: 460 * MB, buckets: {} }, error: null };
  ok((await U.getUsage()).level === 'danger', '超過 90% 警告');
  process.env.SUPABASE_DB_LIMIT_MB = '8192';
  ok((await U.getUsage()).level === 'ok', '升級後可用環境變數改上限');
  rpcResult = { data: null, error: { message: 'function not found' } };
  ok((await U.getUsage()).missing === true, 'SQL 沒跑時回傳 missing、不報錯');
  console.error = quiet;
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
