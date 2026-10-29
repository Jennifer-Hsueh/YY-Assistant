const crypto = require('crypto');
const supabase = require('../config/supabase');
const { forgetUserStatus } = require('../middleware/auth');
const { BUCKET } = require('../services/backupService');
const R = require('../services/restoreService');
const communityImages = require('../services/communityImages');
const paymentProofs = require('../services/paymentProofs');
const { sendPushToUser } = require('../services/fcmService');
const E = require('../lib/entitlements');
const M = require('../services/moderation');
const { sendEmail } = require('../services/emailService');
const beta = require('../lib/beta');
const founding = require('../lib/founding');
const zlib = require('zlib');
const { buildSnapshot, ensureBucket } = require('../services/backupService');
const { USER_TABLES } = require('../services/restoreService');

// 管理後台 API。所有路由都先經過 requireAuth + requireAdmin。
const ROLES = ['user', 'tester', 'admin'];
const PLANS = E.PLANS;
const WISH_STATUSES = ['considering', 'planned', 'done'];
const USER_COLUMNS = 'id, email, username, role, plan, addon_community, basic_choice, basic_choice_changed_at, trial_ends_at, last_payment_date, plan_expires_at, created_at, last_active_at, is_disabled, disabled_reason, disabled_at, community_suspended_until, founding_member, founding_marked_at, founding_granted_at';
const USER_PAGE = 50;
const EXPIRING_DAYS = 30;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// 網路銷售勞務每月銷售額未達 5 萬元可暫免稅籍登記(2025-01-01 起);超過 4 萬元先提醒
const REVENUE_LIMIT = 50000;
const REVENUE_WARN = 40000;
async function monthRevenue(month) {
  const [y, m] = month.split('-').map(Number);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const { data, error } = await supabase.from('yy_payments').select('amount').gte('paid_at', `${month}-01`).lt('paid_at', next);
  if (error) throw error;
  return (data || []).reduce((s, p) => s + Number(p.amount || 0), 0);
}
const revenueInfo = (month, total) => ({ month, total, warn: REVENUE_WARN, limit: REVENUE_LIMIT, level: total >= REVENUE_LIMIT ? 'over' : total >= REVENUE_WARN ? 'warn' : 'ok' });

const DAY = 24 * 60 * 60 * 1000;
const taipeiToday = () => E.taipeiDate();

const escapeHtml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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

// 列表用的方案摘要
function summarize(u, today) {
  const ent = E.computeEntitlements(u, today);
  let expiry = null;
  if (ent.status === 'active' && ent.days_left !== null && ent.days_left <= EXPIRING_DAYS) expiry = 'expiring';
  if (ent.status === 'grace') expiry = 'grace';
  if (ent.status === 'basic' && ent.expired) expiry = 'expired';
  return { status: ent.status, days_left: ent.days_left, trial_ends_at: ent.trial_ends_at, grace_ends_at: ent.grace_ends_at, features: ent.features, expiry };
}

function publicUser(u, today) {
  const { basic_choice_changed_at, ...rest } = u;
  return { ...rest, ent: summarize(u, today) };
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
    const bugQ = supabase.from('yy_bug_reports').select('id', { count: 'exact', head: true }).eq('status', 'new');
    const [users, posts, reports, backup, bugs] = await Promise.all([
      fetchAll('yy_users', '*'),
      fetchAll('yy_posts', 'id, board, visibility, hidden, created_at'),
      fetchAll('yy_post_reports', 'post_id'),
      lastBackup(),
      bugQ.then((r) => r, () => ({ count: null })),
    ]);
    const now = Date.now();
    const since = (days) => new Date(now - days * DAY).toISOString();
    const today = taipeiToday();
    const countBy = (key, keys) => Object.fromEntries(keys.map((k) => [k, users.filter((u) => (u[key] || keys[0]) === k).length]));
    const sums = users.map((u) => ({ u, e: summarize(u, today) }));
    const byStatus = Object.fromEntries(['trial', 'basic', 'active', 'grace', 'staff'].map((k) => [k, sums.filter((x) => x.e.status === k).length]));
    const paying = sums.filter((x) => x.e.status === 'active' || x.e.status === 'grace');
    const byPlan = Object.fromEntries(E.PAID_PLANS.map((k) => [k, paying.filter((x) => x.u.plan === k).length]));
    const basicChoice = { ledger: 0, calendar: 0, none: 0 };
    sums.filter((x) => x.e.status === 'basic').forEach((x) => { basicChoice[x.u.basic_choice || 'none'] += 1; });
    const hiddenIds = new Set(posts.filter((p) => p.hidden).map((p) => p.id));
    const reportedIds = new Set(reports.map((r) => r.post_id));
    const curMonth = taipeiToday().slice(0, 7);
    const revenue = revenueInfo(curMonth, await monthRevenue(curMonth).catch(() => 0));
    const { count: payPending } = await supabase.from('yy_payment_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    return res.json({
      revenue,
      paymentReportsPending: payPending || 0,
      users: {
        total: users.length,
        active7: users.filter((u) => u.last_active_at && u.last_active_at >= since(7)).length,
        active30: users.filter((u) => u.last_active_at && u.last_active_at >= since(30)).length,
        new7: users.filter((u) => u.created_at >= since(7)).length,
        new30: users.filter((u) => u.created_at >= since(30)).length,
        disabled: users.filter((u) => u.is_disabled).length,
        expiring: sums.filter((x) => x.e.expiry === 'expiring').length,
        grace: byStatus.grace,
        expired: sums.filter((x) => x.e.expiry === 'expired').length,
        trialEnding: sums.filter((x) => x.e.status === 'trial' && x.e.days_left <= EXPIRING_DAYS).length,
        byRole: countBy('role', ROLES),
        byStatus,
        byPlan,
        addonCommunity: paying.filter((x) => x.u.addon_community && E.ADDON_PLANS.includes(x.u.plan)).length,
        basicChoice,
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
      bugsNew: bugs?.count ?? null,
    });
  } catch (err) {
    return fail(res, 'overview', err, 'Failed to load overview');
  }
}

