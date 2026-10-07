const cron = require('node-cron');
const supabase = require('../config/supabase');
const { sendPushToUser } = require('../services/fcmService');

const TZ = 'Asia/Taipei';
const MAX_CATCH_UP = 60; // safety cap on periods processed per item per run
let running = false;

function todayInTaipei() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

// Next occurrence after `dateStr` (YYYY-MM-DD), keeping the configured day of month.
function addPeriod(item, dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = item.frequency === 'weekly'
    ? new Date(Date.UTC(y, m - 1, d + 7))
    : new Date(Date.UTC(y, m, item.day_of_month || d));
  return next.toISOString().slice(0, 10);
}

// Records one occurrence of a ledger item as a transaction and adjusts the account balance.
async function recordTransaction(item, dateStr) {
  if (!item.amount) return false;
  const amount = Number(item.amount);
  const { error } = await supabase.from('yy_transactions').insert({
    user_id: item.user_id,
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

    let periods = 0;
    let recorded = 0;
    for (const item of dueItems) {
      try {
        const isLedger = item.kind === 'expense' || item.kind === 'income';
        let date = item.next_trigger_date;
        let count = 0;

        // Catch up every missed period up to today (and not past the end date).
        while (date <= today && count < MAX_CATCH_UP) {
          if (item.end_date && date > item.end_date) break;
          if (isLedger && (await recordTransaction(item, date))) recorded += 1;
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

        if (count > 0 && (item.reminder_method === 'push' || item.reminder_method === 'both')) {
          let body;
          if (isLedger && item.amount) body = count > 1 ? `${item.title} 已自動記帳 ${count} 期` : `${item.title} 已自動記帳`;
          else if (isLedger) body = `${item.title} 到期提醒`;
          else body = `${item.title} 今天`;
          await sendPushToUser(item.user_id, {
            title: '循環提醒',
            body,
            data: { recurring_item_id: item.id },
          });
        }
      } catch (itemErr) {
        console.error(`[recurringScheduler] failed to process item ${item.id}`, itemErr);
      }
    }

    console.log(`[recurringScheduler] ${today}: ${dueItems.length} item(s), ${periods} period(s), ${recorded} transaction(s) recorded`);
    return { date: today, items: dueItems.length, periods, recorded };
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
