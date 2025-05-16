const express = require('express');
const router = express.Router();
const { authenticate, isCoordinator } = require('../middleware/auth');
const {
  createScale,
  getScaleByEventId,
  updateScale,
  deleteScale
} = require('../controllers/scaleController');

router.post('/', authenticate, isCoordinator, createScale);
router.get('/event/:eventId', authenticate, getScaleByEventId);
router.patch('/:id', authenticate, isCoordinator, updateScale);
router.delete('/:id', authenticate, isCoordinator, deleteScale);

module.exports = router;