// ---------- 使用者 ----------
async function listUsers(req, res) {
  try {
    const { q = '', role = '', plan = '', status = '', exp_from = '', exp_to = '' } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const today = taipeiToday();
    let users = (await fetchAll('yy_users', USER_COLUMNS)).map((u) => ({ u, e: summarize(u, today) }));
    const kw = String(q).trim().toLowerCase();
    if (kw) {
      users = users.filter(({ u }) => u.id.toLowerCase().startsWith(kw)
        || (u.email || '').toLowerCase().includes(kw) || (u.username || '').toLowerCase().includes(kw));
    }
    if (ROLES.includes(role)) users = users.filter(({ u }) => (u.role || 'user') === role);
    if (PLANS.includes(plan)) users = users.filter(({ u }) => (u.plan || 'basic') === plan);
    if (status === 'disabled') users = users.filter(({ u }) => u.is_disabled);
    if (status === 'founding') users = users.filter(({ u }) => u.founding_member);
    if (['trial', 'basic', 'active', 'grace', 'staff'].includes(status)) users = users.filter(({ e }) => e.status === status);
    if (status === 'expiring' || status === 'expired') users = users.filter(({ e }) => e.expiry === status);
    if (status === 'trial_ending') users = users.filter(({ e }) => e.status === 'trial' && e.days_left <= EXPIRING_DAYS);
    // 依權限截止日查詢
    if (DATE_RE.test(exp_from)) users = users.filter(({ u }) => u.plan_expires_at && u.plan_expires_at >= exp_from);
    if (DATE_RE.test(exp_to)) users = users.filter(({ u }) => u.plan_expires_at && u.plan_expires_at <= exp_to);
    if (DATE_RE.test(exp_from) || DATE_RE.test(exp_to)) users.sort((a, b) => a.u.plan_expires_at.localeCompare(b.u.plan_expires_at));
    else users.sort((a, b) => (b.u.created_at || '').localeCompare(a.u.created_at || ''));
    const total = users.length;
    const rows = users.slice((page - 1) * USER_PAGE, page * USER_PAGE).map(({ u }) => publicUser(u, today));
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
    if (b.addon_community !== undefined) updates.addon_community = !!b.addon_community;
    if (b.founding_member !== undefined) {
      updates.founding_member = !!b.founding_member;
      updates.founding_marked_at = b.founding_member ? new Date().toISOString() : null;
    }
    if (b.basic_choice !== undefined) {
      if (b.basic_choice !== null && !['ledger', 'calendar'].includes(b.basic_choice)) return res.status(400).json({ error: '基本功能選項不正確' });
      updates.basic_choice = b.basic_choice; // 管理員代為更換不受每月一次的限制
    }
    for (const k of ['last_payment_date', 'plan_expires_at', 'trial_ends_at']) {
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

    const { data: before } = await supabase.from('yy_users').select('is_disabled').eq('id', id).maybeSingle();
    const { data, error } = await supabase.from('yy_users').update(updates).eq('id', id).select(USER_COLUMNS).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: '找不到這位使用者' });
    forgetUserStatus(id);
    // 停用/恢復:留紀錄;停用時寄 Email 通知(寄信失敗不影響停用)
    if (updates.is_disabled !== undefined && !!before?.is_disabled !== updates.is_disabled) {
      await M.logAction({ user_id: id, action: updates.is_disabled ? 'disable' : 'enable', reason: updates.disabled_reason || null, created_by: req.user.id });
      if (updates.is_disabled && data.email) {
        const reason = updates.disabled_reason ? `<p>原因：${escapeHtml(updates.disabled_reason)}</p>` : '';
        sendEmail({
          to: data.email,
          subject: '[YY手帳] 您的帳號已停用',
          html: `<div style="font-family:sans-serif;line-height:1.6"><p>您好，</p><p>您的 YY手帳 帳號已依使用條款第 12 條停用，暫時無法登入。</p>${reason}<p>${M.appealText()}</p></div>`,
        }).catch((e) => console.error('[adminController.updateUser] disable email failed', e));
      }
    }
    return res.json({ user: publicUser(data, taipeiToday()) });
  } catch (err) {
    return fail(res, 'updateUser', err, 'Failed to update user');
  }
}

