const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getExchangeRate } = require('../controllers/exchangeRateController');

const router = express.Router();
router.use(requireAuth);

router.get('/', getExchangeRate);

module.exports = router;
