const supabase = require('../config/supabase');

// 啟動時檢查資料庫有沒有程式需要的欄位。
// 缺少時代表 SQL 沒有在 yy-assistant 專案執行(曾經跑到舊專案 line-life-app),Logs 會清楚提示。
// 結果也會顯示在 /health 的 schema 欄位。
const REQUIRED = {
  yy_users: 'id, plan, addon_community, basic_choice, trial_ends_at, plan_expires_at, is_disabled, terms_version, terms_accepted_at, community_suspended_until, founding_member, founding_granted_at, friend_code, birthday_md, birthday_visible, notify_birthdays',
  yy_posts: 'id, images, edited_at, hide_friends',
  yy_announcements: 'id, target_user_id',
  yy_payments: 'id, user_email',
  yy_plan_notices: 'id',
  yy_bug_reports: 'id',
  yy_moderation_actions: 'id',
  yy_password_reset_tokens: 'id',
  yy_settings: 'key, value',
  yy_active_days: 'user_id, day',
  yy_friendships: 'id, status',
  yy_ledgers: 'id, is_default, archived_at, owner_hidden',
  yy_ledger_members: 'ledger_id, status',
  yy_event_members: 'event_id, status',
  yy_anniversary_members: 'anniversary_id, status',
  yy_reminder_log: 'key',
  yy_anniversaries: 'id, remind, icon, recurring, show_years, show_age, year_known',
  yy_transactions: 'id, ledger_id',
  yy_accounts: 'id, ledger_id',
  yy_budgets: 'id, ledger_id',
  yy_recurring_items: 'id, ledger_id',
  yy_user_blocks: 'blocker_id',
  yy_user_reports: 'id, status',
};

let status = { ok: null, missing: [] };

async function checkSchema() {
  const missing = [];
  for (const [table, cols] of Object.entries(REQUIRED)) {
    try {
      const { error } = await supabase.from(table).select(cols).limit(1);
      if (error) missing.push(`${table}: ${error.message}`);
    } catch (err) {
      missing.push(`${table}: ${err.message}`);
    }
  }
  status = { ok: missing.length === 0, missing };
  if (missing.length) {
    console.error('[schemaCheck] ✗ 資料庫缺少程式需要的表或欄位:');
    for (const m of missing) console.error(`[schemaCheck]   - ${m}`);
    console.error('[schemaCheck] 請到 Supabase「yy-assistant」專案(左上角確認專案名稱)的 SQL Editor 執行缺少的 SQL;backend/supabase_schema.sql 可以整份重跑。執行後再加一行 notify pgrst, \'reload schema\';');
  } else {
    console.log('[schemaCheck] ✓ 資料庫欄位齊全');
  }
  return status;
}

module.exports = { checkSchema, schemaStatus: () => status };
