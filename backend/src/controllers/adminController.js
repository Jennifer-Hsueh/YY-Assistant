const supabase = require('../config/supabase');
const { forgetUserStatus } = require('../middleware/auth');
const { BUCKET } = require('../services/backupService');

// 管理後台 API。所有路由都先經過 requireAuth + requireAdmin。
const ROLES = ['user', 'tester', 'admin'];
const PLANS = ['free', 'ledger', 'calendar', 'full'];
const WISH_STATUSES = ['considering', 'planned', 'done'];
const USER_COLUMNS = 'id, email, username, role, plan, last_payment_date, plan_expires_at, created_at, last_active_at, is_disabled, disabled_reason, disabled_at';
const USER_PAGE = 50;
const EXPIRING_DAYS = 14;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const DAY = 24 * 60 * 60 * 1000;
const taipeiToday = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
const addDays = (ymd, n) => new Date(new Date(ymd + 'T00:00:00Z').getTime() + n * DAY).toISOString().slice(0, 10);

function fail(res, where, err, msg) {
  console.error(`[adminController.${where}]`, err);
  return res.status(500).json({ error: msg });
}

// 一次分頁抓完整張表(使用者 / 文章數量不大)
async function fetchAll(table, columns) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

function expiryState(u, today) {
  if (!u.plan_expires_at) return null;
  if (u.plan_expires_at < today) return 'expired';
  if (u.plan_expires_at <= addDays(today, EXPIRING_DAYS)) return 'expiring';
  return 'ok';
}

async function me(req, res) {
  const { data } = await supabase.from('yy_users').select('id, email, username').eq('id', req.user.id).maybeSingle();
  return res.json({ admin: data });
}

// ---------- 總覽 ----------
async function lastBackup() {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).list('weekly', { limit: 100 });
    if (error || !data) return null;
    const names = data.map((f) => f.name).filter((n) => /^yy-backup-\d{8}\.json\.gz$/.test(n)).sort();
    const name = names.pop();
    if (!name) return null;
    const d = name.slice(10, 18);
    const file = data.find((f) => f.name === name);
    return { name, date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, created_at: file?.created_at || null, count: names.length + 1 };
  } catch {
    return null;
  }
}

async function overview(req, res) {
  try {
    const [users, posts, reports, backup] = await Promise.all([
      fetchAll('yy_users', 'id, role, plan, created_at, last_active_at, is_disabled, plan_expires_at'),
      fetchAll('yy_posts', 'id, board, visibility, hidden, created_at'),
      fetchAll('yy_post_reports', 'post_id'),
      lastBackup(),
    ]);
    const now = Date.now();
    const since = (days) => new Date(now - days * DAY).toISOString();
    const today = taipeiToday();
    const countBy = (key, keys) => Object.fromEntries(keys.map((k) => [k, users.filter((u) => (u[key] || keys[0]) === k).length]));
    const hiddenIds = new Set(posts.filter((p) => p.hidden).map((p) => p.id));
    const reportedIds = new Set(reports.map((r) => r.post_id));
    return res.json({
      users: {
        total: users.length,
        active7: users.filter((u) => u.last_active_at && u.last_active_at >= since(7)).length,
        active30: users.filter((u) => u.last_active_at && u.last_active_at >= since(30)).length,
        new7: users.filter((u) => u.created_at >= since(7)).length,
        new30: users.filter((u) => u.created_at >= since(30)).length,
        disabled: users.filter((u) => u.is_disabled).length,
        expiring: users.filter((u) => expiryState(u, today) === 'expiring').length,
        expired: users.filter((u) => expiryState(u, today) === 'expired').length,
        byRole: countBy('role', ROLES),
        byPlan: countBy('plan', PLANS),
      },
      posts: {
        total: posts.length,
        public: posts.filter((p) => p.visibility === 'public').length,
        new7: posts.filter((p) => p.created_at >= since(7)).length,
        byBoard: Object.fromEntries(['mood', 'finance', 'wish'].map((b) => [b, posts.filter((p) => p.board === b && p.visibility === 'public').length])),
        hidden: hiddenIds.size,
        reported: [...reportedIds].filter((id) => !hiddenIds.has(id)).length,
      },
      backup,
    });
  } catch (err) {
    return fail(res, 'overview', err, 'Failed to load overview');
  }
}

