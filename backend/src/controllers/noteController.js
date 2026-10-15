const supabase = require('../config/supabase');

// 墨箋絮語:隨手記事(短便條),可打勾完成
const MAX_LEN = 2000;
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const cleanContent = (v) => (typeof v === 'string' ? v.trim().slice(0, MAX_LEN) : '');

// GET /notes?status=open|done|all&q=關鍵字&from=YYYY-MM-DD&to=YYYY-MM-DD
async function listNotes(req, res) {
  try {
    const { status = 'all', q, from, to } = req.query;
    let query = supabase
      .from('yy_notes')
      .select('id, content, is_done, done_at, created_at, updated_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (status === 'open') query = query.eq('is_done', false);
    if (status === 'done') query = query.eq('is_done', true);
    if (typeof q === 'string' && q.trim()) {
      // 跳脫 LIKE 的萬用字元,關鍵字照字面比對
      const kw = q.trim().slice(0, 100).replace(/[\\%_]/g, (c) => `\\${c}`);
      query = query.ilike('content', `%${kw}%`);
    }
    // 日期以台灣時間的整天計算
    if (isDate(from)) query = query.gte('created_at', new Date(`${from}T00:00:00+08:00`).toISOString());
    if (isDate(to)) query = query.lt('created_at', new Date(new Date(`${to}T00:00:00+08:00`).getTime() + 86400000).toISOString());
    const { data, error } = await query;
    if (error) throw error;
    return res.json({ notes: data });
  } catch (err) {
    console.error('[noteController.listNotes]', err);
    return res.status(500).json({ error: 'Failed to fetch notes' });
  }
}

// POST /notes { content }
async function createNote(req, res) {
  try {
    const content = cleanContent(req.body?.content);
    if (!content) return res.status(400).json({ error: 'Content is required' });
    const { data, error } = await supabase
      .from('yy_notes')
      .insert({ user_id: req.user.id, content })
      .select('id, content, is_done, done_at, created_at, updated_at')
      .single();
    if (error) throw error;
    return res.status(201).json({ note: data });
  } catch (err) {
    console.error('[noteController.createNote]', err);
    return res.status(500).json({ error: 'Failed to create note' });
  }
}

// PUT /notes/:id { content?, is_done? } — 只接受這兩個欄位
async function updateNote(req, res) {
  try {
    const patch = { updated_at: new Date().toISOString() };
    if (req.body?.content !== undefined) {
      const content = cleanContent(req.body.content);
      if (!content) return res.status(400).json({ error: 'Content is required' });
      patch.content = content;
    }
    if (req.body?.is_done !== undefined) {
      patch.is_done = req.body.is_done === true;
      patch.done_at = patch.is_done ? new Date().toISOString() : null;
    }
    const { data, error } = await supabase
      .from('yy_notes')
      .update(patch)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id, content, is_done, done_at, created_at, updated_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Note not found' });
    return res.json({ note: data });
  } catch (err) {
    console.error('[noteController.updateNote]', err);
    return res.status(500).json({ error: 'Failed to update note' });
  }
}

// DELETE /notes/:id
async function deleteNote(req, res) {
  try {
    const { data, error } = await supabase
      .from('yy_notes')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: 'Note not found' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[noteController.deleteNote]', err);
    return res.status(500).json({ error: 'Failed to delete note' });
  }
}

module.exports = { listNotes, createNote, updateNote, deleteNote };
