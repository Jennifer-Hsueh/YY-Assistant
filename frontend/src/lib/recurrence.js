// 循環頻率共用工具:每月(1–31 或 -1 = 最後一天)、每週(0=日…6=六)、每年(依 next_trigger_date 的月/日)
export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();

// 從今天(含)起算的下一次日期
export function nextOccurrence({ frequency, day_of_month, day_of_week, yearly_date }, from = new Date()) {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (frequency === 'weekly') {
    const dow = Number(day_of_week ?? 0);
    const d = new Date(today);
    d.setDate(d.getDate() + ((dow - today.getDay() + 7) % 7));
    return ymd(d);
  }
  if (frequency === 'yearly') {
    const [, mm, dd] = (yearly_date || ymd(today)).split('-').map(Number);
    for (const y of [today.getFullYear(), today.getFullYear() + 1]) {
      const d = new Date(y, mm - 1, Math.min(dd, daysIn(y, mm - 1)));
      if (d >= today) return ymd(d);
    }
  }
  const want = Number(day_of_month) === -1 ? 31 : Number(day_of_month) || 1;
  for (const offset of [0, 1]) {
    const y = today.getFullYear();
    const m = today.getMonth() + offset;
    const d = new Date(y, m, Math.min(want, daysIn(y, m)));
    if (d >= today) return ymd(d);
  }
  return ymd(today);
}

// 列表上的文字:每月 5 號 / 每月最後一天 / 每週三 / 每年 3/15
export function describeRecurrence(item, t) {
  if (item.frequency === 'weekly') return `${t('rec_weekly_prefix')}${t('cal_weekdays')[item.day_of_week ?? 0]}`;
  if (item.frequency === 'yearly') {
    const [, mm, dd] = (item.next_trigger_date || '').split('-').map(Number);
    return `${t('rec_yearly_prefix')}${mm}/${dd}`;
  }
  if (Number(item.day_of_month) === -1) return t('rec_last_day');
  return `${t('rec_monthly_prefix')}${item.day_of_month}${t('rec_monthly_suffix')}`;
}

// 表單 ↔ 資料
export const emptyRecurrence = { frequency: 'monthly', day_of_month: '1', day_of_week: '1', yearly_date: '' };

export function recurrenceFromItem(item) {
  return {
    frequency: item.frequency || 'monthly',
    day_of_month: item.day_of_month != null ? String(item.day_of_month) : '1',
    day_of_week: item.day_of_week != null ? String(item.day_of_week) : '1',
    yearly_date: item.frequency === 'yearly' ? item.next_trigger_date : '',
  };
}

export function recurrencePayload(form) {
  const next = nextOccurrence(form);
  return {
    frequency: form.frequency,
    day_of_month: form.frequency === 'monthly' ? Number(form.day_of_month) : null,
    day_of_week: form.frequency === 'weekly' ? Number(form.day_of_week) : null,
    next_trigger_date: next,
  };
}

// 重新啟用時,依新的起始日期決定日/星期
export function reactivationPayload(item, dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const base = { is_active: true, next_trigger_date: dateStr };
  if (item.frequency === 'weekly') return { ...base, day_of_week: d.getDay() };
  if (item.frequency === 'yearly') return base;
  return { ...base, day_of_month: Number(item.day_of_month) === -1 ? -1 : d.getDate() };
}
