// src/routes/songRoutes.js
const express = require('express');
const router = express.Router();
const songController = require('../controllers/songController');
const { unifiedSearch } = require('../services/musicApiService');

// Rota para criar nova música
router.post('/', songController.createSong);

// Rota para listar todas músicas
router.get('/', songController.getAllSongs);

// Rota para buscar músicas em Spotify, YouTube e Deezer
router.get('/search-external', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Query param "q" is required.' });

  try {
    const results = await unifiedSearch(query);

    if (!Array.isArray(results)) {
      console.warn('⚠️ unifiedSearch não retornou um array válido:', results);
      return res.status(502).json({ error: 'Erro na integração com as plataformas de música.' });
    }

    res.json(results);
  } catch (err) {
    console.error(`❌ Erro ao buscar músicas externas para query "${query}":`, err.stack || err.message);
    res.status(500).json({ error: 'Erro interno ao buscar músicas.' });
  }
});

module.exports = router;
