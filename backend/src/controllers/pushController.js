const supabase = require('../config/supabase');

// Called by the frontend after the browser grants notification permission
// and firebase/messaging returns a device token.
async function registerSubscription(req, res) {
  try {
    const { fcm_token } = req.body;
    if (!fcm_token) {
      return res.status(400).json({ error: 'fcm_token is required' });
    }

    // Upsert on token so re-registering the same device doesn't duplicate rows,
    // and so a token that moved to a different account gets reassigned.
    const { error } = await supabase
      .from('yy_push_subscriptions')
      .upsert(
        { user_id: req.user.id, fcm_token },
        { onConflict: 'fcm_token' }
      );
    if (error) throw error;

    return res.status(201).json({ message: 'Subscribed' });
  } catch (err) {
    console.error('[pushController.registerSubscription]', err);
    return res.status(500).json({ error: 'Failed to register push subscription' });
  }
}

async function unregisterSubscription(req, res) {
  try {
    const { fcm_token } = req.body;
    if (!fcm_token) {
      return res.status(400).json({ error: 'fcm_token is required' });
    }
    const { error } = await supabase
      .from('yy_push_subscriptions')
      .delete()
      .eq('user_id', req.user.id)
      .eq('fcm_token', fcm_token);
    if (error) throw error;
    return res.status(204).send();
  } catch (err) {
    console.error('[pushController.unregisterSubscription]', err);
    return res.status(500).json({ error: 'Failed to unregister push subscription' });
  }
}

module.exports = { registerSubscription, unregisterSubscription };
