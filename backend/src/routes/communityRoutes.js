const express = require('express');
const { requireAuth } = require('../middleware/auth');
const c = require('../controllers/communityController');

const router = express.Router();
router.use(requireAuth);

router.get('/posts', c.listPosts);
router.get('/stats', c.myStats);
router.post('/posts', c.createPost);
router.put('/posts/:id', c.updatePost);
router.delete('/posts/:id', c.deletePost);
router.get('/posts/:id/comments', c.listComments);
router.post('/posts/:id/comments', c.createComment);
router.delete('/comments/:id', c.deleteComment);
router.post('/posts/:id/react', c.react);
router.post('/posts/:id/report', c.report);
router.put('/posts/:id/status', c.setWishStatus);

module.exports = router;
