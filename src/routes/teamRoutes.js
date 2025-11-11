const express = require('express');
const router = express.Router();
const orgContext = require('../middleware/orgContext');
const licenseGuard = require('../middleware/licenseGuard');
const teamController = require('../controllers/teamController');
const auth = require('../middleware/auth');

// Todas as rotas requerem autenticação
router.use(auth.authenticate, orgContext);

// Criação, edição e exclusão: apenas coordenador
router.post('/', licenseGuard, teamController.createTeam);
router.patch('/:id', licenseGuard, teamController.updateTeam);
router.delete('/:id', licenseGuard, teamController.deleteTeam);

// Listagem e detalhes: aberto para todos autenticados
router.get('/', teamController.getTeams);
router.get('/:id', teamController.getTeamById);

module.exports = router;
