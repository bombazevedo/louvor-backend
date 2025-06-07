const express = require('express');
const router = express.Router();
const {
  getAllBandRoles,
  createBandRole,
  updateBandRole,
  deleteBandRole
} = require('../controllers/bandRoleController');

const authenticate = require('../middleware/auth');
const isCoordinator = require('../middleware/isCoordinator');

// 🔓 Rotas Públicas
router.get('/', getAllBandRoles);

// 🔐 Rotas Protegidas (somente Coordenador)
router.post('/', authenticate, isCoordinator, createBandRole);
router.put('/:id', authenticate, isCoordinator, updateBandRole);
router.delete('/:id', authenticate, isCoordinator, deleteBandRole); // ✅ Corrigida

module.exports = router;
