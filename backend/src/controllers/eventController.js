const supabase = require('../config/supabase');

async function listEvents(req, res) {
  try {
    const { from, to } = req.query;
    let query = supabase
      .from('yy_events')
      .select('*')
      .eq('user_id', req.user.id)
      .order('start_at', { ascending: true });

    if (from) query = query.gte('start_at', from);
    if (to) query = query.lte('start_at', to);

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
    const { title, start_at, end_at, category, color, note } = req.body;
    if (!title || !start_at) {
      return res.status(400).json({ error: 'title and start_at are required' });
    }

    const { data, error } = await supabase
      .from('yy_events')
      .insert({
        user_id: req.user.id,
        title,
        start_at,
        end_at: end_at || start_at,
        category: category || null,
        color: color || null, // hex string chosen by the user for this category
        note: note || null,
        source: 'app', // vs 'google' once phase-2 sync lands
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
    const { data, error } = await supabase
      .from('yy_events')
      .update(req.body)
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
