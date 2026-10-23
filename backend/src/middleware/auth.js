const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { computeEntitlements, has } = require('../lib/entitlements');
const { withBeta, getBeta } = require('../lib/beta');

// 帳號狀態快取:每位使用者最多 60 秒查一次資料庫(停用 / 最後上線時間)
const STATUS_TTL_MS = 60 * 1000;
const ACTIVE_TOUCH_MS = 60 * 60 * 1000; // 最後上線時間最多每小時更新一次
const statusCache = new Map();
const touchedDay = new Map(); // 使用者今天是否已記錄使用日

// 記錄「有使用的日子」(台灣日期,每人每天一筆),創始會員資格用
function touchActiveDay(userId) {
  const day = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  if (touchedDay.get(userId) === day) return;
  touchedDay.set(userId, day);
  supabase.from('yy_active_days').upsert({ user_id: userId, day }, { onConflict: 'user_id,day', ignoreDuplicates: true })
    .then(({ error }) => { if (error) touchedDay.delete(userId); }, () => touchedDay.delete(userId));
}

function forgetUserStatus(userId) {
  statusCache.delete(userId);
}

// 只留下判斷方案需要的欄位(不要把密碼雜湊放在記憶體快取裡)
function entitlementRow(u) {
  const { role, plan, plan_expires_at, addon_community, basic_choice, basic_choice_changed_at, trial_ends_at, created_at } = u;
  return { role, plan, plan_expires_at, addon_community, basic_choice, basic_choice_changed_at, trial_ends_at, created_at };
}

async function loadStatus(userId) {
  const hit = statusCache.get(userId);
  if (hit && Date.now() - hit.at < STATUS_TTL_MS) return hit;
  const { data, error } = await supabase
    .from('yy_users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  // 查詢失敗(例如欄位還沒建立)時不擋人,也不快取
  if (error) throw new Error(error.message);
  const entry = { at: Date.now(), exists: !!data, disabled: !!data?.is_disabled, row: data ? entitlementRow(data) : null };
  statusCache.set(userId, entry);
  if (data && !data.is_disabled) {
    touchActiveDay(userId);
    const last = data.last_active_at ? new Date(data.last_active_at).getTime() : 0;
    if (Date.now() - last > ACTIVE_TOUCH_MS) {
      supabase.from('yy_users').update({ last_active_at: new Date().toISOString() }).eq('id', userId)
        .then(() => {}, () => {});
    }
  }
  return entry;
}

/**
 * Verifies the Bearer token on protected routes and attaches
 * the decoded user (at minimum: { id, email }) to req.user.
 * 被管理員停用的帳號一律回 403。
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const status = await loadStatus(decoded.id);
    if (!status.exists) return res.status(401).json({ error: 'Invalid or expired token' });
    if (status.disabled) return res.status(401).json({ error: '帳號已停用', code: 'ACCOUNT_DISABLED' });
    if (status.row) req.ent = withBeta(computeEntitlements(status.row));
    getBeta().catch(() => {}); // 背景更新測試版設定(有快取)
  } catch (err) {
    // 查不到狀態時不擋住使用者(資料庫短暫異常)
    console.error('[auth.status]', err.message);
  }

  req.user = decoded;
  next();
}

// 管理後台:每次都向資料庫確認身份(不信任 token 內容)
async function requireAdmin(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('yy_users')
      .select('role, is_disabled')
      .eq('id', req.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.role !== 'admin' || data.is_disabled) {
      return res.status(403).json({ error: 'Admin only' });
    }
    next();
  } catch (err) {
    console.error('[auth.requireAdmin]', err);
    return res.status(500).json({ error: 'Failed to verify admin' });
  }
}

// 方案權限:沒有任何一個指定功能就擋下(查不到方案時不擋)
const planRequired = (res, feature) => res.status(403).json({ error: '目前的方案無法使用這個功能', code: 'PLAN_REQUIRED', feature });

function requireFeature(...anyOf) {
  return (req, res, next) => {
    if (!req.ent || anyOf.some((f) => has(req.ent, f))) return next();
    return planRequired(res, anyOf[0]);
  };
}

// 只擋寫入(GET 照常可以讀)
function writeRequires(...anyOf) {
  const check = requireFeature(...anyOf);
  return (req, res, next) => (req.method === 'GET' ? next() : check(req, res, next));
}

module.exports = { requireAuth, requireAdmin, forgetUserStatus, requireFeature, writeRequires, planRequired };
