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
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error('[Spotify Token] ❌ Erro ao obter token:', error?.response?.data || error.message);
    return null;
  }
}

// 🎼 Mapeamento do número para nota musical
const KEY_MAP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// 🔑 Busca a tonalidade (key) via Spotify Audio Features
async function fetchKeyFromSpotify(spotifyUrl) {
  try {
    if (!spotifyUrl) return null;
    const match = spotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
    if (!match) return null;
    const id = match[1];
    const token = await getSpotifyToken();
    if (!token) return null;

    const res = await axios.get(`https://api.spotify.com/v1/audio-features/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.data && typeof res.data.key === 'number' && typeof res.data.mode === 'number') {
      const note = KEY_MAP[res.data.key];
      const keyName = note + (res.data.mode === 1 ? '' : 'm');
      console.log(`[enrichment] 🎼 Key encontrada no Spotify: ${keyName} (raw=${res.data.key}, mode=${res.data.mode})`);
      return keyName;
    }
    return null;
  } catch (err) {
    console.error('[Enrichment] ❌ Spotify key fetch erro:', err?.response?.data || err.message);
    return null;
  }
}

// 🎧 Spotify → album, duration, coverUrl
async function fetchFromSpotify(title, artist) {
  try {
    const token = await getSpotifyToken();
    if (!token) return {};

    const query = encodeURIComponent(`${title} ${artist}`);
    const searchUrl = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;

    const searchRes = await axios.get(searchUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const track = searchRes.data.tracks?.items?.[0];
    if (!track || !track.id) {
      console.warn('[Spotify] ⚠️ Nenhuma faixa encontrada.');
      return {};
    }

    console.log('[Spotify] 🎧 Resultado do enrichment:', {
      album: track.album?.name || null,
      duration: track.duration_ms ? Math.floor(track.duration_ms / 1000) : null,
      coverUrl: track.album?.images?.[0]?.url || null,
      spotifyUrl: track.external_urls?.spotify || null,
      spotifyTrackId: track.id
    });

    return {
      album: track.album?.name || null,
      duration: track.duration_ms ? Math.floor(track.duration_ms / 1000) : null,
      coverUrl: track.album?.images?.[0]?.url || null,
      spotifyUrl: track.external_urls?.spotify || null,
      spotifyTrackId: track.id
    };
  } catch (error) {
    console.error('[Enrichment] ❌ Spotify erro:', error?.response?.data || error.message);
    return {};
  }
}

// 🎧 Deezer → bpm, album, duration, coverUrl
async function fetchFromDeezer(title, artist) {
  try {
    const query = encodeURIComponent(`${title} ${artist}`);
    const searchUrl = `https://api.deezer.com/search?q=${query}&limit=1`;

    const searchRes = await axios.get(searchUrl);
    const track = searchRes.data.data?.[0];
    if (!track || !track.id) {
      console.warn('[Deezer] ⚠️ Nenhuma faixa encontrada.');
      return {};
    }

    const detailedRes = await axios.get(`https://api.deezer.com/track/${track.id}`);
    const detailed = detailedRes.data;

    console.log('[Deezer] 🎯 Faixa detalhada:', detailed);

    return {
      bpm: detailed.bpm || null,
      duration: detailed.duration || null,
      album: detailed.album?.title || null,
      coverUrl: detailed.album?.cover_medium || null,
      deezerUrl: detailed.link || null
    };
  } catch (error) {
    console.error('[Enrichment] ❌ Deezer erro:', error?.response?.data || error.message);
    return {};
  }
}

// 🔄 Enriquecimento cruzado
async function enrichSong(song) {
  const { title, artist, spotifyUrl, deezerUrl, coverUrl } = song;
  console.log(`[enrichSong] Iniciando enrichment:`, { title, artist, spotifyUrl });

  const [spotifyData, deezerData] = await Promise.all([
    fetchFromSpotify(title, artist),
    fetchFromDeezer(title, artist),
  ]);

  let key = null;
  const finalSpotifyUrl = spotifyUrl || spotifyData.spotifyUrl || null;
  if (finalSpotifyUrl) {
    key = await fetchKeyFromSpotify(finalSpotifyUrl);
  }

  console.log('[enrichSong] 🔍 Dados retornados:', { spotifyData, deezerData, key });

  return {
    bpm: deezerData.bpm || null,
    key: key || null,
    duration: spotifyData.duration || deezerData.duration || null,
    album: spotifyData.album || deezerData.album || null,
    coverUrl: coverUrl || spotifyData.coverUrl || deezerData.coverUrl || null,
    spotifyUrl: finalSpotifyUrl,
    deezerUrl: deezerData.deezerUrl || (deezerUrl !== undefined ? deezerUrl : null)
  };
}

module.exports = {
  enrichSong,
};
