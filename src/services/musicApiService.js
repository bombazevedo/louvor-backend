require('dotenv').config();
const axios = require('axios');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

let spotifyToken = null;
let tokenExpiresAt = 0;

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
    // Salva o tempo de expiração do token
    tokenExpiresAt = now + res.data.expires_in * 1000;
    return spotifyToken;
  } catch (err) {
    console.error('❌ Erro ao obter token do Spotify:', err.message);
    throw new Error('Falha na autenticação com o Spotify');
  }
};

const searchYouTube = async (query) => {
  try {
    const res = await axios.get(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`
    );

    return res.data.items
      .filter(item => item.id && item.id.videoId)
      .map((item) => ({
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
    return res.data.data.slice(0, 5).map((track) => ({
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
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return res.data.tracks.items.map((track) => ({
      name: track.name,
      artist: track.artists.map((a) => a.name).join(', '),
      url: track.external_urls.spotify,
      platform: 'Spotify',
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
