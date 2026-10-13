const supabase = require('../config/supabase');

// 提醒選項(分鐘):null 不提醒、0 準時、10/30/60 分鐘前、1440 一天前;
// 全天行程:-480 = 當天早上 8 點、960 = 前一天早上 8 點
const REMIND_OPTIONS = [null, 0, 10, 30, 60, 1440, -480, 960];
const validRemind = (v) => v === undefined || REMIND_OPTIONS.includes(v);

async function listEvents(req, res) {
  try {
    const { from, to } = req.query;
    let query = supabase
      .from('yy_events')
      .select('*')
      .eq('user_id', req.user.id)
      .order('start_at', { ascending: true });

    // 跨日行程:只要和查詢區間有重疊就列出(結束時間在 from 之後、開始時間在 to 之前)
    const valid = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
    if (valid(from)) {
      const f = new Date(from).toISOString();
      query = query.or(`end_at.gte."${f}",and(end_at.is.null,start_at.gte."${f}")`);
    }
    if (valid(to)) query = query.lte('start_at', new Date(to).toISOString());

    const { data, error } = await query;
    if (error) throw error;
    return res.json({ events: data });
  } catch (err) {
    console.error('[eventController.listEvents]', err);
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
}

async function createEvent(req, res) {
  try {
    const { title, start_at, end_at, category, color, note, remind_before_minutes } = req.body;
    if (!title || !start_at) {
      return res.status(400).json({ error: 'title and start_at are required' });
    }
    if (!validRemind(remind_before_minutes)) return res.status(400).json({ error: 'Invalid reminder' });

    const { data, error } = await supabase
      .from('yy_events')
      .insert({
        user_id: req.user.id,
        title,
        start_at,
        // 結束時間不得早於開始時間
        end_at: end_at && end_at > start_at ? end_at : start_at,
        category: category || null,
        color: color || null, // hex string chosen by the user for this category
        note: note || null,
        source: 'app', // vs 'google' once phase-2 sync lands
        remind_before_minutes: remind_before_minutes ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json({ event: data });
  } catch (err) {
    console.error('[eventController.createEvent]', err);
    return res.status(500).json({ error: 'Failed to create event' });
  }
}

async function updateEvent(req, res) {
  try {
    const { id } = req.params;
    // 只允許更新這些欄位(不能改 user_id 等)
    const updates = {};
    for (const k of ['title', 'start_at', 'end_at', 'category', 'color', 'note', 'remind_before_minutes']) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    if (!validRemind(updates.remind_before_minutes)) return res.status(400).json({ error: 'Invalid reminder' });
    // 時間或提醒設定改了 → 重新排定提醒
    if (updates.start_at !== undefined || updates.remind_before_minutes !== undefined) updates.reminder_sent_at = null;
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' });
    const { data, error } = await supabase
      .from('yy_events')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Event not found' });
    return res.json({ event: data });
  } catch (err) {
    console.error('[eventController.updateEvent]', err);
    return res.status(500).json({ error: 'Failed to update event' });
  }
}

async function deleteEvent(req, res) {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('yy_events')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);
    if (error) throw error;
    return res.status(204).send();
  } catch (err) {
    console.error('[eventController.deleteEvent]', err);
    return res.status(500).json({ error: 'Failed to delete event' });
  }
}

module.exports = { listEvents, createEvent, updateEvent, deleteEvent };
