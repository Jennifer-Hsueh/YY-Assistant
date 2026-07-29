const cron = require('node-cron');
const supabase = require('../config/supabase');
const { sendPushToUser } = require('../services/fcmService');

// Computes the next trigger date for a recurring item after it fires today.
function computeNextTriggerDate(item) {
  const current = new Date(item.next_trigger_date);
  const next = new Date(current);

  if (item.frequency === 'monthly') {
    next.setMonth(next.getMonth() + 1);
  } else if (item.frequency === 'weekly') {
    next.setDate(next.getDate() + 7);
  }
  return next.toISOString().slice(0, 10);
}

async function runDailyRecurringScan() {
  const today = new Date().toISOString().slice(0, 10);

  const { data: dueItems, error } = await supabase
    .from('recurring_items')
    .select('*')
    .eq('is_active', true)
    .lte('next_trigger_date', today);

  if (error) {
    console.error('[recurringScheduler] failed to fetch due items', error);
    return;
  }

  for (const item of dueItems) {
    try {
      // Notify the user according to their configured reminder_method.
      if (item.reminder_method === 'push' || item.reminder_method === 'both') {
        await sendPushToUser(item.user_id, {
          title: '循環提醒',
          body: `${item.title} 即將發生,請確認或跳過`,
          data: { recurring_item_id: item.id },
        });
      }
      // 'in_app' (and 'both') items are simply left visible in the
      // standalone management page — no extra write needed here.

      const nextDate = computeNextTriggerDate(item);
      await supabase
        .from('recurring_items')
        .update({ next_trigger_date: nextDate })
        .eq('id', item.id);
    } catch (itemErr) {
      console.error(`[recurringScheduler] failed to process item ${item.id}`, itemErr);
    }
  }

  console.log(`[recurringScheduler] processed ${dueItems.length} due item(s) on ${today}`);
}

// Runs once a day at 08:00 server time — adjust to taste once deployed.
function startRecurringScheduler() {
  cron.schedule('0 8 * * *', runDailyRecurringScan);
  console.log('[recurringScheduler] scheduled daily scan at 08:00');
}

module.exports = { startRecurringScheduler, runDailyRecurringScan };
