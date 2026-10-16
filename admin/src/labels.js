export const ROLE_LABEL = { user: '一般使用者', tester: '測試員', admin: '管理員' };
export const PLAN_LABEL = { free: '免費', ledger: '記帳功能', calendar: '行事曆功能', full: '完整功能' };
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
