// src/routes/webhookRoutes.js
const express = require('express');
const router = express.Router();

const { pagarmeWebhook } = require('../controllers/webhookController');

router.post('/pagarme', pagarmeWebhook);

module.exports = router;
