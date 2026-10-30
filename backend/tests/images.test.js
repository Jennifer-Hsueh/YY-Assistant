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
const files = {}; const removed = [];
const fake = { from: q, storage: { getBucket: async () => ({ data: null }), createBucket: async () => ({ error: null }), from: () => ({
  upload: async (p, buf, o) => { if (files[p]) return { error: { message: 'exists' } }; files[p] = { buf, type: o.contentType }; return { error: null }; },
  remove: async (ps) => { ps.forEach((p) => { delete files[p]; removed.push(p); }); return { error: null }; },
  list: async (dir) => ({ data: Object.keys(files).filter((k) => k.startsWith(dir + '/')).map((k) => ({ name: k.slice(dir.length + 1) })) }),
  createSignedUrls: async (paths) => ({ data: paths.filter((p) => files[p]).map((p) => ({ path: p, signedUrl: 'https://signed/' + p })), error: null }),
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
require.cache.FAKE_FCM = { id:'FAKE_FCM', filename:'FAKE_FCM', loaded:true, exports:{ sendPushToUser: async (u, m) => { pushes.push(m.title + ' ' + m.body); return { sent:true }; } } };
require.cache.FAKE_RATE = { id:'FAKE_RATE', filename:'FAKE_RATE', loaded:true, exports:{ rateTo: async (c) => (c === 'JPY' ? 0.2 : 1) } };



const mails = [];
const B = require('path').join(__dirname, '../src') + '/';
const c = require(B + 'controllers/communityController.js');
let fails = 0; const ok = (cnd, m) => { console.log((cnd ? 'PASS ' : 'FAIL ') + m); if (!cnd) fails++; };
const call = async (fn, { user = 'U', params = {}, query = {}, body = {} } = {}) => {
  let status = 200, json; const res = { status(s) { status = s; return res; }, json(j) { json = j; return res; } };
  await fn({ user: { id: user }, params, query, body }, res); return { status, json };
};
const U = '11111111-1111-4111-8111-111111111111';
const V = '22222222-2222-4222-8222-222222222222';
const img = (n) => 'data:image/webp;base64,' + Buffer.alloc(n, 1).toString('base64');
(async () => {
  db.yy_users.push({ id: U, email: 'u@x', username: 'U', role: 'user' }, { id: V, email: 'v@x', role: 'user' });
  let r = await call(c.uploadImage, { user: U, body: { image: img(1000), thumb: img(100) } });
  ok(r.status === 201 && r.json.image.key.startsWith(U + '/') && r.json.image.url && r.json.image.thumb.includes('_t.webp'), 'upload ' + r.json.image?.key);
  const k1 = r.json.image.key;
  const k2 = (await call(c.uploadImage, { user: U, body: { image: img(1000), thumb: img(100) } })).json.image.key;
  r = await call(c.uploadImage, { user: U, body: { image: 'data:image/png;base64,AAAA', thumb: img(10) } }); ok(r.status === 400, 'png rejected');
  r = await call(c.uploadImage, { user: U, body: { image: img(2 * 1024 * 1024), thumb: img(10) } }); ok(r.status === 400, 'too big rejected');
  const kv = (await call(c.uploadImage, { user: V, body: { image: img(500), thumb: img(50) } })).json.image.key;

  r = await call(c.createPost, { user: U, body: { board: 'finance', visibility: 'public', title: 't', content: 'hello', images: [k1, k2] } });
  ok(r.status === 201 && r.json.post.images.length === 2 && r.json.post.images[0].thumb.endsWith('_t.webp'), 'post with 2 images');
  const pid = r.json.post.id;
  r = await call(c.createPost, { user: U, body: { board: 'finance', content: 'x', images: [kv] } }); ok(r.status === 400, "cannot use others' image");
  r = await call(c.createPost, { user: U, body: { board: 'finance', content: 'x', images: [k1, k2, k1 + 'x', 'a', 'b'] } }); ok(r.status === 400, 'more than 3 rejected');

  r = await call(c.updatePost, { user: U, params: { id: pid }, body: { visibility: 'private', anonymous: false } });
  ok(!r.json.post.edited_at, 'scope change is not an edit');
  r = await call(c.updatePost, { user: U, params: { id: pid }, body: { content: 'hello edited', images: [k2] } });
  ok(r.json.post.content === 'hello edited' && r.json.post.edited_at && r.json.post.images.length === 1, 'edit content + remove image');
  ok(!files[k1] && !files[k1.replace('.webp', '_t.webp')] && files[k2], 'removed image files deleted');
  r = await call(c.updatePost, { user: V, params: { id: pid }, body: { content: 'hack' } }); ok(r.status === 404, 'others cannot edit');

  r = await call(c.listPosts, { user: U, query: { board: 'mine' } });
  ok(r.json.posts[0].images[0].url === 'https://signed/' + k2, 'list signs urls');
  r = await call(c.deletePost, { user: U, params: { id: pid } });
  ok(!files[k2], 'delete post removes images');
  console.log(fails ? `FAILED ${fails}` : 'ALL PASS');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
