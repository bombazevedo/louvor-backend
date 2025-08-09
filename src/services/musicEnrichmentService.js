const axios = require('axios');
const { normalizeTitle, normalizeArtist } = require('../utils/normalizeMusicMeta');

const KEY_MAP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function normalize(text = '') {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

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
      console.log(`[enrichment] 🎼 Key encontrada no Spotify: ${keyName}`);
      return keyName;
    }
    return null;
  } catch (err) {
    console.error('[Enrichment] ❌ Spotify key fetch erro:', err?.response?.data || err.message);
    return null;
  }
}

async function fetchFromSpotify(title, artist, spotifyUrl = null, platformId = null) {
  try {
    const token = await getSpotifyToken();
    if (!token) return {};

    let track;
    const idFromUrl = spotifyUrl?.match(/track\/([a-zA-Z0-9]+)/)?.[1];
    const id = platformId || idFromUrl;
    if (id) {
      const detailRes = await axios.get(`https://api.spotify.com/v1/tracks/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      track = detailRes.data;
    }

    if (!track && title && artist) {
      const query = encodeURIComponent(`${normalizeTitle(title)} ${normalizeArtist(artist)}`);
      const searchUrl = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;

      const searchRes = await axios.get(searchUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const candidate = searchRes.data.tracks?.items?.[0];
      if (!candidate) return {};

      const matchTitle = normalize(candidate.name);
      const matchArtist = normalize(candidate.artists?.[0]?.name || '');

      const originalTitle = normalize(title);
      const originalArtist = normalize(artist);

      if (!matchTitle.includes(originalTitle) && !originalTitle.includes(matchTitle)) return {};
      if (!matchArtist.includes(originalArtist) && !originalArtist.includes(matchArtist)) return {};

      track = candidate;
    }

    return {
      album: track?.album?.name || null,
      duration: track?.duration_ms ? Math.floor(track.duration_ms / 1000) : null,
      coverUrl: track?.album?.images?.[0]?.url || null,
      spotifyUrl: track?.external_urls?.spotify || null,
      spotifyTrackId: track?.id,
      title: track?.name || null,
      artist: track?.artists?.[0]?.name || null
    };
  } catch (error) {
    console.error('[Enrichment] ❌ Spotify erro:', error?.response?.data || error.message);
    return {};
  }
}

async function fetchFromDeezer(title, artist, deezerUrl = null, platformId = null) {
  try {
    let track;
    const idFromUrl = deezerUrl?.match(/track\/(\d+)/)?.[1];
    const id = platformId || idFromUrl;
    if (id) {
      const detailRes = await axios.get(`https://api.deezer.com/track/${id}`);
      track = detailRes.data;
    }

    if (!track && title && artist) {
      const query = encodeURIComponent(`${normalizeTitle(title)} ${normalizeArtist(artist)}`);
      const searchUrl = `https://api.deezer.com/search?q=${query}&limit=1`;

      const searchRes = await axios.get(searchUrl);
      const candidate = searchRes.data.data?.[0];
      if (!candidate || !candidate.id) return {};

      const matchTitle = normalize(candidate.title);
      const matchArtist = normalize(candidate.artist?.name || '');

      const originalTitle = normalize(title);
      const originalArtist = normalize(artist);

      if (!matchTitle.includes(originalTitle) && !originalTitle.includes(matchTitle)) return {};
      if (!matchArtist.includes(originalArtist) && !originalArtist.includes(matchArtist)) return {};

      const detailRes = await axios.get(`https://api.deezer.com/track/${candidate.id}`);
      track = detailRes.data;
    }

    return {
      bpm: track?.bpm || null,
      duration: track?.duration || null,
      album: track?.album?.title || null,
      coverUrl: track?.album?.cover_medium || null,
      deezerUrl: track?.link || null,
      deezerTrackId: track?.id || null,
      title: track?.title || null,
      artist: track?.artist?.name || null
    };
  } catch (error) {
    console.error('[Enrichment] ❌ Deezer erro:', error?.response?.data || error.message);
    return {};
  }
}

async function enrichSong(song) {
  const {
    title,
    artist,
    spotifyUrl,
    deezerUrl,
    coverUrl,
    spotifyTrackId,
    deezerTrackId,
    platform,
    id
  } = song;

  console.log(`[enrichSong] Iniciando enrichment:`, { title, artist, spotifyUrl, deezerUrl, platform, id });

  let spotifyData = {};
  let deezerData = {};
  let referenceData = { title, artist };

  // 1️⃣ Prioridade: ID + plataforma
  if (platform === 'spotify' && id) {
    spotifyData = await fetchFromSpotify(null, null, null, id);
    if (spotifyData.title && spotifyData.artist) {
      referenceData = { title: spotifyData.title, artist: spotifyData.artist };
    }
  } else if (platform === 'deezer' && id) {
    deezerData = await fetchFromDeezer(null, null, null, id);
    if (deezerData.title && deezerData.artist) {
      referenceData = { title: deezerData.title, artist: deezerData.artist };
    }
  }

  // 2️⃣ Busca cruzada usando ID da outra plataforma se disponível
  if (!spotifyData.spotifyUrl && deezerTrackId) {
    spotifyData = await fetchFromSpotify(null, null, null, spotifyTrackId);
  }
  if (!deezerData.deezerUrl && spotifyTrackId) {
    deezerData = await fetchFromDeezer(null, null, null, deezerTrackId);
  }

  // 3️⃣ Fallback: título + artista normalizados
  if (!spotifyData.spotifyUrl) {
    spotifyData = await fetchFromSpotify(
      normalizeTitle(referenceData.title || title),
      normalizeArtist(referenceData.artist || artist)
    );
  }
  if (!deezerData.deezerUrl) {
    deezerData = await fetchFromDeezer(
      normalizeTitle(referenceData.title || title),
      normalizeArtist(referenceData.artist || artist)
    );
  }

  // 🎼 Pega tonalidade via Spotify
  const finalSpotifyUrl = spotifyData.spotifyUrl || spotifyUrl || null;
  const key = finalSpotifyUrl ? await fetchKeyFromSpotify(finalSpotifyUrl) : null;

  console.log('[enrichSong] 🔍 Dados retornados:', { spotifyData, deezerData, key });

  return {
    bpm: deezerData.bpm || null,
    key: key || null,
    duration: spotifyData.duration || deezerData.duration || null,
    album: spotifyData.album || deezerData.album || null,
    coverUrl: coverUrl || spotifyData.coverUrl || deezerData.coverUrl || null,
    spotifyUrl: finalSpotifyUrl,
    spotifyTrackId: spotifyData.spotifyTrackId || spotifyTrackId || null,
    deezerUrl: deezerData.deezerUrl || deezerUrl || null,
    deezerTrackId: deezerData.deezerTrackId || deezerTrackId || null
  };
}

module.exports = {
  enrichSong,
};
