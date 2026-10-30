// 月刊書櫃:每月把記帳、行程、紀念日、心情、墨箋絮語、自己發的文章整理成一本書
// 生命週期(台灣時間):每月 1 號產生上個月的草稿 → 7 號(含)以前可以換封面、寫一句話、按「完成」
// → 8 號 0 點起自動定稿;定稿時把內容存成快照(data),之後固定不變
const supabase = require('../config/supabase');
const { sendPushToUser } = require('./fcmService');

const COVERS = 3;
const MESSAGE_MAX = 60;
const EXCLUDED = ['轉帳', '餘額調整']; // 不算收支
const PAGE = 1000;

const pad = (n) => String(n).padStart(2, '0');
const taipeiNow = (now = new Date()) => new Date(now.getTime() + 8 * 3600 * 1000); // 用 UTC 欄位讀台灣時間
const isYm = (v) => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const ymOf = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return ymOf(d);
}
const monthStart = (ym) => new Date(`${ym}-01T00:00:00+08:00`);
// 定稿期限:下個月 8 號 0 點(台灣時間),也就是 7 號整天都還能改
const deadlineOf = (ym) => new Date(`${addMonths(ym, 1)}-08T00:00:00+08:00`);
const currentYm = (now = new Date()) => ymOf(taipeiNow(now));
const previousYm = (now = new Date()) => addMonths(currentYm(now), -1);
const localDate = (iso) => ymdOf(taipeiNow(new Date(iso)));
const ymdOf = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const defaultCover = (ym) => ((Number(ym.slice(5, 7)) - 1) % COVERS) + 1;

async function fetchAll(build) {
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < PAGE) return out;
  }
}

