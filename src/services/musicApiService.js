require('dotenv').config();
const axios = require('axios');

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

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
    tokenExpiresAt = now + res.data.expires_in * 1000;
    return spotifyToken;
  } catch (err) {
    console.error('❌ Erro ao obter token do Spotify:', err.message);
    throw new Error('Falha na autenticação com o Spotify');
  }
};

const normalize = (text = '') =>
  text.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

const searchYouTube = async (query) => {
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`;
    const res = await axios.get(url);

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
    console.error('[musicApiService] ❌ Erro ao buscar no YouTube:',
      err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
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

  const nameNorm = normalize(name);
  const artistNorm = normalize(artist);
  const urlBase = url?.split('?')[0]?.trim() || '';

  const isSameVersion = (a) => {
    const normName = normalize(a.name);
    const normArtist = normalize(a.artist);
    return (
      (normName.includes(nameNorm) || nameNorm.includes(normName)) &&
      (normArtist.includes(artistNorm) || artistNorm.includes(normArtist))
    );
  };

  const filtered = results.filter(r => {
    const resultUrl = r.url?.split('?')[0]?.trim() || '';
    return r.platform !== platform &&
           isSameVersion(r) &&
           resultUrl !== urlBase;
  });

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
