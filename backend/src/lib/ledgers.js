// 多帳本:帳本的存取權限與預設帳本
// 記帳、帳戶、預算、循環記帳都屬於某一本帳本(ledger_id)。
// 前端用 X-Ledger 標頭告訴後端目前看的是哪一本;沒帶就用預設帳本(舊版前端也能用)。
const supabase = require('../config/supabase');

const LEDGER_TABLES = ['yy_accounts', 'yy_transactions', 'yy_recurring_items', 'yy_budgets'];
const MAX_LEDGERS = 20;
const NAME_MAX = 20;
const DEFAULT_NAME = { zh: '日常', en: 'Daily' };

// 沒有帳本的舊資料(例如還原舊備份)歸到預設帳本
async function adoptOrphans(userId, ledgerId) {
  for (const table of LEDGER_TABLES) {
    let q = supabase.from(table).update({ ledger_id: ledgerId }).eq('user_id', userId).is('ledger_id', null);
    if (table === 'yy_recurring_items') q = q.in('kind', ['expense', 'income']);
    const { error } = await q;
    if (error) throw error;
  }
}

// 取得預設帳本,沒有就建立(同時把沒有帳本的資料歸進來)
async function ensureDefault(userId, lang = 'zh') {
  const { data, error } = await supabase.from('yy_ledgers').select('*').eq('user_id', userId).eq('is_default', true).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const { data: created, error: cErr } = await supabase.from('yy_ledgers')
    .insert({ user_id: userId, name: DEFAULT_NAME[lang] || DEFAULT_NAME.zh, is_default: true })
    .select('*').single();
  if (cErr) {
    if (cErr.code === '23505') return ensureDefault(userId, lang); // 同時建立:用另一個請求建好的
    throw cErr;
  }
  await adoptOrphans(userId, created.id);
  return created;
}

// 使用者對某本帳本的權限:
// owner(建立者)、member(共同帳本成員,可編輯)、left(已退出,只能查看);邀請中或被移出看不到
async function accessOf(userId, ledgerId) {
  const { data: ledger, error } = await supabase.from('yy_ledgers').select('*').eq('id', ledgerId).maybeSingle();
  if (error) throw error;
  if (!ledger) return null;
  // 失效的帳本(建立者退出且沒有其他成員):所有人都只能查看
  if (ledger.archived_at) {
    if (ledger.user_id === userId) return ledger.owner_hidden ? null : { ledger, role: 'left', canWrite: false };
    const { data: m } = await supabase.from('yy_ledger_members').select('status').eq('ledger_id', ledgerId).eq('user_id', userId).maybeSingle();
    return m && m.status !== 'invited' ? { ledger, role: 'left', canWrite: false } : null;
  }
  if (ledger.user_id === userId) return { ledger, role: 'owner', canWrite: true };
  const { data: m, error: mErr } = await supabase.from('yy_ledger_members').select('status')
    .eq('ledger_id', ledgerId).eq('user_id', userId).maybeSingle();
  if (mErr) throw mErr;
  if (m?.status === 'active') return { ledger, role: 'member', canWrite: true };
  if (m?.status === 'left') return { ledger, role: 'left', canWrite: false };
  return null;
}

// 共同帳本裡可以收到通知、算是「目前成員」的人:建立者+已加入的成員
async function activeUserIds(ledger) {
  const { data, error } = await supabase.from('yy_ledger_members').select('user_id')
    .eq('ledger_id', ledger.id).eq('status', 'active');
  if (error) throw error;
  return [ledger.user_id, ...(data || []).map((m) => m.user_id)];
}

// 刪除帳號前:自己建立的共同帳本交給最早加入的成員,避免其他人的資料跟著被刪
async function handOverShared(userId) {
  const { data: own, error } = await supabase.from('yy_ledgers').select('id').eq('user_id', userId);
  if (error) throw error;
  for (const l of own || []) {
    const { data: ms, error: mErr } = await supabase.from('yy_ledger_members').select('*').eq('ledger_id', l.id).eq('status', 'active');
    if (mErr) throw mErr;
    const heir = (ms || []).sort((a, b) => (a.joined_at || a.created_at).localeCompare(b.joined_at || b.created_at))[0];
    if (!heir) continue;
    const { error: e1 } = await supabase.from('yy_ledgers').update({ user_id: heir.user_id, is_default: false }).eq('id', l.id);
    if (e1) throw e1;
    const { error: e2 } = await supabase.from('yy_ledger_members').delete().eq('ledger_id', l.id).eq('user_id', heir.user_id);
    if (e2) throw e2;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 中介層:決定這次請求的帳本,放在 req.ledger
async function withLedger(req, res, next) {
  try {
    const wanted = req.get('x-ledger') || req.query.ledger_id || null;
    if (wanted) {
      const acc = UUID_RE.test(wanted) ? await accessOf(req.user.id, wanted) : null;
      if (!acc) return res.status(404).json({ error: '找不到這本帳本', code: 'LEDGER_NOT_FOUND' });
      req.ledger = { ...acc.ledger, role: acc.role, canWrite: acc.canWrite };
    } else {
      const lang = String(req.get('x-lang') || '').toLowerCase() === 'en' ? 'en' : 'zh';
      const ledger = await ensureDefault(req.user.id, lang);
      req.ledger = { ...ledger, role: 'owner', canWrite: true };
    }
    return next();
  } catch (err) {
    console.error('[ledgers.withLedger]', err);
    return res.status(500).json({ error: '讀取帳本失敗' });
  }
}

// 中介層:只能查看的帳本不能新增、修改、刪除
function ledgerWritable(req, res, next) {
  if (req.method === 'GET' || req.ledger?.canWrite) return next();
  return res.status(403).json({ error: '這本帳本只能查看', code: 'LEDGER_READ_ONLY' });
}

module.exports = { LEDGER_TABLES, MAX_LEDGERS, NAME_MAX, DEFAULT_NAME, ensureDefault, adoptOrphans, accessOf, activeUserIds, handOverShared, withLedger, ledgerWritable };
