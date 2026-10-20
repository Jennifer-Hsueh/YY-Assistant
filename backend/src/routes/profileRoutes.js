const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getProfile, updateProfile, setBasicChoice, acceptTerms } = require('../controllers/profileController');

const router = express.Router();
router.use(requireAuth);

router.get('/', getProfile);
router.put('/', updateProfile);
router.put('/basic-choice', setBasicChoice);
router.put('/accept-terms', acceptTerms);

module.exports = router;
