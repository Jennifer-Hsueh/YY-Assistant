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
    or(expr) { st.filters.push(parseOr(expr)); return api; },
    orOld(expr) { const parts = expr.split(',').map((p) => p.split('.')); st.filters.push((r) => parts.some(([k, op, ...v]) => op === 'is' ? (r[k] ?? null) === null : String(r[k]) === v.join('.'))); return api; },
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
function splitTop(s) { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur); cur = ''; } else cur += ch; } if (cur) out.push(cur); return out; }
function cond(c) {
  const m = c.match(/^and\((.*)\)$/); if (m) { const fs = splitTop(m[1]).map(cond); return (r) => fs.every((f) => f(r)); }
  const [k, op, ...v] = c.split('.'); const val = v.join('.');
  if (op === 'eq') return (r) => String(r[k]) === val;
  if (op === 'is') return (r) => (r[k] ?? null) === null;
  throw new Error('op ' + op);
}
function parseOr(expr) { const fs = splitTop(expr).map(cond); return (r) => fs.some((f) => f(r)); }
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
const call = async (fn, { user = 'admin', body = {}, params = {}, headers = {}, query = {} } = {}) => {
  let status = 200, json; const res = { status(s) { status = s; return res; }, json(j) { json = j; return res; } };
  await fn({ user: { id: user }, params, query: query || {}, body, headers }, res); return { status, json };
};
process.env.FIREBASE_X = '';
const fc = require(B + 'controllers/friendController.js');
const ac = require(B + 'controllers/adminController.js');
const F = require(B + 'lib/friends.js');
const as = (user) => ({ user });
(async () => {
  db.yy_friendships = []; db.yy_user_blocks = []; db.yy_user_reports = [];
  db.yy_users.push({ id: 'a', email: 'a@x', username: '阿美' }, { id: 'b', email: 'b@x', username: '小鮑' }, { id: 'c', email: 'c@x' }, { id: 'd', email: 'd@x', username: '停用', is_disabled: true, friend_code: 'DDDDDDDD' });
  let r = await call(fc.overview, as('a')); const codeA = r.json.me.code;
  ok(/^[A-HJKMNP-Z2-9]{8}$/.test(codeA) && r.json.friends.length === 0, 'code generated ' + codeA);
  r = await call(fc.overview, as('a')); ok(r.json.me.code === codeA, 'code stable');
  const codeB = (await call(fc.overview, as('b'))).json.me.code;
  r = await call(fc.lookup, { user: 'b', query: undefined }); 
  r = await call(fc.request, { user: 'b', body: { code: codeA.slice(0,4) + '-' + codeA.slice(4).toLowerCase() } });
  ok(r.status === 201 && r.json.status === 'outgoing' && r.json.user.name === '阿美' && !r.json.user.email, 'b requests a (normalized code), no email leak');
  r = await call(fc.request, { user: 'b', body: { code: codeA } }); ok(r.json.status === 'outgoing' && db.yy_friendships.length === 1, 'duplicate request idempotent');
  r = await call(fc.overview, as('a')); ok(r.json.incoming.length === 1 && r.json.incoming[0].id === 'b', 'a sees incoming');
  r = await call(fc.overview, as('b')); ok(r.json.outgoing.length === 1, 'b sees outgoing');
  r = await call(fc.accept, { user: 'b', params: { userId: 'a' } }); ok(r.status === 404, 'requester cannot accept own');
  r = await call(fc.accept, { user: 'a', params: { userId: 'b' } }); console.log(JSON.stringify(r)); ok(r.json.status === 'friend', 'a accepts');
  ok(await F.areFriends('a', 'b') && (await F.friendIds('a')).join() === 'b', 'areFriends/friendIds');
  r = await call(fc.request, { user: 'a', body: { code: codeA } }); ok(r.status === 400, 'self code rejected');
  r = await call(fc.request, { user: 'a', body: { code: 'ZZZZZZZZ' } }); ok(r.status === 404, 'unknown code 404');
  r = await call(fc.request, { user: 'a', body: { code: 'DDDDDDDD' } }); ok(r.status === 404, 'disabled user hidden');
  // c requests b, b requests c back -> auto accept
  const codeC = (await call(fc.overview, as('c'))).json.me.code;
  await call(fc.request, { user: 'c', body: { code: codeB } });
  r = await call(fc.request, { user: 'b', body: { code: codeC } }); ok(r.json.status === 'friend', 'mutual request auto-accepts');
  r = await call(fc.lookup, { user: 'a', query: { code: codeC } }); ok(r.json.relation === 'none' && r.json.user.name === null, 'lookup relation none');
  // block: b blocks c -> friendship removed, c cannot find b
  r = await call(fc.block, { user: 'b', params: { userId: 'c' } }); ok(!(await F.areFriends('b', 'c')), 'block removes friendship');
  r = await call(fc.lookup, { user: 'c', query: { code: codeB } }); ok(r.status === 404, 'blocked cannot look up');
  r = await call(fc.overview, as('b')); ok(r.json.blocked.length === 1 && r.json.friends.length === 1, 'blocked list');
  r = await call(fc.unblock, { user: 'b', params: { userId: 'c' } }); r = await call(fc.lookup, { user: 'c', query: { code: codeB } }); ok(r.status === 200, 'unblock');
  // report a -> blocks too
  r = await call(fc.report, { user: 'b', params: { userId: 'a' }, body: { reason: '騷擾' } }); ok(r.status === 201 && db.yy_user_reports.length === 1 && !(await F.areFriends('a','b')), 'report + block');
  r = await call(ac.listUserReports, { user: 'admin', query: {} }); console.log(JSON.stringify(r).slice(0,300));
  ok(r.json.reports[0].reported.email === 'a@x' && r.json.reports[0].reported_times === 1, 'admin list');
  r = await call(ac.updateUserReport, { params: { id: r.json.reports[0].id }, body: { status: 'done' } }); ok(r.json.report.status === 'done', 'admin mark done');
  // regenerate
  r = await call(fc.regenerateCode, as('a')); ok(r.json.code !== codeA, 'regenerate');
  r = await call(fc.lookup, { user: 'c', query: { code: codeA } }); ok(r.status === 404, 'old code invalid');
  // remove
  await call(fc.request, { user: 'c', body: { code: r.json?.code || (await call(fc.overview, as('a'))).json.me.code } });
  r = await call(fc.remove, { user: 'a', params: { userId: 'c' } }); ok(db.yy_friendships.every((f) => !(f.requester_id === 'c' && f.addressee_id === 'a')), 'decline removes');
  console.log(fails ? 'FAILED ' + fails : 'ALL PASS');
})();