// ---------- 使用者 ----------
async function listUsers(req, res) {
  try {
    const { q = '', role = '', plan = '', status = '' } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const today = taipeiToday();
    let users = await fetchAll('yy_users', USER_COLUMNS);
    const kw = String(q).trim().toLowerCase();
    if (kw) {
      users = users.filter((u) => u.id.toLowerCase() === kw || u.id.toLowerCase().startsWith(kw)
        || (u.email || '').toLowerCase().includes(kw) || (u.username || '').toLowerCase().includes(kw));
    }
    if (ROLES.includes(role)) users = users.filter((u) => (u.role || 'user') === role);
    if (PLANS.includes(plan)) users = users.filter((u) => (u.plan || 'free') === plan);
    if (status === 'disabled') users = users.filter((u) => u.is_disabled);
    if (status === 'active') users = users.filter((u) => !u.is_disabled);
    if (status === 'expiring' || status === 'expired') users = users.filter((u) => expiryState(u, today) === status);
    users.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    const total = users.length;
    const rows = users.slice((page - 1) * USER_PAGE, page * USER_PAGE).map((u) => ({ ...u, expiry: expiryState(u, today) }));
    return res.json({ users: rows, total, page, pageSize: USER_PAGE });
  } catch (err) {
    return fail(res, 'listUsers', err, 'Failed to load users');
  }
}

async function updateUser(req, res) {
  try {
    const id = req.params.id;
    const b = req.body || {};
    const updates = {};
    if (b.role !== undefined) {
      if (!ROLES.includes(b.role)) return res.status(400).json({ error: '身份不正確' });
      updates.role = b.role;
    }
    if (b.plan !== undefined) {
      if (!PLANS.includes(b.plan)) return res.status(400).json({ error: '方案不正確' });
      updates.plan = b.plan;
    }
    for (const k of ['last_payment_date', 'plan_expires_at']) {
      if (b[k] === undefined) continue;
      if (b[k] === null || b[k] === '') updates[k] = null;
      else if (DATE_RE.test(b[k])) updates[k] = b[k];
      else return res.status(400).json({ error: '日期格式不正確' });
    }
    if (b.is_disabled !== undefined) {
      updates.is_disabled = !!b.is_disabled;
      updates.disabled_at = b.is_disabled ? new Date().toISOString() : null;
      updates.disabled_reason = b.is_disabled ? String(b.disabled_reason || '').trim().slice(0, 300) || null : null;
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: '沒有要更新的內容' });

    // 不能把自己降級或停用,避免把自己鎖在後台外
    if (id === req.user.id && ((updates.role && updates.role !== 'admin') || updates.is_disabled)) {
      return res.status(400).json({ error: '不能停用自己或移除自己的管理員身份' });
    }

    const { data, error } = await supabase.from('yy_users').update(updates).eq('id', id).select(USER_COLUMNS).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: '找不到這位使用者' });
    forgetUserStatus(id);
    return res.json({ user: { ...data, expiry: expiryState(data, taipeiToday()) } });
  } catch (err) {
    return fail(res, 'updateUser', err, 'Failed to update user');
  }
}

// ---------- 公告 ----------
function annPayload(b, partial) {
  const out = {};
  if (!partial || b.title !== undefined) {
    const title = String(b.title || '').trim().slice(0, 120);
    if (!title) return { error: '請輸入標題' };
    out.title = title;
  }
  if (!partial || b.content !== undefined) {
    const content = String(b.content || '').trim().slice(0, 5000);
    if (!content) return { error: '請輸入內容' };
    out.content = content;
  }
  if (b.is_important !== undefined) out.is_important = !!b.is_important;
  if (b.published_at !== undefined && b.published_at !== null && b.published_at !== '') {
    const d = new Date(b.published_at);
    if (Number.isNaN(d.getTime())) return { error: '發布時間格式不正確' };
    out.published_at = d.toISOString();
  } else if (!partial) {
    out.published_at = new Date().toISOString();
  }
  return { out };
}

async function listAnnouncements(req, res) {
  try {
    const { data, error } = await supabase.from('yy_announcements').select('*').order('published_at', { ascending: false }).limit(200);
    if (error) throw error;
    return res.json({ announcements: data });
  } catch (err) {
    return fail(res, 'listAnnouncements', err, 'Failed to load announcements');
  }
}

async function createAnnouncement(req, res) {
  try {
    const { out, error: bad } = annPayload(req.body || {}, false);
    if (bad) return res.status(400).json({ error: bad });
    const { data, error } = await supabase.from('yy_announcements').insert(out).select().single();
    if (error) throw error;
    return res.status(201).json({ announcement: data });
  } catch (err) {
    return fail(res, 'createAnnouncement', err, 'Failed to create announcement');
  }
}

async function updateAnnouncement(req, res) {
  try {
    const { out, error: bad } = annPayload(req.body || {}, true);
    if (bad) return res.status(400).json({ error: bad });
    if (Object.keys(out).length === 0) return res.status(400).json({ error: '沒有要更新的內容' });
    const { data, error } = await supabase.from('yy_announcements').update(out).eq('id', req.params.id).select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: '找不到這則公告' });
    return res.json({ announcement: data });
  } catch (err) {
    return fail(res, 'updateAnnouncement', err, 'Failed to update announcement');
  }
}

