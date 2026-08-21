const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/', limits: { fileSize: 10 * 1024 * 1024 } });

const { uploadFile, deleteImage } = require('../controllers/utilsController');
const { authenticate } = require('../middleware/auth');

// ✅ Upload de arquivo (padrão já funcional)
router.post('/upload-file', authenticate, upload.single('file'), uploadFile);

// ✅ Alias mais semântico → "/upload"
router.post('/upload', authenticate, upload.single('file'), uploadFile);

// ✅ Delete de imagem/arquivo
router.delete('/delete-image', authenticate, deleteImage);

module.exports = router;
