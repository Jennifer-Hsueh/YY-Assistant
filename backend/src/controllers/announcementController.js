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

// 鈴鐺未讀數與重要公告橫幅。已讀時間存在 yy_users,所以各裝置同步。
// - unread:比「看過公告頁」時間新的公告數
// - banner:最新一則「重要」公告,且比「看過公告頁」與「按 ✕ 關閉」兩個時間都新
async function getStatus(req, res) {
  try {
    const { data: user, error: userErr } = await supabase
      .from('yy_users')
      .select('announcements_seen_at, announcement_banner_dismissed_at')
      .eq('id', req.user.id)
      .single();
    if (userErr) throw userErr;

    const now = new Date().toISOString();
    const seenAt = user?.announcements_seen_at || null;
    const dismissedAt = user?.announcement_banner_dismissed_at || null;

    let unreadQuery = supabase
      .from('yy_announcements')
      .select('id', { count: 'exact', head: true })
      .lte('published_at', now);
    if (seenAt) unreadQuery = unreadQuery.gt('published_at', seenAt);
    const { count, error: countErr } = await unreadQuery;
    if (countErr) throw countErr;

    const bannerAfter = [seenAt, dismissedAt].filter(Boolean).sort().pop() || null;
    let bannerQuery = supabase
      .from('yy_announcements')
      .select('id, title, published_at')
      .eq('is_important', true)
      .lte('published_at', now)
      .order('published_at', { ascending: false })
      .limit(1);
    if (bannerAfter) bannerQuery = bannerQuery.gt('published_at', bannerAfter);
    const { data: banners, error: bannerErr } = await bannerQuery;
    if (bannerErr) throw bannerErr;

    return res.json({ unread: count || 0, banner: banners?.[0] || null });
  } catch (err) {
    console.error('[announcementController.getStatus]', err);
    return res.status(500).json({ error: 'Failed to fetch announcement status' });
  }
}

async function touchUser(req, res, column) {
  try {
    const { error } = await supabase
      .from('yy_users')
      .update({ [column]: new Date().toISOString() })
      .eq('id', req.user.id);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    console.error(`[announcementController.${column}]`, err);
    return res.status(500).json({ error: 'Failed to update announcement status' });
  }
}

const markSeen = (req, res) => touchUser(req, res, 'announcements_seen_at');
const dismissBanner = (req, res) => touchUser(req, res, 'announcement_banner_dismissed_at');

module.exports = { listAnnouncements, getStatus, markSeen, dismissBanner };
