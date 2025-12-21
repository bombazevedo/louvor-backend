// src/routes/scaleRoutes.js
const express = require('express');
const router = express.Router();
const orgContext = require('../middleware/orgContext');
const licenseGuard = require('../middleware/licenseGuard');
const { authenticate, isCoordinator } = require('../middleware/auth');
const scaleController = require('../controllers/scaleController');

// Todas as rotas exigem autenticação
router.use(authenticate, orgContext);

// CRUD
if (typeof scaleController.getAllScales === 'function') {
  router.get('/', scaleController.getAllScales);
}
if (typeof scaleController.getScaleByEventId === 'function') {
  router.get('/event/:eventId', scaleController.getScaleByEventId);
}
// Exportar escalas em PDF (somente coordenador)
// ✅ alteração pontual: adiciona POST para receber o payload com ícones (req.body.icons)
if (typeof scaleController.exportScalesPDF === 'function') {
  router.post('/export/pdf', isCoordinator, scaleController.exportScalesPDF); // novo
  router.get('/export/pdf',  isCoordinator, scaleController.exportScalesPDF); // legado
}

if (typeof scaleController.getScaleById === 'function') {
  router.get('/:id', scaleController.getScaleById);
}
if (typeof scaleController.createScale === 'function') router.post('/', licenseGuard('write'), scaleController.createScale);
if (typeof scaleController.updateScale === 'function') router.patch('/:id', licenseGuard('write'), scaleController.updateScale);
if (typeof scaleController.deleteScale === 'function') router.delete('/:id', licenseGuard('write'), scaleController.deleteScale);

module.exports = router;
