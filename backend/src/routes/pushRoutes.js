const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { registerSubscription, unregisterSubscription } = require('../controllers/pushController');
const { sendPushToUser } = require('../services/fcmService');

// 測試通知:每人 30 秒最多一次
const lastTest = new Map();

const router = express.Router();
router.use(requireAuth);

router.post('/', registerSubscription);
router.delete('/', unregisterSubscription);
// POST /push-subscriptions/test:傳一則測試通知給自己,回傳送達結果(設定頁「傳一則測試通知」)
router.post('/test', async (req, res) => {
  const now = Date.now();
  if (now - (lastTest.get(req.user.id) || 0) < 30000) return res.status(429).json({ error: '請稍等 30 秒再試' });
  lastTest.set(req.user.id, now);
  try {
    const en = String(req.get('x-lang') || '').toLowerCase() === 'en';
    const r = await sendPushToUser(req.user.id, {
      title: en ? '🔔 Test notification' : '🔔 測試通知',
      body: en ? 'If you see this, notifications work on this device.' : '收到這則，就表示這台裝置的通知正常。',
      data: { url: '/settings' },
    });
    // 失敗原因(不含裝置代碼)一併回傳,方便判斷是哪裡的問題
    return res.json({ sent: !!r.sent && (r.successCount || 0) > 0, devices: (r.successCount || 0) + (r.failureCount || 0), success: r.successCount || 0, reason: r.reason || null, errors: [...new Set(r.errors || [])] });
  } catch (err) {
    console.error('[push.test]', err);
    return res.status(500).json({ error: '測試通知失敗' });
  }
});

module.exports = router;
