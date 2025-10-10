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

function removePollution(text = '') {
  const pollutionTerms = [
    /\boficial\b/gi,
    /\bofficial\b/gi,
    /\bao vivo\b/gi,
    /\blive\b/gi,
    /\bvers[aã]o\b/gi,
    /\bportugu[eê]s\b/gi,
    /\bpt[-\s]?br\b/gi,
    /\bac[uú]stic[ao]\b/gi,
  ];
  let cleaned = text;
  pollutionTerms.forEach((regex) => {
    cleaned = cleaned.replace(regex, '').trim();
  });
  return cleaned;
}

function reduceTitle(text = '') {
  let t = text || '';
  t = t.replace(/\(.*?\)|\[.*?]|{.*?}/g, '').trim();
  t = t.split('|')[0];
  t = t.split(' - ')[0];
  t = t.split(' — ')[0];
  return t.trim();
}

function tokenOverlapRatio(a = '', b = '') {
  const A = new Set(normalize(a).split(' ').filter(Boolean));
  const B = new Set(normalize(b).split(' ').filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  A.forEach((tok) => { if (B.has(tok)) inter++; });
  return inter / Math.min(A.size, B.size);
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
      console.log(`[Spotify] Buscando por ID: ${id}`);
      const detailRes = await axios.get(`https://api.spotify.com/v1/tracks/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      track = detailRes.data;
    }

    if (!track && title && artist) {
      const query = encodeURIComponent(`${normalizeTitle(title)} ${normalizeArtist(artist)}`);
      console.log(`[Spotify] Buscando por nome: ${query}`);
      const searchUrl = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`;
      const searchRes = await axios.get(searchUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      track = searchRes.data.tracks?.items?.[0];
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
      console.log(`[Deezer] Buscando por ID: ${id}`);
      const detailRes = await axios.get(`https://api.deezer.com/track/${id}`);
      track = detailRes.data;
    }

    if (!track && (title || artist)) {
      const baseTitle = removePollution(title || '');
      const baseArtist = removePollution(artist || '');
      const reduced = reduceTitle(baseTitle);

      const queries = [
        `${normalizeTitle(baseTitle)} ${normalizeArtist(baseArtist)}`.trim(),
        `${normalizeTitle(reduced)} ${normalizeArtist(baseArtist)}`.trim(),
        `${normalizeTitle(reduced)}`.trim(),
        `${normalizeTitle(baseTitle)}`.trim(),
      ].filter(Boolean);

      // EXTRA: fallback singular simples
      if (reduced.endsWith('s')) {
        const singular = reduced.slice(0, -1).trim();
        if (singular && !queries.includes(singular)) queries.push(singular);
      }

      const pickBestCandidate = (items) => {
        if (!Array.isArray(items) || items.length === 0) return null;
        const target = reduced || baseTitle;
        const targetArtist = baseArtist;

        let best = null;
        let bestScore = 0;

        for (const it of items) {
          const ct = it.title || '';
          const ca = it.artist?.name || '';
          const titleRatio = tokenOverlapRatio(ct, target);
          const artistRatio = tokenOverlapRatio(ca, targetArtist);
          const score = titleRatio * 0.85 + artistRatio * 0.15;
          const exactArtist = normalize(ca) === normalize(targetArtist);
          const finalScore = exactArtist ? score + 0.05 : score;
          if (finalScore > bestScore) {
            bestScore = finalScore;
            best = it;
          }
        }
        return bestScore >= 0.6 ? best : null;
      };

      for (let i = 0; i < queries.length; i++) {
        const q = queries[i];
        console.log(`[Deezer] Tentativa ${i + 1}: "${q}"`);
        const searchUrl = `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=5`;
        const searchRes = await axios.get(searchUrl);
        const candidate = pickBestCandidate(searchRes.data?.data || []);
        if (candidate?.id) {
          console.log(`[Deezer] ✅ Resultado encontrado na tentativa ${i + 1}`);
          const detailRes = await axios.get(`https://api.deezer.com/track/${candidate.id}`);
          track = detailRes.data;
          break;
        }
      }
    }

    if (!track) return {};

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

// Busca conservadora no YouTube por título + artista, validando duração quando disponível
async function searchYouTubeByTitleArtistStrict(title, artist, referenceDurationSec = null) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey || !title || !artist) return null;

    const q = encodeURIComponent(`${title} ${artist}`);
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${q}&key=${apiKey}`;
    const res = await axios.get(searchUrl);
    const items = Array.isArray(res.data?.items) ? res.data.items : [];

    for (const it of items) {
      const videoId = it?.id?.videoId;
      const ytTitle = it?.snippet?.title || '';
      const ytChannel = it?.snippet?.channelTitle || '';
      if (!videoId) continue;

      const nRefTitle = normalize(normalizeTitle(removePollution(title)));
      const nRefArtist = normalize(normalizeArtist(removePollution(artist)));
      const nYtTitle = normalize(removePollution(ytTitle));
      const nYtChannel = normalize(removePollution(ytChannel));

      const titleOk = nYtTitle.includes(nRefTitle);
      const artistOk = nYtTitle.includes(nRefArtist) || nYtChannel.includes(nRefArtist);
      if (!titleOk || !artistOk) continue;

      if (referenceDurationSec && Number.isFinite(referenceDurationSec)) {
        const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${apiKey}`;
        const vres = await axios.get(videosUrl);
        const vitem = Array.isArray(vres.data?.items) ? vres.data.items[0] : null;
        const isoDur = vitem?.contentDetails?.duration || null;

        const m = isoDur ? isoDur.match(/PT(?:(\d+)M)?(?:(\d+)S)?/i) : null;
        const mins = m && m[1] ? parseInt(m[1], 10) : 0;
        const secs = m && m[2] ? parseInt(m[2], 10) : 0;
        const dur = mins * 60 + secs;

        const delta = Math.abs(dur - referenceDurationSec);
        const isLive = nYtTitle.includes('ao vivo') || nYtTitle.includes('live');
        const limiar = isLive ? 6 : 3;
        if (delta > limiar) continue;
      }

      return `https://www.youtube.com/watch?v=${videoId}`;
    }

    return null;
  } catch (err) {
    console.error('[Enrichment][YouTube Search] Erro:', err?.response?.data || err.message);
    return null;
  }
}

