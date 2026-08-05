const supabase = require('../config/supabase');

async function getProfile(req, res) {
  try {
    const { data, error } = await supabase
      .from('yy_users')
      .select('id, email, username, role, plan, last_payment_date, created_at')
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
    const { username } = req.body;
    if (username === undefined) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const { data, error } = await supabase
      .from('yy_users')
      .update({ username })
      .eq('id', req.user.id)
      .select('id, email, username, role, plan, last_payment_date, created_at')
      .single();
    if (error) throw error;
    return res.json({ profile: data });
  } catch (err) {
    console.error('[profileController.updateProfile]', err);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
}

module.exports = { getProfile, updateProfile };