async function deleteAnnouncement(req, res) {
  try {
    const { error } = await supabase.from('yy_announcements').delete().eq('id', req.params.id);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'deleteAnnouncement', err, 'Failed to delete announcement');
  }
}

// ---------- 檢舉與社群 ----------
async function authorsOf(ids) {
  if (ids.length === 0) return {};
  const { data, error } = await supabase.from('yy_users').select('id, email, username').in('id', ids);
  if (error) throw error;
  return Object.fromEntries(data.map((u) => [u.id, u]));
}

async function listReports(req, res) {
  try {
    const { filter = 'all' } = req.query; // all | hidden | reported
    const { data: reports, error: rErr } = await supabase.from('yy_post_reports').select('*').order('created_at', { ascending: false }).limit(1000);
    if (rErr) throw rErr;
    const { data: hiddenPosts, error: hErr } = await supabase.from('yy_posts').select('id').eq('hidden', true).limit(500);
    if (hErr) throw hErr;
    const ids = [...new Set([...reports.map((r) => r.post_id), ...hiddenPosts.map((p) => p.id)])];
    if (ids.length === 0) return res.json({ posts: [] });
    const { data: posts, error: pErr } = await supabase.from('yy_posts').select('*').in('id', ids);
    if (pErr) throw pErr;
    const people = await authorsOf([...new Set([...posts.map((p) => p.user_id), ...reports.map((r) => r.user_id)])]);
    let list = posts.map((p) => {
      const rs = reports.filter((r) => r.post_id === p.id);
      return {
        ...p,
        author: people[p.user_id] || null,
        report_count: rs.length,
        last_report_at: rs[0]?.created_at || null,
        reports: rs.map((r) => ({ reason: r.reason, created_at: r.created_at, reporter: people[r.user_id] || null })),
      };
    });
    if (filter === 'hidden') list = list.filter((p) => p.hidden);
    if (filter === 'reported') list = list.filter((p) => !p.hidden);
    list.sort((a, b) => (b.last_report_at || b.created_at).localeCompare(a.last_report_at || a.created_at));
    return res.json({ posts: list });
  } catch (err) {
    return fail(res, 'listReports', err, 'Failed to load reports');
  }
}

// 隱藏 / 恢復文章。恢復時一併清掉檢舉紀錄,避免下一次檢舉立刻又被隱藏
async function setPostHidden(req, res) {
  try {
    const hidden = !!req.body?.hidden;
    const { data, error } = await supabase.from('yy_posts').update({ hidden }).eq('id', req.params.id).select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: '找不到這篇文章' });
    if (!hidden) {
      const { error: dErr } = await supabase.from('yy_post_reports').delete().eq('post_id', data.id);
      if (dErr) throw dErr;
    }
    return res.json({ post: data });
  } catch (err) {
    return fail(res, 'setPostHidden', err, 'Failed to update post');
  }
}

async function deletePost(req, res) {
  try {
    const { error } = await supabase.from('yy_posts').delete().eq('id', req.params.id);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'deletePost', err, 'Failed to delete post');
  }
}

async function listWishes(req, res) {
  try {
    const { status = 'all' } = req.query; // all | none | considering | planned | done
    let q = supabase.from('yy_posts').select('*').eq('board', 'wish').eq('visibility', 'public').order('created_at', { ascending: false }).limit(300);
    if (WISH_STATUSES.includes(status)) q = q.eq('wish_status', status);
    if (status === 'none') q = q.is('wish_status', null);
    const { data, error } = await q;
    if (error) throw error;
    const people = await authorsOf([...new Set(data.map((p) => p.user_id))]);
    return res.json({ posts: data.map((p) => ({ ...p, author: people[p.user_id] || null })) });
  } catch (err) {
    return fail(res, 'listWishes', err, 'Failed to load wishes');
  }
}

async function setWishStatus(req, res) {
  try {
    const { wish_status } = req.body || {};
    if (wish_status !== null && !WISH_STATUSES.includes(wish_status)) return res.status(400).json({ error: '狀態不正確' });
    const { data, error } = await supabase.from('yy_posts').update({ wish_status }).eq('id', req.params.id).eq('board', 'wish').select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: '找不到這篇許願' });
    return res.json({ post: data });
  } catch (err) {
    return fail(res, 'setWishStatus', err, 'Failed to update status');
  }
}

module.exports = {
  me, overview, listUsers, updateUser,
  listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  listReports, setPostHidden, deletePost, listWishes, setWishStatus,
};
