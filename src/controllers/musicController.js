// backend/controllers/musicController.js
const {
  searchSpotify,
  searchYouTube,
  searchDeezer,
  matchVersionsAcrossPlatforms,
} = require('../services/musicApiService');

exports.searchPlatform = async (req, res) => {
  const { platform } = req.params;
  const { q } = req.query;

  if (!q) return res.status(400).json({ error: 'Missing search query.' });

  try {
    let results = [];
    if (platform === 'spotify') results = await searchSpotify(q);
    if (platform === 'youtube') results = await searchYouTube(q);
    if (platform === 'deezer') results = await searchDeezer(q);
    else if (!['spotify', 'youtube', 'deezer'].includes(platform)) {
      return res.status(400).json({ error: 'Invalid platform.' });
    }
    res.json(results);
  } catch (err) {
    console.error(`❌ Erro ao buscar em ${platform}:`, err.message);
    res.status(500).json({ error: 'Search failed' });
  }
};

exports.matchVersions = async (req, res) => {
  try {
    const result = await matchVersionsAcrossPlatforms(req.body);
    res.json(result);
  } catch (err) {
    console.error('❌ Erro ao buscar versões relacionadas:', err.message);
    res.status(500).json({ error: 'Match failed' });
  }
};
