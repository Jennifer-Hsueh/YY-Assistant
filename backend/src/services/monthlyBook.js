// 月刊書櫃:每月把記帳、行程、紀念日、心情、墨箋絮語、自己發的文章整理成一本書
// 生命週期(台灣時間):每月 1 號產生上個月的草稿 → 7 號(含)以前可以換封面、寫一句話、按「完成」
// → 8 號 0 點起自動定稿;定稿時把內容存成快照(data),之後固定不變
// 年鑑:同一張表,ym 用 4 碼年份(例如 '2026');1/1 和 12 月月刊一起產生,1/7 以前可以改,1/8 自動定稿
const supabase = require('../config/supabase');
const { sendPushToUser } = require('./fcmService');

const COVERS = 3;
const MESSAGE_MAX = 60;
const YEAR_MESSAGE_MAX = 200; // 年鑑「給自己的話」
const EXCLUDED = ['轉帳', '餘額調整']; // 不算收支
const PAGE = 1000;

const pad = (n) => String(n).padStart(2, '0');
const taipeiNow = (now = new Date()) => new Date(now.getTime() + 8 * 3600 * 1000); // 用 UTC 欄位讀台灣時間
const isYm = (v) => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const isYear = (v) => typeof v === 'string' && /^\d{4}$/.test(v);
const isKey = (v) => isYm(v) || isYear(v); // 月刊 '2026-11' 或年鑑 '2026'
// 書櫃排序:年鑑放在那一年 12 月月刊後面
const sortKey = (k) => (isYear(k) ? `${k}-13` : k);
const messageMax = (k) => (isYear(k) ? YEAR_MESSAGE_MAX : MESSAGE_MAX);
const ymOf = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return ymOf(d);
}
const monthStart = (ym) => new Date(`${ym}-01T00:00:00+08:00`);
// 這本書涵蓋到哪個月之前(月刊:下個月;年鑑:隔年 1 月)
const endYm = (k) => (isYear(k) ? `${Number(k) + 1}-01` : addMonths(k, 1));
// 定稿期限:下個月 8 號 0 點(台灣時間),也就是 7 號整天都還能改(年鑑:隔年 1/8)
const deadlineOf = (k) => new Date(`${endYm(k)}-08T00:00:00+08:00`);
const currentYm = (now = new Date()) => ymOf(taipeiNow(now));
const previousYm = (now = new Date()) => addMonths(currentYm(now), -1);
const localDate = (iso) => ymdOf(taipeiNow(new Date(iso)));
const ymdOf = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const defaultCover = (k) => (isYear(k) ? 1 : ((Number(k.slice(5, 7)) - 1) % COVERS) + 1);

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

async function moneyOf(uid, from, to, full = false) {
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
  const months = Array.from({ length: 12 }, (_, i) => ({ m: i + 1, income: 0, expense: 0 })); // 年鑑:每月台幣收支
  for (const t of counted) {
    const c = cur.get(t.account_id) || 'TWD';
    const amt = Number(t.amount) || 0;
    byCur[c] ||= { currency: c, income: 0, expense: 0 };
    byCur[c][t.type === 'income' ? 'income' : 'expense'] += amt;
    if (c !== 'TWD') continue; // 支出排名與各帳本只算台幣,外幣另外列出
    const mo = months[Number(localDate(t.occurred_at).slice(5, 7)) - 1];
    if (mo) mo[t.type === 'income' ? 'income' : 'expense'] += amt;
    if (t.type !== 'income') {
      const k = t.category || '';
      top[k] = (top[k] || 0) + amt;
    }
    const pl = perLedger.get(t.ledger_id);
    if (pl) { pl[t.type === 'income' ? 'income' : 'expense'] += amt; pl.count += 1; }
  }
  const twd = byCur.TWD || { income: 0, expense: 0 };
  const catList = Object.entries(top).map(([name, amount]) => ({ name, color: name ? color(name) : null, amount: round(amount) })).sort((a, b) => b.amount - a.amount);
  if (full) {
    return {
      currency: 'TWD', income: round(twd.income), expense: round(twd.expense),
      others: Object.values(byCur).filter((x) => x.currency !== 'TWD').map((x) => ({ ...x, income: round(x.income), expense: round(x.expense) })),
      cats: catList, months: months.map((x) => ({ ...x, income: round(x.income), expense: round(x.expense) })), tx_count: counted.length,
    };
  }
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
  const calIds = await require('../lib/calendars').myCalendarIds(uid);
  const ors = [`user_id.eq.${uid}`];
  if (joined.length) ors.push(`id.in.(${joined.join(',')})`);
  if (calIds.length) ors.push(`calendar_id.in.(${calIds.join(',')})`);
  const cats = await fetchAll(() => supabase.from('yy_categories').select('name, color').eq('user_id', uid).eq('type', 'event'));
  const color = (name) => (name && cats.find((c) => c.name === name)?.color) || null;
  const rows = (await fetchAll(() => supabase.from('yy_events').select('id, title, start_at, category, user_id, calendar_id')
    .or(ors.join(','))
    .gte('start_at', from).lt('start_at', to).order('start_at'))).filter((e) => !e.calendar_id || calIds.includes(e.calendar_id));
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

// 日常時光:每天挑一張(依日期固定挑,草稿重新整理也不會換)
async function photosOf(uid, ym) {
  const { data, error } = await supabase.from('yy_moments').select('id, date, image_key').eq('user_id', uid)
    .gte('date', `${ym}-01`).lt('date', `${addMonths(ym, 1)}-01`).order('id');
  if (error) { console.error('[monthlyBook.photosOf]', error.message); return {}; }
  const byDay = {};
  for (const r of data || []) (byDay[r.date] ||= []).push(r.image_key);
  const out = {};
  for (const [date, keys] of Object.entries(byDay)) {
    const seed = [...date].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7);
    out[date] = keys[Math.abs(seed) % keys.length];
  }
  return out;
}

