const supabase = require('../config/supabase');

// 測試版名額:yy_settings 的 beta = { limit, open }
// 計算人數時不含管理員(一般使用者 + 測試員)
const DEFAULT = { limit: 50, open: true };
let cache = null;
let cachedAt = 0;

async function getBeta() {
  if (cache && Date.now() - cachedAt < 30 * 1000) return cache;
  const { data, error } = await supabase.from('yy_settings').select('value').eq('key', 'beta').maybeSingle();
  if (error) console.error('[beta.getBeta]', error);
  const v = data?.value || {};
  cache = {
    limit: Number.isInteger(v.limit) && v.limit > 0 ? v.limit : DEFAULT.limit,
    open: v.open !== undefined ? !!v.open : DEFAULT.open,
  };
  cachedAt = Date.now();
  return cache;
}

async function countMembers() {
  const { count, error } = await supabase.from('yy_users').select('id', { count: 'exact', head: true }).neq('role', 'admin');
  if (error) throw error;
  return count || 0;
}

async function betaStatus() {
  const [beta, used] = await Promise.all([getBeta(), countMembers()]);
  const remaining = Math.max(0, beta.limit - used);
  return { ...beta, used, remaining, full: !beta.open || remaining === 0 };
}

async function setBeta({ limit, open }) {
  const cur = await getBeta();
  const value = {
    limit: limit !== undefined ? limit : cur.limit,
    open: open !== undefined ? !!open : cur.open,
  };
  const { error } = await supabase.from('yy_settings').upsert({ key: 'beta', value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
  cache = null;
  return betaStatus();
}

module.exports = { betaStatus, setBeta };
