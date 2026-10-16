const express = require('express');
const { register, login, requestPasswordReset, resetPassword, changePassword } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { loginLimit, registerLimit, forgotLimit, resetLimit, changePasswordLimit } = require('../middleware/rateLimit');

const router = express.Router();

// 登入、註冊、忘記／重設／修改密碼都有次數限制,防止暴力猜密碼與大量寄信
router.post('/register', registerLimit, register);
router.post('/login', loginLimit, login);
router.post('/forgot-password', forgotLimit, requestPasswordReset);
router.post('/reset-password', resetLimit, resetPassword);
router.post('/change-password', requireAuth, changePasswordLimit, changePassword);

module.exports = router;
