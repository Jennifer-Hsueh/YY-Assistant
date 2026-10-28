const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const c = require('../controllers/paymentReportController');

const limit = rateLimit([{ name: 'payment-report', windowMs: 60 * 60 * 1000, max: 20, key: (req) => req.user?.id || null }]);

const router = express.Router();
router.use(requireAuth);
router.get('/', c.list);
router.post('/proof', limit, c.uploadProof);
router.post('/', limit, c.create);
router.delete('/:id', c.remove);
module.exports = router;
