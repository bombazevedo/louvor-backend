
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
    res.json(results);
  } catch (err) {
    console.error('Erro ao buscar músicas externas:', err);
    res.status(500).json({ error: 'Erro interno ao buscar músicas.' });
  }
});

module.exports = router;
