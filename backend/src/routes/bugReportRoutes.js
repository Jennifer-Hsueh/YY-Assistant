const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { submitBugReport } = require('../controllers/bugReportController');

const router = express.Router();
router.use(requireAuth);

router.post('/', submitBugReport);

module.exports = router;
