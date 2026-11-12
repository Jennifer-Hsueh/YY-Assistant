const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');

// 後台「刪除勾選的使用者」要輸入的刪除密碼。
// 存在 yy_settings 的 delete_password = { hash, updated_at };還沒設定過時預設是「刪除」
const KEY = 'delete_password';
const DEFAULT = '刪除';

async function readRow() {
  const { data, error } = await supabase.from('yy_settings').select('value').eq('key', KEY).maybeSingle();
  if (error) throw error;
  return data?.value || null;
}

async function verify(input) {
  if (typeof input !== 'string' || !input) return false;
  const row = await readRow();
  if (!row?.hash) return input === DEFAULT;
  return bcrypt.compare(input, row.hash);
}

async function info() {
  const row = await readRow();
  return { custom: !!row?.hash, updated_at: row?.updated_at || null };
}

async function change(current, next) {
  if (!(await verify(current))) return { ok: false, error: '目前的刪除密碼不正確' };
  const v = String(next || '');
  if (v.trim().length < 4) return { ok: false, error: '新的刪除密碼至少 4 個字' };
  if (v.length > 64) return { ok: false, error: '新的刪除密碼最多 64 個字' };
  const hash = await bcrypt.hash(v, 10);
  const updated_at = new Date().toISOString();
  const { error } = await supabase.from('yy_settings').upsert({ key: KEY, value: { hash, updated_at }, updated_at }, { onConflict: 'key' });
  if (error) throw error;
  return { ok: true, updated_at };
}

module.exports = { verify, info, change, DEFAULT };
