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

// NOTE: role and plan are currently self-editable by the user because this
// app only has one test account so far. Before opening this up to real
// paying users, lock role/plan edits behind an admin-only check — a user
// should never be able to upgrade their own plan or grant themselves admin.
async function updateProfile(req, res) {
  try {
    const { username, role, plan, last_payment_date } = req.body;
    const updates = {};
    if (username !== undefined) updates.username = username;
    if (role !== undefined) updates.role = role;
    if (plan !== undefined) updates.plan = plan;
    if (last_payment_date !== undefined) updates.last_payment_date = last_payment_date;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const { data, error } = await supabase
      .from('yy_users')
      .update(updates)
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
