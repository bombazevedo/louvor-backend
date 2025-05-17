const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

const scaleController = require('../controllers/scaleController');

// Validação: só adiciona rota se o handler existe
if (typeof scaleController.getAllScales === 'function') {
  router.get('/', authenticate, scaleController.getAllScales);
}
if (typeof scaleController.getScaleByEventId === 'function') {
  router.get('/event/:eventId', authenticate, scaleController.getScaleByEventId);
}
if (typeof scaleController.getScaleById === 'function') {
  router.get('/:id', authenticate, scaleController.getScaleById);
}
if (typeof scaleController.createScale === 'function') {
  router.post('/', authenticate, scaleController.createScale);
}
if (typeof scaleController.updateScale === 'function') {
  router.patch('/:id', authenticate, scaleController.updateScale);
}
if (typeof scaleController.deleteScale === 'function') {
  router.delete('/:id', authenticate, scaleController.deleteScale);
}

module.exports = router;
