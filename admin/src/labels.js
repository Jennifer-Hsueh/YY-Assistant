export const ROLE_LABEL = { user: '一般使用者', tester: '測試員', admin: '管理員' };
export const PLAN_LABEL = { basic: '基本功能', adv_a: '進階 A', adv_b: '進階 B', adv_c: '進階 C', full: '完整版' };
export const PLAN_DESC = { basic: '記帳或行事曆二擇一', adv_a: '記帳+行事曆', adv_b: '記帳進階', adv_c: '行事曆進階', full: '全部功能' };
export const PAID_PLANS = ['adv_a', 'adv_b', 'adv_c', 'full'];
export const ADDON_PLANS = ['adv_a', 'adv_b', 'adv_c'];
export const CHOICE_LABEL = { ledger: '記帳', calendar: '行事曆' };
export const STATUS_LABEL = { trial: '試用中', basic: '基本功能', active: '付費中', grace: '寬限期', staff: '不受限制' };
export const STATUS_TONE = { trial: 'ink', basic: 'gray', active: 'green', grace: 'amber', staff: 'ink' };
// 月費;年繳 = 月費 × 12 − 100
export const MONTHLY = { adv_a: 69, adv_b: 69, adv_c: 69, full: 109 };
export function priceFor(plan, addon, months) {
  const m = (MONTHLY[plan] || 0) + (addon && ADDON_PLANS.includes(plan) ? 10 : 0);
  return Math.floor(months / 12) * (m * 12 - 100) + (months % 12) * m;
}
export function planText(u) {
  if ((u.plan || 'basic') === 'basic') return u.basic_choice ? `基本・${CHOICE_LABEL[u.basic_choice]}` : '基本・未選擇';
  return PLAN_LABEL[u.plan] + (u.addon_community && ADDON_PLANS.includes(u.plan) ? '+社群' : '');
}
export const BOARD_LABEL = { mood: '晴空與雨天', finance: '養豬小能手', wish: '小編許願池' };
export const WISH_LABEL = { considering: '考慮中', planned: '已排入', done: '已完成' };

const pad = (n) => String(n).padStart(2, '0');
export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${fmtDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// datetime-local 欄位用(本機時間)
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${fmtDate(iso)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function ago(iso) {
  if (!iso) return '從未';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return m <= 1 ? '剛剛' : `${m} 分鐘前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小時前`;
  const d = Math.floor(h / 24);
  return d < 60 ? `${d} 天前` : fmtDate(iso);
}

// 日期輸入:只取數字,自動補上斜線(輸入 20261101 → 2026/11/01)
export function typeDate(v) {
  const d = String(v).replace(/\D/g, '').slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}/${d.slice(4)}`;
  return `${d.slice(0, 4)}/${d.slice(4, 6)}/${d.slice(6)}`;
}
// 時間輸入(24 小時制):輸入 0930 → 09:30
export function typeTime(v) {
  const d = String(v).replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}
// ISO → { date: 'yyyy/mm/dd', time: 'HH:MM' }(本機時間)
export function splitLocal(iso) {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  return { date: fmtDate(iso).replace(/-/g, '/'), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
// 日期 + 時間 → ISO;日期空白回 null;格式錯誤回 { error }
export function joinLocal(date, time) {
  if (!date) return { iso: null };
  const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(date);
  if (!m) return { error: '日期請輸入 8 碼,例如 20261101' };
  const t = time ? /^(\d{2}):(\d{2})$/.exec(time) : ['', '00', '00'];
  if (!t) return { error: '時間請輸入 4 碼,例如 0930' };
  const [y, mo, d, h, mi] = [+m[1], +m[2], +m[3], +t[1], +t[2]];
  const dt = new Date(y, mo - 1, d, h, mi);
  if (dt.getMonth() !== mo - 1 || dt.getDate() !== d || h > 23 || mi > 59) return { error: '日期或時間不正確' };
  return { iso: dt.toISOString() };
}
