const express = require('express');
const router = express.Router();
const orgCtl = require('../controllers/orgController');

// 🔧 Torna a importação do auth compatível com default ou named export
const authModule = require('../middleware/auth');
const auth = typeof authModule === 'function' ? authModule : authModule.auth;

// (opcional, ajuda no diagnóstico)
router.get('/_ping', (_req, res) => res.json({ pong: true }));

// Usuário precisa estar logado
router.post('/', auth, orgCtl.createOrg);
router.post('/:id/invite', auth, orgCtl.generateInvite);
router.post('/join', auth, orgCtl.joinByCode);
router.get('/mine', auth, orgCtl.myOrgs);

module.exports = router;
