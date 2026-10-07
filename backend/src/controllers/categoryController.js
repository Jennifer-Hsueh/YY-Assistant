const supabase = require('../config/supabase');

async function listCategories(req, res) {
  try {
    const { data, error } = await supabase
      .from('yy_categories')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return res.json({ categories: data });
  } catch (err) {
    console.error('[categoryController.listCategories]', err);
    return res.status(500).json({ error: 'Failed to fetch categories' });
  }
}

async function createCategory(req, res) {
  try {
    const { name, type, color } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { data, error } = await supabase
      .from('yy_categories')
      .insert({ user_id: req.user.id, name, type: type || 'general', color: color || null })
      .select()
      .single();
    if (error) {
      // Postgres unique_violation — category name already exists for this user.
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Category already exists' });
      }
      throw error;
    }
    return res.status(201).json({ category: data });
  } catch (err) {
    console.error('[categoryController.createCategory]', err);
    return res.status(500).json({ error: 'Failed to create category' });
  }
}

// Renaming a category also updates any existing transactions / events /
// recurring items that reference the old name, since those tables store
// `category` as free text rather than a foreign key.
async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    if (!name && color === undefined) return res.status(400).json({ error: 'name or color is required' });

    const { data: existing, error: fetchErr } = await supabase
      .from('yy_categories')
      .select('id, name, user_id, type')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing || existing.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const oldName = existing.name;

    const { data, error } = await supabase
      .from('yy_categories')
      .update({ ...(name ? { name } : {}), ...(color !== undefined ? { color } : {}) })
      .eq('id', id)
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Category already exists' });
      }
      throw error;
    }

    // Best-effort propagation to the free-text category fields elsewhere.
    // These run independently; if one fails it's logged but doesn't fail the rename.
    const tables = ['yy_transactions', 'yy_events', 'yy_recurring_items'];
    if (name && name !== oldName) await Promise.all(
      tables.map((table) =>
        supabase.from(table).update({ category: name }).eq('user_id', req.user.id).eq('category', oldName)
      )
    );

    // Event categories: keep the stored colour of existing events in sync.
    if (color !== undefined && existing.type === 'event') {
      await supabase.from('yy_events').update({ color: color || '#9CA3AF' }).eq('user_id', req.user.id).eq('category', name || oldName);
    }

    return res.json({ category: data });
  } catch (err) {
    console.error('[categoryController.updateCategory]', err);
    return res.status(500).json({ error: 'Failed to update category' });
  }
}

// Deletes the category from the managed list only. Existing transactions/
// events/recurring items that used this category name keep their text value
// (so historical records aren't silently altered) — it just won't show up
// as a selectable option going forward.
async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    const { data: existing, error: fetchErr } = await supabase
      .from('yy_categories')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing || existing.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const { error } = await supabase.from('yy_categories').delete().eq('id', id);
    if (error) throw error;
    return res.json({ message: 'Category deleted' });
  } catch (err) {
    console.error('[categoryController.deleteCategory]', err);
    return res.status(500).json({ error: 'Failed to delete category' });
  }
}

// Removes every record the user owns (accounts, transactions, events,
// recurring items, categories). The login account and profile are kept.
async function clearAllData(req, res) {
  try {
    const tables = ['yy_transactions', 'yy_events', 'yy_recurring_items', 'yy_categories', 'yy_accounts'];
    for (const table of tables) {
      const { error } = await supabase.from(table).delete().eq('user_id', req.user.id);
      if (error) throw error;
    }
    return res.json({ message: 'All data cleared' });
  } catch (err) {
    console.error('[categoryController.clearAllData]', err);
    return res.status(500).json({ error: 'Failed to clear data' });
  }
}

module.exports = { listCategories, createCategory, updateCategory, deleteCategory, clearAllData };
