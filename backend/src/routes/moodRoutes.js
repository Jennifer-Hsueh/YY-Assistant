const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { listMoods, setMood } = require('../controllers/moodController');

const router = express.Router();
router.use(requireAuth);
router.get('/', listMoods);
router.put('/:date', setMood);
module.exports = router;
