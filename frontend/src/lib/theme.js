// 介面主題:'default'(米紙)或 'grey'(石墨灰)。
// 先存在 localStorage 讓畫面一打開就套用,登入後再以伺服器上的設定為準(Web / APP 共用)。
export const THEMES = ['default', 'grey'];
const KEY = 'yy_theme';

export function getStoredTheme() {
  try {
    const v = localStorage.getItem(KEY);
    return THEMES.includes(v) ? v : 'default';
  } catch {
    return 'default';
  }
}

export function applyTheme(theme) {
  const name = THEMES.includes(theme) ? theme : 'default';
  const root = document.documentElement;
  if (name === 'default') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', name);
  try { localStorage.setItem(KEY, name); } catch { /* ignore */ }
  return name;
}
