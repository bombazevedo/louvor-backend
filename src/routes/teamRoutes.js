const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const auth = require('../middleware/auth');

// Todas as rotas requerem autenticação
router.use(auth.authenticate);

// Criação, edição e exclusão: apenas coordenador
router.post('/', teamController.createTeam);
router.patch('/:id', teamController.updateTeam);
router.delete('/:id', teamController.deleteTeam);

// Listagem e detalhes: aberto para todos autenticados
router.get('/', teamController.getTeams);
router.get('/:id', teamController.getTeamById);

module.exports = router;
