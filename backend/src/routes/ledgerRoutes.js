const express = require('express');
const { requireAuth, writeRequires } = require('../middleware/auth');
const c = require('../controllers/ledgerController');

const router = express.Router();
router.use(requireAuth);
// 方案沒有記帳功能時:帳本可以看,不能新增或修改
router.use(writeRequires('ledger'));
router.get('/', c.listLedgers);
router.post('/', c.createLedger);
router.put('/:id', c.renameLedger);
router.delete('/:id', c.deleteLedger);
module.exports = router;