// ---------- 測試版名額 ----------
async function getBetaSettings(req, res) {
  try {
    const [b, f] = await Promise.all([beta.betaStatus(), founding.stats()]);
    return res.json({ beta: b, founding: f });
  } catch (err) {
    return fail(res, 'getBetaSettings', err, '讀取測試設定失敗');
  }
}
async function updateBetaSettings(req, res) {
  try {
    const b = req.body || {};
    const updates = {};
    if (b.limit !== undefined) {
      const n = Number(b.limit);
      if (!Number.isInteger(n) || n < 1 || n > 100000) return res.status(400).json({ error: '名額請輸入 1 以上的整數' });
      updates.limit = n;
    }
    if (b.open !== undefined) updates.open = !!b.open;
    if (b.active !== undefined) updates.active = !!b.active;
    if (b.ends_at !== undefined) {
      if (b.ends_at === null || b.ends_at === '') updates.ends_at = null;
      else if (beta.DATE_RE.test(b.ends_at)) updates.ends_at = b.ends_at;
      else return res.status(400).json({ error: '日期格式不正確' });
    }
    const { before, status } = await beta.setBeta(updates);
    // 設定(或修改)測試結束日:自動發一則公開的重要公告
    if (updates.ends_at && updates.ends_at !== before.ends_at) {
      const d = updates.ends_at.replace(/-/g, '/');
      const { error } = await supabase.from('yy_announcements').insert({
        title: `測試版將於 ${d} 結束`,
        content: `感謝大家參與 YY手帳 測試！測試版將於 ${d} 結束，結束後測試期間的資料會清除。\n請在結束前到「設定 → 資料匯出／備份」下載備份檔，保留你的記帳與行程資料。`,
        is_important: true,
        published_at: new Date().toISOString(),
      });
      if (error) console.error('[adminController.updateBetaSettings] announce failed', error);
    }
    return res.json({ beta: status });
  } catch (err) {
    return fail(res, 'updateBetaSettings', err, '更新測試設定失敗');
  }
}

// 刪除勾選的使用者(帳號與所有資料、社群照片;管理員與自己不會被刪)
async function bulkDeleteUsers(req, res) {
  try {
    const { ids, confirm } = req.body || {};
    if (confirm !== '刪除') return res.status(400).json({ error: '請輸入「刪除」確認' });
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: '請勾選要刪除的使用者' });
    if (ids.length > 500) return res.status(400).json({ error: '一次最多刪除 500 位' });
    const { data: users, error } = await supabase.from('yy_users').select('id, email, role').in('id', ids);
    if (error) throw error;
    const targets = (users || []).filter((u) => u.role !== 'admin' && u.id !== req.user.id);
    for (const u of targets) {
      await supabase.from('yy_payments').update({ user_email: u.email }).eq('user_id', u.id);
      await require('../lib/ledgers').handOverShared(u.id);
      const { error: dErr } = await supabase.from('yy_users').delete().eq('id', u.id);
      if (dErr) throw dErr;
      forgetUserStatus(u.id);
      await communityImages.removeUserFolder(u.id);
    }
    console.log(`[adminController.bulkDeleteUsers] admin ${req.user.id} deleted ${targets.length} users`);
    return res.json({ deleted: targets.length, skipped: ids.length - targets.length });
  } catch (err) {
    return fail(res, 'bulkDeleteUsers', err, '刪除失敗');
  }
}

// 測試結束:先備份全站資料(beta-end/,不會自動刪除),再清空所有非管理員使用者輸入的資料
// 帳號本身、方案、繳費、公告、故障通報、處置紀錄保留
async function clearBetaData(req, res) {
  try {
    if ((req.body || {}).confirm !== '清空測試資料') return res.status(400).json({ error: '請輸入「清空測試資料」確認' });
    // 清空前先標記創始會員(資格看測試期間的資料筆數,清空後就算不出來了)
    const { marked } = await founding.markEligible();
    await ensureBucket();
    const snap = await buildSnapshot('beta-end');
    const ts = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
    const path = `beta-end/yy-beta-end-${ts}.json.gz`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, zlib.gzipSync(Buffer.from(JSON.stringify(snap))), { contentType: 'application/gzip', upsert: true });
    if (upErr) throw upErr;

    const users = await fetchAll('yy_users', 'id, role');
    const ids = users.filter((u) => u.role !== 'admin').map((u) => u.id);
    const counts = {};
    // 子資料先刪(回應、留言、檢舉 → 文章 → 其他)
    const order = ['yy_post_reactions', 'yy_post_comments', 'yy_post_reports', ...USER_TABLES.filter((t) => !['yy_post_reactions', 'yy_post_comments', 'yy_post_reports'].includes(t))];
    for (const table of order) {
      counts[table] = 0;
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { data, error } = await supabase.from(table).delete().in('user_id', chunk).select('user_id');
        if (error) throw error;
        counts[table] += (data || []).length;
      }
    }
    for (const id of ids) await communityImages.removeUserFolder(id);
    for (const id of ids) forgetUserStatus(id);
    console.log('[adminController.clearBetaData]', { path, users: ids.length, counts });
    return res.json({ backup: path, users: ids.length, counts, founding_marked: marked });
  } catch (err) {
    return fail(res, 'clearBetaData', err, '清空失敗(已完成的部分不會還原,可用備份還原)');
  }
}

