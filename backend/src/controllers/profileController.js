const supabase = require('../config/supabase');

const PROFILE_COLUMNS = 'id, email, username, role, plan, last_payment_date, plan_expires_at, created_at, home_image, theme, notify_ledger, notify_calendar, country';
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
    return res.json({ profile: data });
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
    return res.json({ profile: data });
  } catch (err) {
    console.error('[profileController.updateProfile]', err);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
}

module.exports = { getProfile, updateProfile };
