const supabase = require('../config/supabase');

// 使用者只看得到「公開」與「發給自己」的公告(公告由管理後台發布)
const audience = (userId) => `target_user_id.is.null,target_user_id.eq.${userId}`;

async function listAnnouncements(req, res) {
  try {
    const { data, error } = await supabase
      .from('yy_announcements')
      .select('*')
      .lte('published_at', new Date().toISOString())
      .or(audience(req.user.id))
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
// 好友通知:等我回覆的好友邀請、上次看好友頁之後接受我邀請的人(欄位還沒建立時回 0)
async function friendNotices(uid) {
  try {
    const { count: requests } = await supabase.from('yy_friendships').select('id', { count: 'exact', head: true })
      .eq('addressee_id', uid).eq('status', 'pending');
    const { data: me } = await supabase.from('yy_users').select('friends_seen_at').eq('id', uid).maybeSingle();
    let q = supabase.from('yy_friendships').select('id', { count: 'exact', head: true }).eq('requester_id', uid).eq('status', 'accepted');
    if (me?.friends_seen_at) q = q.gt('accepted_at', me.friends_seen_at);
    const { count: accepted } = await q;
    return { requests: requests || 0, accepted: me?.friends_seen_at ? (accepted || 0) : 0 };
  } catch (err) {
    console.error('[announcementController.friendNotices]', err.message);
    return { requests: 0, accepted: 0 };
  }
}

// 還沒回覆的邀請:行事曆、共同行程、共同紀念日算在「行事曆」,共同帳本算在「記帳」
async function inviteCounts(uid) {
  const count = async (table) => {
    const { count: n, error } = await supabase.from(table).select('user_id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'invited');
    if (error) throw error;
    return n || 0;
  };
  try {
    const [cal, ev, ann, led] = await Promise.all(['yy_calendar_members', 'yy_event_members', 'yy_anniversary_members', 'yy_ledger_members'].map(count));
    return { calendar: cal + ev + ann, ledger: led };
  } catch (err) {
    console.error('[announcementController.inviteCounts]', err.message);
    return { calendar: 0, ledger: 0 };
  }
}

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
      .lte('published_at', now)
      .or(audience(req.user.id));
    if (seenAt) unreadQuery = unreadQuery.gt('published_at', seenAt);
    const { count, error: countErr } = await unreadQuery;
    if (countErr) throw countErr;

    const bannerAfter = [seenAt, dismissedAt].filter(Boolean).sort().pop() || null;
    let bannerQuery = supabase
      .from('yy_announcements')
      .select('id, title, published_at')
      .eq('is_important', true)
      .lte('published_at', now)
      .or(audience(req.user.id))
      .order('published_at', { ascending: false })
      .limit(1);
    if (bannerAfter) bannerQuery = bannerQuery.gt('published_at', bannerAfter);
    const { data: banners, error: bannerErr } = await bannerQuery;
    if (bannerErr) throw bannerErr;

    return res.json({ unread: count || 0, banner: banners?.[0] || null, friends: await friendNotices(req.user.id), invites: await inviteCounts(req.user.id) });
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
