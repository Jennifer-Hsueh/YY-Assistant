// 共用行事曆:建立者+已加入的成員都能看、新增、修改、刪除裡面的行程
const supabase = require('../config/supabase');

const NAME_MAX = 20;
const MAX_MEMBERS = 10; // 建立者以外最多幾位(含邀請中)
const COLORS = ['#C1666B', '#6E8B5D', '#4C7A9E', '#B08238', '#8E6BA8', '#D9822B', '#3F8F8B', '#9A6B4F'];

// 我目前在的共用行事曆 id(建立的+已加入的)
async function myCalendarIds(userId) {
  const [{ data: own, error: e1 }, { data: mine, error: e2 }] = await Promise.all([
    supabase.from('yy_calendars').select('id').eq('user_id', userId),
    supabase.from('yy_calendar_members').select('calendar_id').eq('user_id', userId).eq('status', 'active'),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return [...new Set([...(own || []).map((c) => c.id), ...(mine || []).map((m) => m.calendar_id)])];
}

// 我對某本行事曆的身分:owner / member;不是成員回傳 null
async function accessOf(userId, calendarId) {
  const { data: cal, error } = await supabase.from('yy_calendars').select('*').eq('id', calendarId).maybeSingle();
  if (error) throw error;
  if (!cal) return null;
  if (cal.user_id === userId) return { cal, role: 'owner' };
  const { data: m, error: mErr } = await supabase.from('yy_calendar_members').select('status').eq('calendar_id', calendarId).eq('user_id', userId).maybeSingle();
  if (mErr) throw mErr;
  return m?.status === 'active' ? { cal, role: 'member' } : null;
}

// 建立者+已加入的成員
async function activeUserIds(cal) {
  const { data, error } = await supabase.from('yy_calendar_members').select('user_id').eq('calendar_id', cal.id).eq('status', 'active');
  if (error) throw error;
  return [cal.user_id, ...(data || []).map((m) => m.user_id)];
}

// 交給最早加入的成員;沒有成員就刪掉這本(連同行程)
async function handOver(cal) {
  const { data: ms, error } = await supabase.from('yy_calendar_members').select('*').eq('calendar_id', cal.id).eq('status', 'active');
  if (error) throw error;
  const heir = (ms || []).sort((a, b) => (a.joined_at || a.created_at).localeCompare(b.joined_at || b.created_at))[0];
  if (!heir) {
    const { error: dErr } = await supabase.from('yy_calendars').delete().eq('id', cal.id);
    if (dErr) throw dErr;
    return null;
  }
  const { error: e1 } = await supabase.from('yy_calendars').update({ user_id: heir.user_id }).eq('id', cal.id);
  if (e1) throw e1;
  const { error: e2 } = await supabase.from('yy_calendar_members').delete().eq('calendar_id', cal.id).eq('user_id', heir.user_id);
  if (e2) throw e2;
  return heir.user_id;
}

// 刪除帳號前:自己建立的共用行事曆交給其他成員
async function handOverAll(userId) {
  const { data, error } = await supabase.from('yy_calendars').select('*').eq('user_id', userId);
  if (error) throw error;
  for (const cal of data || []) await handOver(cal);
}

module.exports = { NAME_MAX, MAX_MEMBERS, COLORS, myCalendarIds, accessOf, activeUserIds, handOver, handOverAll };
