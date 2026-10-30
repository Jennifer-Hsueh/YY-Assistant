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
  if (st.op === 'insert') {
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
  return origResolve.call(this, req, parent, ...rest);
};
db.yy_password_reset_tokens = [];
require.cache.FAKE_SUPABASE = { id: 'FAKE_SUPABASE', filename: 'FAKE_SUPABASE', loaded: true, exports: { from: q } };
process.env.JWT_SECRET = 'x'; process.env.APP_URL = 'https://app.test';
const B = require('path').join(__dirname, '../src') + '/';
let sent = []; let mode = 'ok';
global.fetch = async (url, opt) => {
  sent.push({ url, body: JSON.parse(opt.body) });
  if (mode === 'ok') return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, remaining: 99 }) };
  if (mode === 'bad') return { ok: true, status: 200, text: async () => JSON.stringify({ ok: false, error: 'unauthorized' }) };
  return { ok: false, status: 403, text: async () => '{"message":"testing only"}' };
};
const a = require(B + 'controllers/authController.js');
const adm = require(B + 'controllers/adminController.js');
let fails = 0; const ok = (cnd, m) => { console.log((cnd ? 'PASS ' : 'FAIL ') + m); if (!cnd) fails++; };
const call = async (fn, { user = 'U', body = {}, params = {} } = {}) => {
  let status = 200, json; const res = { status(s) { status = s; return res; }, json(j) { json = j; return res; }, send() { return res; } };
  await fn({ user: { id: user }, params, query: {}, body }, res); return { status, json };
};
(async () => {
  db.yy_users.push({ id: 'u1', email: 'a@x.com', password_hash: require('bcryptjs').hashSync('rightpass', 4) });
  process.env.EMAIL_RELAY_URL = 'https://script.test/exec'; process.env.EMAIL_RELAY_KEY = 'k';
  let r = await call(a.requestPasswordReset, { body: { email: 'a@x.com' } });
  ok(r.status === 200 && sent[0].url === 'https://script.test/exec' && sent[0].body.key === 'k' && sent[0].body.to === 'a@x.com', 'relay used');
  mode = 'bad'; r = await call(a.requestPasswordReset, { body: { email: 'a@x.com' } });
  ok(r.status === 502 && r.json.error === '寄信失敗，請稍後再試', 'relay failure -> chinese 502');
  delete process.env.EMAIL_RELAY_URL; process.env.RESEND_API_KEY = 'r'; mode = 'resend403'; sent = [];
  r = await call(a.requestPasswordReset, { body: { email: 'a@x.com' } });
  ok(r.status === 502 && sent[0].url.includes('resend'), 'fallback resend, failure handled');
  r = await call(a.requestPasswordReset, { body: { email: 'none@x.com' } }); ok(r.status === 200, 'unknown email still 200');
  r = await call(a.login, { body: { email: 'a@x.com', password: 'zzzzzzzz' } }); ok(r.status === 401 && r.json.error === 'Email 或密碼不正確', 'chinese login error');
  r = await call(adm.createResetLink, { user: 'admin', params: { id: 'u1' } });
  const exp = new Date(r.json.expires_at).getTime() - Date.now();
  ok(r.status === 200 && r.json.url.startsWith('https://app.test/reset-password?token=') && exp > 23 * 3600e3, 'admin reset link 24h');
  r = await call(adm.createResetLink, { user: 'admin', params: { id: 'nope' } }); ok(r.status === 404, 'admin link unknown user 404');
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
})();
