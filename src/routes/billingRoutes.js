// src/routes/billingRoutes.js
const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const orgContext = require('../middleware/orgContext');
const { subscribe } = require('./billingController');

router.post('/subscribe', authenticate, orgContext, subscribe);

module.exports = router;
