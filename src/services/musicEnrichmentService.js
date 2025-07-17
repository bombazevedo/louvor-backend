// src/services/musicEnrichmentService.js
const axios = require('axios');

// 🔐 Gera token dinâmico do Spotify
async function getSpotifyToken() {
  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error('[Spotify Token] Erro ao obter token:', error?.response?.data || error.message);
    return null;
  }
}

// 🎧 Spotify
async function fetchFromSpotify(title, artist) {
  try {
    const token = await getSpotifyToken();
    if (!token) return {};

    const query = encodeURIComponent(`${title} ${artist}`);
    const url = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const track = response.data.tracks?.items?.[0];
    if (!track) return {};

    return {
      album: track.album?.name || null,
      duration: track.duration_ms ? Math.floor(track.duration_ms / 1000) : null,
      key: null,
      coverUrl: track.album?.images?.[0]?.url || null
    };
  } catch (error) {
    console.error('[Enrichment] Spotify erro:', error?.response?.data || error.message);
    return {};
  }
}

// 🎧 Deezer
async function fetchFromDeezer(title, artist) {
  try {
    const query = encodeURIComponent(`${title} ${artist}`);
    const url = `https://api.deezer.com/search?q=${query}&limit=1`;

    const response = await axios.get(url);
    const track = response.data.data?.[0];
    if (!track) return {};

    return {
      bpm: track.bpm || null,
      duration: track.duration || null,
      album: track.album?.title || null,
      coverUrl: track.album?.cover_medium || null
    };
  } catch (error) {
    console.error('[Enrichment] Deezer erro:', error?.response?.data || error.message);
    return {};
  }
}

// 🔄 Enriquecimento cruzado
async function enrichSong(song) {
  const { title, artist } = song;
  const [spotifyData, deezerData] = await Promise.all([
    fetchFromSpotify(title, artist),
    fetchFromDeezer(title, artist)
  ]);

  return {
    bpm: deezerData.bpm || null,
    key: spotifyData.key || null,
    duration: spotifyData.duration || deezerData.duration || null,
    album: spotifyData.album || deezerData.album || null,
    coverUrl: spotifyData.coverUrl || deezerData.coverUrl || song.coverUrl
  };
}

module.exports = {
  enrichSong
};
