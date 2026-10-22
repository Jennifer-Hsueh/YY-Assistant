/* eslint-disable no-console */
// 把 YY手帳 從共用的 Supabase 專案搬到新的專屬專案。
//
// 用法(在 Codespaces 的 backend 資料夾):
//   1. 輸入金鑰(畫面不會顯示,也不會留在指令紀錄):
//        read -s -p "舊專案 service_role key: " OLD_SUPABASE_KEY; echo; export OLD_SUPABASE_KEY
//        read -s -p "新專案 service_role key: " NEW_SUPABASE_KEY; echo; export NEW_SUPABASE_KEY
//      網址不是機密,可以直接 export:
//        export OLD_SUPABASE_URL=https://舊專案.supabase.co
//        export NEW_SUPABASE_URL=https://新專案.supabase.co
//   2. node scripts/migrate-project.js check   → 只比對兩邊的筆數,不寫入
//   3. node scripts/migrate-project.js run     → 複製所有 yy_ 資料表與照片、備份檔
//   4. node scripts/migrate-project.js check   → 再比對一次,兩邊筆數應該一樣
//
// 只讀舊專案,不會改動或刪除舊專案的任何資料。新專案要先執行過建表 SQL。

const { createClient } = require('@supabase/supabase-js');

// 寫入順序:被參照的表在前
const TABLES = [
  'yy_users', 'yy_accounts', 'yy_categories', 'yy_transactions', 'yy_recurring_items',
  'yy_events', 'yy_budgets', 'yy_moods', 'yy_notes', 'yy_announcements',
  'yy_posts', 'yy_post_comments', 'yy_post_reactions', 'yy_post_reports',
  'yy_payments', 'yy_plan_notices', 'yy_bug_reports', 'yy_moderation_actions', 'yy_settings', 'yy_push_subscriptions',
];
const BUCKETS = ['yy-community', 'yy-backups'];
const PAGE = 1000;
const CHUNK = 500;

function client(urlVar, keyVar) {
  const url = process.env[urlVar];
  const key = process.env[keyVar];
  if (!url || !key) {
    console.error(`缺少 ${urlVar} 或 ${keyVar},請先依檔案開頭的說明設定。`);
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function dump(db, table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select('*').range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

async function count(db, table) {
  const { count: n, error } = await db.from(table).select('*', { count: 'exact', head: true });
  return error ? `錯誤:${error.message}` : n;
}

async function listAll(db, bucket, prefix = '') {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 100, offset });
    if (error) {
      if (/not found/i.test(error.message)) return out;
      throw new Error(`${bucket}/${prefix}: ${error.message}`);
    }
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) out.push(...(await listAll(db, bucket, path))); // 資料夾
      else out.push(path);
    }
    if (data.length < 100) return out;
  }
}

async function check(oldDb, newDb) {
  console.log('資料表            舊專案   新專案');
  let same = true;
  for (const t of TABLES) {
    const [a, b] = await Promise.all([count(oldDb, t), count(newDb, t)]);
    if (a !== b) same = false;
    console.log(`${t.padEnd(22)} ${String(a).padStart(6)}   ${String(b).padStart(6)}${a === b ? '' : '  ← 不同'}`);
  }
  for (const bucket of BUCKETS) {
    const [a, b] = await Promise.all([listAll(oldDb, bucket), listAll(newDb, bucket).catch(() => [])]);
    if (a.length !== b.length) same = false;
    console.log(`${('檔案 ' + bucket).padEnd(20)} ${String(a.length).padStart(6)}   ${String(b.length).padStart(6)}${a.length === b.length ? '' : '  ← 不同'}`);
  }
  console.log(same ? '\n兩邊一致。' : '\n兩邊不一致(搬移前是正常的)。');
}

async function run(oldDb, newDb, force) {
  // 新專案已經有資料就停下來,避免重複搬移
  if (!force) {
    for (const t of TABLES) {
      const n = await count(newDb, t);
      if (typeof n === 'string') throw new Error(`新專案的 ${t} 有問題(${n}),請確認建表 SQL 已執行`);
      if (n > 0) throw new Error(`新專案的 ${t} 已經有 ${n} 筆資料。若確定要覆蓋,請加上 --force`);
    }
  } else {
    console.log('--force:先清空新專案的資料表');
    for (const t of [...TABLES].reverse()) {
      const col = t === 'yy_moods' ? 'user_id' : t === 'yy_post_reactions' ? 'post_id' : 'id';
      const { error } = await newDb.from(t).delete().not(col, 'is', null);
      if (error) throw new Error(`清空 ${t}: ${error.message}`);
    }
  }

  for (const t of TABLES) {
    const rows = await dump(oldDb, t);
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await newDb.from(t).insert(rows.slice(i, i + CHUNK));
      if (error) throw new Error(`${t}: ${error.message}`);
    }
    console.log(`✓ ${t}:${rows.length} 筆`);
  }

  for (const bucket of BUCKETS) {
    const { data: exists } = await newDb.storage.getBucket(bucket);
    if (!exists) {
      const { error } = await newDb.storage.createBucket(bucket, { public: false });
      if (error && !/already exists/i.test(error.message)) throw new Error(`建立 ${bucket}: ${error.message}`);
    }
    const files = await listAll(oldDb, bucket);
    let copied = 0;
    for (const path of files) {
      const { data, error } = await oldDb.storage.from(bucket).download(path);
      if (error) throw new Error(`下載 ${bucket}/${path}: ${error.message}`);
      const buf = Buffer.from(await data.arrayBuffer());
      const { error: upErr } = await newDb.storage.from(bucket).upload(path, buf, { contentType: data.type || 'application/octet-stream', upsert: true });
      if (upErr) throw new Error(`上傳 ${bucket}/${path}: ${upErr.message}`);
      copied += 1;
    }
    console.log(`✓ 檔案 ${bucket}:${copied} 個`);
  }
  console.log('\n搬移完成。請再執行一次 check 確認筆數。');
}

(async () => {
  const mode = process.argv[2];
  const oldDb = client('OLD_SUPABASE_URL', 'OLD_SUPABASE_KEY');
  const newDb = client('NEW_SUPABASE_URL', 'NEW_SUPABASE_KEY');
  if (process.env.OLD_SUPABASE_URL === process.env.NEW_SUPABASE_URL) {
    console.error('新舊專案網址相同,請確認設定。');
    process.exit(1);
  }
  if (mode === 'check') await check(oldDb, newDb);
  else if (mode === 'run') await run(oldDb, newDb, process.argv.includes('--force'));
  else console.log('用法:node scripts/migrate-project.js check | run [--force]');
})().catch((err) => {
  console.error('\n✗ 失敗:', err.message);
  process.exit(1);
});
