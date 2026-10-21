const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const c = require('../controllers/adminController');

// 管理後台(獨立網站使用)。一律需要登入 + 管理員身份。
const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/me', c.me);
router.get('/overview', c.overview);
router.get('/users', c.listUsers);
router.put('/users/:id', c.updateUser);
router.post('/users/:id/reset-link', c.createResetLink);
router.get('/users/:id/payments', c.listPayments);
router.post('/users/:id/payments', c.createPayment);
router.delete('/users/:id/payments/:paymentId', c.deletePayment);
router.get('/announcements', c.listAnnouncements);
router.post('/announcements', c.createAnnouncement);
router.put('/announcements/:id', c.updateAnnouncement);
router.delete('/announcements/:id', c.deleteAnnouncement);
router.get('/reports', c.listReports);
router.put('/posts/:id/hidden', c.setPostHidden);
router.delete('/posts/:id', c.deletePost);
router.get('/wishes', c.listWishes);
router.put('/posts/:id/wish-status', c.setWishStatus);

router.get('/bug-reports', c.listBugReports);
router.put('/bug-reports/:id', c.updateBugReport);
router.get('/backups', c.listBackups);
router.get('/backups/summary', c.backupSummary);
router.get('/backups/download', c.downloadBackup);
router.post('/backups/restore', c.restoreBackup);

module.exports = router;
