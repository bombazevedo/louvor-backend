const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const { uploadFile, deleteImage } = require('../controllers/utilsController');
const { authenticate } = require('../middleware/auth');

// ✅ Upload de arquivo
router.post('/upload-file', authenticate, upload.single('file'), uploadFile);

// ✅ Delete de imagem/arquivo
router.delete('/delete-image', authenticate, deleteImage);

module.exports = router;
