const express = require('express');
const router = express.Router();
const { listarHistorico, listarExecucoesIndividuais } = require('../controllers/historicoController');
const { authenticate } = require('../middleware/auth');

// 🔗 Histórico consolidado com filtro de datas
router.get('/', authenticate, listarHistorico);

// 🔗 Todas execuções individuais com data
router.get('/execucoes', authenticate, listarExecucoesIndividuais);

module.exports = router;
