const express = require('express');
const multer = require('multer');
const importController = require('../controllers/importController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/xls', authMiddleware, upload.single('file'), importController.importXLS);

module.exports = router;
