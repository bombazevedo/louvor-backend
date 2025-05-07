// src/routes/importRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { importEventsFromExcel } = require('../controllers/importController');

// Configuração do multer para upload de arquivos Excel
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const fileFilter = (req, file, cb) => {
  const allowed = /xlsx|xls/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  if (ext) return cb(null, true);
  cb(new Error('Apenas arquivos Excel são permitidos.'));
};
const upload = multer({ storage, fileFilter });

// POST /api/import/upload
console.log("🧪 Tipo de authenticate:", typeof authenticate);
router.post('/upload', authenticate, upload.single('file'), importEventsFromExcel);

module.exports = router;
