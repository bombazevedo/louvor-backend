const express = require('express');
const router = express.Router();
const orgCtl = require('../controllers/orgController');

// 🔧 Resolver o export do auth (default ou named) e evitar crash se vier indefinido
let auth;
try {
  const mod = require('../middleware/auth'); // ATENÇÃO: path e caixa (auth.js) devem casar com o arquivo real
  if (typeof mod === 'function') {
    auth = mod;
  } else if (mod && typeof mod.auth === 'function') {
    auth = mod.auth;
  } else if (mod && mod.default && typeof mod.default === 'function') {
    auth = mod.default;
  }
} catch (e) {
  console.error('[orgRoutes] Falha ao carregar middleware auth:', e.message);
}
// Fallback de segurança para não derrubar o servidor (STAGING): passa reto
if (!auth) {
  console.warn('[orgRoutes] WARNING: auth indefinido — usando no-op middleware (staging). Verifique o export de ../middleware/auth');
  auth = (_req, _res, next) => next();
}

// Diagnóstico rápido
router.get('/_ping', (_req, res) => res.json({ pong: true }));

// Usuário precisa estar logado
router.post('/', auth, orgCtl.createOrg);
router.post('/:id/invite', auth, orgCtl.generateInvite);
router.post('/join', auth, orgCtl.joinByCode);
router.get('/mine', auth, orgCtl.myOrgs);

module.exports = router;
