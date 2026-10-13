const express = require('express');
const { register, login, requestPasswordReset, resetPassword, changePassword } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.post('/change-password', requireAuth, changePassword);

module.exports = router;