// ---------- 使用者檢舉(好友功能) ----------
async function listUserReports(req, res) {
  try {
    const status = req.query.status === 'done' ? 'done' : 'new';
    const { data, error } = await supabase.from('yy_user_reports').select('*').eq('status', status).order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    const ids = [...new Set((data || []).flatMap((r) => [r.reporter_id, r.reported_id]))];
    const { data: users, error: uErr } = ids.length ? await supabase.from('yy_users').select('id, email, username, is_disabled').in('id', ids) : { data: [] };
    if (uErr) throw uErr;
    const map = new Map((users || []).map((u) => [u.id, u]));
    // 同一位被檢舉者累計被檢舉次數
    const { data: all, error: aErr } = await supabase.from('yy_user_reports').select('reported_id');
    if (aErr) throw aErr;
    const times = {};
    for (const r of all || []) times[r.reported_id] = (times[r.reported_id] || 0) + 1;
    return res.json({ reports: (data || []).map((r) => ({ ...r, reporter: map.get(r.reporter_id) || null, reported: map.get(r.reported_id) || null, reported_times: times[r.reported_id] || 0 })) });
  } catch (err) {
    return fail(res, 'listUserReports', err, '讀取使用者檢舉失敗');
  }
}
async function updateUserReport(req, res) {
  try {
    const status = req.body?.status === 'new' ? 'new' : 'done';
    const { data, error } = await supabase.from('yy_user_reports').update({ status }).eq('id', req.params.id).select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: '找不到這筆檢舉' });
    return res.json({ report: data });
  } catch (err) {
    return fail(res, 'updateUserReport', err, '更新失敗');
  }
}

// ---------- 創始會員 ----------
async function markFounding(req, res) {
  try {
    const r = await founding.markEligible();
    return res.json({ ...r, founding: await founding.stats() });
  } catch (err) {
    return fail(res, 'markFounding', err, '標記失敗');
  }
}
// 正式上線後才能發放(一年從發放日起算)
async function grantFounding(req, res) {
  try {
    if ((await beta.betaStatus()).active) return res.status(400).json({ error: '請先結束測試版(正式上線)再發放' });
    const r = await founding.grantAll(req.user.id, forgetUserStatus);
    return res.json({ ...r, founding: await founding.stats() });
  } catch (err) {
    return fail(res, 'grantFounding', err, '發放失敗(已發放的部分會保留,可再按一次補發)');
  }
}

// ---------- 違規處理(條款第 12 條):警告、暫停社群、解除暫停、處置紀錄 ----------
async function moderateUser(req, res) {
  try {
    const { action } = req.body || {};
    const reason = String(req.body?.reason || '').trim().slice(0, 300);
    const { data: user, error } = await supabase.from('yy_users').select('id, role').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!user) return res.status(404).json({ error: '找不到這位使用者' });
    if (user.id === req.user.id) return res.status(400).json({ error: '不能處置自己' });
    let updates = null;
    if (action === 'warn') {
      if (!reason) return res.status(400).json({ error: '請填寫原因' });
      await M.logAction({ user_id: user.id, action: 'warn', reason, created_by: req.user.id });
      await M.notifyUser(user.id, '社群使用警告',
        `您在社群的行為違反了社群規範（使用條款第 10 條）。\n原因：${reason}\n請遵守社群規範；再次違規將暫停社群功能。\n${M.appealText()}`);
    } else if (action === 'suspend') {
      const days = Number(req.body?.days);
      if (!M.SUSPEND_DAYS.includes(days)) return res.status(400).json({ error: '暫停天數不正確' });
      if (!reason) return res.status(400).json({ error: '請填寫原因' });
      const until = new Date(Date.now() + days * DAY).toISOString();
      updates = { community_suspended_until: until };
      await M.logAction({ user_id: user.id, action: 'suspend', reason, days, until, created_by: req.user.id });
      await M.notifyUser(user.id, '社群功能暫停通知',
        `您在社群的行為違反了社群規範（使用條款第 10 條），依第 12 條暫停社群功能 ${days} 天，到 ${M.fmtDate(until)} 為止。期間不能公開發文、留言或回應，記帳、行事曆等功能照常。\n原因：${reason}\n${M.appealText()}`);
    } else if (action === 'lift') {
      updates = { community_suspended_until: null };
      await M.logAction({ user_id: user.id, action: 'lift', reason: reason || null, created_by: req.user.id });
      await M.notifyUser(user.id, '社群功能已恢復', '您的社群功能已恢復，可以正常發文、留言與回應。');
    } else {
      return res.status(400).json({ error: '處置項目不正確' });
    }
    let row = null;
    if (updates) {
      const { data, error: uErr } = await supabase.from('yy_users').update(updates).eq('id', user.id).select(USER_COLUMNS).single();
      if (uErr) throw uErr;
      row = data;
    } else {
      const { data } = await supabase.from('yy_users').select(USER_COLUMNS).eq('id', user.id).single();
      row = data;
    }
    return res.json({ user: publicUser(row, taipeiToday()) });
  } catch (err) {
    return fail(res, 'moderateUser', err, '處置失敗');
  }
}

