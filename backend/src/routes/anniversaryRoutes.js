const express = require('express');
const { requireAuth, writeRequires } = require('../middleware/auth');
const c = require('../controllers/anniversaryController');

const router = express.Router();
router.use(requireAuth);
router.get('/', c.listAll);
// 回覆邀請:不受方案限制
router.post('/:id/accept', c.accept);
router.post('/:id/decline', c.decline);
// 紀念日屬於行事曆功能
router.use(writeRequires('calendar'));
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id/members/:userId', c.removeMember);
router.delete('/:id', c.remove);
module.exports = router;
