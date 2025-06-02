// backend/routes/musicRoutes.js
const express = require('express');
const router = express.Router();
const musicController = require('../controllers/musicController');

// GET /api/music/search/:platform?q=title+artist
router.get('/search/:platform', musicController.searchPlatform);

// POST /api/music/match (com body: { name, artist, platform, url })
router.post('/match', musicController.matchVersions);

// ✅ NOVA ROTA para: POST /api/musics/search-versions
router.post('/search-versions', musicController.searchVersions);

module.exports = router;
