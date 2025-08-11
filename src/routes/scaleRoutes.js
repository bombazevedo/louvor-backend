// src/routes/scaleRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, isCoordinator } = require('../middleware/auth');
const scaleController = require('../controllers/scaleController');

// Todas as rotas exigem autenticação
router.use(authenticate);

// CRUD
if (typeof scaleController.getAllScales === 'function') {
  router.get('/', scaleController.getAllScales);
}
if (typeof scaleController.getScaleByEventId === 'function') {
  router.get('/event/:eventId', scaleController.getScaleByEventId);
}
if (typeof scaleController.getScaleById === 'function') {
  router.get('/:id', scaleController.getScaleById);
}
if (typeof scaleController.createScale === 'function') {
  router.post('/', scaleController.createScale);
}
if (typeof scaleController.updateScale === 'function') {
  router.patch('/:id', scaleController.updateScale);
}
if (typeof scaleController.deleteScale === 'function') {
  router.delete('/:id', scaleController.deleteScale);
}

// Exportar escalas em PDF (somente coordenador)
if (typeof scaleController.exportScalesPDF === 'function') {
  router.get('/export/pdf', isCoordinator, scaleController.exportScalesPDF);
}

module.exports = router;
