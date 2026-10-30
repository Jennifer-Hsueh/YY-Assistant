const Module = require('module'); const path = require('path'); const zlib = require('zlib');
const B = require('path').join(__dirname, '../src') + '/';
// fake supabase with range + storage
const db = {}; for (const t of ['yy_users','yy_accounts','yy_categories','yy_transactions','yy_recurring_items','yy_events','yy_budgets','yy_moods','yy_notes','yy_announcements','yy_posts','yy_post_comments','yy_post_reactions','yy_post_reports']) db[t] = [];
db.yy_transactions = Array.from({ length: 2345 }, (_, i) => ({ id: 't' + i }));
db.yy_users = [{ id: 'u1', email: 'a@b.c' }];
const storage = { buckets: new Set(), files: { 'weekly/yy-backup-20260101.json.gz':1,'weekly/yy-backup-20260108.json.gz':1,'weekly/yy-backup-20260115.json.gz':1,'weekly/yy-backup-20260122.json.gz':1,'weekly/yy-backup-20260129.json.gz':1,'weekly/yy-backup-20260205.json.gz':1,'weekly/yy-backup-20260212.json.gz':1,'weekly/yy-backup-20260219.json.gz':1,'weekly/yy-backup-20260226.json.gz':1 } };
const fake = {
  from: (t) => ({ select: () => ({ range: async (a, b) => (db[t] ? { data: db[t].slice(a, b + 1), error: null } : { data: null, error: { message: 'no table' } }) }) }),
  storage: {
    getBucket: async (n) => ({ data: storage.buckets.has(n) ? { name: n } : null, error: storage.buckets.has(n) ? null : { message: 'not found' } }),
    createBucket: async (n, o) => { storage.buckets.add(n); storage.private = o.public === false; return { error: null }; },
    from: (n) => ({
      upload: async (p, buf) => { storage.files[p] = buf; return { error: null }; },
      list: async (dir) => ({ data: Object.keys(storage.files).filter((k) => k.startsWith(dir + '/')).map((k) => ({ name: k.slice(dir.length + 1) })), error: null }),
      remove: async (ps) => { ps.forEach((p) => delete storage.files[p]); return { error: null }; },
    }),
  },
};
const mails = [];
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, parent, ...rest) {
  if (req.endsWith('config/supabase')) return 'FAKE_SB';
  if (req.endsWith('/emailService') || req === './emailService') return 'FAKE_MAIL';
  return orig.call(this, req, parent, ...rest);
};
require.cache.FAKE_SB = { id: 'FAKE_SB', filename: 'FAKE_SB', loaded: true, exports: fake };
require.cache.FAKE_MAIL = { id: 'FAKE_MAIL', filename: 'FAKE_MAIL', loaded: true, exports: { sendEmail: async (m) => { mails.push(m); return { sent: true }; } } };
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  process.env.BACKUP_EMAIL = 'me@x.y';
  const { runBackup, notify } = require(B + 'services/backupService.js');
  const r = await runBackup();
  ok(storage.buckets.has('yy-backups') && storage.private, 'private bucket created');
  const buf = storage.files[r.path];
  const json = JSON.parse(zlib.gunzipSync(buf).toString());
  ok(json.tables.yy_transactions.length === 2345, 'paged all 2345 transactions');
  ok(!('yy_password_reset_tokens' in json.tables) && !('yy_push_subscriptions' in json.tables), 'skips tokens');
  const left = Object.keys(storage.files).filter((k) => k.startsWith('weekly/'));
  ok(left.length === 8 && !left.includes('weekly/yy-backup-20260101.json.gz') && !left.includes('weekly/yy-backup-20260108.json.gz'), 'keeps latest 8, removed ' + r.removed);
  await notify(true, r); ok(mails[0]?.to === 'me@x.y' && /備份完成/.test(mails[0].subject), 'success email');
  await notify(false, 'boom <x>'); ok(/失敗/.test(mails[1].subject) && !mails[1].html.includes('<x>'), 'failure email escaped');

  // rate limit
  const { loginLimit, changePasswordLimit } = require(B + 'middleware/rateLimit.js');
  const call = (mw, req) => new Promise((res) => { let status = 200; const resp = { set() {}, status(s) { status = s; return resp; }, json(j) { res({ status, j }); } }; mw(req, resp, () => res({ status: 200 })); });
  let r429 = null;
  for (let i = 1; i <= 9; i++) { const out = await call(loginLimit, { ip: '1.1.1.1', body: { email: 'A@b.c ' } }); if (i <= 8) ok(out.status === 200, 'login try ' + i + ' allowed'); else r429 = out; }
  ok(r429.status === 429 && /嘗試次數過多/.test(r429.j.error), 'login 9th blocked: ' + r429.j?.error);
  const other = await call(loginLimit, { ip: '1.1.1.1', body: { email: 'other@b.c' } });
  ok(other.status === 200, 'other email same ip still allowed');
  for (let i = 0; i < 5; i++) await call(changePasswordLimit, { user: { id: 'u9' }, body: {} });
  ok((await call(changePasswordLimit, { user: { id: 'u9' }, body: {} })).status === 429, 'change password 6th blocked');
  console.log(fails ? 'FAILED ' + fails : 'ALL PASS');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
