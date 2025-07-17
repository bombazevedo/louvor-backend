// src/services/musicEnrichmentService.js
const axios = require('axios');

async function fetchFromSpotify(title, artist) {
  try {
    const query = encodeURIComponent(`${title} ${artist}`);
    const url = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;

    const token = process.env.SPOTIFY_TOKEN;
    if (!token) throw new Error('SPOTIFY_TOKEN não definido no .env');

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
      key: null, // Spotify não retorna "key" diretamente sem API especial
      coverUrl: track.album?.images?.[0]?.url || null
    };
  } catch (error) {
    console.error('[Enrichment] Spotify erro:', error?.response?.data || error.message);
    return {};
  }
}

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

async function enrichSong(song) {
  const { title, artist } = song;
  const spotifyData = await fetchFromSpotify(title, artist);
  const deezerData = await fetchFromDeezer(title, artist);

  // Combina os dados, priorizando Spotify, depois Deezer
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
