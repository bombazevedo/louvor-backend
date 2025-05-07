// src/routes/importRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { importEventsFromExcel, uploadExcel } = require('../controllers/importController');

// POST /api/import/upload
router.post('/upload', authenticate, uploadExcel, importEventsFromExcel);

module.exports = router;
