// backend/controllers/musicController.js

const {
  searchSpotify,
  searchYouTube,
  searchDeezer,
  matchVersionsAcrossPlatforms,
} = require('../services/musicApiService');

const SearchCache = require('../models/SearchCache'); // Importa o modelo do cache

// 🔍 Busca em plataforma única
exports.searchPlatform = async (req, res) => {
  const { platform } = req.params;
  const { q } = req.query;

  if (!q) return res.status(400).json({ error: 'Missing search query.' });

  try {
    let results = [];

    if (platform === 'spotify') results = await searchSpotify(q);
    else if (platform === 'youtube') results = await searchYouTube(q);
    else if (platform === 'deezer') results = await searchDeezer(q);
    else {
      return res.status(400).json({ error: 'Invalid platform.' });
    }

    res.json(results);
  } catch (err) {
    console.error(`❌ Erro ao buscar em ${platform}:`, err.message);
    res.status(500).json({ error: 'Search failed' });
  }
};

// 🎯 Match direto de versões similares (usado internamente)
exports.matchVersions = async (req, res) => {
  try {
    const result = await matchVersionsAcrossPlatforms(req.body);
    res.json(result);
  } catch (err) {
    console.error('❌ Erro ao buscar versões relacionadas:', err.message);
    res.status(500).json({ error: 'Match failed' });
  }
};

// 🔥 Rota principal usada pelo frontend para sugerir versões alternativas
exports.searchVersions = async (req, res) => {
  const { title, artist, excludePlatform, url } = req.body;

  if (!title || !artist) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes: title e artist' });
  }

  try {
    const result = await matchVersionsAcrossPlatforms({
      name: title,
      artist,
      platform: excludePlatform || null,
      url: url || null,
    });

    res.json(result);
  } catch (err) {
    console.error('❌ Erro em searchVersions:', err.message);
    res.status(500).json({ error: 'Erro ao buscar versões' });
  }
};

// 🚀 Nova rota principal com cache e enriquecimento completo
exports.searchMusic = async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Campo "query" obrigatório.' });
  }

  try {
    const normalizedQuery = query.trim().toLowerCase();

    // Verifica cache
    const cached = await SearchCache.findOne({ query: normalizedQuery });
    if (cached && cached.updatedAt > Date.now() - 24 * 60 * 60 * 1000) {
      return res.json(cached.results);
    }

    // Busca nas APIs externas
    const [ytResults, spResults, dzResults] = await Promise.all([
      searchYouTube(normalizedQuery),
      searchSpotify(normalizedQuery),
      searchDeezer(normalizedQuery),
    ]);

    const allResults = [...ytResults, ...spResults, ...dzResults];

    // Salva no cache
    await SearchCache.findOneAndUpdate(
      { query: normalizedQuery },
      { results: allResults, updatedAt: new Date() },
      { upsert: true }
    );

    res.json(allResults);
  } catch (err) {
    console.error('❌ Erro em searchMusic:', err.message);
    res.status(500).json({ error: 'Erro ao buscar músicas' });
  }
};
