const supabase = require('../config/supabase');

// Read-only for regular users. Announcements are inserted directly in
// Supabase for now — no admin UI yet since this is a solo-dev app.
async function listAnnouncements(req, res) {
  try {
    const { data, error } = await supabase
      .from('yy_announcements')
      .select('*')
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return res.json({ announcements: data });
  } catch (err) {
    console.error('[announcementController.listAnnouncements]', err);
    return res.status(500).json({ error: 'Failed to fetch announcements' });
  }
}

module.exports = { listAnnouncements };
