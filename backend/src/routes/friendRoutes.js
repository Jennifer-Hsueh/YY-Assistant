const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const c = require('../controllers/friendController');

// 好友碼查詢/送出邀請:限制次數,避免有人亂猜好友碼
const codeLimit = rateLimit([{ name: 'friend-code', windowMs: 10 * 60 * 1000, max: 30, key: (req) => req.user?.id || null }]);

const router = express.Router();
router.use(requireAuth);
router.get('/', c.overview);
router.post('/code', c.regenerateCode);
router.get('/lookup', codeLimit, c.lookup);
router.post('/requests', codeLimit, c.request);
router.post('/:userId/accept', c.accept);
router.delete('/blocks/:userId', c.unblock);
router.post('/:userId/block', c.block);
router.post('/:userId/report', c.report);
router.delete('/:userId', c.remove);
module.exports = router;
