const express = require('express');
const { requireAuth, writeRequires } = require('../middleware/auth');
const { listMoods, setMood } = require('../controllers/moodController');

const router = express.Router();
router.use(requireAuth);
// 方案沒有這個功能時:資料可以讀,不能新增或修改
router.use(writeRequires('mood'));
router.get('/', listMoods);
router.put('/:date', setMood);
module.exports = router;
