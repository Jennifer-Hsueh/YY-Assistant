const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  listRecurringItems,
  createRecurringItem,
  updateRecurringItem,
  deleteRecurringItem,
} = require('../controllers/recurringController');

const router = express.Router();
router.use(requireAuth);

router.get('/', listRecurringItems);
router.post('/', createRecurringItem);
router.put('/:id', updateRecurringItem);
router.delete('/:id', deleteRecurringItem);

module.exports = router;
