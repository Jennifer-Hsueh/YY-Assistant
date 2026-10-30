const express = require('express');
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/calendarController');

const router = express.Router();
router.use(requireAuth);
router.get('/', c.list);
router.post('/', c.create);
router.patch('/:id', c.update);
router.delete('/:id', c.remove);
router.post('/:id/invite', c.invite);
router.post('/:id/accept', c.accept);
router.post('/:id/decline', c.decline);
router.post('/:id/leave', c.leave);
router.delete('/:id/members/:userId', c.removeMember);
module.exports = router;
