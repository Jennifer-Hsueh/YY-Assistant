const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { listAccounts, createAccount, transferBetweenAccounts } = require('../controllers/accountController');

const router = express.Router();
router.use(requireAuth);

router.get('/', listAccounts);
router.post('/', createAccount);
router.post('/transfer', transferBetweenAccounts);

module.exports = router;
