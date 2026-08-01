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
    const { name, type } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { data, error } = await supabase
      .from('yy_categories')
      .insert({ user_id: req.user.id, name, type: type || 'general' })
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
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { data: existing, error: fetchErr } = await supabase
      .from('yy_categories')
      .select('id, name, user_id')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing || existing.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const oldName = existing.name;

    const { data, error } = await supabase
      .from('yy_categories')
      .update({ name })
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
    await Promise.all(
      tables.map((table) =>
        supabase.from(table).update({ category: name }).eq('user_id', req.user.id).eq('category', oldName)
      )
    );

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

module.exports = { listCategories, createCategory, updateCategory, deleteCategory };