async function listModeration(req, res) {
  try {
    const { data, error } = await supabase.from('yy_moderation_actions').select('*').eq('user_id', req.params.id).order('created_at', { ascending: false });
    if (error) throw error;
    const count = (a) => data.filter((r) => r.action === a).length;
    return res.json({ actions: data, summary: { hide_post: count('hide_post'), warn: count('warn'), suspend: count('suspend'), disable: count('disable') } });
  } catch (err) {
    return fail(res, 'listModeration', err, '讀取處置紀錄失敗');
  }
}

// ---------- 客服:產生重設密碼連結(不寄信,由管理員用 LINE 等方式交給使用者) ----------
const ADMIN_RESET_HOURS = 24;
async function createResetLink(req, res) {
  try {
    const { data: user, error } = await supabase.from('yy_users').select('id, email').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!user) return res.status(404).json({ error: '找不到這位使用者' });
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + ADMIN_RESET_HOURS * 60 * 60 * 1000).toISOString();
    const { error: insErr } = await supabase.from('yy_password_reset_tokens').insert({ user_id: user.id, token_hash: tokenHash, expires_at: expiresAt });
    if (insErr) throw insErr;
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const url = `${appUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;
    console.log(`[adminController.createResetLink] admin ${req.user.id} created reset link for ${user.id}`);
    return res.json({ url, expires_at: expiresAt });
  } catch (err) {
    return fail(res, 'createResetLink', err, '產生連結失敗');
  }
}

// ---------- 繳費紀錄 ----------
async function listPayments(req, res) {
  try {
    const { data, error } = await supabase.from('yy_payments').select('*').eq('user_id', req.params.id).order('paid_at', { ascending: false }).limit(200);
    if (error) throw error;
    return res.json({ payments: data, prices: { monthly: E.MONTHLY_PRICE, addon: E.COMMUNITY_ADDON, yearlyDiscount: E.YEARLY_DISCOUNT } });
  } catch (err) {
    return fail(res, 'listPayments', err, 'Failed to load payments');
  }
}

// 登記一筆繳費:同時更新使用者的方案、最近付款日,並把權限截止日往後延
// 起算日:目前截止日還沒過寬限期就從截止日接續,否則從繳費日起算
// 回傳 { error } 或 { payment, updated }
async function recordPayment(user, b, adminId, extra = {}) {
  if (!E.PAID_PLANS.includes(b.plan)) return { error: '請選擇付費方案' };
  const months = parseInt(b.months, 10);
  if (!(months >= 1 && months <= 36)) return { error: '月數不正確' };
  if (!DATE_RE.test(b.paid_at || '')) return { error: '繳費日期格式不正確' };
  const addon = !!b.addon_community && E.ADDON_PLANS.includes(b.plan);
  const amount = b.amount === undefined || b.amount === '' || b.amount === null ? E.priceFor(b.plan, addon, months) : Number(b.amount);
  if (!Number.isFinite(amount) || amount < 0) return { error: '金額不正確' };

  const cur = user.plan_expires_at;
  const start = cur && E.addDays(cur, E.GRACE_DAYS) >= b.paid_at ? cur : b.paid_at;
  const newExpiry = E.addMonths(start, months);

  const { data: payment, error: pErr } = await supabase.from('yy_payments').insert({
    user_id: user.id,
    user_email: user.email,
    paid_at: b.paid_at,
    plan: b.plan,
    addon_community: addon,
    months,
    amount,
    period_start: start,
    period_end: newExpiry,
    note: String(b.note || '').trim().slice(0, 300) || null,
    created_by: adminId,
    ...extra,
  }).select().single();
  if (pErr) throw pErr;

  const { data: updated, error: upErr } = await supabase.from('yy_users').update({
    plan: b.plan,
    addon_community: addon,
    last_payment_date: b.paid_at,
    plan_expires_at: newExpiry,
  }).eq('id', user.id).select(USER_COLUMNS).single();
  if (upErr) throw upErr;
  forgetUserStatus(user.id);
  return { payment, updated };
}

async function createPayment(req, res) {
  try {
    const { data: user, error: uErr } = await supabase.from('yy_users').select(USER_COLUMNS).eq('id', req.params.id).maybeSingle();
    if (uErr) throw uErr;
    if (!user) return res.status(404).json({ error: '找不到這位使用者' });
    const r = await recordPayment(user, req.body || {}, req.user.id, { verified_at: new Date().toISOString() });
    if (r.error) return res.status(400).json({ error: r.error });
    return res.status(201).json({ payment: r.payment, user: publicUser(r.updated, taipeiToday()) });
  } catch (err) {
    return fail(res, 'createPayment', err, 'Failed to record payment');
  }
}

// 刪除紀錄(只刪紀錄,不會自動改回截止日;需要時請在使用者資料手動調整)
async function deletePayment(req, res) {
  try {
    const { error } = await supabase.from('yy_payments').delete().eq('id', req.params.paymentId).eq('user_id', req.params.id);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    return fail(res, 'deletePayment', err, 'Failed to delete payment');
  }
}

// ---------- 入帳核對與收款紀錄 ----------
const PLAN_NAME = { adv_a: '進階 A', adv_b: '進階 B', adv_c: '進階 C', full: '完整版' };
const fmtDay = (d) => String(d || '').replace(/-/g, '/');

// GET /admin/payment-reports?status=pending|approved|rejected|all
async function listPaymentReports(req, res) {
  try {
    const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : req.query.status === 'all' ? null : 'pending';
    let q = supabase.from('yy_payment_reports').select('*').order('created_at', { ascending: status === 'pending' }).limit(200);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    const ids = [...new Set((data || []).map((r) => r.user_id).filter(Boolean))];
    const users = new Map();
    if (ids.length) {
      const { data: us, error: uErr } = await supabase.from('yy_users').select('id, email, username, plan, plan_expires_at').in('id', ids);
      if (uErr) throw uErr;
      (us || []).forEach((u) => users.set(u.id, u));
    }
    const { count: pending } = await supabase.from('yy_payment_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    const reports = await Promise.all((data || []).map(async (r) => ({
      ...r,
      proof_url: await paymentProofs.signedUrl(r.proof_key),
      expected_amount: E.priceFor(r.plan, r.addon_community, r.months),
      user: users.get(r.user_id) || null,
    })));
    return res.json({ reports, pending: pending || 0 });
  } catch (err) {
    return fail(res, 'listPaymentReports', err, '讀取匯款回報失敗');
  }
}

async function reportFor(req, res) {
  const { data: r, error } = await supabase.from('yy_payment_reports').select('*').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!r) { res.status(404).json({ error: '找不到這筆回報' }); return null; }
  if (r.status !== 'pending') { res.status(400).json({ error: '這筆回報已經處理過了' }); return null; }
  return r;
}

// POST /admin/payment-reports/:id/approve { plan, addon_community, months, amount, paid_at, note }:核對無誤 → 入帳並開通
async function approvePaymentReport(req, res) {
  try {
    const r = await reportFor(req, res);
    if (!r) return undefined;
    if (!r.user_id) return res.status(400).json({ error: '這位使用者已刪除帳號' });
    const { data: user, error: uErr } = await supabase.from('yy_users').select(USER_COLUMNS).eq('id', r.user_id).maybeSingle();
    if (uErr) throw uErr;
    if (!user) return res.status(400).json({ error: '這位使用者已刪除帳號' });
    const b = req.body || {};
    const out = await recordPayment(user, {
      plan: b.plan || r.plan,
      addon_community: b.addon_community ?? r.addon_community,
      months: b.months || r.months,
      amount: b.amount ?? r.amount,
      paid_at: b.paid_at || r.paid_on,
      note: b.note ?? r.note,
    }, req.user.id, { report_id: r.id, account_last5: r.account_last5, verified_at: new Date().toISOString() });
    if (out.error) return res.status(400).json({ error: out.error });
    const now = new Date().toISOString();
    const { data: done, error: rErr } = await supabase.from('yy_payment_reports')
      .update({ status: 'approved', reviewed_by: req.user.id, reviewed_at: now, payment_id: out.payment.id }).eq('id', r.id).select().single();
    if (rErr) throw rErr;
    // App 內也會看到:只寫方案和期限,不提金額與付款方式
    const until = fmtDay(out.updated.plan_expires_at);
    const name = `${PLAN_NAME[out.payment.plan] || out.payment.plan}${out.payment.addon_community ? '＋社群' : ''}`;
    await M.notifyUser(user.id, '方案已更新', `您的方案已更新為「${name}」，使用期限到 ${until}。謝謝您的支持！`);
    sendPushToUser(user.id, { title: '方案已更新 🦫', body: `您的方案已更新，使用期限到 ${until}`, data: { url: '/settings#plan' } }).catch(() => {});
    return res.json({ report: done, payment: out.payment, user: publicUser(out.updated, taipeiToday()) });
  } catch (err) {
    return fail(res, 'approvePaymentReport', err, '入帳失敗');
  }
}

// POST /admin/payment-reports/:id/reject { reason }:對不上 → 退回並通知
async function rejectPaymentReport(req, res) {
  try {
    const r = await reportFor(req, res);
    if (!r) return undefined;
    const reason = String(req.body?.reason || '').trim().slice(0, 200);
    if (!reason) return res.status(400).json({ error: '請寫退回原因' });
    const { data: done, error } = await supabase.from('yy_payment_reports')
      .update({ status: 'rejected', reject_reason: reason, reviewed_by: req.user.id, reviewed_at: new Date().toISOString() }).eq('id', r.id).select().single();
    if (error) throw error;
    if (r.user_id) {
      await M.notifyUser(r.user_id, '回報的資料需要再確認', `您在 ${fmtDay(r.paid_on)} 回報的資料需要再確認：${reason}`);
      sendPushToUser(r.user_id, { title: '回報的資料需要再確認', body: reason, data: { url: '/settings#plan' } }).catch(() => {});
    }
    return res.json({ report: done });
  } catch (err) {
    return fail(res, 'rejectPaymentReport', err, '退回失敗');
  }
}

// GET /admin/payments?month=YYYY-MM:收款紀錄(全部使用者),依繳費日;不給月份就是最近 500 筆
async function listAllPayments(req, res) {
  try {
    let q = supabase.from('yy_payments').select('*').order('paid_at', { ascending: false }).limit(500);
    const m = /^(\d{4})-(\d{2})$/.exec(String(req.query.month || ''));
    if (m) {
      const next = new Date(Date.UTC(+m[1], +m[2], 1)).toISOString().slice(0, 10);
      q = q.gte('paid_at', `${m[1]}-${m[2]}-01`).lt('paid_at', next);
    }
    const { data, error } = await q;
    if (error) throw error;
    const ids = [...new Set((data || []).flatMap((p) => [p.user_id, p.created_by]).filter(Boolean))];
    const names = new Map();
    if (ids.length) {
      const { data: us, error: uErr } = await supabase.from('yy_users').select('id, email, username').in('id', ids);
      if (uErr) throw uErr;
      (us || []).forEach((u) => names.set(u.id, u));
    }
    const payments = (data || []).map((p) => ({
      ...p,
      user_name: names.get(p.user_id)?.username || null,
      email: names.get(p.user_id)?.email || p.user_email || null,
      verified_by_name: names.get(p.created_by)?.username || names.get(p.created_by)?.email || null,
    }));
    const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    return res.json({ payments, total, count: payments.length, revenue: m ? revenueInfo(`${m[1]}-${m[2]}`, total) : null });
  } catch (err) {
    return fail(res, 'listAllPayments', err, '讀取收款紀錄失敗');
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

// 發放對象:null = 公開;否則只有那位使用者看得到
async function resolveTarget(b) {
  if (b.target_user_id === undefined) return {};
  if (b.target_user_id === null || b.target_user_id === '') return { value: null };
  const { data } = await supabase.from('yy_users').select('id').eq('id', String(b.target_user_id)).maybeSingle();
  return data ? { value: data.id } : { error: '找不到發放對象的使用者' };
}

async function withTargets(list) {
  const people = await authorsOf([...new Set(list.map((a) => a.target_user_id).filter(Boolean))]);
  return list.map((a) => ({ ...a, target: a.target_user_id ? people[a.target_user_id] || null : null }));
}

async function listAnnouncements(req, res) {
  try {
    const { data, error } = await supabase.from('yy_announcements').select('*').order('published_at', { ascending: false }).limit(200);
    if (error) throw error;
    return res.json({ announcements: await withTargets(data) });
  } catch (err) {
    return fail(res, 'listAnnouncements', err, 'Failed to load announcements');
  }
}

async function createAnnouncement(req, res) {
  try {
    const { out, error: bad } = annPayload(req.body || {}, false);
    if (bad) return res.status(400).json({ error: bad });
    const target = await resolveTarget(req.body || {});
    if (target.error) return res.status(400).json({ error: target.error });
    out.target_user_id = target.value ?? null;
    const { data, error } = await supabase.from('yy_announcements').insert(out).select().single();
    if (error) throw error;
    const [announcement] = await withTargets([data]);
    return res.status(201).json({ announcement });
  } catch (err) {
    return fail(res, 'createAnnouncement', err, 'Failed to create announcement');
  }
}

async function updateAnnouncement(req, res) {
  try {
    const { out, error: bad } = annPayload(req.body || {}, true);
    if (bad) return res.status(400).json({ error: bad });
    const target = await resolveTarget(req.body || {});
    if (target.error) return res.status(400).json({ error: target.error });
    if ('value' in target) out.target_user_id = target.value;
    if (Object.keys(out).length === 0) return res.status(400).json({ error: '沒有要更新的內容' });
    const { data, error } = await supabase.from('yy_announcements').update(out).eq('id', req.params.id).select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: '找不到這則公告' });
    const [announcement] = await withTargets([data]);
    return res.json({ announcement });
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
    let list = (await communityImages.signPosts(posts)).map((p) => {
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
    const reason = String(req.body?.reason || '').trim().slice(0, 300);
    const { data: before } = await supabase.from('yy_posts').select('hidden').eq('id', req.params.id).maybeSingle();
    const { data, error } = await supabase.from('yy_posts').update({ hidden }).eq('id', req.params.id).select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: '找不到這篇文章' });
    // 狀態有變,或已被檢舉自動隱藏的文章由管理員「確認違規」時,留紀錄並通知作者
    if (!!before?.hidden !== hidden || (hidden && req.body?.confirm)) {
      await M.logAction({ user_id: data.user_id, action: hidden ? 'hide_post' : 'restore_post', post_id: data.id, reason: reason || null, created_by: req.user.id });
      const label = data.title || `${String(data.content || '').slice(0, 20)}${String(data.content || '').length > 20 ? '…' : ''}`;
      if (hidden) {
        await M.notifyUser(data.user_id, '您的文章已被隱藏',
          `您發表的文章「${label}」因違反社群規範（使用條款第 10 條）已被隱藏，其他人看不到這篇文章。${reason ? `\n原因：${reason}` : ''}\n${M.appealText()}`);
      } else if (before?.hidden) {
        await M.notifyUser(data.user_id, '您的文章已恢復顯示', `您發表的文章「${label}」經審核後已恢復顯示。`);
      }
    }
    if (!hidden) {
      const { error: dErr } = await supabase.from('yy_post_reports').delete().eq('post_id', data.id);
      if (dErr) throw dErr;
    }
    const [signed] = await communityImages.signPosts([data]);
    return res.json({ post: signed });
  } catch (err) {
    return fail(res, 'setPostHidden', err, 'Failed to update post');
  }
}

async function deletePost(req, res) {
  try {
    const { data: post } = await supabase.from('yy_posts').select('images').eq('id', req.params.id).maybeSingle();
    const { error } = await supabase.from('yy_posts').delete().eq('id', req.params.id);
    if (error) throw error;
    await communityImages.removeImages(post?.images);
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
    const signed = await communityImages.signPosts(data);
    return res.json({ posts: signed.map((p) => ({ ...p, author: people[p.user_id] || null })) });
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

// ---------- 故障通報 ----------
const BUG_STATUSES = ['new', 'in_progress', 'done'];

async function listBugReports(req, res) {
  try {
    const { status = 'open' } = req.query; // open = 未處理+處理中 | new | in_progress | done | all
    let q = supabase.from('yy_bug_reports').select('*').order('created_at', { ascending: false }).limit(300);
    if (BUG_STATUSES.includes(status)) q = q.eq('status', status);
    if (status === 'open') q = q.in('status', ['new', 'in_progress']);
    const { data, error } = await q;
    if (error) throw error;
    const people = await authorsOf([...new Set(data.map((r) => r.user_id).filter(Boolean))]);
    return res.json({ reports: data.map((r) => ({ ...r, reporter: r.user_id ? people[r.user_id] || null : null })) });
  } catch (err) {
    return fail(res, 'listBugReports', err, 'Failed to load bug reports');
  }
}

async function updateBugReport(req, res) {
  try {
    const b = req.body || {};
    const updates = { updated_at: new Date().toISOString() };
    if (b.status !== undefined) {
      if (!BUG_STATUSES.includes(b.status)) return res.status(400).json({ error: '狀態不正確' });
      updates.status = b.status;
    }
    if (b.admin_note !== undefined) updates.admin_note = String(b.admin_note || '').trim().slice(0, 2000) || null;
    const { data, error } = await supabase.from('yy_bug_reports').update(updates).eq('id', req.params.id).select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: '找不到這筆通報' });
    return res.json({ report: data });
  } catch (err) {
    return fail(res, 'updateBugReport', err, 'Failed to update bug report');
  }
}

// ---------- 備份還原 ----------
const errStatus = (res, where, err, msg) => (err.status ? res.status(err.status).json({ error: err.message }) : fail(res, where, err, msg));

async function listBackups(req, res) {
  try {
    return res.json({ backups: await R.listBackups() });
  } catch (err) {
    return fail(res, 'listBackups', err, 'Failed to list backups');
  }
}

async function backupSummary(req, res) {
  try {
    const backup = await R.readBackup(req.query.path);
    const out = R.summarize(backup);
    if (req.query.user) out.userCounts = R.userCounts(backup, req.query.user);
    return res.json(out);
  } catch (err) {
    return errStatus(res, 'backupSummary', err, 'Failed to read backup');
  }
}

async function downloadBackup(req, res) {
  try {
    const raw = await R.downloadRaw(req.query.path);
    res.set('Content-Type', 'application/gzip');
    res.set('Content-Disposition', `attachment; filename="${req.query.path.split('/').pop()}"`);
    return res.send(raw);
  } catch (err) {
    return errStatus(res, 'downloadBackup', err, 'Failed to download backup');
  }
}

// 還原要再輸入一次確認文字(全站:「全站還原」;單一使用者:該使用者在備份裡的 Email)
async function restoreBackup(req, res) {
  const { path, scope, user_id, confirm } = req.body || {};
  try {
    const backup = await R.readBackup(path);
    if (scope === 'all') {
      if (confirm !== '全站還原') return res.status(400).json({ error: '確認文字不正確' });
      const result = await R.restoreAll(backup);
      console.log('[admin.restore] all from', path, 'by', req.user.id, result.counts);
      return res.json({ ok: true, ...result });
    }
    if (scope === 'user') {
      const u = (backup.tables.yy_users || []).find((x) => x.id === user_id);
      if (!u) return res.status(404).json({ error: '這份備份裡沒有這位使用者' });
      if (String(confirm || '').trim().toLowerCase() !== String(u.email).toLowerCase()) return res.status(400).json({ error: '確認文字不正確' });
      const result = await R.restoreUser(backup, user_id);
      forgetUserStatus(user_id);
      console.log('[admin.restore] user', user_id, 'from', path, 'by', req.user.id, result.counts);
      return res.json({ ok: true, ...result });
    }
    return res.status(400).json({ error: '請選擇還原範圍' });
  } catch (err) {
    if (err.safety) {
      console.error('[admin.restore] failed', err);
      return res.status(500).json({ error: `還原失敗:${err.message}。還原前的資料已存在 ${err.safety},可用它再還原一次。`, safety: err.safety });
    }
    return errStatus(res, 'restoreBackup', err, 'Failed to restore');
  }
}

module.exports = {
  listBugReports, updateBugReport, listBackups, backupSummary, downloadBackup, restoreBackup,
  getBetaSettings, updateBetaSettings, bulkDeleteUsers, clearBetaData, markFounding, grantFounding, listUserReports, updateUserReport,
  me, overview, listUsers, updateUser, createResetLink, moderateUser, listModeration, listPayments, createPayment, deletePayment,
  listPaymentReports, approvePaymentReport, rejectPaymentReport, listAllPayments,
  listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  listReports, setPostHidden, deletePost, listWishes, setWishStatus,
};
