const express = require('express');
const { requireAuth, requireFeature } = require('../middleware/auth');
const c = require('../controllers/momentController');

// 日常時光:看自己的照片不限方案;新增、刪除要完整版(moments)
const router = express.Router();
router.use(requireAuth);
router.get('/', c.list);
router.post('/', requireFeature('moments'), c.create);
router.delete('/:id', c.remove);
module.exports = router;
