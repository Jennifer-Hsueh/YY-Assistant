const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { listEvents, createEvent, updateEvent, deleteEvent } = require('../controllers/eventController');

const router = express.Router();
router.use(requireAuth);

router.get('/', listEvents);
router.post('/', createEvent);
router.put('/:id', updateEvent);
router.delete('/:id', deleteEvent);

module.exports = router;
