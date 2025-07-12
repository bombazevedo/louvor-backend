// backend/routes/musicRoutes.js
const express = require('express');
const router = express.Router();
const musicController = require('../controllers/musicController');
const auth = require('../middleware/auth'); // Importa middleware de autenticação

// GET /api/music/search/:platform?q=title+artist
router.get('/search/:platform', musicController.searchPlatform);

// POST /api/music/match (com body: { name, artist, platform, url })
router.post('/match', musicController.matchVersions);

// ✅ ROTA para: POST /api/music/search
router.post('/search', musicController.searchMusic);

// ✅ ROTA para: POST /api/music/search-versions
router.post('/search-versions', musicController.searchVersions);

// 🟢 NOVA ROTA: Retorna histórico do usuário logado
router.get('/history', auth, musicController.getUserSearchHistory);

// 🟢 NOVA ROTA: Salva termo buscado pelo usuário logado
router.post('/history', auth, musicController.saveUserSearchTerm);

module.exports = router;
