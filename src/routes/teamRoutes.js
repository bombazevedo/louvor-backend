const express = require('express');
const router = express.Router();
const orgContext = require('../middleware/orgContext');
const licenseGuard = require('../middleware/licenseGuard');
const teamController = require('../controllers/teamController');
const auth = require('../middleware/auth');
const limitsGuard = require('../middleware/limitsGuard');

// Todas as rotas requerem autenticação
router.use(auth.authenticate, orgContext);

// Criação, edição e exclusão: apenas coordenador
router.post('/', licenseGuard('write','team:create'), limitsGuard('team:create'), teamController.createTeam);
router.patch('/:id', licenseGuard('write','team:update'), teamController.updateTeam);
router.delete('/:id', licenseGuard('write','team:delete'), teamController.deleteTeam);

// Listagem e detalhes: aberto para todos autenticados
router.get('/', teamController.getTeams);
router.get('/:id', teamController.getTeamById);

module.exports = router;
