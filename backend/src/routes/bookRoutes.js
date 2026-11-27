const express = require('express');
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/bookController');

const router = express.Router();
router.use(requireAuth);
router.get('/', c.list);
router.get('/:ym', c.get);
router.patch('/:ym', c.update);
router.post('/:ym/finalize', c.finalize);
module.exports = router;
