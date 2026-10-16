// 行程提醒選項(分鐘);有時間的行程用 TIMED,全天行程用 ALL_DAY(-480 = 當天 08:00、960 = 前一天 08:00)
export const REMIND_TIMED = ['none', '0', '10', '30', '60', '1440'];
export const REMIND_ALL_DAY = ['none', '-480', '960'];

// 切換「有沒有填時間」時,把提醒換成另一組裡最接近的選項
export function normalizeRemind(remind, hasTime) {
  if (remind === 'none') return 'none';
  if (hasTime) return remind === '960' ? '1440' : remind === '-480' ? '0' : remind;
  return remind === '1440' ? '960' : REMIND_ALL_DAY.includes(remind) ? remind : '-480';
}

export const remindMinutes = (remind, hasTime) => {
  const r = normalizeRemind(remind, hasTime);
  return r === 'none' ? null : Number(r);
};

// 結束:可只填結束時間(同一天),或填結束日期(跨日)
export function endAtIso({ date, time, end_date, end_time }) {
  if (!end_date && !end_time) return null;
  return new Date(`${end_date || date}T${end_time || (end_date ? '23:59' : time || '00:00')}:00`).toISOString();
}