// 🔒 Novo helper: comparação estrita de matches
function isStrictMatch(base, candidate) {
  if (!base?.title || !base?.artist || !candidate?.title || !candidate?.artist) return false;
  const baseTitle = normalizeTitle(base.title);
  const baseArtist = normalizeArtist(base.artist);
  const candTitle = normalizeTitle(candidate.title);
  const candArtist = normalizeArtist(candidate.artist);
  return baseTitle === candTitle && baseArtist === candArtist;
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

  const rawTitle = title;
  const rawArtist = artist;

  let spotifyData = {};
  let deezerData = {};
  let referenceData = { title, artist };

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

  spotifyData = await fetchFromSpotify(title, artist, spotifyUrl, spotifyTrackId) || spotifyData;
  deezerData = await fetchFromDeezer(title, artist, deezerUrl, deezerTrackId) || deezerData;

  if (!spotifyData.spotifyUrl && (rawTitle || rawArtist)) {
    spotifyData = await fetchFromSpotify(removePollution(rawTitle), removePollution(rawArtist));
  }
  if (!deezerData.deezerUrl && (rawTitle || rawArtist)) {
    deezerData = await fetchFromDeezer(removePollution(rawTitle), removePollution(rawArtist));
  }

  const finalSpotifyUrl = spotifyData.spotifyUrl || spotifyUrl || null;
  const key = finalSpotifyUrl ? await fetchKeyFromSpotify(finalSpotifyUrl) : null;

  // Buscar YouTube quando ainda não houver youtubeUrl e houver referência
  let finalYoutubeUrl = (typeof youtubeUrl === 'string' && youtubeUrl.trim()) ? youtubeUrl : null;
  if (!finalYoutubeUrl && (title || artist)) {
    const refDuration = spotifyData?.duration || deezerData?.duration || null;
    const ytFound = await searchYouTubeByTitleArtistStrict(title || rawTitle, artist || rawArtist, refDuration);
    if (ytFound) {
      finalYoutubeUrl = ytFound;
    }
  }

  // 🔒 Garantir que só retorne dados cruzados se houver match estrito
  if (
    (spotifyData?.title && spotifyData?.artist && !isStrictMatch(referenceData, spotifyData)) ||
    (deezerData?.title && deezerData?.artist && !isStrictMatch(referenceData, deezerData))
  ) {
    console.log('[Enrichment] ⚠️ Nenhum match estrito encontrado. Não retornando dados cruzados.');
    return {
      title: referenceData.title,
      artist: referenceData.artist,
      bpm: null,
      key: null,
      duration: null,
      album: null,
      coverUrl: coverUrl || null,
      youtubeUrl: finalYoutubeUrl || null,
      spotifyUrl: null,
      deezerUrl: null,
      spotifyTrackId: null,
      deezerTrackId: null
    };
  }

  return {
    bpm: deezerData.bpm || null,
    key: key || null,
    duration: spotifyData.duration || deezerData.duration || null,
    album: spotifyData.album || deezerData.album || null,
    coverUrl: coverUrl || spotifyData.coverUrl || deezerData.coverUrl || null,
    youtubeUrl: finalYoutubeUrl || null,
    spotifyUrl: finalSpotifyUrl,
    spotifyTrackId: spotifyData.spotifyTrackId || spotifyTrackId || null,
    deezerUrl: deezerData.deezerUrl || deezerUrl || null,
    deezerTrackId: deezerData.deezerTrackId || deezerTrackId || null,
    title: title,
    artist: artist
  };
}

module.exports = { enrichSong };
