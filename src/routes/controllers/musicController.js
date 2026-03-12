const {
  searchSpotify,
  searchYouTube,
  searchDeezer,
  matchVersionsAcrossPlatforms,
} = require('../services/musicApiService');

const { enrichSong } = require('../services/musicEnrichmentService');
const Song = require('../models/Song');
const SearchCache = require('../models/SearchCache');
const SearchHistory = require('../models/SearchHistory');

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

// 🎯 Match direto de versões similares
exports.matchVersions = async (req, res) => {
  try {
    const result = await matchVersionsAcrossPlatforms(req.body);
    res.json(result);
  } catch (err) {
    console.error('❌ Erro ao buscar versões relacionadas:', err.message);
    res.status(500).json({ error: 'Match failed' });
  }
};

// 🔥 Usado para sugerir versões alternativas no frontend
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

// 🚀 Enriquecimento + criação definitiva da música
exports.createSong = async (req, res) => {
  try {
    const {
      title,
      artist,
      youtubeUrl,
      coverUrl,
      album,
      spotifyUrl,
      deezerUrl,
      platform,
      id
    } = req.body;

    if (!title || !artist) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
    }

    const enrichment = await enrichSong({
      title,
      artist,
      spotifyUrl,
      deezerUrl,
      coverUrl,
      platform,
      id
    });

    const newSong = new Song({
      title,
      artist,
      youtubeUrl: youtubeUrl || null,
      coverUrl: enrichment.coverUrl || coverUrl || null,
      album: enrichment.album || album || '',
      bpm: enrichment.bpm || null,
      duration: enrichment.duration || null,
      key: enrichment.key || null,
      spotifyUrl: enrichment.spotifyUrl || spotifyUrl || null,
      deezerUrl: enrichment.deezerUrl || deezerUrl || null
    });

    await newSong.save();
    res.status(201).json(newSong);
  } catch (err) {
    console.error('❌ Erro ao criar música:', err.message);
    res.status(500).json({ error: 'Erro ao salvar música' });
  }
};

// 🟢 Busca com cache e enriquecimento cruzado
exports.searchMusic = async (req, res) => {
  let { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Campo "query" obrigatório.' });
  }

  if (typeof query === 'object' && query !== null) {
    const name = query.name || '';
    const artist = query.artist || '';
    query = `${name} ${artist}`.trim();
  }

  if (typeof query !== 'string' || query.trim() === '') {
    return res.status(400).json({ error: 'Campo "query" deve ser uma string válida.' });
  }

  try {
    const normalizedQuery = query.trim().toLowerCase();
    const cached = await SearchCache.findOne({ query: normalizedQuery });

    if (cached && cached.updatedAt > Date.now() - 24 * 60 * 60 * 1000) {
      return res.json(cached.results);
    }

    const [ytResults, spResults, dzResults] = await Promise.all([
      searchYouTube(normalizedQuery),
      searchSpotify(normalizedQuery),
      searchDeezer(normalizedQuery),
    ]);

    const allResults = [...ytResults, ...spResults, ...dzResults];

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

// 🔁 Histórico do usuário: GET
exports.getUserSearchHistory = async (req, res) => {
  try {
    const history = await SearchHistory.find({ userId: req.user.id })
      .sort({ searchedAt: -1 })
      .limit(20);

    res.json(history);
  } catch (err) {
    console.error('❌ Erro ao buscar histórico do usuário:', err.message);
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
};

// 🔁 Histórico do usuário: POST
exports.saveUserSearchTerm = async (req, res) => {
  const { term } = req.body;

  if (!term || typeof term !== 'string' || term.trim() === '') {
    return res.status(400).json({ error: 'Campo "term" obrigatório.' });
  }

  const normalizedTerm = term.trim().toLowerCase();

  try {
    await SearchHistory.findOneAndUpdate(
      { userId: req.user.id, term: normalizedTerm },
      { searchedAt: new Date() },
      { upsert: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Erro ao salvar termo no histórico:', err.message);
    res.status(500).json({ error: 'Erro ao salvar histórico' });
  }
};
