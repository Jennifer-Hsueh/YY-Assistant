const supabase = require('../config/supabase');
const { sendPushToUser } = require('./fcmService');
const { rateTo } = require('../controllers/exchangeRateController');

// 不算收支的分類
const EXCLUDED = ['轉帳', '餘額調整'];
const THRESHOLDS = [0.8, 1];

function monthOf(iso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit' }).format(new Date(iso));
}

// 記一筆支出後檢查預算:本筆讓使用率跨過 80% 或 100% 時推播一次
async function checkBudgetAfterExpense(userId, tx) {
  if (tx.type !== 'expense' || EXCLUDED.includes(tx.category)) return { checked: false };
  const month = monthOf(tx.occurred_at);
  if (month !== monthOf(new Date().toISOString())) return { checked: false }; // 只提醒本月

  const { data: budgets } = await supabase.from('yy_budgets').select('category, amount').eq('user_id', userId);
  const relevant = (budgets || []).filter((b) => b.category === '' || b.category === tx.category);
  if (relevant.length === 0) return { checked: false };

  const [{ data: accounts }, { data: txs }] = await Promise.all([
    supabase.from('yy_accounts').select('id, currency').eq('user_id', userId),
    supabase.from('yy_transactions').select('id, amount, category, account_id, occurred_at, type')
      .eq('user_id', userId).eq('type', 'expense'),
  ]);
  const currencyOf = (id) => (accounts || []).find((a) => a.id === id)?.currency || 'TWD';
  const rates = {};
  const toTwd = async (t) => {
    const c = currencyOf(t.account_id);
    if (rates[c] == null) rates[c] = await rateTo(c, 'TWD').catch(() => 1);
    return Number(t.amount) * rates[c];
  };

  const monthTxs = (txs || []).filter((t) => monthOf(t.occurred_at) === month && !EXCLUDED.includes(t.category));
  const thisAmount = await toTwd(tx);
  const alerts = [];
  for (const b of relevant) {
    let spent = 0;
    for (const t of monthTxs) if (b.category === '' || t.category === b.category) spent += await toTwd(t);
    const before = (spent - thisAmount) / Number(b.amount);
    const after = spent / Number(b.amount);
    const crossed = THRESHOLDS.filter((th) => before < th && after >= th).pop();
    if (crossed == null) continue;
    const name = b.category === '' ? '本月總預算' : `「${b.category}」預算`;
    const pct = Math.round(after * 100);
    alerts.push(`${name}已使用 ${pct}%`);
    await sendPushToUser(userId, {
      channel: 'ledger',
      title: crossed >= 1 ? '⚠️ 預算已用完' : '💰 預算提醒',
      body: `${name}已使用 ${pct}%(NT$ ${Math.round(spent).toLocaleString()} / ${Number(b.amount).toLocaleString()})`,
      data: { url: '/' },
    }).catch((err) => console.error('[budgetAlert] push failed', err));
  }
  return { checked: true, alerts };
}

module.exports = { checkBudgetAfterExpense };
