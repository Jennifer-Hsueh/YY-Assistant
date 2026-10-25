// 還沒登入時點了好友邀請連結:先記住好友碼,登入或註冊完再帶去加好友
const KEY = 'yy_pending_friend';

export function savePendingInvite(code) {
  try { if (code) localStorage.setItem(KEY, code); } catch { /* ignore */ }
}
export function takePendingInvite() {
  try { const c = localStorage.getItem(KEY); localStorage.removeItem(KEY); return c; } catch { return null; }
}
// 登入或註冊後要去的頁面
export function afterAuthPath(fallback = '/') {
  const c = takePendingInvite();
  return c ? `/add-friend?code=${encodeURIComponent(c)}` : fallback;
}
