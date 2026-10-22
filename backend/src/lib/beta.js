const supabase = require('../config/supabase');

// 測試版設定:yy_settings 的 beta = { active, limit, open, ends_at }
// - active:是否仍在測試期間(關掉 = 正式上線,不再顯示測試版標籤、不限名額)
// - limit / open:測試名額上限、是否開放註冊(人數不含管理員)
// - ends_at:測試結束日(YYYY-MM-DD;空白 = 尚未決定)
const DEFAULT = { active: true, limit: 50, open: true, ends_at: null };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
let cache = null;
let cachedAt = 0;

function normalize(v = {}) {
  return {
    active: v.active !== undefined ? !!v.active : DEFAULT.active,
    limit: Number.isInteger(v.limit) && v.limit > 0 ? v.limit : DEFAULT.limit,
    open: v.open !== undefined ? !!v.open : DEFAULT.open,
    ends_at: typeof v.ends_at === 'string' && DATE_RE.test(v.ends_at) ? v.ends_at : null,
  };
}

async function getBeta() {
  if (cache && Date.now() - cachedAt < 30 * 1000) return cache;
  const { data, error } = await supabase.from('yy_settings').select('value').eq('key', 'beta').maybeSingle();
  if (error) console.error('[beta.getBeta]', error);
  cache = normalize(data?.value);
  cachedAt = Date.now();
  return cache;
}

// 同步讀取(用在權限計算;還沒讀過時視為測試中)
const betaActiveNow = () => (cache ? cache.active : true);

// 測試期間:每位使用者都可以匯出備份自己的資料
function withBeta(ent) {
  if (!ent || !betaActiveNow() || ent.features.includes('export')) return ent;
  return { ...ent, features: [...ent.features, 'export'] };
}

async function countMembers() {
  const { count, error } = await supabase.from('yy_users').select('id', { count: 'exact', head: true }).neq('role', 'admin');
  if (error) throw error;
  return count || 0;
}

async function betaStatus() {
  const [beta, used] = await Promise.all([getBeta(), countMembers()]);
  const remaining = Math.max(0, beta.limit - used);
  return { ...beta, used, remaining, full: beta.active && (!beta.open || remaining === 0) };
}

async function setBeta(updates) {
  const cur = await getBeta();
  const value = normalize({ ...cur, ...updates });
  const { error } = await supabase.from('yy_settings').upsert({ key: 'beta', value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
  cache = null;
  return { before: cur, status: await betaStatus() };
}

getBeta().catch(() => {});

module.exports = { betaStatus, setBeta, getBeta, withBeta, betaActiveNow, DATE_RE };
