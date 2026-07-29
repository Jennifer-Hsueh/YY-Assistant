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

module.exports = { listAccounts, createAccount, transferBetweenAccounts };
