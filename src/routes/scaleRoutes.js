// src/routes/scaleRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, isCoordinator } = require('../middleware/auth');
const scaleController = require('../controllers/scaleController');

// Todas as rotas abaixo exigem autenticação
router.use(authenticate);

// Listar todas as escalas
router.get('/', scaleController.getAllScales);

// Escala associada a um evento
router.get('/event/:eventId', scaleController.getScaleByEventId);

// Exportar escalas em PDF (apenas coordenador)
router.get('/export/pdf', isCoordinator, scaleController.exportScalesPDF);

// Detalhes de uma escala pelo ID
router.get('/:id', scaleController.getScaleById);

// Criar nova escala (apenas coordenador)
router.post('/', isCoordinator, scaleController.createScale);

// Atualizar escala existente (apenas coordenador)
router.patch('/:id', isCoordinator, scaleController.updateScale);

// Remover escala (apenas coordenador)
router.delete('/:id', isCoordinator, scaleController.deleteScale);

module.exports = router;
