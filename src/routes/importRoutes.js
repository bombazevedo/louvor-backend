
const express = require('express');
const multer = require('multer');
const { importXLS } = require('../controllers/importController');
const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/xls', upload.single('file'), importXLS);
module.exports = router;
