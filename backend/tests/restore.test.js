// In-memory fake of the supabase-js query builder, enough for communityController.
const Module = require('module');
const path = require('path');
const db = { yy_bug_reports: [], yy_accounts: [], yy_transactions: [], yy_moods: [], yy_categories: [], yy_events: [], yy_budgets: [], yy_users: [], yy_notes: [], yy_posts: [], yy_post_reports: [], yy_post_comments: [], yy_post_reactions: [], yy_announcements: [], yy_payments: [], yy_plan_notices: [], yy_recurring_items: [], yy_transactions: [], yy_accounts: [], yy_push_subscriptions: [] };
let seq = 0;
function q(table) {
  const st = { table, filters: [], op: 'select', order: null, limit: null, single: false, maybe: false, count: false, head: false, payload: null, onConflict: null, returning: false };
  const api = {
    select(cols, opts = {}) { if (st.op === 'select') st.op = 'select'; else st.returning = true; st.count = !!opts.count; st.head = !!opts.head; return api; },
    eq(k, v) { st.filters.push((r) => r[k] === v); return api; },
    neq(k, v) { st.filters.push((r) => r[k] !== v); return api; },
    in(k, vs) { st.filters.push((r) => vs.includes(r[k])); return api; },
    ilike(k, pat) { const kw = pat.slice(1, -1).replace(/\\(.)/g, '$1').toLowerCase(); st.filters.push((r) => (r[k] || '').toLowerCase().includes(kw)); return api; },
    lt(k, v) { st.filters.push((r) => r[k] < v); return api; },
    lte(k, v) { st.filters.push((r) => r[k] <= v); return api; },
    gte(k, v) { st.filters.push((r) => r[k] >= v); return api; },
    is(k, v) { st.filters.push((r) => (r[k] ?? null) === v); return api; },
    not(k, op, v) { st.filters.push((r) => !((r[k] ?? null) === v)); return api; },
    order(k, o) { st.order = [k, o?.ascending !== false]; return api; },
    limit(n) { st.limit = n; return api; },
    range(a, b) { st.range = [a, b]; return api; },
    or(expr) { const parts = expr.split(',').map((p) => p.split('.')); st.filters.push((r) => parts.some(([k, op, ...v]) => op === 'is' ? (r[k] ?? null) === null : String(r[k]) === v.join('.'))); return api; },
    insert(p) { st.op = 'insert'; st.payload = p; return api; },
    update(p) { st.op = 'update'; st.payload = p; return api; },
    delete() { st.op = 'delete'; return api; },
    upsert(p, o) { st.op = 'upsert'; st.payload = p; st.onConflict = o?.onConflict; return api; },
    single() { st.single = true; return api; },
    maybeSingle() { st.maybe = true; return api; },
    then(res, rej) { try { res(run(st)); } catch (e) { rej(e); } },
  };
  return api;
}
function run(st) {
  const rows = db[st.table];
  const match = (r) => st.filters.every((f) => f(r));
  let out;
  if (st.op === 'insert' && st.table === 'yy_plan_notices' && rows.some((r) => ['user_id','kind','ref_date','threshold'].every((k) => r[k] === st.payload[k]))) {
    return { data: null, error: { code: '23505', message: 'dup' } };
  }
  if (st.op === 'insert' && Array.isArray(st.payload)) {
    st.payload.forEach((p) => rows.push({ ...p })); out = st.payload;
  } else if (st.op === 'insert') {
    const r = { id: 'id' + (++seq), created_at: new Date(Date.now() + seq).toISOString(), hidden: false, ...(st.table === 'yy_notes' ? { is_done: false, done_at: null } : {}), ...st.payload };
    if (st.table === 'yy_posts') r.updated_at = r.created_at;
    rows.push(r); out = [r];
  } else if (st.op === 'upsert') {
    const keys = st.onConflict.split(',');
    const ex = rows.find((r) => keys.every((k) => r[k] === st.payload[k]));
    if (ex) Object.assign(ex, st.payload); else rows.push({ id: 'id' + (++seq), created_at: new Date().toISOString(), ...st.payload });
    out = [];
  } else if (st.op === 'update') {
    out = rows.filter(match); out.forEach((r) => Object.assign(r, st.payload));
  } else if (st.op === 'delete') {
    const del = rows.filter(match);
    db[st.table] = rows.filter((r) => !match(r));
    if (st.table === 'yy_posts') for (const t of ['yy_post_comments', 'yy_post_reactions', 'yy_post_reports']) db[t] = db[t].filter((r) => !del.some((d) => d.id === r.post_id));
    if (st.table === 'yy_users') {
      const ids = new Set(del.map((d) => d.id));
      for (const t of Object.keys(db)) {
        if (t === 'yy_users') continue;
        if (t === 'yy_payments' || t === 'yy_bug_reports') db[t].forEach((r) => { if (ids.has(r.user_id)) r.user_id = null; });
        else db[t] = db[t].filter((r) => !ids.has(r.user_id) && !ids.has(r.target_user_id));
      }
      const postIds = new Set(); // cascade from posts removed above
      for (const t of ['yy_post_comments', 'yy_post_reactions', 'yy_post_reports']) db[t] = db[t].filter((r) => db.yy_posts.some((p) => p.id === r.post_id));
    }
    out = del;
  } else {
    out = rows.filter(match).map((r) => ({ ...r }));
    if (st.order) { const [k, asc] = st.order; out.sort((a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0) * (asc ? 1 : -1)); }
    if (st.limit) out = out.slice(0, st.limit);
    if (st.range) out = out.slice(st.range[0], st.range[1] + 1);
    if (st.count) return { data: st.head ? null : out, count: out.length, error: null };
  }
  if (st.single) return { data: out[0] ? { ...out[0] } : null, error: out[0] ? null : { message: 'no rows' } };
  if (st.maybe) return { data: out[0] ? { ...out[0] } : null, error: null };
  return { data: out, error: null };
}
const store = {};
const fake = { from: q, storage: { getBucket: async () => ({ data: { name: 'b' } }), createBucket: async () => ({}), from: () => ({
  upload: async (p, buf) => { store[p] = buf; return { error: null }; },
  download: async (p) => (store[p] ? { data: new Blob([store[p]]), error: null } : { data: null, error: { message: 'nf' } }),
  list: async (dir) => ({ data: Object.keys(store).filter((k) => k.startsWith(dir + '/')).map((k) => ({ name: k.slice(dir.length + 1), created_at: new Date().toISOString(), metadata: { size: store[k].length } })), error: null }),
  remove: async (ps) => { ps.forEach((p) => delete store[p]); return { error: null }; },
}) }, storage0: { from: () => ({ list: async () => ({ data: [{ name: 'yy-backup-20261004.json.gz' }, { name: 'yy-backup-20261011.json.gz', created_at: '2026-10-11T19:10:00Z' }], error: null }) }) } };
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, parent, ...rest) {
  if (req.endsWith('config/supabase')) return 'FAKE_SUPABASE';
  if (req.endsWith('services/fcmService')) return 'FAKE_FCM';
  if (req.endsWith('/emailService')) return 'FAKE_FCM';
  if (req === 'node-cron') return 'FAKE_CRON';
  if (req.endsWith('controllers/exchangeRateController')) return 'FAKE_RATE';
  return origResolve.call(this, req, parent, ...rest);
};
require.cache.FAKE_SUPABASE = { id: 'FAKE_SUPABASE', filename: 'FAKE_SUPABASE', loaded: true, exports: fake };
const pushes = [];
require.cache.FAKE_FCM = { id:'FAKE_FCM', filename:'FAKE_FCM', loaded:true, exports:{ sendPushToUser: async (u, m) => { pushes.push(m.title + ' ' + m.body); return { sent:true }; }, sendEmail: async (m) => { mails.push(m); return { sent: true }; }, sendPasswordResetEmail: async () => ({}) } };
require.cache.FAKE_RATE = { id:'FAKE_RATE', filename:'FAKE_RATE', loaded:true, exports:{ rateTo: async (c) => (c === 'JPY' ? 0.2 : 1) } };



