const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { listBudgets, upsertBudget, deleteBudget } = require('../controllers/budgetController');

const router = express.Router();
router.use(requireAuth);
router.get('/', listBudgets);
router.put('/', upsertBudget);
router.delete('/:id', deleteBudget);
module.exports = router;
