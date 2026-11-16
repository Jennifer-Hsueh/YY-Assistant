// In-memory fake of the supabase-js query builder, enough for communityController.
const Module = require('module');
const path = require('path');
const db = { yy_users: [], yy_notes: [], yy_posts: [], yy_post_reports: [], yy_post_comments: [], yy_post_reactions: [], yy_announcements: [], yy_payments: [], yy_plan_notices: [], yy_recurring_items: [], yy_transactions: [], yy_accounts: [], yy_push_subscriptions: [] };
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
    out = st.payload.map((p) => ({ id: 'id' + (++seq), ...p })); rows.push(...out);
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
const origResolve = Module._resolveFilename;
const uploads = []; const removed = [];
Module._resolveFilename = function (req, parent, ...rest) {
  if (req.endsWith('config/supabase')) return 'FAKE_SUPABASE';
  if (req.endsWith('/emailService')) return 'FAKE_MAIL';
  if (req.endsWith('services/communityImages')) return 'FAKE_IMG';
  return origResolve.call(this, req, parent, ...rest);
};
for (const t of ['yy_settings','yy_events','yy_categories','yy_budgets','yy_moods','yy_password_reset_tokens','yy_moderation_actions']) db[t] = db[t] || [];
const storage = { getBucket: async () => ({ data: {} }), createBucket: async () => ({}), from: () => ({ upload: async (p) => { uploads.push(p); return { error: null }; }, list: async () => ({ data: [] }), remove: async () => ({}) }) };
require.cache.FAKE_SUPABASE = { id: 'FAKE_SUPABASE', filename: 'FAKE_SUPABASE', loaded: true, exports: { from: (t) => { if (!db[t]) db[t] = []; return q(t); }, storage } };
require.cache.FAKE_MAIL = { id: 'FAKE_MAIL', filename: 'FAKE_MAIL', loaded: true, exports: { sendEmail: async () => ({}), sendPasswordResetEmail: async () => ({}) } };
require.cache.FAKE_IMG = { id: 'FAKE_IMG', filename: 'FAKE_IMG', loaded: true, exports: { removeUserFolder: async (id) => removed.push(id), signPosts: async (p) => p, validKeys: () => [], removeImages: async () => {} } };
process.env.JWT_SECRET = 'x';
const B = require('path').join(__dirname, '../src') + '/';
const adm = require(B + 'controllers/adminController.js');
const prof = require(B + 'controllers/profileController.js');
const beta = require(B + 'lib/beta.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const call = async (fn, { user = 'admin', body = {}, params = {} } = {}) => {
  let status = 200, json; const res = { status(s) { status = s; return res; }, json(j) { json = j; return res; } };
  await fn({ user: { id: user }, params, query: {}, body }, res); return { status, json };
};
(async () => {
  db.yy_users.push({ id: 'admin', email: 'ad@x', role: 'admin' }, { id: 'u1', email: 'u1@x', role: 'user', plan: 'basic', created_at: '2026-01-01T00:00:00Z', basic_choice: 'ledger' }, { id: 'u2', email: 'u2@x', role: 'user', plan: 'basic', created_at: '2026-10-01T00:00:00Z' });
  db.yy_transactions.push({ id: 't1', user_id: 'u1' }, { id: 't2', user_id: 'admin' });
  db.yy_notes.push({ id: 'n1', user_id: 'u2' });
  db.yy_posts.push({ id: 'p1', user_id: 'admin', board: 'mood', visibility: 'public' }, { id: 'p2', user_id: 'u1', board: 'mood' });
  db.yy_post_comments.push({ id: 'c1', post_id: 'p1', user_id: 'u1' });
  db.yy_payments.push({ id: 'pay', user_id: 'u2', amount: 69 });
  await beta.getBeta();
  let r = await call(prof.getProfile, { user: 'u1' }); ok(r.json.profile.ent.features.includes('export'), 'basic user can export during beta');
  r = await call(adm.updateBetaSettings, { body: { ends_at: '2026-12-31' } });
  ok(r.json.beta.ends_at === '2026-12-31' && db.yy_announcements.some((a) => a.title.includes('2026/12/31') && a.is_important), 'end date announces');
  const n = db.yy_announcements.length; await call(adm.updateBetaSettings, { body: { ends_at: '2026-12-31' } }); ok(db.yy_announcements.length === n, 'same date no duplicate');
  // 清空單一使用者:私人帳本清掉、共用帳本保留,補回預設分類與帳戶
  db.yy_ledgers = [{ id: 'L1', user_id: 'u1', is_default: true, name: '日常' }, { id: 'L2', user_id: 'u1', is_default: false, name: '家用' }];
  db.yy_ledger_members = [{ ledger_id: 'L2', user_id: 'u2', status: 'active' }];
  db.yy_transactions.push({ id: 't3', user_id: 'u1', ledger_id: 'L1' }, { id: 't4', user_id: 'u1', ledger_id: 'L2' });
  db.yy_accounts.push({ id: 'a1', user_id: 'u1', ledger_id: 'L1', name: '舊帳戶', balance: 5 });
  db.yy_moods.push({ user_id: 'u1', date: '2026-11-01', mood: 'sunny' });
  db.yy_categories.push({ id: 'cat', user_id: 'u1', name: '自訂', type: 'expense' });
  r = await call(adm.clearUserData, { params: { id: 'u1' }, body: { confirm: 'wrong@x' } }); ok(r.status === 400 && db.yy_moods.length === 1, 'clear user needs email confirm');
  r = await call(adm.clearUserData, { params: { id: 'admin' }, body: { confirm: 'ad@x' } }); ok(r.status === 400, 'admin cannot be cleared');
  r = await call(adm.clearUserData, { params: { id: 'u1' }, body: { confirm: 'U1@x' } });
  const u1Ledgers = db.yy_ledgers.filter((l) => l.user_id === 'u1');
  ok(r.status === 200 && uploads.some((p) => p.startsWith('user-clear/')) && removed.includes('u1'), 'clear user backs up first & removes photos: ' + JSON.stringify(r.json));
  ok(!db.yy_transactions.some((t) => t.id === 't3') && db.yy_transactions.some((t) => t.id === 't4') && db.yy_transactions.some((t) => t.id === 't2'), 'private ledger cleared, shared ledger and others kept');
  ok(!db.yy_posts.some((p) => p.id === 'p2') && db.yy_posts.some((p) => p.id === 'p1') && db.yy_post_comments.length === 0 && db.yy_moods.length === 0, 'own posts, comments, moods cleared');
  ok(u1Ledgers.some((l) => l.id === 'L2') && u1Ledgers.some((l) => l.is_default && l.id !== 'L1') && db.yy_accounts.filter((a) => a.user_id === 'u1').length === 2 && !db.yy_accounts.some((a) => a.id === 'a1'), 'new default ledger with default accounts');
  ok(db.yy_categories.filter((c) => c.user_id === 'u1').length > 3 && !db.yy_categories.some((c) => c.id === 'cat') && db.yy_users.length === 3, 'default categories back, account kept');
  r = await call(adm.bulkDeleteUsers, { body: { ids: ['u2', 'admin'], confirm: '刪除' } });
  ok(r.json.deleted === 1 && r.json.skipped === 1 && !db.yy_users.some((u) => u.id === 'u2') && db.yy_payments[0].user_email === 'u2@x', 'bulk delete skips admin, snapshots payment email');
  r = await call(adm.bulkDeleteUsers, { body: { ids: ['u1'], confirm: 'no' } }); ok(r.status === 400, 'bulk needs confirm');
  r = await call(adm.changeDeletePassword, { body: { current: 'wrong', next: 'abcd1234' } }); ok(r.status === 400, 'change delete pw needs current');
  r = await call(adm.changeDeletePassword, { body: { current: '刪除', next: 'ab' } }); ok(r.status === 400, 'new delete pw too short');
  r = await call(adm.changeDeletePassword, { body: { current: '刪除', next: 'abcd1234' } }); ok(r.status === 200 && r.json.custom, 'change delete pw');
  r = await call(adm.bulkDeleteUsers, { body: { ids: ['u1'], confirm: '刪除' } }); ok(r.status === 400, 'old delete pw rejected');
  r = await call(adm.getDeletePassword, {}); ok(r.json.custom === true, 'delete pw info');
  r = await call(adm.updateBetaSettings, { body: { active: false } }); await beta.getBeta();
  r = await call(prof.getProfile, { user: 'u1' }); ok(!r.json.profile.ent.features.includes('export'), 'after beta, basic no export');
  const st = await beta.betaStatus(); ok(st.full === false, 'not full when not active');
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
})();
