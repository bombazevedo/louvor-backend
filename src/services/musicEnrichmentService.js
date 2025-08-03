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

function normalize(text = '') {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

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
async function fetchFromSpotify(title, artist, spotifyUrl = null) {
  try {
    const token = await getSpotifyToken();
    if (!token) return {};

    let track;
    if (spotifyUrl) {
      const match = spotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
      if (match) {
        const id = match[1];
        const detailRes = await axios.get(`https://api.spotify.com/v1/tracks/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        track = detailRes.data;
      }
    }

    if (!track) {
      const query = encodeURIComponent(`${title} ${artist}`);
      const searchUrl = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;

      const searchRes = await axios.get(searchUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const candidate = searchRes.data.tracks?.items?.[0];
      if (!candidate) return {};

      const titleNorm = normalize(title);
      const artistNorm = normalize(artist);
      const matchTitle = normalize(candidate.name);
      const matchArtist = normalize(candidate.artists?.[0]?.name || '');

      if (!matchTitle.includes(titleNorm) && !titleNorm.includes(matchTitle)) return {};
      if (!matchArtist.includes(artistNorm) && !artistNorm.includes(matchArtist)) return {};

      track = candidate;
    }

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
async function fetchFromDeezer(title, artist, deezerUrl = null) {
  try {
    let track;

    if (deezerUrl) {
      const match = deezerUrl.match(/track\/(\d+)/);
      if (match) {
        const id = match[1];
        const detailRes = await axios.get(`https://api.deezer.com/track/${id}`);
        track = detailRes.data;
      }
    }

    if (!track) {
      const query = encodeURIComponent(`${title} ${artist}`);
      const searchUrl = `https://api.deezer.com/search?q=${query}&limit=1`;

      const searchRes = await axios.get(searchUrl);
      const candidate = searchRes.data.data?.[0];
      if (!candidate || !candidate.id) return {};

      const matchTitle = normalize(candidate.title);
      const matchArtist = normalize(candidate.artist?.name || '');
      const titleNorm = normalize(title);
      const artistNorm = normalize(artist);

      if (!matchTitle.includes(titleNorm) && !titleNorm.includes(matchTitle)) return {};
      if (!matchArtist.includes(artistNorm) && !artistNorm.includes(matchArtist)) return {};

      const detailRes = await axios.get(`https://api.deezer.com/track/${candidate.id}`);
      track = detailRes.data;
    }

    return {
      bpm: track.bpm || null,
      duration: track.duration || null,
      album: track.album?.title || null,
      coverUrl: track.album?.cover_medium || null,
      deezerUrl: track.link || null
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
    fetchFromSpotify(title, artist, spotifyUrl),
    fetchFromDeezer(title, artist, deezerUrl),
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
