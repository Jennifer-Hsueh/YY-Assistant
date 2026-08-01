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
    const { name, balance } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { data, error } = await supabase
      .from('yy_accounts')
      .insert({ user_id: req.user.id, name, balance: balance || 0 })
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json({ account: data });
  } catch (err) {
    console.error('[accountController.createAccount]', err);
    return res.status(500).json({ error: 'Failed to create account' });
  }
}

// Rename an account and/or manually adjust its balance.
async function updateAccount(req, res) {
  try {
    const { id } = req.params;
    const { name, balance } = req.body;

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

// Deleting an account leaves past transactions intact — the FK is
// `on delete set null`, so those rows just lose their account reference
// rather than being deleted.
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

// Direct transfer between two of the user's own accounts.
async function transferBetweenAccounts(req, res) {
  try {
    const { from_account_id, to_account_id, amount } = req.body;
    if (!from_account_id || !to_account_id || !amount || amount <= 0) {
      return res.status(400).json({ error: 'from_account_id, to_account_id and a positive amount are required' });
    }
    if (from_account_id === to_account_id) {
      return res.status(400).json({ error: 'from_account_id and to_account_id must differ' });
    }

    const { data: accounts, error } = await supabase
      .from('yy_accounts')
      .select('id, balance, user_id')
      .in('id', [from_account_id, to_account_id]);
    if (error) throw error;

    const from = accounts.find((a) => a.id === from_account_id);
    const to = accounts.find((a) => a.id === to_account_id);
    if (!from || !to || from.user_id !== req.user.id || to.user_id !== req.user.id) {
      return res.status(404).json({ error: 'One or both accounts were not found' });
    }

    await supabase.from('yy_accounts').update({ balance: Number(from.balance) - Number(amount) }).eq('id', from_account_id);
    await supabase.from('yy_accounts').update({ balance: Number(to.balance) + Number(amount) }).eq('id', to_account_id);

    return res.json({ message: 'Transfer complete' });
  } catch (err) {
    console.error('[accountController.transferBetweenAccounts]', err);
    return res.status(500).json({ error: 'Failed to transfer between accounts' });
  }
}

module.exports = { listAccounts, createAccount, updateAccount, deleteAccount, transferBetweenAccounts };
