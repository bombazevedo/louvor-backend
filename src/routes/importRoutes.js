// src/routes/importRoutes.js
const express = require('express');
const router = express.Router();
const { importXLS } = require('../controllers/importController');
const { authenticate } = require('../middleware/auth');

router.post('/upload', authenticate, importXLS);

module.exports = router;
