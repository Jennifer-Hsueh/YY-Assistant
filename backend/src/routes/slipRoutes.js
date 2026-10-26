const express = require('express');
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/slipController');

const router = express.Router();
router.use(requireAuth);
router.get('/', c.list);
router.get('/contacts', c.contacts);
router.get('/unread', c.unread);
router.post('/', c.send);
router.post('/read', c.markRead);
router.delete('/:id', c.remove);
module.exports = router;
