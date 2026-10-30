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
    if (ex) Object.assign(ex, st.payload); else rows.push({ id: require('crypto').randomUUID(), _seq: ++seq, created_at: new Date().toISOString(), ...st.payload });
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
const call = async (fn, { user = 'admin', body = {}, params = {}, headers = {}, query = {}, method = 'GET', ledger } = {}) => {
  let status = 200, json; const res = { status(s) { status = s; return res; }, json(j) { json = j; return res; }, send() { return res; } };
  const req = { user: { id: user }, params, query: query || {}, body, headers, method, get: (h) => headers[h.toLowerCase()], ledger }; if (Array.isArray(fn)) { for (const f of fn) { let nexted = false; await f(req, res, () => { nexted = true; }); if (!nexted) break; } } else await fn(req, res); return { status, json };
};


const pushes = []; const origLog = console.log;
console.log = (...a) => { const m = String(a[0]); const mm = m.match(/would push to user (\S+): (.*)$/); if (mm) pushes.push({ to: mm[1], text: mm[2] }); else if (!m.startsWith('[firebase]')) origLog(...a); };

const Lg = require(B + 'lib/ledgers.js');
const lc = require(B + 'controllers/ledgerController.js');
const tc = require(B + 'controllers/transactionController.js');
const ec = require(B + 'controllers/eventController.js');
const { runEventReminders } = require(B + 'jobs/eventReminder.js');
const R = () => require('crypto').randomUUID();
const W = (fn) => [Lg.withLedger, Lg.ledgerWritable, fn];
const wait = () => new Promise((r) => setTimeout(r, 30));
(async () => {
  for (const t of ['yy_ledgers','yy_ledger_members','yy_accounts','yy_transactions','yy_budgets','yy_recurring_items','yy_events','yy_event_members','yy_friendships']) db[t] = db[t] || [];
  const A = R(), Bb = R(), C = R(), Dd = R();
  db.yy_users.push({ id: A, email: 'a@x', username: '阿美', created_at: new Date().toISOString() }, { id: Bb, email: 'b@x', username: '小鮑', created_at: new Date().toISOString() }, { id: C, email: 'c@x', username: '小陳' }, { id: Dd, email: 'd@x', username: '路人' });
  db.yy_friendships.push({ id: R(), requester_id: A, addressee_id: Bb, status: 'accepted' }, { id: R(), requester_id: A, addressee_id: C, status: 'accepted' });
  // ---- archive rule
  await call(lc.listLedgers, { user: A });
  let r = await call(lc.createLedger, { user: A, body: { name: '家用' } }); const home = r.json.ledger;
  await call(lc.inviteMember, { user: A, params: { id: home.id }, body: { user_id: Bb } }); await call(lc.acceptInvite, { user: Bb, params: { id: home.id } });
  await call(lc.leaveLedger, { user: Bb, params: { id: home.id } });
  r = await call(lc.deleteLedger, { user: A, params: { id: home.id } }); ok(r.status === 400, 'once-shared ledger cannot be deleted');
  r = await call(lc.listLedgers, { user: A }); ok(r.json.ledgers.find((l) => l.id === home.id).was_shared === true, 'was_shared flag');
  r = await call(lc.leaveLedger, { user: A, params: { id: home.id } }); ok(r.json.archived === true && db.yy_ledgers.find((l) => l.id === home.id), 'owner alone -> archived, not deleted');
  r = await call(W(tc.createTransaction), { user: A, method: 'POST', headers: { 'x-ledger': home.id }, body: { type: 'expense', amount: 1, occurred_at: new Date().toISOString() } }); ok(r.status === 403, 'archived read-only for owner');
  r = await call(W(tc.listTransactions), { user: Bb, headers: { 'x-ledger': home.id } }); ok(r.status === 200, 'left member still views archived');
  r = await call(lc.listLedgers, { user: A }); const al = r.json.ledgers.find((l) => l.id === home.id); ok(al.role === 'left' && al.archived, 'listed archived');
  r = await call(lc.hideLedger, { user: A, params: { id: home.id } }); r = await call(lc.listLedgers, { user: A }); ok(!r.json.ledgers.some((l) => l.id === home.id) && db.yy_ledgers.some((l) => l.id === home.id), 'owner hides archived, data kept');
  // archive default ledger -> new default
  const def = db.yy_ledgers.find((l) => l.user_id === A && l.is_default);
  await call(lc.inviteMember, { user: A, params: { id: def.id }, body: { user_id: C } }); await call(lc.acceptInvite, { user: C, params: { id: def.id } }); await call(lc.leaveLedger, { user: C, params: { id: def.id } });
  await call(lc.leaveLedger, { user: A, params: { id: def.id } });
  ok(db.yy_ledgers.filter((l) => l.user_id === A && l.is_default && !l.archived_at).length === 1, 'new default after archiving default');
  // ---- shared events
  pushes.length = 0;
  r = await call(ec.createEvent, { user: A, body: { title: '聚餐', start_at: '2026-11-01T10:00:00.000Z', remind_before_minutes: 60, invite_ids: [Bb, C, Dd] } });
  const ev = r.json.event; await wait();
  ok(r.json.invited === 2, 'invites only friends');
  ok(pushes.filter((p) => p.text.includes('邀請你參加「聚餐」')).length === 2, 'invite pushes');
  r = await call(ec.listEvents, { user: Bb, query: {} }); ok(r.json.events.length === 0, 'invitee does not see before accept');
  r = await call(ec.listInvites, { user: Bb }); ok(r.json.invites.length === 1 && r.json.invites[0].from === '阿美', 'invite listed');
  pushes.length = 0;
  r = await call(ec.acceptInvite, { user: Bb, params: { id: ev.id } }); await wait();
  ok(pushes.some((p) => p.to === A && p.text.includes('小鮑 會參加')), 'accept notifies owner');
  r = await call(ec.declineInvite, { user: C, params: { id: ev.id } });
  r = await call(ec.listEvents, { user: Bb, query: {} });
  const bev = r.json.events[0]; ok(bev && bev.shared && !bev.is_owner && bev.owner.name === '阿美' && bev.members.length === 1, 'member sees shared event');
  // member edits
  pushes.length = 0;
  r = await call(ec.updateEvent, { user: Bb, params: { id: ev.id }, body: { title: '聚餐（改地點）', category: '工作' } }); await wait();
  ok(r.status === 200 && db.yy_events.find((e) => e.id === ev.id).title === '聚餐（改地點）' && db.yy_events.find((e) => e.id === ev.id).category !== '工作', 'member edits content, not category');
  ok(pushes.some((p) => p.to === A && p.text.includes('小鮑 修改了')), 'edit notifies owner');
  r = await call(ec.updateEvent, { user: Dd, params: { id: ev.id }, body: { title: 'x' } }); ok(r.status === 404, 'stranger cannot edit');
  // reminder goes to both
  pushes.length = 0;
  const rr = await runEventReminders(new Date('2026-11-01T09:00:30.000Z')); await wait(); origLog(JSON.stringify(rr), JSON.stringify(pushes));
  ok(pushes.filter((p) => p.text.includes('聚餐')).map((p) => p.to).sort().join() === [A, Bb].sort().join(), 'reminder to all participants');
  // member delete = leave
  r = await call(ec.deleteEvent, { user: Bb, params: { id: ev.id } });
  ok(db.yy_events.some((e) => e.id === ev.id) && !db.yy_event_members.some((m) => m.event_id === ev.id && m.user_id === Bb), 'member delete = leave');
  // owner delete removes for all
  await call(ec.updateEvent, { user: A, params: { id: ev.id }, body: { invite_ids: [Bb] } }); await call(ec.acceptInvite, { user: Bb, params: { id: ev.id } });
  pushes.length = 0;
  r = await call(ec.deleteEvent, { user: A, params: { id: ev.id } }); await wait();
  ok(!db.yy_events.some((e) => e.id === ev.id) && pushes.some((p) => p.to === Bb && p.text.includes('取消了')), 'owner delete cancels for all');
  console.log(fails ? 'FAILED ' + fails : 'ALL PASS');
})();
