const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { listAccounts, createAccount, updateAccount, deleteAccount, transferBetweenAccounts } = require('../controllers/accountController');

const router = express.Router();
router.use(requireAuth);

router.get('/', listAccounts);
router.post('/', createAccount);
router.post('/transfer', transferBetweenAccounts);
router.put('/:id', updateAccount);
router.delete('/:id', deleteAccount);

module.exports = router;
