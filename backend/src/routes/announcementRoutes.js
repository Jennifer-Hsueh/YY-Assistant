const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { listAnnouncements } = require('../controllers/announcementController');

const router = express.Router();
router.use(requireAuth);

router.get('/', listAnnouncements);

module.exports = router;
