const supabase = require('../config/supabase');
const { computeEntitlements } = require('../lib/entitlements');
const { forgetUserStatus } = require('../middleware/auth');
const { TERMS_VERSION } = require('../lib/terms');
const { withBeta } = require('../lib/beta');

const PROFILE_COLUMNS = 'id, email, username, role, plan, addon_community, basic_choice, basic_choice_changed_at, trial_ends_at, last_payment_date, plan_expires_at, created_at, theme, notify_ledger, notify_calendar, country, terms_version, community_suspended_until, birthday_md, birthday_visible, notify_birthdays';

// 回傳給前端:附上目前的方案權限(首頁圖片功能已移除,不再回傳)
function withEnt(row) {
  const ent = withBeta(computeEntitlements(row));
  const { basic_choice_changed_at, home_image, ...profile } = row;
  // terms_ok:已同意目前版本的使用條款(沒同意前 App 會跳出同意視窗)
  return { ...profile, ent, terms_ok: row.terms_version === TERMS_VERSION };
}
// 國別(決定社群顯示哪一國的安心專線);只開放已查證有專線的國家
const COUNTRIES = ['TW', 'HK', 'JP', 'SG', 'MY', 'CN', 'US', 'GB'];

async function getProfile(req, res) {
  try {
    const { data, error } = await supabase
      .from('yy_users')
      .select(PROFILE_COLUMNS)
      .eq('id', req.user.id)
      .single();
    if (error) throw error;
    return res.json({ profile: withEnt(data) });
  } catch (err) {
    console.error('[profileController.getProfile]', err);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

// role, plan, and last_payment_date are intentionally NOT accepted here —
// those are set by the developer directly in Supabase (or later, an admin
// panel). A regular user must never be able to grant themselves admin
// access or upgrade their own plan by calling this endpoint.
async function updateProfile(req, res) {
  try {
    const { username, theme, notify_ledger, notify_calendar, country, birthday_md, birthday_visible, notify_birthdays } = req.body;
    const updates = {};
    if (username !== undefined) updates.username = username;
    if (theme !== undefined) {
      if (!['default', 'grey', 'morandi', 'sport'].includes(theme)) return res.status(400).json({ error: 'Invalid theme' });
      updates.theme = theme;
    }
    if (country !== undefined) {
      if (country !== null && !COUNTRIES.includes(country)) return res.status(400).json({ error: 'Invalid country' });
      updates.country = country;
    }
    if (typeof notify_ledger === 'boolean') updates.notify_ledger = notify_ledger;
    if (typeof notify_calendar === 'boolean') updates.notify_calendar = notify_calendar;
    // 生日只存月日(不存年份)
    if (birthday_md !== undefined) {
      if (birthday_md !== null && !/^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(birthday_md)) return res.status(400).json({ error: 'Invalid birthday' });
      updates.birthday_md = birthday_md;
    }
    if (typeof birthday_visible === 'boolean') updates.birthday_visible = birthday_visible;
    if (typeof notify_birthdays === 'boolean') updates.notify_birthdays = notify_birthdays;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const { data, error } = await supabase
      .from('yy_users')
      .update(updates)
      .eq('id', req.user.id)
      .select(PROFILE_COLUMNS)
      .single();
    if (error) throw error;
    return res.json({ profile: withEnt(data) });
  } catch (err) {
    console.error('[profileController.updateProfile]', err);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
}

// 基本功能:記帳或行事曆二擇一,每個月可換一次
async function setBasicChoice(req, res) {
  try {
    const { choice } = req.body || {};
    if (!['ledger', 'calendar'].includes(choice)) return res.status(400).json({ error: 'Invalid choice' });
    const { data: row, error: rErr } = await supabase.from('yy_users').select(PROFILE_COLUMNS).eq('id', req.user.id).single();
    if (rErr) throw rErr;
    if (row.basic_choice === choice) return res.json({ profile: withEnt(row) });
    if (!computeEntitlements(row).can_change_choice) {
      return res.status(400).json({ error: '這個月已經換過了，下個月才能再換', code: 'CHOICE_LOCKED' });
    }
    const { data, error } = await supabase
      .from('yy_users')
      .update({ basic_choice: choice, basic_choice_changed_at: new Date().toISOString() })
      .eq('id', req.user.id)
      .select(PROFILE_COLUMNS)
      .single();
    if (error) throw error;
    forgetUserStatus(req.user.id);
    return res.json({ profile: withEnt(data) });
  } catch (err) {
    console.error('[profileController.setBasicChoice]', err);
    return res.status(500).json({ error: 'Failed to update choice' });
  }
}

// 同意目前版本的使用條款與隱私權政策
async function acceptTerms(req, res) {
  try {
    const { data, error } = await supabase
      .from('yy_users')
      .update({ terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() })
      .eq('id', req.user.id)
      .select(PROFILE_COLUMNS)
      .single();
    if (error) throw error;
    return res.json({ profile: withEnt(data) });
  } catch (err) {
    console.error('[profileController.acceptTerms]', err);
    return res.status(500).json({ error: 'Failed to accept terms' });
  }
}

module.exports = { getProfile, updateProfile, setBasicChoice, acceptTerms };
