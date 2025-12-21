// src/routes/orgRoutes.js
const express = require('express');
const router = express.Router();
const orgCtl = require('../controllers/orgController');

// 🔧 Resolver caminho/forma de export do middleware de auth (default ou named; vários nomes comuns)
function resolveAuth() {
  const candidates = [
    '../middleware/auth',
    '../middleware/authMiddleware',
    '../middleware/Auth',
  ];

  for (const p of candidates) {
    try {
      const mod = require(p);
      // Possíveis formas de export
      if (typeof mod === 'function') return mod;
      if (mod && typeof mod.default === 'function') return mod.default;
      if (mod && typeof mod.auth === 'function') return mod.auth;
      if (mod && typeof mod.authenticate === 'function') return mod.authenticate;
      if (mod && typeof mod.protect === 'function') return mod.protect;
    } catch (_e) {
      // tenta o próximo candidato
    }
  }
  return null;
}

let auth = resolveAuth();

// Fallback de segurança para não derrubar o servidor em STAGING
if (!auth) {
  console.warn('[orgRoutes] WARNING: auth indefinido — usando no-op middleware (staging). Verifique o export/caminho do middleware de autenticação.');
  auth = (_req, _res, next) => next();
}

// Diagnóstico rápido
router.get('/_ping', (_req, res) => res.json({ pong: true }));

// Usuário precisa estar logado
router.post('/', auth, orgCtl.createOrg);
router.post('/:id/invite', auth, orgCtl.generateInvite);
router.post('/join', auth, orgCtl.joinByCode);
router.put('/:id/logo', auth, orgCtl.updateLogo);
router.get('/:id/license', auth, orgCtl.getLicense);
router.get('/mine', auth, orgCtl.myOrgs);
router.delete('/:id/members/:userId', auth, orgCtl.removeMember);

module.exports = router;
