// Supabase 用量:資料庫大小與檔案(Storage)大小,和免費方案上限比較,超過 70% 提醒、90% 警告
// 數字來自資料庫函式 yy_usage()(SQL 見 supabase_schema.sql);流量(egress)查不到,要到 Supabase 後台看
// 上限可用環境變數調整(升級 Pro 後改大):SUPABASE_DB_LIMIT_MB(預設 500)、SUPABASE_STORAGE_LIMIT_MB(預設 1024)
const supabase = require('../config/supabase');

const MB = 1024 * 1024;
const WARN = 70;
const DANGER = 90;
const limitMb = (name, def) => Number(process.env[name]) > 0 ? Number(process.env[name]) : def;
const levelOf = (pct) => (pct >= DANGER ? 'danger' : pct >= WARN ? 'warn' : 'ok');
const item = (bytes, limit) => {
  const pct = Math.round((bytes / limit) * 1000) / 10;
  return { bytes, limit, pct, level: levelOf(pct) };
};

async function getUsage() {
  const { data, error } = await supabase.rpc('yy_usage');
  if (error) {
    // 函式還沒建立(SQL 沒跑):回傳 missing,後台顯示提示,不影響其他資料
    console.error('[usage] yy_usage 讀取失敗(是否已執行用量的 SQL?)', error.message);
    return { missing: true };
  }
  const buckets = data?.buckets || {};
  const storageBytes = Object.values(buckets).reduce((s, b) => s + Number(b.bytes || 0), 0);
  const db = item(Number(data?.db_bytes || 0), limitMb('SUPABASE_DB_LIMIT_MB', 500) * MB);
  const storage = item(storageBytes, limitMb('SUPABASE_STORAGE_LIMIT_MB', 1024) * MB);
  const worst = [db, storage].reduce((a, b) => (b.pct > a.pct ? b : a));
  return {
    db, storage, level: worst.level, warn: WARN, danger: DANGER,
    buckets: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, { bytes: Number(v.bytes || 0), files: Number(v.files || 0) }])),
  };
}

const fmtMb = (bytes) => `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`;

module.exports = { getUsage, fmtMb, WARN, DANGER, levelOf, item };
