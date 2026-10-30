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
    upsert(p, o) { st.op = 'upsert'; st.payload = p; st.onConflict = o?.onConflict; st.ignoreDup = o?.ignoreDuplicates; return api; },
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
  if (op === 'in') { const set = val.replace(/^\(|\)$/g, '').split(','); return (r) => set.includes(String(r[k])); }
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
    out = st.payload.map((p) => ({ id: require('crypto').randomUUID(), _seq: ++seq, ...p })); rows.push(...out);
  } else if (st.op === 'insert') {
    const r = { id: require('crypto').randomUUID(), _seq: ++seq, created_at: new Date(Date.now() + seq).toISOString(), hidden: false, ...(st.table === 'yy_notes' ? { is_done: false, done_at: null } : {}), ...st.payload };
    if (st.table === 'yy_posts') r.updated_at = r.created_at;
    rows.push(r); out = [r];
  } else if (st.op === 'upsert') {
    const keys = st.onConflict.split(',');
    const ex = rows.find((r) => keys.every((k) => r[k] === st.payload[k]));
    if (ex) { if (!st.ignoreDup) Object.assign(ex, st.payload); out = []; } else { const nr = { id: require('crypto').randomUUID(), _seq: ++seq, created_at: new Date().toISOString(), ...st.payload }; rows.push(nr); out = [nr]; }
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
const call = async (fn, { user = 'admin', body = {}, params = {}, headers = {}, query = {}, method = 'GET', ledger } = {}) => {
  let status = 200, json; const res = { status(s) { status = s; return res; }, json(j) { json = j; return res; }, send() { return res; } };
  const req = { user: { id: user }, params, query: query || {}, body, headers, method, get: (h) => headers[h.toLowerCase()], ledger }; if (Array.isArray(fn)) { for (const f of fn) { let nexted = false; await f(req, res, () => { nexted = true; }); if (!nexted) break; } } else await fn(req, res); return { status, json };
};


const pushes = []; const origLog = console.log;
console.log = (...a) => { const m = String(a[0]); const mm = m.match(/would push to user (\S+): (.*)$/); if (mm) pushes.push({ to: mm[1], text: mm[2] }); else if (!m.startsWith('[firebase]')) origLog(...a); };



const sc = require(B + 'controllers/slipController.js');
const R = () => require('crypto').randomUUID();
(async () => {
  for (const t of ['yy_slips','yy_friendships','yy_user_blocks','yy_ledgers','yy_ledger_members','yy_events','yy_event_members','yy_anniversaries','yy_anniversary_members']) db[t] = db[t] || [];
  const A = R(), Fr = R(), L = R(), E = R(), N = R(), X = R(), Bl = R();
  db.yy_users.push({ id: A, username: '阿美' }, { id: Fr, username: '好友' }, { id: L, username: '帳本夥伴' }, { id: E, username: '行程夥伴' }, { id: N, username: '紀念日夥伴' }, { id: X, username: '路人' }, { id: Bl, username: '被封鎖' });
  db.yy_friendships.push({ id: R(), requester_id: A, addressee_id: Fr, status: 'accepted' }, { id: R(), requester_id: A, addressee_id: Bl, status: 'accepted' });
  db.yy_user_blocks.push({ blocker_id: A, blocked_id: Bl });
  const led = R(); db.yy_ledgers.push({ id: led, user_id: L, archived_at: null }); db.yy_ledger_members.push({ ledger_id: led, user_id: A, status: 'active' });
  const ev = R(); db.yy_events.push({ id: ev, user_id: A }); db.yy_event_members.push({ event_id: ev, user_id: E, status: 'active' });
  const an = R(); db.yy_anniversaries.push({ id: an, user_id: A }); db.yy_anniversary_members.push({ anniversary_id: an, user_id: N, status: 'invited' });
  let r = await call(sc.contacts, { user: A });
  const names = r.json.contacts.map((c) => c.name);
  ok(names.includes('好友') && names.includes('帳本夥伴') && names.includes('行程夥伴'), 'contacts include friend/ledger/event ' + names);
  ok(!names.includes('紀念日夥伴') && !names.includes('路人') && !names.includes('被封鎖'), 'excludes invited/stranger/blocked');
  r = await call(sc.contacts, { user: E }); ok(r.json.contacts.map((c) => c.name).includes('阿美'), 'event member sees owner');
  r = await call(sc.send, { user: A, body: { to: X, content: 'hi' } }); ok(r.status === 400, 'cannot send to stranger');
  r = await call(sc.send, { user: A, body: { to: Fr, content: '一二三四五六七八九十一二三四五六七八九十一二三四五六' } }); ok(r.status === 400, '26 chars rejected');
  r = await call(sc.send, { user: A, body: { to: Fr, content: '一二三四五六七八九十一二三四五六七八九十一二三四五' } }); ok(r.status === 201, '25 chars ok');
  const s1 = r.json.slip.id;
  r = await call(sc.send, { user: A, body: { to: L, content: '記得買菜' } }); const s2 = r.json.slip.id;
  ok(pushes.some((p) => p.to === L && p.text.includes('阿美')), 'push sent');
  r = await call(sc.list, { user: Fr }); ok(r.json.received.length === 1 && r.json.received[0].from.name === '阿美' && !r.json.received[0].read_at, 'recipient list');
  r = await call(sc.list, { user: A }); ok(r.json.sent.length === 2 && r.json.received.length === 0, 'sender sent list');
  await call(sc.markRead, { user: Fr, body: { ids: [s1] } });
  r = await call(sc.remove, { user: A, params: { id: s1 } }); ok(r.json.removed === 'hidden', 'read slip: sender only hides');
  r = await call(sc.list, { user: Fr }); ok(r.json.received.length === 1, 'recipient still has it');
  r = await call(sc.remove, { user: A, params: { id: s2 } }); ok(r.json.removed === 'recalled', 'unread slip recalled');
  r = await call(sc.list, { user: L }); ok(r.json.received.length === 0, 'recalled gone');
  r = await call(sc.remove, { user: X, params: { id: s1 } }); ok(r.status === 404, 'stranger cannot delete');
  r = await call(sc.remove, { user: Fr, params: { id: s1 } }); ok(r.json.removed === 'torn', 'recipient tears');
  ok(db.yy_slips.length === 0, 'gone');
  for (let i = 0; i < 20; i++) await call(sc.send, { user: A, body: { to: Fr, content: 'x' + i } });
  r = await call(sc.send, { user: A, body: { to: Fr, content: 'over' } }); ok(r.status === 429, 'daily cap ' + r.status);
  db.yy_slips = []; await call(sc.send, { user: L, body: { to: A, content: '騷擾' } });
  let u = await call(sc.unread, { user: A }); ok(u.json.count === 1, 'unread 1');
  db.yy_user_blocks.push({ blocker_id: A, blocked_id: L });
  u = await call(sc.unread, { user: A }); ok(u.json.count === 0, 'blocked unread 0');
  let l = await call(sc.list, { user: A }); ok(l.json.received.length === 0, 'blocked slip hidden');
  l = await call(sc.send, { user: L, body: { to: A, content: 'again' } }); ok(l.status === 400, 'blocked cannot send');
  console.log(fails ? `${fails} FAIL` : 'ALL PASS'); process.exit(fails ? 1 : 0);
})();