// 我看得到的帳本:自己建立的(沒隱藏)+加入過的共同帳本
async function myLedgers(uid) {
  const [{ data: own, error: e1 }, { data: mine, error: e2 }] = await Promise.all([
    supabase.from('yy_ledgers').select('id, name, user_id, archived_at').eq('user_id', uid).not('owner_hidden', 'is', true),
    supabase.from('yy_ledger_members').select('ledger_id, status').eq('user_id', uid),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const joined = (mine || []).filter((m) => m.status === 'active' || m.status === 'left').map((m) => m.ledger_id);
  const { data: others, error: e3 } = joined.length ? await supabase.from('yy_ledgers').select('id, name, user_id, archived_at').in('id', joined) : { data: [] };
  if (e3) throw e3;
  const all = [...(own || []), ...(others || [])];
  const ids = all.map((l) => l.id);
  const { data: ms, error: e4 } = ids.length ? await supabase.from('yy_ledger_members').select('ledger_id, status').in('ledger_id', ids) : { data: [] };
  if (e4) throw e4;
  return all.map((l) => ({ ...l, shared: (ms || []).some((m) => m.ledger_id === l.id && m.status !== 'invited') }));
}

async function moneyOf(uid, from, to) {
  const ledgers = await myLedgers(uid);
  const ids = ledgers.map((l) => l.id);
  const [txs, accounts, cats] = await Promise.all([
    ids.length
      ? fetchAll(() => supabase.from('yy_transactions').select('id, ledger_id, type, amount, category, account_id, occurred_at')
        .in('ledger_id', ids).gte('occurred_at', from).lt('occurred_at', to).order('occurred_at'))
      : [],
    ids.length ? fetchAll(() => supabase.from('yy_accounts').select('id, currency').in('ledger_id', ids)) : [],
    fetchAll(() => supabase.from('yy_categories').select('name, type, color').eq('user_id', uid)),
  ]);
  const cur = new Map(accounts.map((a) => [a.id, a.currency || 'TWD']));
  const color = (name) => cats.find((c) => c.type !== 'event' && c.name === name)?.color || null;
  const counted = txs.filter((t) => !EXCLUDED.includes(t.category));
  const byCur = {};
  const top = {};
  const perLedger = new Map(ledgers.map((l) => [l.id, { name: l.name, shared: l.shared, income: 0, expense: 0, count: 0 }]));
  for (const t of counted) {
    const c = cur.get(t.account_id) || 'TWD';
    const amt = Number(t.amount) || 0;
    byCur[c] ||= { currency: c, income: 0, expense: 0 };
    byCur[c][t.type === 'income' ? 'income' : 'expense'] += amt;
    if (c !== 'TWD') continue; // 支出排名與各帳本只算台幣,外幣另外列出
    if (t.type !== 'income') {
      const k = t.category || '';
      top[k] = (top[k] || 0) + amt;
    }
    const pl = perLedger.get(t.ledger_id);
    if (pl) { pl[t.type === 'income' ? 'income' : 'expense'] += amt; pl.count += 1; }
  }
  const twd = byCur.TWD || { income: 0, expense: 0 };
  return {
    currency: 'TWD',
    income: round(twd.income),
    expense: round(twd.expense),
    others: Object.values(byCur).filter((x) => x.currency !== 'TWD').map((x) => ({ ...x, income: round(x.income), expense: round(x.expense) })),
    top: Object.entries(top).map(([name, amount]) => ({ name, color: name ? color(name) : null, amount: round(amount) }))
      .sort((a, b) => b.amount - a.amount).slice(0, 5),
    ledgers: [...perLedger.values()].filter((l) => l.count > 0).map(({ count, ...l }) => ({ ...l, income: round(l.income), expense: round(l.expense) })),
    tx_count: counted.length,
  };
}
const round = (n) => Math.round(n * 100) / 100;

async function eventsOf(uid, from, to) {
  const { data: mine, error } = await supabase.from('yy_event_members').select('event_id').eq('user_id', uid).eq('status', 'active');
  if (error) throw error;
  const joined = (mine || []).map((m) => m.event_id);
  const cats = await fetchAll(() => supabase.from('yy_categories').select('name, color').eq('user_id', uid).eq('type', 'event'));
  const color = (name) => (name && cats.find((c) => c.name === name)?.color) || null;
  const rows = await fetchAll(() => supabase.from('yy_events').select('id, title, start_at, category, user_id')
    .or(joined.length ? `user_id.eq.${uid},id.in.(${joined.join(',')})` : `user_id.eq.${uid}`)
    .gte('start_at', from).lt('start_at', to).order('start_at'));
  return rows.map((e) => ({ date: localDate(e.start_at), title: e.title, color: color(e.category), shared: e.user_id !== uid || undefined }));
}

async function annivsOf(uid, ym) {
  const { data: mine, error } = await supabase.from('yy_anniversary_members').select('anniversary_id').eq('user_id', uid).eq('status', 'active');
  if (error) throw error;
  const joined = (mine || []).map((m) => m.anniversary_id);
  let q = supabase.from('yy_anniversaries').select('title, date, recurring, icon');
  q = joined.length ? q.or(`user_id.eq.${uid},id.in.(${joined.join(',')})`) : q.eq('user_id', uid);
  const { data, error: e2 } = await q;
  if (e2) throw e2;
  const [y, m] = ym.split('-').map(Number);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const out = [];
  for (const a of data || []) {
    if (!a.date) continue;
    if (a.recurring === false) {
      if (a.date.slice(0, 7) === ym) out.push({ date: a.date, title: a.title, icon: a.icon || null });
      continue;
    }
    if (Number(a.date.slice(5, 7)) !== m || a.date.slice(0, 4) > ym.slice(0, 4)) continue;
    let d = Number(a.date.slice(8, 10));
    if (m === 2 && d === 29 && !leap) d = 28;
    out.push({ date: `${ym}-${pad(d)}`, title: a.title, icon: a.icon || null });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

async function moodsOf(uid, ym) {
  const { data, error } = await supabase.from('yy_moods').select('date, mood').eq('user_id', uid)
    .gte('date', `${ym}-01`).lt('date', `${addMonths(ym, 1)}-01`);
  if (error) throw error;
  return Object.fromEntries((data || []).map((r) => [r.date, r.mood]));
}

async function notesOf(uid, from, to) {
  const rows = await fetchAll(() => supabase.from('yy_notes').select('content, created_at').eq('user_id', uid)
    .gte('created_at', from).lt('created_at', to).order('created_at'));
  return rows.map((n) => ({ date: localDate(n.created_at), content: n.content }));
}

async function postsOf(uid, from, to) {
  const rows = await fetchAll(() => supabase.from('yy_posts').select('board, mood, title, content, images, created_at').eq('user_id', uid)
    .gte('created_at', from).lt('created_at', to).order('created_at'));
  return rows.map((p) => ({
    date: localDate(p.created_at), board: p.board, mood: p.mood || null, title: p.title || null, content: p.content,
    images: Array.isArray(p.images) ? p.images.slice(0, 2) : [],
  }));
}

// 整理一個月的內容(草稿每次即時整理;定稿時存成快照)
async function buildBookData(uid, ym) {
  const from = monthStart(ym).toISOString();
  const to = monthStart(addMonths(ym, 1)).toISOString();
  const [money, events, annivs, moods, notes, posts] = await Promise.all([
    moneyOf(uid, from, to), eventsOf(uid, from, to), annivsOf(uid, ym), moodsOf(uid, ym), notesOf(uid, from, to), postsOf(uid, from, to),
  ]);
  return {
    ym, built_at: new Date().toISOString(), money, events, annivs, moods, notes, posts,
    counts: { events: events.length, annivs: annivs.length, words: notes.length + posts.length, tx: money.tx_count },
  };
}

async function finalize(row) {
  const data = await buildBookData(row.user_id, row.ym);
  const { data: saved, error } = await supabase.from('yy_monthly_books')
    .update({ status: 'final', data, cover: row.cover || defaultCover(row.ym), finalized_at: new Date().toISOString() })
    .eq('id', row.id).eq('status', 'draft').select('*').maybeSingle();
  if (error) throw error;
  return saved || row;
}

// 使用者在那個月已經註冊才有那個月的書
async function createDraft(uid, ym, userCreatedAt) {
  if (userCreatedAt && new Date(userCreatedAt) >= monthStart(addMonths(ym, 1))) return null;
  const { data, error } = await supabase.from('yy_monthly_books')
    .upsert({ user_id: uid, ym, status: 'draft' }, { onConflict: 'user_id,ym', ignoreDuplicates: true }).select('*');
  if (error) throw error;
  return data?.[0] || null;
}

// 打開書櫃時:補上上個月的草稿、把過了期限的草稿定稿
async function ensureBooks(uid, now = new Date()) {
  const { data: me, error } = await supabase.from('yy_users').select('created_at').eq('id', uid).maybeSingle();
  if (error) throw error;
  await createDraft(uid, previousYm(now), me?.created_at);
  const { data: drafts, error: dErr } = await supabase.from('yy_monthly_books').select('*').eq('user_id', uid).eq('status', 'draft');
  if (dErr) throw dErr;
  for (const d of drafts || []) {
    if (now >= deadlineOf(d.ym)) await finalize(d);
  }
}

// 每天的排程:1 號替所有人產生草稿並推播;每天把過期的草稿定稿
async function runMonthlyBooks(now = new Date()) {
  const ym = previousYm(now);
  let created = 0;
  let finalized = 0;
  const users = await fetchAll(() => supabase.from('yy_users').select('id, created_at, is_disabled').order('created_at'));
  for (const u of users) {
    if (u.is_disabled) continue;
    try {
      const row = await createDraft(u.id, ym, u.created_at);
      if (row) {
        created += 1;
        const m = Number(ym.slice(5, 7));
        sendPushToUser(u.id, { title: '📚 月刊書櫃', body: `你的 ${m} 月月刊整理好了，7 號以前可以挑封面、寫一句話`, data: { url: '/bookshelf' } }).catch(() => {});
      }
    } catch (err) {
      console.error('[monthlyBook.create]', u.id, err.message);
    }
  }
  const drafts = await fetchAll(() => supabase.from('yy_monthly_books').select('*').eq('status', 'draft'));
  for (const d of drafts) {
    if (now < deadlineOf(d.ym)) continue;
    try {
      await finalize(d);
      finalized += 1;
    } catch (err) {
      console.error('[monthlyBook.finalize]', d.id, err.message);
    }
  }
  return { created, finalized };
}

module.exports = {
  COVERS, MESSAGE_MAX, isYm, addMonths, deadlineOf, currentYm, previousYm, defaultCover,
  buildBookData, finalize, ensureBooks, runMonthlyBooks,
};
