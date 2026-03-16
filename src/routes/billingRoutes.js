// src/routes/billingRoutes.js
const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth');
const orgContext = require('../middleware/orgContext');
const {
  subscribe,
  catalog,
  checkout,
  landingCheckout,
  confirmApplePurchase,
} = require('../controllers/billingController');

router.get('/catalog', authenticate, orgContext, catalog);
router.post('/checkout', authenticate, orgContext, checkout);
router.post('/landing/checkout', authenticate, landingCheckout);
router.post('/apple/confirm', authenticate, orgContext, confirmApplePurchase);

// router.post('/subscribe', authenticate, orgContext, subscribe);
module.exports = router;