const supabase = require('../config/supabase');

// 預算:category = '' 代表每月總預算
async function listBudgets(req, res) {
  try {
    const { data, error } = await supabase
      .from('yy_budgets')
      .select('id, category, amount')
      .eq('ledger_id', req.ledger.id)
      .order('category', { ascending: true });
    if (error) throw error;
    return res.json({ budgets: data });
  } catch (err) {
    console.error('[budgetController.listBudgets]', err);
    return res.status(500).json({ error: 'Failed to fetch budgets' });
  }
}

// 新增或更新(同一個分類只會有一筆)
async function upsertBudget(req, res) {
  try {
    const category = typeof req.body.category === 'string' ? req.body.category.trim() : '';
    const amount = Number(req.body.amount);
    if (!(amount > 0)) return res.status(400).json({ error: 'amount must be positive' });
    const { data, error } = await supabase
      .from('yy_budgets')
      .upsert({ user_id: req.user.id, ledger_id: req.ledger.id, category, amount }, { onConflict: 'ledger_id,category' })
      .select('id, category, amount')
      .single();
    if (error) throw error;
    return res.json({ budget: data });
  } catch (err) {
    console.error('[budgetController.upsertBudget]', err);
    return res.status(500).json({ error: 'Failed to save budget' });
  }
}

async function deleteBudget(req, res) {
  try {
    const { error } = await supabase
      .from('yy_budgets')
      .delete()
      .eq('id', req.params.id)
      .eq('ledger_id', req.ledger.id);
    if (error) throw error;
    return res.json({ message: 'Budget deleted' });
  } catch (err) {
    console.error('[budgetController.deleteBudget]', err);
    return res.status(500).json({ error: 'Failed to delete budget' });
  }
}

module.exports = { listBudgets, upsertBudget, deleteBudget };
