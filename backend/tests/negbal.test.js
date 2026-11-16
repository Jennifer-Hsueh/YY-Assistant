// 帳戶餘額不能變負數(允許負數的帳戶除外);假資料庫同 events.test.js
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
require.cache.FAKE_SUPABASE = { id: 'FAKE_SUPABASE', filename: 'FAKE_SUPABASE', loaded: true, exports: { from: (t) => { if (!db[t]) db[t] = []; return q(t); }, storage: { from: () => ({}) } } };
require.cache.FAKE_MAIL = { id: 'FAKE_MAIL', filename: 'FAKE_MAIL', loaded: true, exports: { sendEmail: async () => ({}) } };
const B = path.join(__dirname, '../src') + '/';
const tc = require(B + 'controllers/transactionController.js');
const ac = require(B + 'controllers/accountController.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const ledger = { id: 'L1', user_id: 'U' };
const call = async (fn, { body = {}, params = {} } = {}) => {
  let status = 200, json; const res = { status(s) { status = s; return res; }, json(j) { json = j; return res; }, send() { return res; } };
  await fn({ user: { id: 'U' }, params, body, query: {}, headers: {}, ledger }, res); return { status, json };
};
const quiet = console.error; console.error = () => {};
(async () => {
  db.yy_accounts.push(
    { id: 'A', user_id: 'U', ledger_id: 'L1', name: '現金', bank: null, balance: 100, currency: 'TWD', allow_negative: false },
    { id: 'C', user_id: 'U', ledger_id: 'L1', name: '信用卡', bank: '國泰', balance: 0, currency: 'TWD', allow_negative: true },
  );
  const bal = (id) => db.yy_accounts.find((a) => a.id === id).balance;
  const day = '2026-11-16T04:00:00.000Z';

  let r = await call(tc.createTransaction, { body: { account_id: 'A', type: 'expense', amount: 150, occurred_at: day } });
  ok(r.status === 400 && r.json.code === 'NEGATIVE_BALANCE' && r.json.account.after === -50, '支出超過餘額：擋下並回傳變化後餘額');
  ok(bal('A') === 100 && db.yy_transactions.length === 0, '被擋下時沒有寫入、餘額不變');

  r = await call(tc.createTransaction, { body: { account_id: 'A', type: 'expense', amount: 100, occurred_at: day } });
  ok(r.status === 201 && bal('A') === 0, '剛好用到 0 可以儲存');

  r = await call(tc.createTransaction, { body: { account_id: 'C', type: 'expense', amount: 500, occurred_at: day } });
  ok(r.status === 201 && bal('C') === -500, '允許負數的帳戶（信用卡）可以變負數');

  r = await call(tc.createTransaction, { body: { account_id: 'A', type: 'income', amount: 30, occurred_at: day } });
  ok(r.status === 201 && bal('A') === 30, '收入照常');
  const incomeId = r.json.transaction.id;
  const spend = db.yy_transactions.find((t) => t.account_id === 'A' && t.type === 'expense');

  r = await call(tc.updateTransaction, { params: { id: spend.id }, body: { amount: 140 } });
  ok(r.status === 400 && r.json.account.after === -10 && bal('A') === 30, '修改金額後會變負數：擋下、餘額不變');
  r = await call(tc.updateTransaction, { params: { id: spend.id }, body: { amount: 110 } });
  ok(r.status === 200 && bal('A') === 20, '修改後仍 >= 0 可以儲存（先退回舊的再算新的）');
  r = await call(tc.updateTransaction, { params: { id: incomeId }, body: { type: 'expense' } });
  ok(r.status === 400 && r.json.account.after === -40, '收入改成支出會變負數：擋下');

  r = await call(ac.transferBetweenAccounts, { body: { from_account_id: 'A', to_account_id: 'C', amount: 21 } });
  ok(r.status === 400 && r.json.code === 'NEGATIVE_BALANCE' && bal('A') === 20, '轉出超過餘額：擋下');
  r = await call(ac.transferBetweenAccounts, { body: { from_account_id: 'C', to_account_id: 'A', amount: 100 } });
  ok(r.status !== 400 && bal('C') === -600 && bal('A') === 120, '從允許負數的帳戶轉出可以');

  r = await call(ac.createAccount, { body: { name: '負的', balance: -5 } });
  ok(r.status === 400 && r.json.code === 'NEGATIVE_BALANCE', '新帳戶期初負數且沒勾允許：擋下');
  r = await call(ac.createAccount, { body: { name: '新卡', balance: -5, allow_negative: true } });
  ok(r.status === 201 && r.json.account.allow_negative === true, '勾允許負數可以用負的期初餘額');
  r = await call(ac.updateAccount, { params: { id: 'A' }, body: { allow_negative: true } });
  ok(r.status === 200 && r.json.account.allow_negative === true, '編輯帳戶可以改「允許負數」');

  console.error = quiet;
  console.log(fails ? `${fails} FAILED` : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
