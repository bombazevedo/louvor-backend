const express = require('express');
const router = express.Router();
const { listarHistorico, listarExecucoesIndividuais } = require('../controllers/historicoController');
const { authenticate } = require('../middleware/auth');
const orgContext = require('../middleware/orgContext');

// 🔗 Histórico consolidado com filtro de datas
router.get('/', authenticate, orgContext, listarHistorico);

// 🔗 Todas execuções individuais com data
router.get('/execucoes', authenticate, orgContext, listarExecucoesIndividuais);

module.exports = router;