const mails = [];
require.cache.FAKE_CRON = { id:'FAKE_CRON', filename:'FAKE_CRON', loaded:true, exports:{ schedule(){} } };
process.env.JWT_SECRET = 'testsecret';
const B = require('path').join(__dirname, '../src') + '/';
const zlib = require('zlib');
const bcrypt = require('bcryptjs');
const admin = require(B + 'controllers/adminController.js');
const auth = require(B + 'controllers/authController.js');
const bug = require(B + 'controllers/bugReportController.js');
const { runBackup } = require(B + 'services/backupService.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const call = async (fn, { user = 'A', params = {}, query = {}, body = {}, headers = {} } = {}) => {
  let status = 200, json, sent; const res = { status(s) { status = s; return res; }, json(j) { json = j; return res; }, set() {}, send(b) { sent = b; return res; } };
  await fn({ user: user && { id: user, email: user + '@x' }, params, query, body, headers }, res, () => {}); return { status, json, sent };
};
const clone = () => JSON.parse(JSON.stringify(db));
(async () => {
  const hash = await bcrypt.hash('pw123456', 4);
  db.yy_users.push({ id: 'A', email: 'admin@x', role: 'admin', password_hash: hash }, { id: 'U', email: 'u@x', role: 'user', password_hash: hash }, { id: 'V', email: 'v@x', role: 'user', password_hash: hash });
  db.yy_accounts.push({ id: 'acc1', user_id: 'U', name: '錢包' });
  db.yy_transactions.push({ id: 't1', user_id: 'U', account_id: 'acc1', amount: 100 }, { id: 't2', user_id: 'U', account_id: 'acc1', amount: 50 }, { id: 'tv', user_id: 'V', amount: 9 });
  db.yy_moods.push({ user_id: 'U', date: '2026-10-01', mood: 'sunny' });
  db.yy_posts.push({ id: 'pU', user_id: 'U', board: 'mood', content: 'U post' }, { id: 'pV', user_id: 'V', board: 'mood', content: 'V post' });
  db.yy_post_comments.push({ id: 'c1', post_id: 'pU', user_id: 'V', content: 'V on U' }, { id: 'c2', post_id: 'pV', user_id: 'U', content: 'U on V' });
  db.yy_post_reactions.push({ post_id: 'pU', user_id: 'V', type: 'hug' });
  db.yy_payments.push({ id: 'pay1', user_id: 'U', plan: 'adv_b', amount: 59 });

  // 故障通報
  let r = await call(bug.submitBugReport, { user: 'U', body: { title: ' 當機 ', description: '打不開' }, headers: { 'user-agent': 'iPhone Safari' } });
  ok(r.status === 200 && db.yy_bug_reports[0].title === '當機' && db.yy_bug_reports[0].user_agent === 'iPhone Safari', 'bug report saved (no email env)');
  r = await call(admin.listBugReports, {}); console.log(JSON.stringify(r.json).slice(0,300)); ok(r.json.reports.length === 1 && r.json.reports[0].reporter, 'list bugs open');
  r = await call(admin.updateBugReport, { params: { id: db.yy_bug_reports[0].id }, body: { status: 'done', admin_note: '已修正' } });
  ok(r.json.report.status === 'done', 'update bug');
  r = await call(admin.listBugReports, { query: { status: 'open' } }); ok(r.json.reports.length === 0, 'done hidden from open');
  r = await call(admin.updateBugReport, { params: { id: db.yy_bug_reports[0].id }, body: { status: 'x' } }); ok(r.status === 400, 'bad status');

  // 備份
  const bk = await runBackup();
  ok(bk.path.startsWith('weekly/') && store[bk.path], 'weekly backup made');
  const snapshot = clone();
  r = await call(admin.listBackups); ok(r.json.backups.length === 1, 'list backups');
  r = await call(admin.backupSummary, { query: { path: bk.path, user: 'U' } });
  ok(r.json.users.length === 3 && r.json.userCounts.yy_transactions === 2 && r.json.userCounts.yy_post_comments === 2, 'summary + user counts ' + JSON.stringify(r.json.userCounts));
  r = await call(admin.backupSummary, { query: { path: '../etc/passwd' } }); ok(r.status === 400, 'path validated');
  r = await call(admin.downloadBackup, { query: { path: bk.path } }); ok(Buffer.isBuffer(r.sent) && r.sent.length > 10, 'download');

  // 使用者 U 誤刪資料 + 新增一筆
  db.yy_transactions = db.yy_transactions.filter((t) => t.id !== 't1');
  db.yy_transactions.push({ id: 't3', user_id: 'U', amount: 7 });
  db.yy_posts = db.yy_posts.filter((p) => p.id !== 'pU'); db.yy_post_comments = db.yy_post_comments.filter((c) => c.post_id !== 'pU'); db.yy_post_reactions = [];
  r = await call(admin.restoreBackup, { body: { path: bk.path, scope: 'user', user_id: 'U', confirm: 'wrong' } }); ok(r.status === 400, 'confirm required');
  r = await call(admin.restoreBackup, { body: { path: bk.path, scope: 'user', user_id: 'U', confirm: 'U@X' } });
  ok(r.json.ok && r.json.safety.startsWith('pre-restore/'), 'user restore ok, safety ' + r.json.safety);
  const uTx = db.yy_transactions.filter((t) => t.user_id === 'U').map((t) => t.id).sort().join();
  ok(uTx === 't1,t2', 'U transactions back to backup: ' + uTx);
  ok(db.yy_transactions.some((t) => t.id === 'tv'), 'V untouched');
  ok(db.yy_posts.some((p) => p.id === 'pU') && db.yy_post_comments.some((c) => c.id === 'c1') && db.yy_post_reactions.length === 1, 'U post + V comment/reaction restored');
  ok(db.yy_post_comments.filter((c) => c.id === 'c2').length === 1, 'no duplicate U comment on V post');
  ok(db.yy_payments.length === 1, 'payments untouched');

  // 刪除帳號
  r = await call(auth.deleteAccount, { user: 'U', body: { password: 'nope' } }); ok(r.status === 400 && r.json.code === 'wrong_password', 'wrong password');
  r = await call(auth.deleteAccount, { user: 'A', body: { password: 'pw123456' } }); ok(r.status === 400 && r.json.code === 'admin_account', 'admin blocked');
  r = await call(auth.deleteAccount, { user: 'U', body: { password: 'pw123456' } });
  ok(r.status === 200 && !db.yy_users.some((u) => u.id === 'U'), 'account deleted');
  ok(!db.yy_transactions.some((t) => t.user_id === 'U') && !db.yy_posts.some((p) => p.user_id === 'U'), 'data cascaded');
  ok(db.yy_payments[0].user_id === null && db.yy_payments[0].user_email === 'u@x', 'payment kept with email snapshot');
  ok(db.yy_bug_reports[0].user_id === null, 'bug report kept anonymized');

  // 還原已刪除的使用者
  r = await call(admin.restoreBackup, { body: { path: bk.path, scope: 'user', user_id: 'U', confirm: 'u@x' } });
  ok(r.json.recreated && db.yy_users.some((u) => u.id === 'U') && db.yy_transactions.filter((t) => t.user_id === 'U').length === 2, 'deleted user recreated from backup');

  // 全站還原
  db.yy_transactions.push({ id: 'junk', user_id: 'V', amount: 1 });
  db.yy_announcements.push({ id: 'annNew', title: 'new' });
  r = await call(admin.restoreBackup, { body: { path: bk.path, scope: 'all', confirm: '全站還原' } });
  ok(r.json.ok, 'full restore ok');
  const pick = (d) => Object.fromEntries(['yy_users','yy_transactions','yy_posts','yy_post_comments','yy_payments','yy_announcements'].map((t) => [t, d[t].map((x) => x.id || x.post_id).sort().join()]));
  ok(JSON.stringify(pick(db)) === JSON.stringify(pick(snapshot)), 'db equals backup after full restore');
  const pre = Object.keys(store).filter((k) => k.startsWith('pre-restore/'));
  const preJson = JSON.parse(zlib.gunzipSync(store[pre[pre.length - 1]]).toString());
  ok(preJson.tables.yy_transactions.some((t) => t.id === 'junk'), 'pre-restore snapshot holds the state before restore');
  console.log(fails ? `FAILED ${fails}` : 'ALL PASS');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
