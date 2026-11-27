// 月刊書櫃:書本的分頁、海狸的話、書背
import { moodEmoji } from './moods';

// 書背(public/bookshelf/spine/01–12.webp、year.webp):每個月固定一款,年鑑另一款(2026-11-27 起不用挑封面)
export const isYearKey = (k) => /^\d{4}$/.test(k || '');
export const SPINE_W = 177 / 2480; // 書背寬:高
export const spineKey = (ym) => (isYearKey(ym) ? 'year' : ym.slice(5, 7));
export const spineSrc = (ym, small = false) => `/bookshelf/spine/${spineKey(ym)}${small ? '-s' : ''}.webp`;
// 每款書背的代表色(手機版月份按鈕的框線)
const SPINE_COLOR = { '01': '#9DB8E0', '02': '#E9A3B5', '03': '#EBB3C3', '04': '#A9C98A', '05': '#E5C04A', '06': '#B9A6DE',
  '07': '#7FB6DE', '08': '#E5C35E', '09': '#E7A35F', 10: '#9B82C9', 11: '#E2B47F', 12: '#9CCFCB', year: '#2F4A8C' };
export const spineColor = (ym) => SPINE_COLOR[spineKey(ym)];
export const MESSAGE_MAX = 60;
export const YEAR_MESSAGE_MAX = 200; // 年鑑「給自己的話」
export const ymLabel = (ym) => ym.replace('-', '.');
export const BOARD = {
  zh: { mood: '晴空與雨天', finance: '養豬小能手', wish: '小編許願池' },
  en: { mood: 'Sun & Rain', finance: 'Piggy Bank', wish: 'Wishing Well' },
};

const MOOD_NAME = {
  zh: { sunny: '晴天', cloudy: '陰天', rainy: '雨天', storm: '雷雨', love: '心動', flower: '開花', angry: '生氣', question: '疑惑', exclaim: '驚嘆', rainbow: '彩虹' },
  en: { sunny: 'sunny', cloudy: 'cloudy', rainy: 'rainy', storm: 'stormy', love: 'lovely', flower: 'blooming', angry: 'grumpy', question: 'puzzled', exclaim: 'surprised', rainbow: 'rainbow' },
};

// 這個月最常出現的心情(多到少)
export function moodRank(moods) {
  const n = {};
  Object.values(moods || {}).forEach((m) => { n[m] = (n[m] || 0) + 1; });
  return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([mood, days]) => ({ mood, days, emoji: moodEmoji(mood) }));
}

const fmt = (n) => Number(n || 0).toLocaleString();

// 海狸的話:依當月的數字套用固定句型
export function beaverWords(data, lang = 'zh') {
  const m = data.money || {};
  const c = data.counts || {};
  const top = moodRank(data.moods)[0];
  const month = Number(data.ym.slice(5, 7));
  if (lang !== 'zh') {
    const parts = [];
    const did = [c.tx ? `logged ${c.tx} entries` : null, c.events ? `planned ${c.events} events` : null].filter(Boolean);
    if (did.length) parts.push(`This month you ${did.join(' and ')}.`);
    if (top) parts.push(`${top.days} of your days felt ${MOOD_NAME.en[top.mood] || top.mood}.`);
    if (m.income > m.expense && m.expense > 0) parts.push(`You kept NT$${fmt(m.income - m.expense)} more than you spent. Beaver is quietly clapping for you!`);
    else if (m.top?.[0]?.name) parts.push(`Most of your spending went to "${m.top[0].name}". Let's see if we can save a little next month.`);
    if (!parts.length) parts.push('It was a quiet month. Beaver rested with you for a while.');
    parts.push(['Let’s take it slow next month, too.', 'Remember to be kind to yourself.', 'See you next month!'][month % 3]);
    return parts.join(' ');
  }
  const parts = [];
  const did = [c.tx ? `記了 ${c.tx} 筆帳` : null, c.events ? `排了 ${c.events} 個行程` : null].filter(Boolean);
  if (did.length) parts.push(`這個月你${did.join('、')}。`);
  if (top) parts.push(`有 ${top.days} 天是${MOOD_NAME.zh[top.mood] || ''}的心情。`);
  if (m.income > m.expense && m.expense > 0) parts.push(`收入比支出多了 ${fmt(m.income - m.expense)} 元，小河狸幫你偷偷拍拍手！`);
  else if (m.top?.[0]?.name) parts.push(`花最多的是「${m.top[0].name}」，下個月一起看看能不能省一點點。`);
  if (!parts.length) parts.push('這個月比較安靜，小河狸也陪你休息了一下。');
  parts.push(['下個月也一起慢慢來吧。', '記得對自己好一點喔。', '我們下個月見！'][month % 3]);
  return parts.join('');
}

