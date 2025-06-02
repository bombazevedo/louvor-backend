require('dotenv').config();
const axios = require('axios');
const _ = require('lodash');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

let spotifyToken = null;
let tokenExpiresAt = 0;

// 🔑 Autenticação do Spotify
const getSpotifyToken = async () => {
  const now = Date.now();
  if (spotifyToken && now < tokenExpiresAt) return spotifyToken;

  try {
    const res = await axios.post(
      'https://accounts.spotify.com/api/token',
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization:
            'Basic ' + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64'),
        },
      }
    );

    spotifyToken = res.data.access_token;
    tokenExpiresAt = now + res.data.expires_in * 1000;
    return spotifyToken;
  } catch (err) {
    console.error('❌ Erro ao obter token do Spotify:', err.message);
    throw new Error('Falha na autenticação com o Spotify');
  }
};

// 🔍 Buscas
const searchYouTube = async (query) => {
  try {
    const res = await axios.get(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`
    );

    return res.data.items
      .filter(item => item.id && item.id.videoId)
      .map(item => ({
        name: item.snippet.title,
        artist: item.snippet.channelTitle,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        platform: 'YouTube',
      }));
  } catch (err) {
    console.error('❌ Erro ao buscar no YouTube:', err.message);
    return [];
  }
};

const searchDeezer = async (query) => {
  try {
    const res = await axios.get(`https://api.deezer.com/search?q=${encodeURIComponent(query)}`);
    return res.data.data.slice(0, 5).map(track => ({
      name: track.title,
      artist: track.artist.name,
      url: track.link,
      platform: 'Deezer',
    }));
  } catch (err) {
    console.error('❌ Erro ao buscar no Deezer:', err.message);
    return [];
  }
};

const searchSpotify = async (query) => {
  try {
    const token = await getSpotifyToken();
    const res = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return res.data.tracks.items.map(track => ({
      name: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      url: track.external_urls.spotify,
      platform: 'Spotify',
    }));
  } catch (err) {
    console.error('❌ Erro ao buscar no Spotify:', err.message);
    return [];
  }
};

// 🔁 Busca unificada
const unifiedSearch = async (query) => {
  try {
    const [yt, dz, sp] = await Promise.all([
      searchYouTube(query),
      searchDeezer(query),
      searchSpotify(query),
    ]);
    return [...yt, ...dz, ...sp];
  } catch (err) {
    console.error('❌ unifiedSearch falhou:', err.message);
    return [];
  }
};

// 🔧 Utilidades de match
const normalize = str =>
  str?.toLowerCase().replace(/[^\w\s]/gi, '').trim();

const calcSimilarity = (a, b) => {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;

  const wordsA = new Set(na.split(/\s+/));
  const wordsB = new Set(nb.split(/\s+/));
  const inter = [...wordsA].filter(w => wordsB.has(w));
  return inter.length / Math.max(wordsA.size, wordsB.size);
};

const matchVersionsAcrossPlatforms = async ({ name, artist, platform, url }) => {
  const query = `${name} ${artist}`;
  const results = await unifiedSearch(query);

  const filtered = results.filter(r => r.platform !== platform);

  // Agrupar e escolher o melhor de cada plataforma
  const bestByPlatform = _(filtered)
    .groupBy('platform')
    .map((tracks, platform) => {
      const ranked = tracks.map(t => ({
        ...t,
        score: calcSimilarity(t.name, name) * 0.6 + calcSimilarity(t.artist, artist) * 0.4,
      })).sort((a, b) => b.score - a.score);

      return ranked[0] ? { platform, url: ranked[0].url } : null;
    })
    .filter(Boolean)
    .value();

  return {
    name,
    artist,
    platform,
    url,
    alternatives: bestByPlatform
  };
};

module.exports = {
  searchYouTube,
  searchDeezer,
  searchSpotify,
  unifiedSearch,
  matchVersionsAcrossPlatforms,
};
