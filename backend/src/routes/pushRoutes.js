const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { registerSubscription, unregisterSubscription } = require('../controllers/pushController');

const router = express.Router();
router.use(requireAuth);

router.post('/', registerSubscription);
router.delete('/', unregisterSubscription);

module.exports = router;
