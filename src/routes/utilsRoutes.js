const express = require('express');
const router = express.Router();
const utilsController = require('../controllers/utilsController');
const auth = require('../middleware/auth');

// 🔒 Protegido por autenticação
router.delete('/delete-image', auth, utilsController.deleteImage);

module.exports = router;
