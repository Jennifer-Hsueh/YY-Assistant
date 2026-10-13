const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { exportData, importData } = require('../controllers/dataController');

const router = express.Router();
router.use(requireAuth);
router.get('/export', exportData);
router.post('/import', importData);
module.exports = router;
