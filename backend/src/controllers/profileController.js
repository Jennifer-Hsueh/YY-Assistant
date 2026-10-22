const supabase = require('../config/supabase');
const { computeEntitlements, has } = require('../lib/entitlements');
const { forgetUserStatus, planRequired } = require('../middleware/auth');
const { TERMS_VERSION } = require('../lib/terms');

const PROFILE_COLUMNS = 'id, email, username, role, plan, addon_community, basic_choice, basic_choice_changed_at, trial_ends_at, last_payment_date, plan_expires_at, created_at, home_image, theme, notify_ledger, notify_calendar, country, terms_version, community_suspended_until';

// 回傳給前端:附上目前的方案權限;沒有「首頁圖片」功能時顯示預設圖片(原本的選擇保留)
function withEnt(row) {
  const ent = computeEntitlements(row);
  const { basic_choice_changed_at, ...profile } = row;
  // terms_ok:已同意目前版本的使用條款(沒同意前 App 會跳出同意視窗)
  return { ...profile, home_image: has(ent, 'home_image') ? row.home_image : null, ent, terms_ok: row.terms_version === TERMS_VERSION };
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
    const { username, home_image, theme, notify_ledger, notify_calendar, country } = req.body;
    const updates = {};
    if (username !== undefined) updates.username = username;
    if (home_image !== undefined) {
      if (req.ent && !has(req.ent, 'home_image')) return planRequired(res, 'home_image');
      const valid = home_image === null || (typeof home_image === 'string' && /^\/home-images\/yy-([1-9]|1[0-2])\.png$/.test(home_image));
      if (!valid) return res.status(400).json({ error: 'Invalid image' });
      updates.home_image = home_image;
    }
    if (theme !== undefined) {
      if (!['default', 'grey'].includes(theme)) return res.status(400).json({ error: 'Invalid theme' });
      updates.theme = theme;
    }
    if (country !== undefined) {
      if (country !== null && !COUNTRIES.includes(country)) return res.status(400).json({ error: 'Invalid country' });
      updates.country = country;
    }
    if (typeof notify_ledger === 'boolean') updates.notify_ledger = notify_ledger;
    if (typeof notify_calendar === 'boolean') updates.notify_calendar = notify_calendar;
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
