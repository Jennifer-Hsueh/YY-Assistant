const { getFirebaseApp, admin } = require('../config/firebase');
const supabase = require('../config/supabase');

// Sends a push notification to every device token the user has registered
// (a user may be logged in on more than one device/browser).
async function sendPushToUser(userId, { title, body, data = {} } = {}) {
  const app = getFirebaseApp();
  if (!app) {
    console.log(`[fcmService] (not configured) would push to user ${userId}: ${title} — ${body}`);
    return { sent: false, reason: 'firebase not configured' };
  }

  const { data: subs, error } = await supabase
    .from('yy_push_subscriptions')
    .select('id, fcm_token')
    .eq('user_id', userId);

  if (error) {
    console.error('[fcmService] failed to load subscriptions', error);
    return { sent: false, reason: 'failed to load subscriptions' };
  }
  if (!subs || subs.length === 0) {
    return { sent: false, reason: 'user has no registered devices' };
  }

  const tokens = subs.map((s) => s.fcm_token);

  // Data payload values must all be strings for FCM.
  const stringData = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v)])
  );

  const message = {
    tokens,
    notification: { title, body },
    data: stringData,
    webpush: {
      fcmOptions: { link: process.env.APP_URL || '/' },
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);

    // Clean up tokens that are no longer valid (app uninstalled, token
    // rotated, etc.) so future sends don't keep retrying them.
    const deadTokenIds = [];
    response.responses.forEach((res, idx) => {
      if (!res.success) {
        const code = res.error?.code;
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
          deadTokenIds.push(subs[idx].id);
        }
      }
    });
    if (deadTokenIds.length > 0) {
      await supabase.from('yy_push_subscriptions').delete().in('id', deadTokenIds);
    }

    return { sent: true, successCount: response.successCount, failureCount: response.failureCount };
  } catch (err) {
    console.error('[fcmService] sendEachForMulticast failed', err);
    return { sent: false, reason: 'FCM send failed' };
  }
}

module.exports = { sendPushToUser };
