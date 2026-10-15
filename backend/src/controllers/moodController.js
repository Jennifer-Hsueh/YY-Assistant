const supabase = require('../config/supabase');

// 九種心情;rainbow 為舊資料,仍接受
const MOODS = ['question', 'angry', 'rainy', 'storm', 'love', 'sunny', 'cloudy', 'exclaim', 'flower', 'rainbow'];
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

// GET /moods?from=YYYY-MM-DD&to=YYYY-MM-DD
async function listMoods(req, res) {
  try {
    let q = supabase.from('yy_moods').select('date, mood').eq('user_id', req.user.id).order('date', { ascending: true });
    if (isDate(req.query.from)) q = q.gte('date', req.query.from);
    if (isDate(req.query.to)) q = q.lte('date', req.query.to);
    const { data, error } = await q;
    if (error) throw error;
    return res.json({ moods: data });
  } catch (err) {
    console.error('[moodController.listMoods]', err);
    return res.status(500).json({ error: 'Failed to fetch moods' });
  }
}

// PUT /moods/:date  { mood }  — mood = null 代表清除
async function setMood(req, res) {
  try {
    const { date } = req.params;
    const { mood } = req.body;
    if (!isDate(date)) return res.status(400).json({ error: 'Invalid date' });
    if (mood === null) {
      const { error } = await supabase.from('yy_moods').delete().eq('user_id', req.user.id).eq('date', date);
      if (error) throw error;
      return res.json({ mood: null });
    }
    if (!MOODS.includes(mood)) return res.status(400).json({ error: 'Invalid mood' });
    const { data, error } = await supabase
      .from('yy_moods')
      .upsert({ user_id: req.user.id, date, mood, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' })
      .select('date, mood')
      .single();
    if (error) throw error;
    return res.json({ mood: data });
  } catch (err) {
    console.error('[moodController.setMood]', err);
    return res.status(500).json({ error: 'Failed to save mood' });
  }
}

module.exports = { listMoods, setMood };
