const express = require('express');
const { requireAuth, writeRequires } = require('../middleware/auth');
const { listAccounts, createAccount, updateAccount, deleteAccount, transferBetweenAccounts } = require('../controllers/accountController');

const router = express.Router();
router.use(requireAuth);
// 方案沒有這個功能時:資料可以讀,不能新增或修改
router.use(writeRequires('ledger'));

router.get('/', listAccounts);
router.post('/', createAccount);
router.post('/transfer', transferBetweenAccounts);
router.put('/:id', updateAccount);
router.delete('/:id', deleteAccount);

module.exports = router;
