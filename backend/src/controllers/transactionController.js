const supabase = require('../config/supabase');

// List transactions for the logged-in user, optionally filtered by date range / account.
async function listTransactions(req, res) {
  try {
    const { from, to, account_id, type } = req.query;
    let query = supabase
      .from('yy_transactions')
      .select('*')
      .eq('user_id', req.user.id)
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

    const { data: tx, error } = await supabase
      .from('yy_transactions')
      .insert({
        user_id: req.user.id,
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
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing) return res.status(404).json({ error: 'Transaction not found' });

    // Reverse the old amount from its account, then apply the new one —
    // matches the reversal rule documented for 帳戶管理 in the planning doc.
    if (existing.account_id) {
      const reverseDelta = existing.type === 'income' ? -existing.amount : existing.amount;
      await adjustAccountBalance(existing.account_id, reverseDelta);
    }

    const updates = { ...req.body };
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
      .eq('user_id', req.user.id)
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
