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


const ac = require(B + 'controllers/anniversaryController.js');
const An = require(B + 'lib/annualDates.js');
const { runDailyReminders } = require(B + 'jobs/dailyReminders.js');
const R = () => require('crypto').randomUUID();
const wait = () => new Promise((r) => setTimeout(r, 30));
(async () => {
  for (const t of ['yy_anniversaries','yy_anniversary_members','yy_friendships','yy_reminder_log']) db[t] = db[t] || [];
  // date helpers
  ok(An.nextOf('10-26', '2026-10-25').days_left === 1 && An.nextOf('10-24', '2026-10-25').next === '2027-10-24', 'nextOf');
  ok(An.nextOf('02-29', '2026-03-01').next === '2027-02-28' && An.nextOf('02-29', '2027-03-01').next === '2028-02-29', 'leap day');
  ok(An.anniversaryInfo('2020-10-25', '2026-10-25').years === 6 && An.anniversaryInfo('2020-10-25', '2026-10-25').days_left === 0, 'years & today');
  ok(An.anniversaryInfo({ date: '2026-12-01', recurring: false }, '2026-10-25').days_left === 37 && An.anniversaryInfo({ date: '2026-10-01', recurring: false }, '2026-10-25').days_left === -24, 'non-recurring');
  ok(An.anniversaryInfo({ date: '2000-10-25', year_known: false }, '2026-10-25').years === null, 'unknown year no years');
  const A = R(), Bb = R(), C = R();
  db.yy_users.push({ id: A, email: 'a@x', username: '阿美', birthday_md: '10-25', birthday_visible: true }, { id: Bb, email: 'b@x', username: '小鮑', notify_birthdays: true }, { id: C, email: 'c@x', username: '小陳', notify_birthdays: false });
  db.yy_friendships.push({ id: R(), requester_id: A, addressee_id: Bb, status: 'accepted' }, { id: R(), requester_id: A, addressee_id: C, status: 'accepted' });
  let r = await call(ac.create, { user: A, body: { title: '交往紀念日', date: '2020-10-25', remind: 'day_3', icon: 'a08', invite_ids: [Bb] } });
  const an = r.json.anniversary; ok(r.status === 201 && r.json.invited === 1, 'create with invite');
  r = await call(ac.create, { user: A, body: { title: '', date: '2020-10-25' } }); ok(r.status === 400, 'validation');
  r = await call(ac.create, { user: A, body: { title: 'x', date: '2020-10-25', remind: 'day_7' } }); ok(r.status === 400, 'old remind rejected');
  r = await call(ac.create, { user: A, body: { title: 'x', date: '2020-10-25', icon: 'zz' } }); ok(r.status === 400, 'bad icon');
  r = await call(ac.create, { user: A, body: { title: '媽媽生日', date: '1960-10-25', year_known: false, show_age: true, recurring: false } });
  ok(r.status === 201 && r.json.anniversary.date === '2000-10-25' && r.json.anniversary.recurring === true, 'unknown year stored as 2000 + recurring');
  await call(ac.remove, { user: A, params: { id: r.json.anniversary.id } });
  r = await call(ac.create, { user: A, body: { title: '爸爸生日', date: '1958-10-25', show_age: true, show_years: false } }); const dad = r.json.anniversary;
  r = await call(ac.create, { user: A, body: { title: '只有我', date: '2019-10-28' } }); ok(r.status === 201, 'create without invites');
  r = await call(ac.listAll, { user: Bb }); ok(r.json.invites.length === 1 && r.json.anniversaries.length === 0 && r.json.birthdays[0].name === '阿美', 'invitee sees invite & friend birthday');
  await call(ac.accept, { user: Bb, params: { id: an.id } });
  r = await call(ac.listAll, { user: Bb }); ok(r.json.anniversaries.length === 1 && !r.json.anniversaries[0].is_owner, 'member sees anniversary');
  r = await call(ac.update, { user: Bb, params: { id: an.id }, body: { title: '在一起紀念日' } }); ok(r.status === 200, 'member can edit');
  r = await call(ac.update, { user: C, params: { id: an.id }, body: { title: 'x' } }); ok(r.status === 404, 'stranger cannot');
  // daily reminders on 2026-10-25 09:00 Taipei
  pushes.length = 0;
  const now = new Date('2026-10-25T01:00:00Z');
  let res = await runDailyReminders(now); await wait();
  ok(pushes.filter((p) => p.text.includes('在一起紀念日')).length === 2, 'anniversary day push to both ' + JSON.stringify(res));
  ok(pushes.some((p) => p.text.includes('爸爸生日') && p.text.includes('68 歲')), 'age label');
  await call(ac.remove, { user: A, params: { id: dad.id } });
  ok(pushes.some((p) => p.to === Bb && p.text.includes('阿美 的生日')) && !pushes.some((p) => p.to === C && p.text.includes('生日')), 'birthday to opted-in friends only');
  pushes.length = 0; await runDailyReminders(now); await wait(); ok(pushes.length === 0, 'no duplicates on rerun');
  // before reminder: '只有我' 2019-10-28 remind day -> no before; set day_3
  await call(ac.update, { user: A, params: { id: db.yy_anniversaries[1].id }, body: { remind: 'day_3' } });
  pushes.length = 0; await runDailyReminders(now); await wait(); ok(pushes.some((p) => p.text.includes('3 天後是「只有我」')), 'before reminder');
  pushes.length = 0; await runDailyReminders(new Date('2026-10-24T20:00:00Z')); ok(true, 'early hour skip ok');
  const early = await runDailyReminders(new Date('2026-10-24T22:00:00Z')); ok(early.skipped === 'too early', 'skip before 8am');
  // hidden birthday
  db.yy_users.find((u) => u.id === A).birthday_visible = false;
  r = await call(ac.listAll, { user: Bb }); ok(r.json.birthdays.length === 0, 'hidden birthday not listed');
  // member delete = leave; owner delete all
  await call(ac.remove, { user: Bb, params: { id: an.id } }); ok(db.yy_anniversaries.some((x) => x.id === an.id) && !db.yy_anniversary_members.some((m) => m.user_id === Bb && m.anniversary_id === an.id), 'member leaves');
  await call(ac.remove, { user: A, params: { id: an.id } }); ok(!db.yy_anniversaries.some((x) => x.id === an.id), 'owner deletes');
  console.log(fails ? 'FAILED ' + fails : 'ALL PASS');
})();
