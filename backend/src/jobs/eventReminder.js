const cron = require('node-cron');
const supabase = require('../config/supabase');
const { sendPushToUser } = require('../services/fcmService');

// 行程提醒:提醒時間到了就推播一次,並記錄 reminder_sent_at 避免重複。
// 錯過超過 STALE_MS(例如伺服器睡著)的提醒直接標記為已處理,不補發過時的通知。
const STALE_MS = 6 * 60 * 60 * 1000;
const MAX_LEAD_MIN = 1440 + 960; // 最長提前量(1 天前 / 全天行程前一天 8 點)
let running = false;

function timeLabel(startIso, minutes) {
  const d = new Date(startIso);
  const opts = { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric' };
  const date = new Intl.DateTimeFormat('zh-TW', opts).format(d);
  // 全天行程(提醒值為 -480 或 960)不顯示時間
  if (minutes === -480 || minutes === 960) return date;
  const time = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${date} ${time}`;
}

async function runEventReminders(now = new Date()) {
  if (running) return { skipped: true };
  running = true;
  try {
    const from = new Date(now.getTime() - STALE_MS - 16 * 3600 * 1000).toISOString();
    const to = new Date(now.getTime() + MAX_LEAD_MIN * 60000).toISOString();
    const { data: events, error } = await supabase
      .from('yy_events')
      .select('id, user_id, title, start_at, remind_before_minutes')
      .not('remind_before_minutes', 'is', null)
      .is('reminder_sent_at', null)
      .gte('start_at', from)
      .lte('start_at', to);
    if (error) throw error;

    let sent = 0;
    let skipped = 0;
    for (const ev of events) {
      const remindAt = new Date(ev.start_at).getTime() - ev.remind_before_minutes * 60000;
      if (remindAt > now.getTime()) continue; // 還沒到
      const stale = now.getTime() - remindAt > STALE_MS;
      if (!stale) {
        try {
          await sendPushToUser(ev.user_id, {
            channel: 'calendar',
            title: `📅 ${ev.title}`,
            body: timeLabel(ev.start_at, ev.remind_before_minutes),
            data: { event_id: ev.id, url: '/calendar' },
          });
          sent += 1;
        } catch (err) {
          console.error('[eventReminder] push failed', ev.id, err);
          continue; // 推播失敗:下次再試
        }
      } else {
        skipped += 1;
      }
      await supabase.from('yy_events').update({ reminder_sent_at: now.toISOString() }).eq('id', ev.id);
    }
    return { checked: events.length, sent, skipped };
  } finally {
    running = false;
  }
}

function startEventReminders() {
  if (process.env.NODE_ENV === 'development') {
    console.log('[eventReminder] disabled in development');
    return;
  }
  // 每分鐘檢查一次;伺服器睡著時由 cron-job.org 呼叫 /cron/event-reminders 叫醒並補做
  cron.schedule('* * * * *', () => {
    runEventReminders().catch((err) => console.error('[eventReminder]', err));
  }, { timezone: 'Asia/Taipei' });
  console.log('[eventReminder] started (every minute)');
}

module.exports = { runEventReminders, startEventReminders };
