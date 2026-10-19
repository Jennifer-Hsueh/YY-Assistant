const express = require('express');
const { requireAuth, requireFeature } = require('../middleware/auth');
const { listCategories, createCategory, updateCategory, deleteCategory, clearAllData } = require('../controllers/categoryController');

const router = express.Router();
router.use(requireAuth);

router.get('/', listCategories);
// 分類記帳與行事曆共用:有其中一個功能就能管理
const canEdit = requireFeature('ledger', 'calendar');
router.post('/', canEdit, createCategory);
router.put('/:id', canEdit, updateCategory);
router.delete('/all-data', clearAllData);
router.delete('/:id', canEdit, deleteCategory);

module.exports = router;
