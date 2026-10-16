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
router.get('/announcements', c.listAnnouncements);
router.post('/announcements', c.createAnnouncement);
router.put('/announcements/:id', c.updateAnnouncement);
router.delete('/announcements/:id', c.deleteAnnouncement);
router.get('/reports', c.listReports);
router.put('/posts/:id/hidden', c.setPostHidden);
router.delete('/posts/:id', c.deletePost);
router.get('/wishes', c.listWishes);
router.put('/posts/:id/wish-status', c.setWishStatus);

module.exports = router;
