// 後台「清空這位使用者的資料」:保留帳號、方案、繳費、好友與公告,清掉他自己記錄的內容
// 共用的東西不動:有其他成員的帳本、共用行事曆的行程、有邀請成員的行程與紀念日都保留
const supabase = require('../config/supabase');
const { removeUserFolder } = require('../services/communityImages');
const { ensureDefault } = require('./ledgers');
const { CATEGORIES, ACCOUNTS } = require('./defaultData');

async function rows(q) { const { data, error } = await q; if (error) throw error; return data || []; }
async function del(table, build, counts) {
  const { data, error } = await build(supabase.from(table).delete()).select('*');
  if (error) throw error;
  counts[table] = (counts[table] || 0) + (data || []).length;
}
const chunks = (arr, n = 200) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

async function clearUserData(userId, lang = 'zh') {
  const counts = {};

  // 1. 帳本:沒有其他成員的才刪(帳戶、記帳、循環記帳、預算跟著刪除)
  const own = await rows(supabase.from('yy_ledgers').select('id').eq('user_id', userId));
  const ownIds = own.map((l) => l.id);
  const sharedIds = new Set();
  for (const c of chunks(ownIds)) {
    for (const m of await rows(supabase.from('yy_ledger_members').select('ledger_id').in('ledger_id', c).eq('status', 'active'))) sharedIds.add(m.ledger_id);
  }
  const privIds = ownIds.filter((id) => !sharedIds.has(id));
  for (const c of chunks(privIds)) {
    for (const t of ['yy_transactions', 'yy_recurring_items', 'yy_budgets', 'yy_accounts']) await del(t, (q) => q.in('ledger_id', c), counts);
    const { error } = await supabase.from('yy_ledgers').delete().in('id', c);
    if (error) throw error;
  }
  counts.yy_ledgers = privIds.length;

  // 2. 分類、循環行程
  await del('yy_categories', (q) => q.eq('user_id', userId), counts);
  await del('yy_recurring_items', (q) => q.eq('user_id', userId).eq('kind', 'event'), counts);

  // 3. 行程:自己的、不在共用行事曆、沒有邀請別人的
  const evs = await rows(supabase.from('yy_events').select('id, calendar_id').eq('user_id', userId));
  const candidates = evs.filter((e) => !e.calendar_id).map((e) => e.id);
  const withMembers = new Set();
  for (const c of chunks(candidates)) for (const m of await rows(supabase.from('yy_event_members').select('event_id').in('event_id', c))) withMembers.add(m.event_id);
  const evIds = candidates.filter((id) => !withMembers.has(id));
  for (const c of chunks(evIds)) await del('yy_events', (q) => q.in('id', c), counts);

  // 4. 紀念日:自己的、沒有邀請別人的
  const anns = await rows(supabase.from('yy_anniversaries').select('id').eq('user_id', userId));
  const annShared = new Set();
  for (const c of chunks(anns.map((a) => a.id))) for (const m of await rows(supabase.from('yy_anniversary_members').select('anniversary_id').in('anniversary_id', c))) annShared.add(m.anniversary_id);
  const annIds = anns.map((a) => a.id).filter((id) => !annShared.has(id));
  for (const c of chunks(annIds)) await del('yy_anniversaries', (q) => q.in('id', c), counts);

  // 5. 社群:自己的文章(連同別人在上面的回應、留言、檢舉),以及自己在別人文章的回應與留言
  const posts = await rows(supabase.from('yy_posts').select('id').eq('user_id', userId));
  for (const c of chunks(posts.map((p) => p.id))) {
    for (const t of ['yy_post_reactions', 'yy_post_comments', 'yy_post_reports']) await del(t, (q) => q.in('post_id', c), counts);
  }
  await del('yy_post_reactions', (q) => q.eq('user_id', userId), counts);
  await del('yy_post_comments', (q) => q.eq('user_id', userId), counts);
  await del('yy_posts', (q) => q.eq('user_id', userId), counts);

  // 6. 心情、墨箋絮語、日常時光、月刊
  for (const t of ['yy_moods', 'yy_notes', 'yy_moments', 'yy_monthly_books']) await del(t, (q) => q.eq('user_id', userId), counts);

  // 7. 照片檔(文章與日常時光)
  await removeUserFolder(userId);

  // 8. 放回預設分類;預設帳本是新的才放預設帳戶(共用中的預設帳本不動)
  const L = lang === 'en' ? 'en' : 'zh';
  const hadDefault = (await rows(supabase.from('yy_ledgers').select('id').eq('user_id', userId).eq('is_default', true))).length > 0;
  const ledger = await ensureDefault(userId, L);
  const base = Date.now();
  const stamp = (i) => new Date(base + i).toISOString();
  const { error: cErr } = await supabase.from('yy_categories').insert(CATEGORIES[L].map(([name, type, color], i) => ({ user_id: userId, name, type, color, created_at: stamp(i) })));
  if (cErr) throw cErr;
  if (!hadDefault) {
    const { error: aErr } = await supabase.from('yy_accounts').insert(ACCOUNTS[L].map(([name, color], i) => ({ user_id: userId, ledger_id: ledger.id, name, color, balance: 0, currency: 'TWD', created_at: stamp(i) })));
    if (aErr) throw aErr;
  }
  return { counts, kept_shared_ledgers: sharedIds.size };
}

module.exports = { clearUserData };
