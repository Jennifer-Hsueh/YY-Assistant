const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { listAnnouncements, getStatus, markSeen, dismissBanner } = require('../controllers/announcementController');

const router = express.Router();
router.use(requireAuth);

router.get('/', listAnnouncements);
router.get('/status', getStatus);
router.post('/seen', markSeen);
router.post('/banner-dismiss', dismissBanner);

module.exports = router;
