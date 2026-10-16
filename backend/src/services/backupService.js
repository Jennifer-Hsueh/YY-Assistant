const zlib = require('zlib');
const supabase = require('../config/supabase');
const { sendEmail } = require('./emailService');

// 每週自動備份:把 YY手帳 所有資料表匯出成一個壓縮的 JSON,
// 存到 Supabase Storage 的私人 bucket「yy-backups」,保留最近 KEEP 份。
// 不備份:密碼重設 token、推播 token(都是暫時性資料,還原後也用不到)
const BUCKET = 'yy-backups';
const KEEP = 8;
const TABLES = [
  'yy_users', 'yy_accounts', 'yy_categories', 'yy_transactions', 'yy_recurring_items',
  'yy_events', 'yy_budgets', 'yy_moods', 'yy_notes', 'yy_announcements',
  'yy_posts', 'yy_post_comments', 'yy_post_reactions', 'yy_post_reports',
];
const PAGE = 1000;

async function dumpTable(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

async function ensureBucket() {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
  if (error && !/already exists/i.test(error.message)) throw error;
}

// 台灣時間的日期,例如 20261016
function stamp(d = new Date()) {
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10).replaceAll('-', '');
}

async function runBackup() {
  const started = Date.now();
  const tables = {};
  const counts = {};
  for (const t of TABLES) {
    tables[t] = await dumpTable(t);
    counts[t] = tables[t].length;
  }
  const payload = { app: 'YY手帳', kind: 'full-backup', created_at: new Date().toISOString(), counts, tables };
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(payload)));

  await ensureBucket();
  const path = `weekly/yy-backup-${stamp()}.json.gz`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, gz, { contentType: 'application/gzip', upsert: true });
  if (upErr) throw upErr;

  // 只保留最近 KEEP 份(檔名含日期,排序後刪掉最舊的)
  const { data: files, error: listErr } = await supabase.storage.from(BUCKET).list('weekly', { limit: 100 });
  if (listErr) throw listErr;
  const names = files.map((f) => f.name).filter((n) => n.startsWith('yy-backup-')).sort();
  const old = names.slice(0, Math.max(0, names.length - KEEP)).map((n) => `weekly/${n}`);
  if (old.length) {
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove(old);
    if (rmErr) console.error('[backup] prune failed', rmErr);
  }

  const result = {
    path,
    size_kb: Math.round(gz.length / 1024),
    rows: Object.values(counts).reduce((a, b) => a + b, 0),
    kept: Math.min(names.length, KEEP),
    removed: old.length,
    seconds: Math.round((Date.now() - started) / 100) / 10,
  };
  console.log('[backup] done', result);
  return { ...result, counts };
}

// 備份結果寄給開發者(BACKUP_EMAIL,沒設定時用 BUG_REPORT_EMAIL);寄信失敗不影響備份
async function notify(ok, info) {
  const to = process.env.BACKUP_EMAIL || process.env.BUG_REPORT_EMAIL;
  if (!to) return;
  const rows = ok
    ? Object.entries(info.counts).map(([t, n]) => `<tr><td>${t}</td><td style="text-align:right">${n}</td></tr>`).join('')
    : '';
  const html = ok
    ? `<div style="font-family:sans-serif"><p>每週備份完成:<b>${info.path}</b>(${info.size_kb} KB,共 ${info.rows} 筆,保留最近 ${info.kept} 份)</p><table>${rows}</table></div>`
    : `<div style="font-family:sans-serif"><p style="color:#b91c1c">每週備份失敗:${String(info).replace(/[<>&]/g, '')}</p><p>請到 Render 後端紀錄查看 [backup] 開頭的訊息。</p></div>`;
  try {
    await sendEmail({ to, subject: ok ? `[YY手帳] 每週備份完成 ${stamp()}` : `[YY手帳] 每週備份失敗 ${stamp()}`, html });
  } catch (err) {
    console.error('[backup] notify email failed', err.message);
  }
}

module.exports = { runBackup, notify, TABLES, BUCKET, KEEP };
