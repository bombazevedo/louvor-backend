require('dotenv').config();
const axios = require('axios');

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// ✅ Agora só uma chave YouTube
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
console.log('[musicApiService] 🟢 process.env.YOUTUBE_API_KEY:', YOUTUBE_API_KEY);

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

// ✅ Busca YouTube com UMA chave
const searchYouTube = async (query) => {
  try {
    // 🟢 LOG: Query recebida
    console.log('[musicApiService] 🔍 searchYouTube query:', query);

    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`;
    
    // 🟢 LOG: URL final usada
    console.log('[musicApiService] 🌐 YouTube API URL:', url);

    const res = await axios.get(url);

    // 🟢 LOG: Retorno bruto
    console.log('[musicApiService] ✅ YouTube API response:', JSON.stringify(res.data, null, 2));

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
    // 🟢 LOG: Erro detalhado
    console.error(
      '[musicApiService] ❌ Erro ao buscar no YouTube:',
      err.response ? JSON.stringify(err.response.data, null, 2) : err.message
    );
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
    console.log('[musicApiService] 🟢 unifiedSearch INICIADA com query:', query);

const promises = [
  searchYouTube(query),
  searchDeezer(query),
  searchSpotify(query),
];

console.log('[musicApiService] 🟢 Promises criadas:', promises.map(p => typeof p));

const [yt, dz, sp] = await Promise.all(promises);

console.log('[musicApiService] 🟢 Resultado YouTube:', yt);
console.log('[musicApiService] 🟢 Resultado Deezer:', dz);
console.log('[musicApiService] 🟢 Resultado Spotify:', sp);

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
