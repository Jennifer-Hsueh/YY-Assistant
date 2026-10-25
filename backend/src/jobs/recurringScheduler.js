const cron = require('node-cron');
const supabase = require('../config/supabase');
const { accessOf } = require('../lib/ledgers');
const { runDailyReminders } = require('./dailyReminders');
const { sendPushToUser } = require('../services/fcmService');
const { computeEntitlements, has } = require('../lib/entitlements');

const TZ = 'Asia/Taipei';
const MAX_CATCH_UP = 60; // safety cap on periods processed per item per run
let running = false;

function todayInTaipei() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const daysIn = (y, monthIndex) => new Date(Date.UTC(y, monthIndex + 1, 0)).getUTCDate();

// Next occurrence after `dateStr` (YYYY-MM-DD).
// weekly: +7 天;yearly: 明年同月同日(2/29 → 2/28);
// monthly: 下個月的 day_of_month,超過該月天數就用月底;day_of_month = -1 代表每月最後一天
function addPeriod(item, dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  let next;
  if (item.frequency === 'weekly') {
    next = new Date(Date.UTC(y, m - 1, d + 7));
  } else if (item.frequency === 'yearly') {
    next = new Date(Date.UTC(y + 1, m - 1, Math.min(d, daysIn(y + 1, m - 1))));
  } else {
    const want = item.day_of_month === -1 ? 31 : item.day_of_month || d;
    next = new Date(Date.UTC(y, m, Math.min(want, daysIn(y, m))));
  }
  return next.toISOString().slice(0, 10);
}

// Records one occurrence of a ledger item as a transaction and adjusts the account balance.
async function recordTransaction(item, dateStr) {
  if (!item.amount) return false;
  const amount = Number(item.amount);
  const { error } = await supabase.from('yy_transactions').insert({
    user_id: item.user_id,
    ledger_id: item.ledger_id || null,
    account_id: item.account_id || null,
    type: item.kind,
    amount,
    category: item.category || null,
    note: item.title,
    occurred_at: new Date(`${dateStr}T12:00:00+08:00`).toISOString(),
  });
  if (error) throw error;

  if (item.account_id) {
    const { data: acc, error: accErr } = await supabase
      .from('yy_accounts')
      .select('balance')
      .eq('id', item.account_id)
      .maybeSingle();
    if (accErr) throw accErr;
    if (acc) {
      const delta = item.kind === 'income' ? amount : -amount;
      const { error: balErr } = await supabase
        .from('yy_accounts')
        .update({ balance: Number(acc.balance) + delta })
        .eq('id', item.account_id);
      if (balErr) throw balErr;
    }
  }
  return true;
}

async function runDailyRecurringScan() {
  if (running) return { skipped: true };
  running = true;
  try {
    const today = todayInTaipei();
    const { data: dueItems, error } = await supabase
      .from('yy_recurring_items')
      .select('*')
      .eq('is_active', true)
      .lte('next_trigger_date', today);

    if (error) {
      console.error('[recurringScheduler] failed to fetch due items', error);
      return { error: true };
    }

    // 方案沒有循環功能的使用者:到期的期數只往後推,不記帳也不通知(升級後不會一次補記一大堆)
    const userIds = [...new Set(dueItems.map((i) => i.user_id))];
    const ents = {};
    if (userIds.length) {
      const { data: users, error: uErr } = await supabase.from('yy_users').select('*').in('id', userIds);
      if (uErr) console.error('[recurringScheduler] failed to load users', uErr);
      for (const u of users || []) ents[u.id] = computeEntitlements(u, today);
    }
    const allowed = (item) => {
      const ent = ents[item.user_id];
      if (!ent) return true;
      return has(ent, item.kind === 'event' ? 'calendar_recurring' : 'ledger_recurring');
    };

    let periods = 0;
    let recorded = 0;
    let paused = 0;
    for (const item of dueItems) {
      try {
        const isLedger = item.kind === 'expense' || item.kind === 'income';
        let active = allowed(item);
        // 共同帳本:建立這筆循環的人已退出或被移出時,不再自動記帳(期數照樣往後推)
        if (active && isLedger && item.ledger_id) {
          const acc = await accessOf(item.user_id, item.ledger_id);
          if (!acc?.canWrite) active = false;
        }
        if (!active) paused += 1;
        let date = item.next_trigger_date;
        let count = 0;

        // Catch up every missed period up to today (and not past the end date).
        while (date <= today && count < MAX_CATCH_UP) {
          if (item.end_date && date > item.end_date) break;
          if (active && isLedger && (await recordTransaction(item, date))) recorded += 1;
          count += 1;
          date = addPeriod(item, date);
          // Advance after each period so a crash mid-way never records a period twice.
          const { error: upErr } = await supabase
            .from('yy_recurring_items')
            .update({ next_trigger_date: date })
            .eq('id', item.id);
          if (upErr) throw upErr;
        }
        periods += count;

        if (active && count > 0 && (item.reminder_method === 'push' || item.reminder_method === 'both')) {
          let body;
          if (isLedger && item.amount) body = count > 1 ? `${item.title} 已自動記帳 ${count} 期` : `${item.title} 已自動記帳`;
          else if (isLedger) body = `${item.title} 到期提醒`;
          else body = `${item.title} 今天`;
          await sendPushToUser(item.user_id, {
            channel: item.kind === 'event' ? 'calendar' : 'ledger',
            title: '循環提醒',
            body,
            data: { recurring_item_id: item.id },
          });
        }
      } catch (itemErr) {
        console.error(`[recurringScheduler] failed to process item ${item.id}`, itemErr);
      }
    }

    // 紀念日、好友生日提醒(失敗不影響循環記帳)
    let reminders = null;
    try {
      reminders = await runDailyReminders();
    } catch (err) {
      console.error('[recurringScheduler] daily reminders failed', err);
    }
    console.log(`[recurringScheduler] ${today}: ${dueItems.length} item(s), ${periods} period(s), ${recorded} transaction(s) recorded, ${paused} paused by plan`);
    return { date: today, items: dueItems.length, periods, recorded, paused, reminders };
  } finally {
    running = false;
  }
}

// Daily at 08:00 Taiwan time, plus one catch-up scan shortly after start-up
// (Render free instances sleep, so the 08:00 tick can be missed).
// Disabled in local development so a Codespace backend never processes items
// alongside the deployed one.
function startRecurringScheduler() {
  if (process.env.NODE_ENV === 'development') {
    console.log('[recurringScheduler] disabled in development');
    return;
  }
  cron.schedule('0 8 * * *', runDailyRecurringScan, { timezone: TZ });
  setTimeout(() => runDailyRecurringScan().catch((err) => console.error('[recurringScheduler] startup scan failed', err)), 5000);
  console.log('[recurringScheduler] scheduled daily scan at 08:00 Asia/Taipei');
}

module.exports = { startRecurringScheduler, runDailyRecurringScan };
