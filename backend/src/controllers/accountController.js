const supabase = require('../config/supabase');

async function listAccounts(req, res) {
  try {
    const { data, error } = await supabase
      .from('yy_accounts')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return res.json({ accounts: data });
  } catch (err) {
    console.error('[accountController.listAccounts]', err);
    return res.status(500).json({ error: 'Failed to fetch accounts' });
  }
}

async function createAccount(req, res) {
  try {
    const { name, balance, currency } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { data, error } = await supabase
      .from('yy_accounts')
      .insert({ user_id: req.user.id, name, balance: balance || 0, currency: currency || 'TWD' })
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json({ account: data });
  } catch (err) {
    console.error('[accountController.createAccount]', err);
    return res.status(500).json({ error: 'Failed to create account' });
  }
}

async function updateAccount(req, res) {
  try {
    const { id } = req.params;
    const { name, balance, currency } = req.body;

    const { data: existing, error: fetchErr } = await supabase
      .from('yy_accounts')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing || existing.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (balance !== undefined) updates.balance = balance;
    if (currency !== undefined) updates.currency = currency;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const { data, error } = await supabase
      .from('yy_accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return res.json({ account: data });
  } catch (err) {
    console.error('[accountController.updateAccount]', err);
    return res.status(500).json({ error: 'Failed to update account' });
  }
}

async function deleteAccount(req, res) {
  try {
    const { id } = req.params;
    const { data: existing, error: fetchErr } = await supabase
      .from('yy_accounts')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing || existing.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const { error } = await supabase.from('yy_accounts').delete().eq('id', id);
    if (error) throw error;
    return res.json({ message: 'Account deleted' });
  } catch (err) {
    console.error('[accountController.deleteAccount]', err);
    return res.status(500).json({ error: 'Failed to delete account' });
  }
}

// Transfer between two accounts. If they use different currencies, the
// caller must supply exchange_rate (destination currency units per 1 unit
// of source currency) — we don't call any live FX rate API, the user
// enters the rate manually. `amount` is always expressed in the source
// (from) account's currency; the destination account is credited
// amount * exchange_rate.
async function transferBetweenAccounts(req, res) {
  try {
    const { from_account_id, to_account_id, amount, exchange_rate } = req.body;
    if (!from_account_id || !to_account_id || !amount || amount <= 0) {
      return res.status(400).json({ error: 'from_account_id, to_account_id and a positive amount are required' });
    }
    if (from_account_id === to_account_id) {
      return res.status(400).json({ error: 'from_account_id and to_account_id must differ' });
    }

    const { data: accounts, error } = await supabase
      .from('yy_accounts')
      .select('id, name, balance, user_id, currency')
      .in('id', [from_account_id, to_account_id]);
    if (error) throw error;

    const from = accounts.find((a) => a.id === from_account_id);
    const to = accounts.find((a) => a.id === to_account_id);
    if (!from || !to || from.user_id !== req.user.id || to.user_id !== req.user.id) {
      return res.status(404).json({ error: 'One or both accounts were not found' });
    }

    const differentCurrency = from.currency !== to.currency;
    const rate = differentCurrency ? Number(exchange_rate) : 1;
    if (differentCurrency && (!rate || rate <= 0)) {
      return res.status(400).json({ error: 'A positive exchange_rate is required when currencies differ' });
    }

    const creditedAmount = Number(amount) * rate;

    await supabase.from('yy_accounts').update({ balance: Number(from.balance) - Number(amount) }).eq('id', from_account_id);
    await supabase.from('yy_accounts').update({ balance: Number(to.balance) + creditedAmount }).eq('id', to_account_id);

    // Also record the transfer as two transaction rows so it shows up in
    // the ledger — one outflow on the source account, one inflow on the
    // destination account, tagged with category "轉帳" (Transfer).
    const now = new Date().toISOString();
    await supabase.from('yy_transactions').insert([
      {
        user_id: req.user.id,
        account_id: from_account_id,
        type: 'expense',
        amount: Number(amount),
        category: '轉帳',
        note: `轉出至:${to.name}`,
        occurred_at: now,
      },
      {
        user_id: req.user.id,
        account_id: to_account_id,
        type: 'income',
        amount: creditedAmount,
        category: '轉帳',
        note: `轉入自:${from.name}`,
        occurred_at: now,
      },
    ]);

    return res.json({ message: 'Transfer complete', credited_amount: creditedAmount });
  } catch (err) {
    console.error('[accountController.transferBetweenAccounts]', err);
    return res.status(500).json({ error: 'Failed to transfer between accounts' });
  }
}

module.exports = { listAccounts, createAccount, updateAccount, deleteAccount, transferBetweenAccounts };
