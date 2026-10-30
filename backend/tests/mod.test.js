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
const mails = [];
Module._resolveFilename = function (req, parent, ...rest) {
  if (req.endsWith('config/supabase')) return 'FAKE_SUPABASE';
  if (req.endsWith('/emailService')) return 'FAKE_MAIL';
  if (req.endsWith('services/communityImages')) return 'FAKE_IMG';
  return origResolve.call(this, req, parent, ...rest);
};
db.yy_moderation_actions = [];
require.cache.FAKE_SUPABASE = { id: 'FAKE_SUPABASE', filename: 'FAKE_SUPABASE', loaded: true, exports: { from: q, storage: { from: () => ({}) } } };
require.cache.FAKE_MAIL = { id: 'FAKE_MAIL', filename: 'FAKE_MAIL', loaded: true, exports: { sendEmail: async (m) => { mails.push(m); return { sent: true }; }, sendPasswordResetEmail: async () => ({}) } };
require.cache.FAKE_IMG = { id: 'FAKE_IMG', filename: 'FAKE_IMG', loaded: true, exports: { validKeys: () => [], signPosts: async (p) => p, removeImages: async () => {}, removeUserFolder: async () => {} } };
process.env.SUPPORT_EMAIL = 'help@x.com';
const B = require('path').join(__dirname, '../src') + '/';
const adm = require(B + 'controllers/adminController.js');
const cm = require(B + 'controllers/communityController.js');
let fails = 0; const ok = (cnd, m) => { console.log((cnd ? 'PASS ' : 'FAIL ') + m); if (!cnd) fails++; };
const call = async (fn, { user = 'U', body = {}, params = {}, query = {} } = {}) => {
  let status = 200, json; const res = { status(s) { status = s; return res; }, json(j) { json = j; return res; }, send() { return res; } };
  await fn({ user: { id: user }, params, query, body }, res); return { status, json };
};
(async () => {
  db.yy_users.push({ id: 'admin', email: 'a@x', role: 'admin' }, { id: 'u1', email: 'u1@x', role: 'user', plan: 'full', created_at: new Date().toISOString() });
  db.yy_posts.push({ id: 'p1', user_id: 'u1', board: 'finance', visibility: 'public', hidden: false, title: '賺錢', content: '加我賴' });
  let r = await call(adm.moderateUser, { user: 'admin', params: { id: 'u1' }, body: { action: 'warn', reason: '廣告' } });
  ok(r.status === 200 && db.yy_moderation_actions.length === 1 && db.yy_announcements.some((a) => a.target_user_id === 'u1' && a.title === '社群使用警告' && a.content.includes('help@x.com')), 'warn logs + announces');
  r = await call(adm.moderateUser, { user: 'admin', params: { id: 'u1' }, body: { action: 'suspend', days: 10, reason: 'x' } }); ok(r.status === 400, 'bad days rejected');
  r = await call(adm.moderateUser, { user: 'admin', params: { id: 'u1' }, body: { action: 'suspend', days: 7, reason: '再犯' } });
  ok(r.status === 200 && r.json.user.community_suspended_until && db.yy_users[1].community_suspended_until, 'suspend sets until');
  r = await call(cm.createPost, { user: 'u1', body: { board: 'finance', visibility: 'public', content: 'hi' } });
  ok(r.status === 403 && r.json.code === 'COMMUNITY_SUSPENDED', 'public post blocked: ' + r.json.error);
  r = await call(cm.createPost, { user: 'u1', body: { board: 'finance', visibility: 'private', content: 'hi' } }); ok(r.status === 201, 'private post allowed');
  r = await call(cm.react, { user: 'u1', params: { id: 'p1' }, body: { type: 'like' } }); ok(r.status === 403, 'react blocked');
  r = await call(cm.updatePost, { user: 'u1', params: { id: 'p1' }, body: { content: 'edit' } }); ok(r.status === 403, 'edit public post blocked');
  r = await call(adm.moderateUser, { user: 'admin', params: { id: 'u1' }, body: { action: 'lift' } }); ok(!db.yy_users[1].community_suspended_until, 'lift clears');
  r = await call(cm.createPost, { user: 'u1', body: { board: 'finance', visibility: 'public', content: 'hi' } }); ok(r.status === 201, 'public post ok after lift');
  r = await call(adm.setPostHidden, { user: 'admin', params: { id: 'p1' }, body: { hidden: true, reason: '廣告／引流' } });
  ok(db.yy_moderation_actions.some((a) => a.action === 'hide_post' && a.post_id === 'p1') && db.yy_announcements.some((a) => a.title === '您的文章已被隱藏' && a.content.includes('賺錢')), 'hide logs + notifies');
  const n = db.yy_announcements.length;
  r = await call(adm.setPostHidden, { user: 'admin', params: { id: 'p1' }, body: { hidden: true, reason: '廣告', confirm: true } }); ok(db.yy_announcements.length === n + 1, 'confirm on hidden notifies');
  r = await call(adm.setPostHidden, { user: 'admin', params: { id: 'p1' }, body: { hidden: true } }); ok(db.yy_announcements.length === n + 1, 'no-op hide no notify');
  r = await call(adm.updateUser, { user: 'admin', params: { id: 'u1' }, body: { is_disabled: true, disabled_reason: '詐騙' } });
  await new Promise((s) => setTimeout(s, 20));
  ok(mails.length === 1 && mails[0].to === 'u1@x' && mails[0].html.includes('詐騙') && db.yy_moderation_actions.some((a) => a.action === 'disable'), 'disable emails + logs');
  r = await call(adm.listModeration, { user: 'admin', params: { id: 'u1' } });
  ok(r.json.summary.warn === 1 && r.json.summary.suspend === 1 && r.json.summary.hide_post === 2 && r.json.summary.disable === 1, 'summary ' + JSON.stringify(r.json.summary));
  r = await call(adm.moderateUser, { user: 'admin', params: { id: 'admin' }, body: { action: 'warn', reason: 'x' } }); ok(r.status === 400, 'cannot moderate self');
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
})();
