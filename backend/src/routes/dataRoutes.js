const express = require('express');
const { requireAuth, requireFeature } = require('../middleware/auth');
const { exportData, importData } = require('../controllers/dataController');

const router = express.Router();
router.use(requireAuth);
// 資料匯出與備份屬於進階功能
router.use(requireFeature('export'));
router.get('/export', exportData);
router.post('/import', importData);
module.exports = router;
