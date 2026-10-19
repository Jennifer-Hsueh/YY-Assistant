const express = require('express');
const { requireAuth, writeRequires } = require('../middleware/auth');
const {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} = require('../controllers/transactionController');

const router = express.Router();
router.use(requireAuth);
// 方案沒有這個功能時:資料可以讀,不能新增或修改
router.use(writeRequires('ledger'));

router.get('/', listTransactions);
router.post('/', createTransaction);
router.put('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);

module.exports = router;
