const express = require('express');
const { requireAuth, requireFeature } = require('../middleware/auth');
const c = require('../controllers/communityController');

const router = express.Router();
router.use(requireAuth);

router.get('/posts', c.listPosts);
router.get('/stats', c.myStats);
// 社群為加購功能:沒有時只能瀏覽、刪除自己的內容
const member = requireFeature('community');
router.post('/posts', member, c.createPost);
router.put('/posts/:id', member, c.updatePost);
router.delete('/posts/:id', c.deletePost);
router.get('/posts/:id/comments', c.listComments);
router.post('/posts/:id/comments', member, c.createComment);
router.delete('/comments/:id', c.deleteComment);
router.post('/posts/:id/react', member, c.react);
router.post('/posts/:id/report', member, c.report);
router.put('/posts/:id/status', c.setWishStatus);

module.exports = router;
