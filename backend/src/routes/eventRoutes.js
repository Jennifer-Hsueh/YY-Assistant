const express = require('express');
const { requireAuth, writeRequires } = require('../middleware/auth');
const c = require('../controllers/eventController');

const router = express.Router();
router.use(requireAuth);
router.get('/invites', c.listInvites);
// 回覆共同行程邀請:不受方案限制
router.post('/:id/accept', c.acceptInvite);
router.post('/:id/decline', c.declineInvite);
// 方案沒有這個功能時:資料可以讀,不能新增或修改
router.use(writeRequires('calendar'));

router.get('/', c.listEvents);
router.post('/', c.createEvent);
router.put('/:id', c.updateEvent);
router.delete('/:id/members/:userId', c.removeMember);
router.delete('/:id', c.deleteEvent);

module.exports = router;
