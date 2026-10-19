const express = require('express');
const { requireAuth, writeRequires } = require('../middleware/auth');
const { listBudgets, upsertBudget, deleteBudget } = require('../controllers/budgetController');

const router = express.Router();
router.use(requireAuth);
// 方案沒有這個功能時:資料可以讀,不能新增或修改
router.use(writeRequires('ledger'));
router.get('/', listBudgets);
router.put('/', upsertBudget);
router.delete('/:id', deleteBudget);
module.exports = router;
