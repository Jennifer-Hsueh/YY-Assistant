const express = require('express');
const { requireAuth, writeRequires } = require('../middleware/auth');
const { withLedger, ledgerWritable } = require('../lib/ledgers');
const { listBudgets, upsertBudget, deleteBudget } = require('../controllers/budgetController');

const router = express.Router();
router.use(requireAuth);
// 方案沒有這個功能時:資料可以讀,不能新增或修改
router.use(writeRequires('ledger'));
// 帳本:X-Ledger 標頭決定目前的帳本;只能查看的帳本不能修改
router.use(withLedger, ledgerWritable);
router.get('/', listBudgets);
router.put('/', upsertBudget);
router.delete('/:id', deleteBudget);
module.exports = router;