// 內容多的頁面自動接到下一頁(依字數估計高度,單位 px,頁面內容區約 450px)
const PAGE_H = 440;
const lines = (text, perLine) => Math.max(1, String(text || '').split('\n').reduce((n, l) => n + Math.max(1, Math.ceil([...l].length / perLine)), 0));
function chunk(items, weight) {
  const pages = [];
  let cur = [];
  let h = 0;
  for (const it of items) {
    const w = weight(it);
    if (cur.length && h + w > PAGE_H) { pages.push(cur); cur = []; h = 0; }
    cur.push(it);
    h += w;
  }
  if (cur.length) pages.push(cur);
  return pages.length ? pages : [[]];
}

export function paginate(data) {
  const pages = [{ type: 'cover' }, { type: 'overview' }, { type: 'calendar' }, { type: 'mood' }];
  chunk(data.notes || [], (n) => 30 + lines(n.content, 30) * 19).forEach((items, i) => pages.push({ type: 'notes', items, cont: i > 0 }));
  chunk(data.posts || [], (p) => 34 + (p.title ? 20 : 0) + lines(p.content, 30) * 20 + (p.images?.length ? 122 : 0))
    .forEach((items, i) => pages.push({ type: 'posts', items, cont: i > 0 }));
  pages.push({ type: 'beaver' }, { type: 'back' });
  return pages;
}

// 月曆格子:前面補空白,回傳 [{ day, date } | null]
export function monthCells(ym) {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const days = new Date(y, m, 0).getDate();
  const cells = Array.from({ length: first }, () => null);
  for (let d = 1; d <= days; d += 1) cells.push({ day: d, date: `${ym}-${String(d).padStart(2, '0')}` });
  while (cells.length % 7) cells.push(null);
  return cells;
}

// ---------- 年鑑 ----------
// 心情折線圖的高度(1 最低 ~ 5 最高),與後端 MOOD_LEVEL 相同
export const MOOD_LEVEL = { sunny: 5, rainbow: 5, love: 5, flower: 4, cloudy: 3, exclaim: 3, question: 3, rainy: 2, storm: 1, angry: 1 };

// 年鑑分頁:封面 → 年度概況(圓餅圖)→ 一年的心情(第 2、3 頁,左右對開一次看完)→ 每月一覽 → 一年的時光
// → 每月一句話 → 紀念日與行程 → 微光拾憶(全部,自動接頁)→ 給自己的話 → 封底
export function paginateYear(data) {
  const year = data.ym;
  const startM = data.since && data.since.startsWith(year) ? Number(data.since.slice(5, 7)) : 1;
  const months = Array.from({ length: 13 - startM }, (_, i) => `${year}-${String(startM + i).padStart(2, '0')}`);
  // 心情固定放在第 2、3 頁(偶數頁在左、奇數頁在右),打開就是左右兩頁;月份平分到兩頁(每頁最多 6 個月)
  const half = Math.ceil(months.length / 2);
  const pages = [{ type: 'cover' }, { type: 'y_overview' },
    { type: 'y_mood', items: months.slice(0, half), spread: 'L' }, { type: 'y_mood', items: months.slice(half), spread: 'R' },
    { type: 'y_months' }];
  if (Object.keys(data.photos || {}).length) pages.push({ type: 'y_photos', items: months });
  chunk(data.messages || [], (m) => 34 + lines(m.message, 26) * 22).forEach((items, i) => pages.push({ type: 'y_messages', items, cont: i > 0 }));
  pages.push({ type: 'y_dates' });
  chunk(data.posts || [], (p) => 34 + (p.title ? 20 : 0) + lines(p.content, 30) * 20)
    .forEach((items, i) => pages.push({ type: 'posts', items, cont: i > 0 }));
  pages.push({ type: 'y_letter' }, { type: 'back' });
  return pages;
}
export const paginateAny = (data) => (data?.kind === 'year' ? paginateYear(data) : paginate(data));

// 閱讀時的畫面:一般一次一頁;標了 spread L/R 的兩頁並排成一個畫面(左右對開)
export function viewsOf(pages) {
  const views = [];
  for (let i = 0; i < pages.length; i += 1) {
    if (pages[i].spread === 'L' && pages[i + 1]?.spread === 'R') { views.push([i, i + 1]); i += 1; } else views.push([i]);
  }
  return views;
}
