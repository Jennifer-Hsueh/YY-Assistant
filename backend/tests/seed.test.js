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
Module._resolveFilename = function (req, parent, ...rest) {
  if (req.endsWith('config/supabase')) return 'FAKE_SUPABASE';
  if (req.endsWith('/emailService')) return 'FAKE_MAIL';
  return origResolve.call(this, req, parent, ...rest);
};
db.yy_settings = [];
require.cache.FAKE_SUPABASE = { id: 'FAKE_SUPABASE', filename: 'FAKE_SUPABASE', loaded: true, exports: { from: (t) => { if (!db[t]) db[t] = []; return q(t); }, storage: { from: () => ({}) } } };
require.cache.FAKE_MAIL = { id: 'FAKE_MAIL', filename: 'FAKE_MAIL', loaded: true, exports: { sendEmail: async () => ({}), sendPasswordResetEmail: async () => ({}) } };
process.env.JWT_SECRET = 'x';
const B = require('path').join(__dirname, '../src') + '/';
const a = require(B + 'controllers/authController.js');
const adm = require(B + 'controllers/adminController.js');
const { betaStatus } = require(B + 'lib/beta.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const call = async (fn, { user = 'admin', body = {}, params = {}, headers = {} } = {}) => {
  let status = 200, json; const res = { status(s) { status = s; return res; }, json(j) { json = j; return res; } };
  await fn({ user: { id: user }, params, query: {}, body, headers }, res); return { status, json };
};
const cc = require(B + 'controllers/categoryController.js');
(async () => {
  let r = await call(a.register, { body: { email: 'z@x', password: '12345678', accept_terms: true } }); ok(r.status === 201, 'reg zh');
  const zid = r.json.user.id;
  r = await call(cc.listCategories, { user: zid }); const names = r.json.categories.map((c) => c.name);
  ok(names.length === 15 && names[0] === '餐飲' && names[14] === '約會', 'zh cats ordered ' + names.join(','));
  ok(db.yy_accounts.filter((x) => x.user_id === zid).map((x) => x.name).join() === '現金,銀行', 'zh accounts');
  r = await call(a.register, { body: { email: 'e@x', password: '12345678', accept_terms: true }, headers: { 'x-lang': 'en' } }); const eid = r.json.user.id;
  ok(db.yy_categories.filter((x) => x.user_id === eid)[0].name === 'Food', 'en cats');
  ok(db.yy_categories.filter((x) => x.user_id === eid && x.type === 'event').length === 3, 'event cats');
  // seed failure doesn't break registration
  const orig = db.yy_categories; Object.defineProperty(db, 'yy_categories', { get() { throw new Error('boom'); }, configurable: true });
  r = await call(a.register, { body: { email: 'f@x', password: '12345678', accept_terms: true } }); ok(r.status === 201, 'reg ok when seed fails');
  console.log(fails ? 'FAILED ' + fails : 'ALL PASS');
})();
