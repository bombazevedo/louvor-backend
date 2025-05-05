const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createScale,
  updateScale,
  getScaleByEventId,
  getScaleById,
  getAllScales,
  deleteScale
} = require('../controllers/scaleController');

// Middleware de autenticação
router.use(authenticate);

// Escalas
router.post('/', createScale);
router.patch('/:id', updateScale);
router.get('/event/:eventId', getScaleByEventId);
router.get('/:id', getScaleById);
router.get('/', getAllScales);
router.delete('/:id', deleteScale);

module.exports = router;