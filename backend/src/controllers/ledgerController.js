const supabase = require('../config/supabase');
const L = require('../lib/ledgers');

function fail(res, where, err, msg) {
  console.error(`[ledgerController.${where}]`, err);
  return res.status(500).json({ error: msg });
}
const langOf = (req) => (String(req.get('x-lang') || '').toLowerCase() === 'en' ? 'en' : 'zh');
const cleanName = (v) => String(v || '').trim().slice(0, L.NAME_MAX);

async function listLedgers(req, res) {
  try {
    await L.ensureDefault(req.user.id, langOf(req));
    const { data, error } = await supabase.from('yy_ledgers').select('*').eq('user_id', req.user.id).order('created_at', { ascending: true });
    if (error) throw error;
    // 預設帳本排第一
    const ledgers = (data || []).sort((a, b) => (b.is_default - a.is_default))
      .map((l) => ({ id: l.id, name: l.name, is_default: l.is_default, role: 'owner', can_write: true, created_at: l.created_at }));
    return res.json({ ledgers });
  } catch (err) {
    return fail(res, 'listLedgers', err, '讀取帳本失敗');
  }
}

async function createLedger(req, res) {
  try {
    const name = cleanName(req.body?.name);
    if (!name) return res.status(400).json({ error: '請輸入帳本名稱' });
    await L.ensureDefault(req.user.id, langOf(req));
    const { count, error: cErr } = await supabase.from('yy_ledgers').select('id', { count: 'exact', head: true }).eq('user_id', req.user.id);
    if (cErr) throw cErr;
    if (count >= L.MAX_LEDGERS) return res.status(400).json({ error: `帳本最多 ${L.MAX_LEDGERS} 本` });
    const { data, error } = await supabase.from('yy_ledgers').insert({ user_id: req.user.id, name, is_default: false }).select('*').single();
    if (error) throw error;
    return res.status(201).json({ ledger: { id: data.id, name: data.name, is_default: false, role: 'owner', can_write: true, created_at: data.created_at } });
  } catch (err) {
    return fail(res, 'createLedger', err, '新增帳本失敗');
  }
}

async function ownLedger(req, res) {
  const acc = await L.accessOf(req.user.id, req.params.id);
  if (!acc || acc.role !== 'owner') {
    res.status(404).json({ error: '找不到這本帳本', code: 'LEDGER_NOT_FOUND' });
    return null;
  }
  return acc.ledger;
}

async function renameLedger(req, res) {
  try {
    const name = cleanName(req.body?.name);
    if (!name) return res.status(400).json({ error: '請輸入帳本名稱' });
    const ledger = await ownLedger(req, res);
    if (!ledger) return undefined;
    const { data, error } = await supabase.from('yy_ledgers').update({ name }).eq('id', ledger.id).select('*').single();
    if (error) throw error;
    return res.json({ ledger: { id: data.id, name: data.name, is_default: data.is_default, role: 'owner', can_write: true, created_at: data.created_at } });
  } catch (err) {
    return fail(res, 'renameLedger', err, '修改帳本失敗');
  }
}

// 刪除帳本:連同帳本裡的記帳、帳戶、預算、循環記帳一起刪除;最後一本不能刪
async function deleteLedger(req, res) {
  try {
    const ledger = await ownLedger(req, res);
    if (!ledger) return undefined;
    const { data: mine, error: mErr } = await supabase.from('yy_ledgers').select('id, created_at').eq('user_id', req.user.id).order('created_at', { ascending: true });
    if (mErr) throw mErr;
    if ((mine || []).length <= 1) return res.status(400).json({ error: '至少要保留一本帳本' });
    for (const table of ['yy_transactions', 'yy_recurring_items', 'yy_budgets', 'yy_accounts']) {
      const { error } = await supabase.from(table).delete().eq('ledger_id', ledger.id);
      if (error) throw error;
    }
    const { error } = await supabase.from('yy_ledgers').delete().eq('id', ledger.id);
    if (error) throw error;
    // 刪掉的是預設帳本:最早建立的那本變成預設
    if (ledger.is_default) {
      const next = mine.find((l) => l.id !== ledger.id);
      const { error: dErr } = await supabase.from('yy_ledgers').update({ is_default: true }).eq('id', next.id);
      if (dErr) throw dErr;
    }
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'deleteLedger', err, '刪除帳本失敗');
  }
}

module.exports = { listLedgers, createLedger, renameLedger, deleteLedger };
