const express = require('express');
const router = express.Router();
const utilsController = require('../controllers/utilsController');

// Rota para deletar imagem do Cloudinary
router.delete('/delete-image', utilsController.deleteImage);

module.exports = router;
