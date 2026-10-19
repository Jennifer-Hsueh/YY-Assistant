const express = require('express');
const { requireAuth, writeRequires } = require('../middleware/auth');
const { listEvents, createEvent, updateEvent, deleteEvent } = require('../controllers/eventController');

const router = express.Router();
router.use(requireAuth);
// 方案沒有這個功能時:資料可以讀,不能新增或修改
router.use(writeRequires('calendar'));

router.get('/', listEvents);
router.post('/', createEvent);
router.put('/:id', updateEvent);
router.delete('/:id', deleteEvent);

module.exports = router;
