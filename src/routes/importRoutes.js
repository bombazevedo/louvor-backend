const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { importEventsFromExcel } = require('../controllers/importController');

router.post('/upload', authenticate, importEventsFromExcel);

module.exports = router;
