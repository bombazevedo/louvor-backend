// src/routes/billingRoutes.js
const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const orgContext = require('../middleware/orgContext');
const { subscribe } = require('../controllers/billingController');

router.post('/subscribe', auth, orgContext, subscribe);

module.exports = router;
