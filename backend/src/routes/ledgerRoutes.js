const express = require('express');
const { requireAuth, writeRequires } = require('../middleware/auth');
const c = require('../controllers/ledgerController');

const router = express.Router();
router.use(requireAuth);
router.get('/', c.listLedgers);
// 回覆邀請、退出、從清單移除:不受方案限制
router.post('/:id/accept', c.acceptInvite);
router.post('/:id/decline', c.declineInvite);
router.post('/:id/leave', c.leaveLedger);
router.post('/:id/hide', c.hideLedger);
// 方案沒有記帳功能時:帳本可以看,不能新增或修改
router.use(writeRequires('ledger'));
router.post('/', c.createLedger);
router.put('/:id', c.renameLedger);
router.delete('/:id', c.deleteLedger);
router.post('/:id/members', c.inviteMember);
router.delete('/:id/members/:userId', c.removeMember);
module.exports = router;
