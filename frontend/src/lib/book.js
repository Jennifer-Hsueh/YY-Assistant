// 月刊書櫃:書本的分頁、海狸的話、封面資料
import { moodEmoji } from './moods';

// 封面(public/bookshelf/covers/cover-N.webp)與書背顏色
export const COVERS = [
  { id: 1, spine: '#C9A77C' },
  { id: 2, spine: '#8FAE8A' },
  { id: 3, spine: '#8E9DB3' },
];
export const coverSrc = (id, small = false) => `/bookshelf/covers/cover-${id}${small ? '-s' : ''}.webp`;
export const spineColor = (id) => COVERS.find((c) => c.id === id)?.spine || COVERS[0].spine;
export const MESSAGE_MAX = 60;

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
  if (lang === 'en') {
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
