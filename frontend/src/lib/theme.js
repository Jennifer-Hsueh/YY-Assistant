// 介面主題(2026-11-27 換成 11 種配色;'default' = 日暖米杏)
// 先存在 localStorage 讓畫面一打開就套用,登入後再以伺服器上的設定為準(Web / APP 共用)。
export const THEME_LIST = [
  { name: 'default', swatch: '#956440', label: { zh: '日暖米杏', en: 'Warm Beige', ja: 'ぬくもりベージュ' } },
  { name: 'sakura', swatch: '#A85473', label: { zh: '櫻花粉霧', en: 'Cherry Blossom', ja: 'さくらミスト' } },
  { name: 'sprout', swatch: '#57794D', label: { zh: '春芽嫩綠', en: 'Fresh Green', ja: '新芽グリーン' } },
  { name: 'lake', swatch: '#42799D', label: { zh: '湖水晴藍', en: 'Lake Blue', ja: '湖のブルー' } },
  { name: 'lavender', swatch: '#7862A5', label: { zh: '薰衣草紫', en: 'Lavender', ja: 'ラベンダー' } },
  { name: 'lemon', swatch: '#E6CB45', label: { zh: '檸檬奶黃', en: 'Lemon Cream', ja: 'レモンクリーム' } },
  { name: 'breeze', swatch: '#397F76', label: { zh: '海風青綠', en: 'Ocean Breeze', ja: '潮風グリーン' } },
  { name: 'terracotta', swatch: '#A4473D', label: { zh: '暮秋磚紅', en: 'Terracotta Red', ja: 'テラコッタ' } },
  { name: 'mist', swatch: '#666C79', label: { zh: '霧柔暖灰', en: 'Gentle Gray', ja: 'やさしいグレー' } },
  { name: 'indigo', swatch: '#151D36', label: { zh: '午夜靛藍', en: 'Midnight Indigo', ja: 'ミッドナイトインディゴ' } },
  { name: 'ink', swatch: '#000000', label: { zh: '墨夜時光', en: 'Midnight Ink', ja: '墨夜' } },
];
export const THEMES = THEME_LIST.map((x) => x.name);
// 舊主題代碼換到最接近的新配色(帳號裡存的舊值不用改資料庫)
const LEGACY = { grey: 'ink', morandi: 'mist', sport: 'lake', macaron: 'sakura', beaver: 'default' };
export const normalizeTheme = (v) => {
  const n = LEGACY[v] || v;
  return THEMES.includes(n) ? n : 'default';
};
const KEY = 'yy_theme';

export function getStoredTheme() {
  try {
    return normalizeTheme(localStorage.getItem(KEY));
  } catch {
    return 'default';
  }
}

export function applyTheme(theme) {
  const name = normalizeTheme(theme);
  const root = document.documentElement;
  if (name === 'default') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', name);
  try { localStorage.setItem(KEY, name); } catch { /* ignore */ }
  return name;
}
