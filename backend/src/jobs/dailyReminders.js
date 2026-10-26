// 每天早上的提醒:紀念日(當天/前 N 天)、好友生日(當天)
// 用 yy_reminder_log 防重複:伺服器重開或排程重跑都不會重複推播
const supabase = require('../config/supabase');
const A = require('../lib/annualDates');
const F = require('../lib/friends');
const { sendPushToUser } = require('../services/fcmService');

const BEFORE = { day: 0, day_3: 3 };

// 第一次寫入成功才回 true(已寄過就略過)
async function once(key) {
  const { data, error } = await supabase.from('yy_reminder_log').upsert({ key }, { onConflict: 'key', ignoreDuplicates: true }).select('key');
  if (error) throw error;
  return (data || []).length > 0;
}

async function fetchAll(table, columns) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

async function runDailyReminders(now = new Date()) {
  // 早上 8 點以前不發(伺服器半夜重開時不吵人)
  const hour = Number(new Date(now.getTime() + 8 * 3600 * 1000).toISOString().slice(11, 13));
  if (hour < 8) return { skipped: 'too early' };
  const today = new Date(now.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  let anniv = 0;
  let bday = 0;

  // ---- 紀念日
  const list = await fetchAll('yy_anniversaries', '*');
  const members = await fetchAll('yy_anniversary_members', 'anniversary_id, user_id, status');
  for (const a of list) {
    if (a.remind === 'none') continue;
    const { next, days_left: left, years } = A.anniversaryInfo(a, today);
    const before = BEFORE[a.remind] || 0;
    const isDay = left === 0;
    const isBefore = before > 0 && left === before;
    if (!isDay && !isBefore) continue;
    const who = [a.user_id, ...members.filter((m) => m.anniversary_id === a.id && m.status === 'active').map((m) => m.user_id)];
    const nth = years > 0 && a.show_age ? `（${years} 歲）` : years > 0 && a.show_years !== false ? `（${years} 週年）` : '';
    const label = a.year_known === false ? next.slice(5).replace('-', '/') : next.replace(/-/g, '/');
    for (const uid of who) {
      if (!(await once(`anniv:${a.id}:${next}:${isDay ? 'day' : 'before'}:${uid}`))) continue;
      await sendPushToUser(uid, {
        channel: 'calendar_shared',
        title: isDay ? `💝 今天是「${a.title}」` : `💝 ${before} 天後是「${a.title}」`,
        body: isDay ? `${label}${nth}` : `${label}${nth}，別忘了準備喔`,
        data: { url: '/anniversaries' },
      }).catch(() => {});
      anniv += 1;
    }
  }

  // ---- 好友生日(當天)
  const md = today.slice(5, 10);
  const mds = [md];
  // 非閏年的 2/28 也提醒 2/29 生日的人
  const y = Number(today.slice(0, 4));
  if (md === '02-28' && !((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0)) mds.push('02-29');
  const { data: stars, error } = await supabase.from('yy_users').select('id, username, birthday_visible, is_disabled').in('birthday_md', mds);
  if (error) throw error;
  for (const s of (stars || []).filter((u) => u.birthday_visible && !u.is_disabled)) {
    const friends = await F.friendIds(s.id);
    if (!friends.length) continue;
    const { data: fans } = await supabase.from('yy_users').select('id, notify_birthdays').in('id', friends);
    for (const f of (fans || []).filter((u) => u.notify_birthdays !== false)) {
      if (!(await once(`bday:${s.id}:${today}:${f.id}`))) continue;
      await sendPushToUser(f.id, {
        title: '🎂 好友生日',
        body: `今天是 ${s.username || '你的好友'} 的生日，送上祝福吧！`,
        data: { url: '/anniversaries' },
      }).catch(() => {});
      bday += 1;
    }
  }
  return { date: today, anniversaries: anniv, birthdays: bday };
}

module.exports = { runDailyReminders };