// 整理一個月的內容(草稿每次即時整理;定稿時存成快照)
async function buildBookData(uid, ym) {
  const from = monthStart(ym).toISOString();
  const to = monthStart(addMonths(ym, 1)).toISOString();
  const [money, events, annivs, moods, notes, posts, photos] = await Promise.all([
    moneyOf(uid, from, to), eventsOf(uid, from, to), annivsOf(uid, ym), moodsOf(uid, ym), notesOf(uid, from, to), postsOf(uid, from, to), photosOf(uid, ym),
  ]);
  return {
    ym, built_at: new Date().toISOString(), money, events, annivs, moods, notes, posts, photos,
    counts: { events: events.length, annivs: annivs.length, words: notes.length + posts.length, tx: money.tx_count },
  };
}

// ---------- 年鑑 ----------
// 心情折線圖的高度(1 最低 ~ 5 最高)
const MOOD_LEVEL = { sunny: 5, rainbow: 5, love: 5, flower: 4, cloudy: 3, exclaim: 3, question: 3, rainy: 2, storm: 1, angry: 1 };

async function buildYearData(uid, year, createdAt) {
  const from = monthStart(`${year}-01`).toISOString();
  const to = monthStart(`${Number(year) + 1}-01`).toISOString();
  // 年中才開始用:從註冊的月份算起
  const joined = createdAt ? ymOf(taipeiNow(new Date(createdAt))) : `${year}-01`;
  const since = joined > `${year}-01` && joined.startsWith(year) ? joined : `${year}-01`;
  const yms = Array.from({ length: 12 }, (_, i) => `${year}-${pad(i + 1)}`);
  const [money, events, moodRows, posts, momentRows, books, annivLists] = await Promise.all([
    moneyOf(uid, from, to, true),
    eventsOf(uid, from, to),
    supabase.from('yy_moods').select('date, mood').eq('user_id', uid).gte('date', `${year}-01-01`).lt('date', `${Number(year) + 1}-01-01`),
    fetchAll(() => supabase.from('yy_posts').select('board, mood, title, content, created_at').eq('user_id', uid)
      .gte('created_at', from).lt('created_at', to).order('created_at')),
    supabase.from('yy_moments').select('id, date, image_key').eq('user_id', uid).gte('date', `${year}-01-01`).lt('date', `${Number(year) + 1}-01-01`).order('id'),
    supabase.from('yy_monthly_books').select('ym, message').eq('user_id', uid).like('ym', `${year}-%`),
    Promise.all(yms.map((ym) => annivsOf(uid, ym))),
  ]);
  if (moodRows.error) throw moodRows.error;
  if (books.error) throw books.error;
  const moods = Object.fromEntries((moodRows.data || []).map((r) => [r.date, r.mood]));
  // 日常時光:每個月挑一張(依月份固定挑)
  const photos = {};
  if (momentRows.error) console.error('[monthlyBook.year photos]', momentRows.error.message);
  const byMonth = {};
  for (const r of momentRows.data || []) (byMonth[r.date.slice(0, 7)] ||= []).push(r.image_key);
  for (const [ym, keys] of Object.entries(byMonth)) {
    const seed = [...ym].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7);
    photos[ym] = keys[Math.abs(seed) % keys.length];
  }
  const eventsByMonth = Array(12).fill(0);
  for (const e of events) eventsByMonth[Number(e.date.slice(5, 7)) - 1] += 1;
  const messages = (books.data || []).filter((b) => b.message && isYm(b.ym)).map((b) => ({ ym: b.ym, message: b.message })).sort((a, b) => a.ym.localeCompare(b.ym));
  const postList = posts.map((p) => ({ date: localDate(p.created_at), board: p.board, mood: p.mood || null, title: p.title || null, content: p.content, images: [] }));
  return {
    ym: year, kind: 'year', since, built_at: new Date().toISOString(),
    money, moods, photos, messages, annivs: annivLists.flat(), events_by_month: eventsByMonth, posts: postList,
    counts: { events: events.length, annivs: annivLists.flat().length, posts: postList.length, tx: money.tx_count, moods: Object.keys(moods).length },
  };
}

