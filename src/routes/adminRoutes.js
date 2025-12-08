// routes/adminRoutes.js
const express = require('express');
const router = express.Router();

const adminAuth = require('../middleware/adminAuth');
const {
  getDbInfo,
  listOrgs,
  updateOrgLicense,
  listUsers,
  deleteUser,
  purgeAllSongs,
  purgeCollection,
} = require('../controllers/adminController');

// 🔐 Todas as rotas admin exigem o header X-Admin-Secret
router.use(adminAuth);

// 📊 Info do banco (nome do DB + collections)
router.get('/db-info', getDbInfo);

// 🏛 Organizações / planos
router.get('/orgs', listOrgs);
router.patch('/orgs/:id/license', updateOrgLicense);

// 👥 Usuários
router.get('/users', listUsers);
router.delete('/users/:id', deleteUser);

// 🎵 Songs (apagar tudo)
router.delete('/songs', purgeAllSongs);

// 🧹 Qualquer coleção (com ou sem filtro)
router.post('/collections/:name/purge', purgeCollection);

module.exports = router;
