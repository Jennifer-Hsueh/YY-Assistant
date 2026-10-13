// 收支計算共用工具(首頁、統計分析共用)
export const EXCLUDED_CATEGORIES = ['轉帳', '餘額調整']; // 不算收支

export function localDate(iso) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 指定月份(YYYY-MM)的支出/收入,換算成 TWD;byCategory 為各分類支出
export function monthTotals(transactions, accounts, rates, monthPrefix) {
  const currencyOf = (id) => accounts.find((a) => a.id === id)?.currency || 'TWD';
  const result = { expense: 0, income: 0, byCategory: {} };
  for (const tx of transactions) {
    if (EXCLUDED_CATEGORIES.includes(tx.category)) continue;
    if (localDate(tx.occurred_at).slice(0, 7) !== monthPrefix) continue;
    const twd = Number(tx.amount) * (rates[currencyOf(tx.account_id)] ?? 1);
    if (tx.type === 'expense') {
      result.expense += twd;
      if (tx.category) result.byCategory[tx.category] = (result.byCategory[tx.category] || 0) + twd;
    } else {
      result.income += twd;
    }
  }
  return result;
}

// 各帳戶幣別 → TWD 匯率
export async function loadRates(api, accounts) {
  const currencies = [...new Set(accounts.map((a) => a.currency || 'TWD'))].filter((c) => c !== 'TWD');
  const pairs = await Promise.all(currencies.map((c) => api.getExchangeRate(c, 'TWD').then(({ rate }) => [c, rate]).catch(() => [c, 1])));
  return { TWD: 1, ...Object.fromEntries(pairs) };
}
