const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createScale,
  updateScale,
  getScaleByEventId,
  getAllScales,
  getScaleById,
  deleteScale
} = require('../controllers/scaleController');

router.get('/', authenticate, getAllScales);
router.get('/event/:eventId', authenticate, getScaleByEventId);
router.get('/:id', authenticate, getScaleById);
router.post('/', authenticate, createScale);
router.patch('/:id', authenticate, updateScale);
router.delete('/:id', authenticate, deleteScale);

module.exports = router;
