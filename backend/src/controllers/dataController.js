const supabase = require('../config/supabase');
const Ledgers = require('../lib/ledgers');

// 匯出 / 匯入使用者的全部資料(備份與還原)
// 只處理登入者自己的資料;匯入時欄位一律白名單,不接受 user_id / id 等系統欄位。
const BACKUP_VERSION = 2; // 2:加入帳本
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

// 備份的全部內容(JSON):記帳、行程、紀念日、心情、絮語、文章、留言、日常時光、月刊、小紙條、好友……
// 還原時只會還原帳本相關、行程、分類、預算、心情與絮語;其他內容是讓使用者自己保存
async function collectBackup(uid) {
  // 帳本:匯出自己建立的帳本與裡面所有的紀錄(共同帳本含成員記的帳)
  const ledgers = await selectAll('yy_ledgers', uid);
  const ids = ledgers.map((l) => l.id);
  const byLedger = async (table) => {
    if (!ids.length) return [];
    const { data, error } = await supabase.from(table).select('*').in('ledger_id', ids);
    if (error) throw error;
    return data.map(({ user_id, ...rest }) => rest);
  };
  const optional = (table) => selectAll(table, uid).catch(() => []); // 資料表還沒建立時不影響匯出
  const [accounts, categories, transactions, events, recurringMoney, recurringEvents, budgets, moods, notes,
    anniversaries, posts, comments, moments, books, calendars] = await Promise.all([
    byLedger('yy_accounts'),
    selectAll('yy_categories', uid),
    byLedger('yy_transactions'),
    selectAll('yy_events', uid),
    byLedger('yy_recurring_items'),
    selectAll('yy_recurring_items', uid).then((rows) => rows.filter((r) => r.kind === 'event')),
    byLedger('yy_budgets'),
    selectAll('yy_moods', uid),
    optional('yy_notes'),
    optional('yy_anniversaries'),
    optional('yy_posts'),
    optional('yy_post_comments'),
    optional('yy_moments'),
    optional('yy_monthly_books'),
    optional('yy_calendars'),
  ]);
  // 小紙條(收到與送出的)、好友名單、個人資料
  const [{ data: inSlips }, { data: outSlips }, { data: me }] = await Promise.all([
    supabase.from('yy_slips').select('sender_id, content, created_at, read_at').eq('recipient_id', uid),
    supabase.from('yy_slips').select('recipient_id, content, created_at, read_at').eq('sender_id', uid),
    supabase.from('yy_users').select('username, email, birthday_md, friend_code, created_at').eq('id', uid).maybeSingle(),
  ]);
  let friendIds = [];
  try { friendIds = await require('../lib/friends').friendIds(uid); } catch { /* ignore */ }
  const people = [...new Set([...(inSlips || []).map((r) => r.sender_id), ...(outSlips || []).map((r) => r.recipient_id), ...friendIds].filter(Boolean))];
  const names = {};
  for (let i = 0; i < people.length; i += CHUNK) {
    const { data } = await supabase.from('yy_users').select('id, username').in('id', people.slice(i, i + CHUNK));
    (data || []).forEach((u) => { names[u.id] = u.username || ''; });
  }
  const slips = [
    ...(inSlips || []).map((r) => ({ direction: 'received', with: names[r.sender_id] || null, content: r.content, created_at: r.created_at, read_at: r.read_at })),
    ...(outSlips || []).map((r) => ({ direction: 'sent', with: names[r.recipient_id] || null, content: r.content, created_at: r.created_at, read_at: r.read_at })),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return {
    app: 'YY手帳',
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    data: {
      ledgers, accounts, categories, transactions, events, recurring_items: [...recurringMoney, ...recurringEvents], budgets, moods, notes,
      profile: me || null,
      anniversaries, calendars,
      posts, comments,
      moments, monthly_books: books,
      slips,
      friends: friendIds.map((id) => names[id] || null).filter(Boolean),
    },
  };
}

// GET /data/export(JSON;Excel 匯出用)
async function exportData(req, res) {
  try {
    return res.json(await collectBackup(req.user.id));
  } catch (err) {
    console.error('[dataController.exportData]', err);
    return res.status(500).json({ error: 'Failed to export data' });
  }
}

// GET /data/backup:完整備份(ZIP)= backup.json + 日常時光與文章的照片
async function backupZip(req, res) {
  let started = false;
  try {
    const backup = await collectBackup(req.user.id);
    const { BUCKET } = require('../services/communityImages');
    const { createZip } = require('../lib/zipStream');
    const day = (iso) => new Date(new Date(iso).getTime() + 8 * 3600e3).toISOString().slice(0, 10);
    const stamp = day(new Date().toISOString()).replaceAll('-', '');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="YY-Assistant-backup-${stamp}.zip"`);
    started = true;
    const zip = createZip(res);
    zip.add('backup.json', JSON.stringify(backup, null, 2));
    zip.add('README.txt', [
      'YY手帳 完整備份',
      '',
      'backup.json：所有資料（記帳、行程、紀念日、心情、墨箋絮語、文章與留言、日常時光、月刊、小紙條、好友名單）。',
      '在 App 的「設定 → 資料匯出 / 備份 → 還原備份」選這個 ZIP 檔（或裡面的 backup.json）可以還原帳本、記帳、行程、循環、分類、預算、心情與絮語。',
      'photos/moments：日常時光的照片（日期_編號）。',
      'photos/posts：你發過的文章裡的照片（發文日期_編號）。',
    ].join('\r\n'));
    const photos = [];
    const count = {};
    const nameFor = (folder, date, key) => {
      const k = `${folder}/${date}`;
      count[k] = (count[k] || 0) + 1;
      return `photos/${folder}/${date}_${count[k]}.${key.split('.').pop()}`;
    };
    for (const m of [...(backup.data.moments || [])].sort((a, b) => `${a.date}${a.created_at}`.localeCompare(`${b.date}${b.created_at}`))) {
      if (m.image_key) photos.push([nameFor('moments', m.date, m.image_key), m.image_key]);
    }
    for (const p of [...(backup.data.posts || [])].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      for (const key of Array.isArray(p.images) ? p.images : []) photos.push([nameFor('posts', day(p.created_at), key), key]);
    }
    for (const [name, key] of photos) {
      try {
        const { data, error } = await supabase.storage.from(BUCKET).download(key);
        if (error || !data) continue;
        zip.add(name, Buffer.from(await data.arrayBuffer()));
      } catch (e) {
        console.error('[dataController.backupZip] photo failed', key, e.message);
      }
    }
    zip.finish();
    return undefined;
  } catch (err) {
    console.error('[dataController.backupZip]', err);
    if (started) return res.end();
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
      const { data: accounts, error } = await supabase.from('yy_accounts').select('id, name, balance').eq('ledger_id', req.ledger.id);
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
          ledger_id: req.ledger.id,
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
      for (const table of ['yy_transactions', 'yy_events', 'yy_recurring_items', 'yy_categories', 'yy_budgets', 'yy_moods', 'yy_notes', 'yy_accounts', 'yy_ledgers']) {
        const { error } = await supabase.from(table).delete().eq('user_id', uid);
        if (error) throw error;
      }
    }

    // 帳本:備份裡的預設帳本對應到目前的預設帳本,其他帳本另外建立
    // 舊版備份(沒有帳本)全部歸到預設帳本
    const defaultLedger = await Ledgers.ensureDefault(uid);
    const ledgerMap = {};
    for (const l of data.ledgers || []) {
      if (!l.id) continue;
      if (l.is_default) { ledgerMap[l.id] = defaultLedger.id; continue; }
      const name = String(l.name || '').trim().slice(0, Ledgers.NAME_MAX);
      if (!name) continue;
      const { data: created, error } = await supabase.from('yy_ledgers').insert({ user_id: uid, name, is_default: false }).select('id').single();
      if (error) throw error;
      ledgerMap[l.id] = created.id;
    }
    const ledgerOf = (row) => ledgerMap[row.ledger_id] || defaultLedger.id;

    // 帳戶:建立新帳戶,記下舊 id → 新 id(記帳、循環要用)
    const accountMap = {};
    for (const a of data.accounts || []) {
      if (!a.name) continue;
      const { data: created, error } = await supabase
        .from('yy_accounts')
        .insert({ user_id: uid, ledger_id: ledgerOf(a), ...pick(a, ['name', 'currency', 'color', 'bank']), balance: Number(a.balance) || 0 })
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
      .map((t) => ({ user_id: uid, ledger_id: ledgerOf(t), ...pick(t, ['type', 'amount', 'category', 'note', 'occurred_at']), account_id: accountMap[t.account_id] || null })));

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
        ledger_id: r.kind === 'event' ? null : ledgerOf(r),
      })));

    // 同一本帳本、同一個分類只留最後一筆
    const budgetByKey = new Map();
    for (const b of (data.budgets || []).filter((x) => Number(x.amount) > 0)) {
      const row = { user_id: uid, ledger_id: ledgerOf(b), category: b.category || '', amount: Number(b.amount) };
      budgetByKey.set(`${row.ledger_id}|${row.category}`, row);
    }
    const budgetRows = [...budgetByKey.values()];
    if (budgetRows.length) {
      const { error } = await supabase.from('yy_budgets').upsert(budgetRows, { onConflict: 'ledger_id,category' });
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

module.exports = { exportData, backupZip, importData };
