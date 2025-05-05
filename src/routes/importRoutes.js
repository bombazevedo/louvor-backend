const express = require('express');
const router = express.Router();
const { importEventsFromExcel } = require('../controllers/importController');
const { authenticate } = require('../middleware/auth');

router.post('/upload', authenticate, importEventsFromExcel);

module.exports = router;