// 每年同一天的日期計算(紀念日、生日);2/29 在非閏年用 2/28
const DAY = 24 * 60 * 60 * 1000;
const taipeiToday = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const pad = (n) => String(n).padStart(2, '0');

function onYear(md, year) {
  let [m, d] = md.split('-').map(Number);
  if (m === 2 && d === 29 && !isLeap(year)) d = 28;
  return `${year}-${pad(m)}-${pad(d)}`;
}
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / DAY);

// md:'MM-DD';回傳今天(含)之後最近的那一天與剩幾天
function nextOf(md, today = taipeiToday()) {
  const y = Number(today.slice(0, 4));
  let next = onYear(md, y);
  if (next < today) next = onYear(md, y + 1);
  return { next, days_left: daysBetween(today, next) };
}

// 紀念日:date 為第一次的日期 'YYYY-MM-DD';years = 這次是第幾週年
function anniversaryInfo(date, today = taipeiToday()) {
  const { next, days_left } = nextOf(date.slice(5, 10), today);
  return { next, days_left, years: Number(next.slice(0, 4)) - Number(date.slice(0, 4)) };
}

module.exports = { taipeiToday, nextOf, anniversaryInfo, daysBetween };
