const express = require('express');
const router = express.Router();
const songController = require('../controllers/songController');
const { unifiedSearch, matchVersionsAcrossPlatforms } = require('../services/musicApiService');

// Importe os middlewares de autenticação e autorização (ajuste o caminho conforme seu projeto)
const { authenticate, isCoordinator } = require('../middleware/auth');

router.post('/', songController.createSong);

router.get('/', songController.getAllSongs);

// 🔍 Rota externa de busca
router.get('/search-external', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Query param "q" is required.' });

  try {
    const results = await unifiedSearch(query);
    if (!Array.isArray(results)) {
      console.warn('⚠️ unifiedSearch não retornou um array válido:', results);
      return res.status(502).json({ error: 'Erro na integração com plataformas externas.' });
    }
    res.json(results);
  } catch (err) {
    console.error('❌ Erro ao buscar músicas externas:', err.stack || err.message);
    res.status(500).json({ error: 'Erro interno ao buscar músicas.' });
  }
});

// ✅ NOVO endpoint para retornar equivalência exata da versão da música
router.post('/match', async (req, res) => {
  const { name, artist, platform, url } = req.body;
  if (!name || !artist || !platform || !url)
    return res.status(400).json({ error: 'Campos obrigatórios: name, artist, platform, url.' });

  try {
    const matched = await matchVersionsAcrossPlatforms({ name, artist, platform, url });
    res.json(matched);
  } catch (err) {
    console.error('Erro ao fazer matching de versões:', err.message);
    res.status(500).json({ error: 'Erro interno ao procurar versões equivalentes.' });
  }
});

// ✅ Endpoint PATCH /api/songs/:id/enrich (protege para coordenadores/admins)
router.patch('/:id/enrich', authenticate, isCoordinator, songController.updateSongEnrichment);

// ✅ Endpoint GET /api/songs/:id (ajuste: use diretamente o controller padrão)
router.get('/:id', songController.getSongById);

module.exports = router;
