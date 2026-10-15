const supabase = require('../config/supabase');

// 匯出 / 匯入使用者的全部資料(備份與還原)
// 只處理登入者自己的資料;匯入時欄位一律白名單,不接受 user_id / id 等系統欄位。
const BACKUP_VERSION = 1;
const CHUNK = 500;

const pick = (row, keys) => Object.fromEntries(keys.filter((k) => row[k] !== undefined).map((k) => [k, row[k]]));
const isDate = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));

async function selectAll(table, userId, columns = '*') {
  const { data, error } = await supabase.from(table).select(columns).eq('user_id', userId);
  if (error) throw error;
  return data.map(({ user_id, ...rest }) => rest);
}

async function insertChunks(table, rows) {
  let count = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const part = rows.slice(i, i + CHUNK);
    if (part.length === 0) continue;
    const { error } = await supabase.from(table).insert(part);
    if (error) throw error;
    count += part.length;
  }
  return count;
}

// GET /data/export
async function exportData(req, res) {
  try {
    const uid = req.user.id;
    const [accounts, categories, transactions, events, recurring_items, budgets, moods, notes] = await Promise.all([
      selectAll('yy_accounts', uid),
      selectAll('yy_categories', uid),
      selectAll('yy_transactions', uid),
      selectAll('yy_events', uid),
      selectAll('yy_recurring_items', uid),
      selectAll('yy_budgets', uid),
      selectAll('yy_moods', uid),
      // 墨箋絮語:資料表尚未建立時不影響匯出
      selectAll('yy_notes', uid).catch(() => []),
    ]);
    return res.json({
      app: 'YY手帳',
      version: BACKUP_VERSION,
      exported_at: new Date().toISOString(),
      data: { accounts, categories, transactions, events, recurring_items, budgets, moods, notes },
    });
  } catch (err) {
    console.error('[dataController.exportData]', err);
    return res.status(500).json({ error: 'Failed to export data' });
  }
}

