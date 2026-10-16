// 簡易次數限制(記憶體版,不需額外套件):在時間窗內超過次數就回 429
// 伺服器重開機會歸零;單一 Render 執行個體已足夠擋下暴力猜密碼
const buckets = new Map(); // key -> { count, resetAt }

// 每 10 分鐘清掉過期的紀錄,避免記憶體一直增加
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}, 10 * 60 * 1000).unref();

function hit(key, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return b;
}

// rules: [{ name, windowMs, max, key: (req) => string | null }]
// 任何一條規則超過上限就擋下
function rateLimit(rules) {
  return (req, res, next) => {
    for (const rule of rules) {
      const k = rule.key(req);
      if (!k) continue;
      const b = hit(`${rule.name}:${k}`, rule.windowMs);
      if (b.count > rule.max) {
        const retryAfter = Math.ceil((b.resetAt - Date.now()) / 1000);
        res.set('Retry-After', String(retryAfter));
        const minutes = Math.max(1, Math.ceil(retryAfter / 60));
        return res.status(429).json({
          error: `嘗試次數過多,請約 ${minutes} 分鐘後再試`,
          retry_after: retryAfter,
        });
      }
    }
    return next();
  };
}

const MIN = 60 * 1000;
const ip = (req) => req.ip || 'unknown';
const email = (req) => (typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : null);

// 登入:同一個 email 15 分鐘 8 次;同一個 IP 15 分鐘 30 次
const loginLimit = rateLimit([
  { name: 'login-email', windowMs: 15 * MIN, max: 8, key: email },
  { name: 'login-ip', windowMs: 15 * MIN, max: 30, key: ip },
]);
// 註冊:同一個 IP 每小時 5 次
const registerLimit = rateLimit([{ name: 'register-ip', windowMs: 60 * MIN, max: 5, key: ip }]);
// 忘記密碼:同一個 email 每小時 3 次;同一個 IP 每小時 10 次
const forgotLimit = rateLimit([
  { name: 'forgot-email', windowMs: 60 * MIN, max: 3, key: email },
  { name: 'forgot-ip', windowMs: 60 * MIN, max: 10, key: ip },
]);
// 重設密碼:同一個 email 每小時 5 次;同一個 IP 每小時 15 次
const resetLimit = rateLimit([
  { name: 'reset-email', windowMs: 60 * MIN, max: 5, key: email },
  { name: 'reset-ip', windowMs: 60 * MIN, max: 15, key: ip },
]);
// 修改密碼:同一個使用者 15 分鐘 5 次(需先登入,放在 requireAuth 之後)
const changePasswordLimit = rateLimit([
  { name: 'change-pw-user', windowMs: 15 * MIN, max: 5, key: (req) => req.user?.id || null },
]);

module.exports = { rateLimit, loginLimit, registerLimit, forgotLimit, resetLimit, changePasswordLimit, _buckets: buckets };
