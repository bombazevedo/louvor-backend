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

// 🔹 Limpa termos poluentes comuns
function removePollution(text = '') {
  const pollutionTerms = [
    /\boficial\b/gi,
    /\bao vivo\b/gi,
    /\bvers[aã]o portugues\b/gi,
    /\bcover\b/gi
  ];
  let cleaned = text;
  pollutionTerms.forEach(regex => {
    cleaned = cleaned.replace(regex, '').trim();
  });
  return cleaned;
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

async function fetchFromYouTube(youtubeUrl) {
  try {
    const match = youtubeUrl?.match(/v=([a-zA-Z0-9_\-]+)/);
    if (!match) return {};
    const videoId = match[1];
    const apiKey = process.env.YOUTUBE_API_KEY;
    const ytRes = await axios.get(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`);
    const item = ytRes.data.items?.[0];
    if (!item) return {};
    return {
      title: removePollution(item.snippet?.title || ''),
      artist: removePollution(item.snippet?.channelTitle || ''),
      coverUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    };
  } catch (err) {
    console.error('[Enrichment] ❌ YouTube erro:', err?.response?.data || err.message);
    return {};
  }
}

async function enrichSong(song) {
  let {
    title,
    artist,
    spotifyUrl,
    deezerUrl,
    coverUrl,
    spotifyTrackId,
    deezerTrackId,
    platform,
    id,
    youtubeUrl
  } = song;

  // Guarda originais para fallback
  const rawTitle = title;
  const rawArtist = artist;

  let spotifyData = {};
  let deezerData = {};
  let referenceData = { title, artist };

  // 1️⃣ Prioridade: ID + plataforma
  if (platform === 'spotify' && id) {
    spotifyData = await fetchFromSpotify(null, null, null, id);
    if (spotifyData.title && spotifyData.artist) {
      referenceData = { title: spotifyData.title, artist: spotifyData.artist };
      title = spotifyData.title;
      artist = spotifyData.artist;
    }
  } else if (platform === 'deezer' && id) {
    deezerData = await fetchFromDeezer(null, null, null, id);
    if (deezerData.title && deezerData.artist) {
      referenceData = { title: deezerData.title, artist: deezerData.artist };
      title = deezerData.title;
      artist = deezerData.artist;
    }
  } else if (platform === 'youtube' && youtubeUrl) {
    const ytData = await fetchFromYouTube(youtubeUrl);
    if (ytData.title && ytData.artist) {
      referenceData = { title: ytData.title, artist: ytData.artist };
      title = ytData.title;
      artist = ytData.artist;
      if (!coverUrl) coverUrl = ytData.coverUrl;
    }
  }

  // 2️⃣ Busca cruzada normal
  spotifyData = await fetchFromSpotify(title, artist, spotifyUrl, spotifyTrackId) || spotifyData;
  deezerData = await fetchFromDeezer(title, artist, deezerUrl, deezerTrackId) || deezerData;

  // 3️⃣ Fallback se não achou nada
  if (!spotifyData.spotifyUrl) {
    spotifyData = await fetchFromSpotify(removePollution(rawTitle), removePollution(rawArtist));
  }
  if (!deezerData.deezerUrl) {
    deezerData = await fetchFromDeezer(removePollution(rawTitle), removePollution(rawArtist));
  }

  const finalSpotifyUrl = spotifyData.spotifyUrl || spotifyUrl || null;
  const key = finalSpotifyUrl ? await fetchKeyFromSpotify(finalSpotifyUrl) : null;

  return {
    bpm: deezerData.bpm || null,
    key: key || null,
    duration: spotifyData.duration || deezerData.duration || null,
    album: spotifyData.album || deezerData.album || null,
    coverUrl: coverUrl || spotifyData.coverUrl || deezerData.coverUrl || null,
    spotifyUrl: finalSpotifyUrl,
    spotifyTrackId: spotifyData.spotifyTrackId || spotifyTrackId || null,
    deezerUrl: deezerData.deezerUrl || deezerUrl || null,
    deezerTrackId: deezerData.deezerTrackId || deezerTrackId || null,
    title: title,
    artist: artist
  };
}

module.exports = { enrichSong };