async function buildFor(row) {
  if (!isYear(row.ym)) return buildBookData(row.user_id, row.ym);
  const { data: me } = await supabase.from('yy_users').select('created_at').eq('id', row.user_id).maybeSingle();
  return buildYearData(row.user_id, row.ym, me?.created_at);
}

async function finalize(row) {
  const data = await buildFor(row);
  const { data: saved, error } = await supabase.from('yy_monthly_books')
    .update({ status: 'final', data, cover: row.cover || defaultCover(row.ym), finalized_at: new Date().toISOString() })
    .eq('id', row.id).eq('status', 'draft').select('*').maybeSingle();
  if (error) throw error;
  return saved || row;
}

// 使用者在那個月已經註冊才有那個月的書
async function createDraft(uid, ym, userCreatedAt) {
  if (userCreatedAt && new Date(userCreatedAt) >= monthStart(endYm(ym))) return null;
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
  // 年鑑:進入新的一年後補上去年的(1/1 排程沒跑到時)
  // (年鑑失敗不影響月刊書櫃,例如 SQL 還沒跑)
  try {
    await createDraft(uid, String(Number(currentYm(now).slice(0, 4)) - 1), me?.created_at);
    // 測試站預覽:Render 環境變數 YEARBOOK_PREVIEW=1 時,先產生今年的年鑑草稿(正式站不要設)
    if (process.env.YEARBOOK_PREVIEW === '1') await createDraft(uid, currentYm(now).slice(0, 4), me?.created_at);
  } catch (err) {
    console.error('[monthlyBook.yearbook] 年鑑草稿建立失敗(是否已執行年鑑的 SQL?)', err.message);
  }
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
  const pushes = []; // 推播結果:統計在排程回應裡,方便從 cron-job.org 查
  const users = await fetchAll(() => supabase.from('yy_users').select('id, created_at, is_disabled').order('created_at'));
  for (const u of users) {
    if (u.is_disabled) continue;
    try {
      const row = await createDraft(u.id, ym, u.created_at);
      // 1/1:去年的年鑑和 12 月月刊一起產生
      const yearRow = ym.endsWith('-12') ? await createDraft(u.id, ym.slice(0, 4), u.created_at) : null;
      if (row || yearRow) {
        created += (row ? 1 : 0) + (yearRow ? 1 : 0);
        const m = Number(ym.slice(5, 7));
        const body = yearRow
          ? `你的${row ? ` ${m} 月月刊和` : ''} ${ym.slice(0, 4)} 年鑑整理好了，7 號以前可以挑封面、寫給自己的話`
          : `你的 ${m} 月月刊整理好了，7 號以前可以挑封面、寫一句話`;
        pushes.push(sendPushToUser(u.id, { title: '📚 月刊書櫃', body, data: { url: '/bookshelf' } })
          .catch((err) => ({ sent: false, reason: err.message })));
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
  const results = await Promise.all(pushes);
  const push = {
    sent: results.filter((r) => r?.sent && r.successCount > 0).length,
    no_device: results.filter((r) => r?.reason === 'user has no registered devices').length,
    failed: results.filter((r) => r && !(r.sent && r.successCount > 0) && r.reason !== 'user has no registered devices').length,
  };
  if (created) console.log(`[monthlyBook] ${ym}: created ${created}, push`, push);
  return { created, finalized, push };
}

module.exports = {
  COVERS, MESSAGE_MAX, YEAR_MESSAGE_MAX, MOOD_LEVEL, isYm, isYear, isKey, sortKey, messageMax, addMonths, deadlineOf, currentYm, previousYm, defaultCover,
  buildBookData, buildYearData, buildFor, finalize, ensureBooks, runMonthlyBooks,
};