// POST /data/import  { mode: 'append' | 'replace', data: {...} }       — 完整備份還原
// POST /data/import  { mode: 'append', transactions: [{date,type,amount,account,category,note}] } — 只匯入記帳明細(Excel)
async function importData(req, res) {
  const uid = req.user.id;
  try {
    const { mode = 'append' } = req.body;
    const summary = {};

    // ---- 只匯入記帳明細(來自 Excel):依帳戶名稱對應,並更新帳戶餘額
    if (Array.isArray(req.body.transactions)) {
      const { data: accounts, error } = await supabase.from('yy_accounts').select('id, name, balance').eq('user_id', uid);
      if (error) throw error;
      const byName = Object.fromEntries(accounts.map((a) => [a.name, a]));
      const rows = [];
      const unknownAccounts = new Set();
      let skipped = 0;
      for (const r of req.body.transactions.slice(0, 20000)) {
        const amount = Number(r.amount);
        const type = r.type === 'income' ? 'income' : r.type === 'expense' ? 'expense' : null;
        if (!type || !(amount > 0) || !isDate(r.date)) { skipped += 1; continue; }
        const acc = r.account ? byName[String(r.account).trim()] : null;
        if (r.account && !acc) unknownAccounts.add(String(r.account).trim());
        rows.push({
          user_id: uid,
          type,
          amount,
          account_id: acc?.id || null,
          category: r.category ? String(r.category).slice(0, 50) : null,
          note: r.note ? String(r.note).slice(0, 500) : null,
          occurred_at: new Date(`${String(r.date).slice(0, 10)}T12:00:00+08:00`).toISOString(),
        });
      }
      summary.transactions = await insertChunks('yy_transactions', rows);
      // 帳戶餘額加上匯入的收支
      const delta = {};
      for (const r of rows) if (r.account_id) delta[r.account_id] = (delta[r.account_id] || 0) + (r.type === 'income' ? r.amount : -r.amount);
      for (const [id, d] of Object.entries(delta)) {
        const acc = accounts.find((a) => a.id === id);
        await supabase.from('yy_accounts').update({ balance: Number(acc.balance) + d }).eq('id', id);
      }
      summary.skipped = skipped;
      summary.unknown_accounts = [...unknownAccounts];
      return res.json({ status: 'ok', summary });
    }

    // ---- 完整備份還原
    const data = req.body.data;
    if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Invalid backup file' });

    if (mode === 'replace') {
      for (const table of ['yy_transactions', 'yy_events', 'yy_recurring_items', 'yy_categories', 'yy_budgets', 'yy_moods', 'yy_notes', 'yy_accounts']) {
        const { error } = await supabase.from(table).delete().eq('user_id', uid);
        if (error) throw error;
      }
    }

    // 帳戶:建立新帳戶,記下舊 id → 新 id(記帳、循環要用)
    const accountMap = {};
    for (const a of data.accounts || []) {
      if (!a.name) continue;
      const { data: created, error } = await supabase
        .from('yy_accounts')
        .insert({ user_id: uid, ...pick(a, ['name', 'currency', 'color']), balance: Number(a.balance) || 0 })
        .select('id')
        .single();
      if (error) throw error;
      accountMap[a.id] = created.id;
    }
    summary.accounts = Object.keys(accountMap).length;

    // 分類:名稱+類型已存在就略過
    const catRows = (data.categories || []).filter((c) => c.name).map((c) => ({ user_id: uid, ...pick(c, ['name', 'type', 'color']) }));
    if (catRows.length) {
      const { error } = await supabase.from('yy_categories').upsert(catRows, { onConflict: 'user_id,name,type', ignoreDuplicates: true });
      if (error) throw error;
    }
    summary.categories = catRows.length;

    // 記帳:帳戶餘額已包含這些紀錄,所以不再調整餘額
    summary.transactions = await insertChunks('yy_transactions', (data.transactions || [])
      .filter((t) => (t.type === 'income' || t.type === 'expense') && Number(t.amount) > 0 && isDate(t.occurred_at))
      .map((t) => ({ user_id: uid, ...pick(t, ['type', 'amount', 'category', 'note', 'occurred_at']), account_id: accountMap[t.account_id] || null })));

    summary.events = await insertChunks('yy_events', (data.events || [])
      .filter((e) => e.title && isDate(e.start_at))
      .map((e) => ({
        user_id: uid,
        ...pick(e, ['title', 'start_at', 'end_at', 'category', 'color', 'note', 'remind_before_minutes']),
        // 已經過去的行程不要再發提醒
        reminder_sent_at: new Date(e.start_at) < new Date() ? new Date().toISOString() : null,
      })));

    summary.recurring_items = await insertChunks('yy_recurring_items', (data.recurring_items || [])
      .filter((r) => r.title && r.kind && r.next_trigger_date)
      .map((r) => ({
        user_id: uid,
        ...pick(r, ['kind', 'title', 'amount', 'category', 'frequency', 'day_of_month', 'day_of_week', 'next_trigger_date', 'reminder_method', 'is_active', 'end_date']),
        account_id: accountMap[r.account_id] || null,
      })));

    const budgetRows = (data.budgets || []).filter((b) => Number(b.amount) > 0).map((b) => ({ user_id: uid, category: b.category || '', amount: Number(b.amount) }));
    if (budgetRows.length) {
      const { error } = await supabase.from('yy_budgets').upsert(budgetRows, { onConflict: 'user_id,category' });
      if (error) throw error;
    }
    summary.budgets = budgetRows.length;

    const moodRows = (data.moods || []).filter((m) => m.date && m.mood).map((m) => ({ user_id: uid, date: m.date, mood: m.mood }));
    if (moodRows.length) {
      const { error } = await supabase.from('yy_moods').upsert(moodRows, { onConflict: 'user_id,date' });
      if (error) throw error;
    }
    summary.moods = moodRows.length;

    summary.notes = await insertChunks('yy_notes', (data.notes || [])
      .filter((n) => typeof n.content === 'string' && n.content.trim())
      .map((n) => ({
        user_id: uid,
        content: n.content.trim().slice(0, 2000),
        is_done: n.is_done === true,
        done_at: n.is_done === true ? (n.done_at || new Date().toISOString()) : null,
        ...(n.created_at ? { created_at: n.created_at } : {}),
      })));

    return res.json({ status: 'ok', summary });
  } catch (err) {
    console.error('[dataController.importData]', err);
    return res.status(500).json({ error: 'Failed to import data' });
  }
}

module.exports = { exportData, importData };
