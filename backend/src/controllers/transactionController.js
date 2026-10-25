const supabase = require('../config/supabase');
const { checkBudgetAfterExpense } = require('../services/budgetAlert');
const { activeUserIds } = require('../lib/ledgers');
const { sendPushToUser } = require('../services/fcmService');

// 共同帳本:有人記一筆時通知其他成員
async function notifyLedgerMembers(ledger, userId, tx) {
  const ids = (await activeUserIds(ledger)).filter((id) => id !== userId);
  if (!ids.length) return;
  const { data: me } = await supabase.from('yy_users').select('username').eq('id', userId).maybeSingle();
  const who = me?.username || 'YY手帳使用者';
  const sign = tx.type === 'income' ? '+' : '-';
  const body = `${who} 記了一筆：${tx.category || '未分類'} ${sign}${Number(tx.amount).toLocaleString()}${tx.note ? `（${tx.note}）` : ''}`;
  for (const id of ids) {
    await sendPushToUser(id, { channel: 'ledger_shared', title: `📒 ${ledger.name}`, body, data: { url: '/transactions' } })
      .catch((err) => console.error('[transaction] member push failed', err.message));
  }
}

// List transactions for the logged-in user, optionally filtered by date range / account.
async function listTransactions(req, res) {
  try {
    const { from, to, account_id, type } = req.query;
    let query = supabase
      .from('yy_transactions')
      .select('*')
      .eq('ledger_id', req.ledger.id)
      .order('occurred_at', { ascending: false });

    if (from) query = query.gte('occurred_at', from);
    if (to) query = query.lte('occurred_at', to);
    if (account_id) query = query.eq('account_id', account_id);
    if (type) query = query.eq('type', type); // 'income' | 'expense'

    const { data, error } = await query;
    if (error) throw error;
    return res.json({ transactions: data });
  } catch (err) {
    console.error('[transactionController.listTransactions]', err);
    return res.status(500).json({ error: 'Failed to fetch transactions' });
  }
}

async function createTransaction(req, res) {
  try {
    const { account_id, type, amount, category, note, occurred_at } = req.body;
    if (!type || !amount || !occurred_at) {
      return res.status(400).json({ error: 'type, amount and occurred_at are required' });
    }
    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ error: "type must be 'income' or 'expense'" });
    }
    if (account_id && !(await accountInLedger(account_id, req.ledger.id))) {
      return res.status(400).json({ error: '帳戶不在這本帳本裡' });
    }

    const { data: tx, error } = await supabase
      .from('yy_transactions')
      .insert({
        user_id: req.user.id,
        ledger_id: req.ledger.id,
        account_id: account_id || null,
        type,
        amount,
        category: category || null,
        note: note || null,
        occurred_at,
      })
      .select()
      .single();
    if (error) throw error;

    if (account_id) {
      await adjustAccountBalance(account_id, type === 'income' ? amount : -amount);
    }

    // 預算提醒(背景執行,失敗不影響記帳)
    checkBudgetAfterExpense(req.user.id, tx).catch((err) => console.error('[budgetAlert]', err));
    notifyLedgerMembers(req.ledger, req.user.id, tx).catch((err) => console.error('[transaction] notify members', err));

    return res.status(201).json({ transaction: tx });
  } catch (err) {
    console.error('[transactionController.createTransaction]', err);
    return res.status(500).json({ error: 'Failed to create transaction' });
  }
}

async function updateTransaction(req, res) {
  try {
    const { id } = req.params;
    const { data: existing, error: fetchErr } = await supabase
      .from('yy_transactions')
      .select('*')
      .eq('id', id)
      .eq('ledger_id', req.ledger.id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing) return res.status(404).json({ error: 'Transaction not found' });

    // 只允許修改這些欄位(不能改 user_id、ledger_id 等)
    const updates = {};
    for (const k of ['account_id', 'type', 'amount', 'category', 'note', 'occurred_at']) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' });
    if (updates.type && !['income', 'expense'].includes(updates.type)) {
      return res.status(400).json({ error: "type must be 'income' or 'expense'" });
    }
    if (updates.account_id && !(await accountInLedger(updates.account_id, req.ledger.id))) {
      return res.status(400).json({ error: '帳戶不在這本帳本裡' });
    }

    // Reverse the old amount from its account, then apply the new one —
    // matches the reversal rule documented for 帳戶管理 in the planning doc.
    if (existing.account_id) {
      const reverseDelta = existing.type === 'income' ? -existing.amount : existing.amount;
      await adjustAccountBalance(existing.account_id, reverseDelta);
    }

    const { data: updated, error } = await supabase
      .from('yy_transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    const newAccountId = updated.account_id;
    if (newAccountId) {
      const applyDelta = updated.type === 'income' ? updated.amount : -updated.amount;
      await adjustAccountBalance(newAccountId, applyDelta);
    }

    return res.json({ transaction: updated });
  } catch (err) {
    console.error('[transactionController.updateTransaction]', err);
    return res.status(500).json({ error: 'Failed to update transaction' });
  }
}

async function deleteTransaction(req, res) {
  try {
    const { id } = req.params;
    const { data: existing, error: fetchErr } = await supabase
      .from('yy_transactions')
      .select('*')
      .eq('id', id)
      .eq('ledger_id', req.ledger.id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing) return res.status(404).json({ error: 'Transaction not found' });

    if (existing.account_id) {
      const reverseDelta = existing.type === 'income' ? -existing.amount : existing.amount;
      await adjustAccountBalance(existing.account_id, reverseDelta);
    }

    const { error } = await supabase.from('yy_transactions').delete().eq('id', id);
    if (error) throw error;

    return res.status(204).send();
  } catch (err) {
    console.error('[transactionController.deleteTransaction]', err);
    return res.status(500).json({ error: 'Failed to delete transaction' });
  }
}

// 帳戶必須屬於同一本帳本
async function accountInLedger(accountId, ledgerId) {
  const { data, error } = await supabase.from('yy_accounts').select('id').eq('id', accountId).eq('ledger_id', ledgerId).maybeSingle();
  if (error) throw error;
  return !!data;
}

// Shared helper: adjusts an account's balance by `delta` (can be negative).
async function adjustAccountBalance(accountId, delta) {
  const { data: account, error } = await supabase
    .from('yy_accounts')
    .select('balance')
    .eq('id', accountId)
    .single();
  if (error) throw error;

  const newBalance = Number(account.balance) + Number(delta);
  const { error: updateErr } = await supabase
    .from('yy_accounts')
    .update({ balance: newBalance })
    .eq('id', accountId);
  if (updateErr) throw updateErr;
}

module.exports = {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};
