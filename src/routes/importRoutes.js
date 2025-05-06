// src/routes/importRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const importController = require('../controllers/importController');

// Configuração do multer para upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/'); // Certifique-se que essa pasta exista
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// POST /api/import/upload
router.post('/upload', authenticate, upload.single('file'), importController.importEventsFromExcel);

module.exports = router;
