// src/routes/adminRoutes.js
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

// Todas as rotas admin exigem o header X-Admin-Secret
router.use(adminAuth);

// INFO DE BANCO
router.get('/db-info', getDbInfo);

// ORGANIZAÇÕES / PLANOS
router.get('/orgs', listOrgs);
router.patch('/orgs/:id/license', updateOrgLicense);

// USUÁRIOS
router.get('/users', listUsers);
router.delete('/users/:id', deleteUser);

// SONGS
router.delete('/songs', purgeAllSongs);

// GENÉRICO DE COLEÇÃO
router.post('/collections/:name/purge', purgeCollection);

module.exports = router;
