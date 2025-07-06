require('dotenv').config();
const axios = require('axios');

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// ✅ Leitura dinâmica de chaves YouTube API numeradas
const YT_KEYS = Array.from({ length: 10 }, (_, i) => process.env[`YOUTUBE_API_KEY_${i + 1}`]).filter(Boolean);

let spotifyToken = null;
let tokenExpiresAt = 0;
let currentIndex = 0;
const failedKeys = new Set();

const getSpotifyToken = async () => {
  const now = Date.now();
  if (spotifyToken && now < tokenExpiresAt) {
    return spotifyToken;
  }

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

// ✅ Busca YouTube com fallback inteligente entre múltiplas chaves
const searchYouTube = async (query) => {
  const total = YT_KEYS.length;

  for (let i = 0; i < total; i++) {
    const index = (currentIndex + i) % total;
    const key = YT_KEYS[index];

    if (!key || failedKeys.has(key)) continue;

    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${encodeURIComponent(query)}&key=${key}`;
      const res = await axios.get(url);

      currentIndex = index;
      return res.data.items
        .filter(item => item.id?.videoId)
        .map(item => ({
          name: item.snippet.title,
          artist: item.snippet.channelTitle,
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
          platform: 'YouTube',
          thumbnail: item.snippet.thumbnails?.medium?.url || ''
        }));

    } catch (err) {
      const reason = err.response?.data?.error?.errors?.[0]?.reason;
      if (reason === 'quotaExceeded') {
        failedKeys.add(key);
        console.warn(`🔁 Chave estourada ignorada: ${key}`);
        continue;
      }
      console.error(`❌ Erro inesperado na chave ${key}:`, err.message);
      break;
    }
  }

  console.error('❌ Todas as chaves falharam ou atingiram a quota.');
  return [];
};

const searchDeezer = async (query) => {
  try {
    const res = await axios.get(`https://api.deezer.com/search?q=${encodeURIComponent(query)}`);
    return res.data.data.slice(0, 5).map(track => ({
      name: track.title,
      artist: track.artist.name,
      url: track.link,
      platform: 'Deezer',
      thumbnail: track.album?.cover_medium || ''
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
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return res.data.tracks.items.map(track => ({
      name: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      url: track.external_urls.spotify,
      platform: 'Spotify',
      thumbnail: track.album?.images?.[0]?.url || ''
    }));
  } catch (err) {
    console.error('❌ Erro ao buscar no Spotify:', err.message);
    return [];
  }
};

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

const matchVersionsAcrossPlatforms = async ({ name, artist, platform, url }) => {
  const query = `${name} ${artist}`;
  const results = await unifiedSearch(query);

  const isSameVersion = (a, b) =>
    a.name.toLowerCase().includes(b.name.toLowerCase()) &&
    a.artist.toLowerCase().includes(b.artist.toLowerCase());

  const filtered = results.filter(
    (r) => r.platform !== platform && isSameVersion(r, { name, artist })
  );

  return {
    name,
    artist,
    url,
    platform,
    alternatives: filtered.map(({ platform, url }) => ({ platform, url }))
  };
};

module.exports = {
  searchYouTube,
  searchDeezer,
  searchSpotify,
  unifiedSearch,
  matchVersionsAcrossPlatforms,
};
