const supabase = require('../config/supabase');

async function listRecurringItems(req, res) {
  try {
    const { data, error } = await supabase
      .from('yy_recurring_items')
      .select('*')
      .eq('user_id', req.user.id)
      .order('next_trigger_date', { ascending: true });
    if (error) throw error;
    return res.json({ recurring_items: data });
  } catch (err) {
    console.error('[recurringController.listRecurringItems]', err);
    return res.status(500).json({ error: 'Failed to fetch recurring items' });
  }
}

async function createRecurringItem(req, res) {
  try {
    const {
      kind, // 'expense' | 'income' | 'event'
      title,
      amount,
      category,
      frequency, // 'monthly' | 'weekly'
      day_of_month,
      day_of_week,
      next_trigger_date,
      reminder_method, // user-configurable: 'push' | 'in_app' | 'both'
      account_id,
      end_date,
    } = req.body;

    if (!kind || !title || !frequency || !next_trigger_date) {
      return res.status(400).json({ error: 'kind, title, frequency and next_trigger_date are required' });
    }
    if (!['monthly', 'weekly', 'yearly'].includes(frequency)) {
      return res.status(400).json({ error: 'Invalid frequency' });
    }

    const { data, error } = await supabase
      .from('yy_recurring_items')
      .insert({
        user_id: req.user.id,
        kind,
        title,
        amount: amount || null,
        category: category || null,
        frequency,
        // 用 ?? 而不是 ||:星期日是 0,不能被當成「沒有」
        day_of_month: day_of_month ?? null,
        day_of_week: day_of_week ?? null,
        next_trigger_date,
        reminder_method: reminder_method || 'push',
        account_id: account_id || null,
        end_date: end_date || null,
        is_active: true,
      })
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json({ recurring_item: data });
  } catch (err) {
    console.error('[recurringController.createRecurringItem]', err);
    return res.status(500).json({ error: 'Failed to create recurring item' });
  }
}

async function updateRecurringItem(req, res) {
  try {
    const { id } = req.params;
    // 只允許更新這些欄位(不能改 user_id 等)
    const updates = {};
    for (const k of ['kind', 'title', 'amount', 'category', 'frequency', 'day_of_month', 'day_of_week',
      'next_trigger_date', 'reminder_method', 'is_active', 'account_id', 'end_date']) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' });
    const { data, error } = await supabase
      .from('yy_recurring_items')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Recurring item not found' });
    return res.json({ recurring_item: data });
  } catch (err) {
    console.error('[recurringController.updateRecurringItem]', err);
    return res.status(500).json({ error: 'Failed to update recurring item' });
  }
}

async function deleteRecurringItem(req, res) {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('yy_recurring_items')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);
    if (error) throw error;
    return res.status(204).send();
  } catch (err) {
    console.error('[recurringController.deleteRecurringItem]', err);
    return res.status(500).json({ error: 'Failed to delete recurring item' });
  }
}

module.exports = {
  listRecurringItems,
  createRecurringItem,
  updateRecurringItem,
  deleteRecurringItem,
};
