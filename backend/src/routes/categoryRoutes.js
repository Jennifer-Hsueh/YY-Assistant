const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { listCategories, createCategory, updateCategory, deleteCategory, clearAllData } = require('../controllers/categoryController');

const router = express.Router();
router.use(requireAuth);

router.get('/', listCategories);
router.post('/', createCategory);
router.put('/:id', updateCategory);
router.delete('/all-data', clearAllData);
router.delete('/:id', deleteCategory);

module.exports = router;
