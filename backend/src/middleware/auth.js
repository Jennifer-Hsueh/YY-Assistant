const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

// 帳號狀態快取:每位使用者最多 60 秒查一次資料庫(停用 / 最後上線時間)
const STATUS_TTL_MS = 60 * 1000;
const ACTIVE_TOUCH_MS = 60 * 60 * 1000; // 最後上線時間最多每小時更新一次
const statusCache = new Map();

function forgetUserStatus(userId) {
  statusCache.delete(userId);
}

async function loadStatus(userId) {
  const hit = statusCache.get(userId);
  if (hit && Date.now() - hit.at < STATUS_TTL_MS) return hit;
  const { data, error } = await supabase
    .from('yy_users')
    .select('id, is_disabled, last_active_at')
    .eq('id', userId)
    .maybeSingle();
  // 查詢失敗(例如欄位還沒建立)時不擋人,也不快取
  if (error) throw new Error(error.message);
  const entry = { at: Date.now(), exists: !!data, disabled: !!data?.is_disabled };
  statusCache.set(userId, entry);
  if (data && !data.is_disabled) {
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

module.exports = { requireAuth, requireAdmin, forgetUserStatus };
