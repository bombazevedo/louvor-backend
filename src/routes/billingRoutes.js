// src/routes/billingRoutes.js
const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const orgContext = require('../middleware/orgContext');
const { subscribe, catalog, checkout, landingCheckout } = require('../controllers/billingController');

router.get('/catalog', authenticate, orgContext, catalog);
router.post('/checkout', authenticate, orgContext, checkout);
router.post('/landing/checkout', authenticate, landingCheckout);

// router.post('/subscribe', authenticate, orgContext, subscribe);
module.exports = router;
