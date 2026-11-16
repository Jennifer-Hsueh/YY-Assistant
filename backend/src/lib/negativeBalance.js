// 帳戶餘額不能因為記帳變成負數(帳戶勾了「允許負數」的除外,例如信用卡)
// deltas:{ 帳戶 id: 金額變化 };只檢查會讓餘額變少的帳戶
const supabase = require('../config/supabase');

const round2 = (n) => Math.round(Number(n) * 100) / 100;

async function findNegative(deltas) {
  const ids = Object.keys(deltas).filter((id) => id && Number(deltas[id]) < 0);
  if (!ids.length) return null;
  const { data, error } = await supabase.from('yy_accounts').select('id, name, bank, balance, currency, allow_negative').in('id', ids);
  if (error) {
    // 資料庫還沒加 allow_negative 欄位(SQL 漏跑):先不檢查,不讓記帳整個壞掉
    if (error.code === '42703') { console.error('[negativeBalance] 缺少 yy_accounts.allow_negative 欄位,請在 Supabase 執行 SQL'); return null; }
    throw error;
  }
  for (const a of data || []) {
    if (a.allow_negative) continue;
    const after = round2(Number(a.balance) + Number(deltas[a.id]));
    if (after < 0) return { id: a.id, name: a.name, bank: a.bank || null, currency: a.currency || 'TWD', balance: round2(a.balance), after };
  }
  return null;
}

function reject(res, hit) {
  const label = hit.bank ? `${hit.bank} / ${hit.name}` : hit.name;
  return res.status(400).json({
    error: `「${label}」的餘額會變成 ${hit.after.toLocaleString('en-US')}，無法儲存`,
    code: 'NEGATIVE_BALANCE',
    account: hit,
  });
}

// 把多筆變化加總到同一個帳戶
function addDelta(map, id, delta) {
  if (!id) return map;
  map[id] = round2((map[id] || 0) + Number(delta));
  return map;
}

module.exports = { findNegative, reject, addDelta };
