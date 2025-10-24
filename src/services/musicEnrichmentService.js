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
      const baseTitle = title || '';
      const baseArtist = artist || '';
      const query = encodeURIComponent(`${normalizeTitle(baseTitle)} ${normalizeArtist(baseArtist)}`.trim());
      console.log(`[Spotify] Buscando por nome: ${query}`);
      const searchUrl = `https://api.spotify.com/v1/search?q=${query}&type=track&limit=5`;
      const searchRes = await axios.get(searchUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const items = Array.isArray(searchRes.data?.tracks?.items) ? searchRes.data.tracks.items : [];
      const targetTitle = reduceTitle(removePollution(baseTitle));
      const targetArtist = removePollution(baseArtist);

      let best = null;
      let bestScore = 0;
      for (const it of items) {
        const ct = it?.name || '';
        const ca = it?.artists?.[0]?.name || '';
        const titleRatio = tokenOverlapRatio(ct, targetTitle);
        const artistRatio = tokenOverlapRatio(ca, targetArtist);
        const score = titleRatio * 0.85 + artistRatio * 0.15;
        const exactArtist = normalize(ca) === normalize(targetArtist);
        const finalScore = exactArtist ? score + 0.05 : score;
        if (finalScore > bestScore) {
          bestScore = finalScore;
          best = it;
        }
      }
      if (best && bestScore >= 0.6) {
        track = best;
      }
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

/** 🔎 helpers específicos para YouTube */
const FEAT_JOINERS_RE = /\b(feat\.?|ft\.?|featuring|participa(?:ç(?:[aã]o)?)?|part\.?|c\/|com|with|convida|duet|dueto|vs\.?|x|×|&)\b/ig;
const LABEL_WORDS_RE  = /\b(records?|music|canal|vevo|topic)\b/ig;

function stripLabelLike(s='') {
  return (s || '').replace(/\s*-\s*topic\b/i, '').replace(LABEL_WORDS_RE, '').replace(/\s{2,}/g,' ').trim();
}
function extractMainArtist(s='') {
  // pega tudo à esquerda do primeiro marcador de colaboração
  const idx = s.search(FEAT_JOINERS_RE);
  const left = idx >= 0 ? s.slice(0, idx) : s;
  // também quebra em separadores comuns de lista
  const first = left.split(/[,&/]| e | x | × /i)[0];
  return first.trim();
}
function hasFeatOrJoiners(s='') {
  return FEAT_JOINERS_RE.test(s);
}
function channelArtistLike(channel='', artist='') {
  const nC = normalize(stripLabelLike(channel));
  const nA = normalize(artist);
  const overlap = tokenOverlapRatio(nC, nA);
  return overlap; // 0..1
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

    const rawTitle = item.snippet?.title || '';
    const rawChannel = item.snippet?.channelTitle || '';

    const channelClean = stripLabelLike(rawChannel);

    // Defaults
    let artist = removePollution(channelClean);
    let title  = removePollution(rawTitle);
    let album  = null;

    // split em hífen
    const parts = rawTitle.split(/\s[-–—]\s/);
    if (parts.length >= 2) {
      const lhsRaw = parts[0];
      const rhsRaw = parts.slice(1).join(' - ');
      const lhs = removePollution(lhsRaw);
      const rhs = removePollution(rhsRaw);

      // decide orientação usando: similaridade com canal + presença de marcadores de artista
      const lhsLike = channelArtistLike(channelClean, lhs);
      const rhsLike = channelArtistLike(channelClean, rhs);
      const rhsLooksArtist = hasFeatOrJoiners(rhsRaw);
      const lhsLooksArtist = hasFeatOrJoiners(lhsRaw);

      // Regra: se RHS parece lista de artistas OU é mais parecido com o canal, título=lhs e artista=rhs
      // senão, artista=lhs e título=rhs (padrão “Artista – Música”)
      if ((rhsLooksArtist && !lhsLooksArtist) || (rhsLike > lhsLike + 0.05)) {
        artist = extractMainArtist(rhs);
        title  = lhs;
      } else {
        artist = extractMainArtist(lhs);
        title  = rhs;
      }

      // Heurística simples de “álbum” textual
      let albumRaw = rhsRaw;
      albumRaw = albumRaw.replace(/\s[-–—]\s(ao vivo|live)\b/i, ' [Ao Vivo]');
      albumRaw = albumRaw.replace(/\b(v[ií]deo oficial|official video)\b/ig, '').trim();
      if (albumRaw && albumRaw.length >= 2) album = albumRaw;
    } else {
      // título não tem hífen; tenta “[Ao Vivo]”
      let base = rawTitle.replace(/\b(v[ií]deo oficial|official video)\b/ig, '').trim();
      base = base.replace(/\s[-–—]\s(ao vivo|live)\b/i, ' [Ao Vivo]');
      if (base && base.length >= 2) album = base;
    }

    // limpeza final de título
    title = (title || '').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();

    return {
      title,
      artist,
      album: album || null,
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
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${q}&key=${apiKey}`;
    const res = await axios.get(searchUrl);
    const items = Array.isArray(res.data?.items) ? res.data.items : [];

    const nRefArtist = normalize(normalizeArtist(removePollution(artist)));
    const refTitleClean = reduceTitle(removePollution(title));
    const nRefTitle = normalize(normalizeTitle(refTitleClean));

    const candidates = [];

    for (const it of items) {
      const videoId = it?.id?.videoId;
      const ytTitle = it?.snippet?.title || '';
      const ytChannel = it?.snippet?.channelTitle || '';
      if (!videoId) continue;

      const nYtTitle = normalize(removePollution(ytTitle));
      const nYtChannel = normalize(removePollution(stripLabelLike(ytChannel)));

      // filtro básico por título+artista (case-insensitive, sem acentos)
      const titleOk  = nYtTitle.includes(nRefTitle);
      const artistOk = nYtTitle.includes(nRefArtist) || nYtChannel.includes(nRefArtist);
      if (!titleOk || !artistOk) continue;

      // duração (com tolerância dinâmica)
      let withinTolerance = true;
      if (referenceDurationSec && Number.isFinite(referenceDurationSec)) {
        let dur = null;
        const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${apiKey}`;
        const vres = await axios.get(videosUrl);
        const vitem = Array.isArray(vres.data?.items) ? vres.data.items[0] : null;
        const isoDur = vitem?.contentDetails?.duration || null;
        if (isoDur) {
          const m = isoDur.match(/PT(?:(\d+)M)?(?:(\d+)S)?/i);
          const mins = m && m[1] ? parseInt(m[1], 10) : 0;
          const secs = m && m[2] ? parseInt(m[2], 10) : 0;
          dur = mins * 60 + secs;
        }

        if (dur !== null) {
          const rawLower = (ytTitle || '').toLowerCase();
          const refLower = (title || '').toLowerCase();
          const isLiveRef = refLower.includes('ao vivo') || refLower.includes('live');
          const isLiveYT  = rawLower.includes('ao vivo') || rawLower.includes('live');
          const isLive    = isLiveRef || isLiveYT;

          const baseTolerance = isLive ? 6 : 3;
          const pctTolerance  = isLive ? 0.08 : 0.05;
          const secTolerance  = Math.max(baseTolerance, Math.round(referenceDurationSec * pctTolerance));
          const delta = Math.abs(dur - referenceDurationSec);

          withinTolerance = delta <= secTolerance;
        }
      }
      if (!withinTolerance) continue;

      // RANKING: prioriza MUITO o canal do artista; penaliza labels/Topic se houver alternativa
      const titleScore = tokenOverlapRatio(ytTitle, refTitleClean);

      const channelNorm = normalize(stripLabelLike(ytChannel));
      const channelExact    = channelNorm === nRefArtist ? 1 : 0;
      const channelContains = channelNorm.includes(nRefArtist) ? 1 : 0;

      const isLabelLike = LABEL_WORDS_RE.test(ytChannel);
      LABEL_WORDS_RE.lastIndex = 0; // reset regex state

      const penaltyTitle  = /\b(cover|karaok[eê]|lyrics|letra|tutorial|playback|ensaio|instrumental|remix)\b/i.test(ytTitle) ? 0.35 : 0;
      const penaltyChannel= /\b(cover|karaok[eê]|lyrics|letra|tutorial|playback|ensaio)\b/i.test(ytChannel) ? 0.20 : 0;
      const labelPenalty  = isLabelLike ? 0.10 : 0; // leve (mantém opção “Topic” quando necessário)

      const score =
        (titleScore * 0.55) +
        (channelExact * 0.35) +
        (channelContains * 0.20) -
        (penaltyTitle + penaltyChannel + labelPenalty);

      candidates.push({ videoId, score });
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.score - a.score);
    return `https://www.youtube.com/watch?v=${candidates[0].videoId}`;
  } catch (err) {
    console.error('[Enrichment][YouTube Search] Erro:', err?.response?.data || err.message);
    return null;
  }
}

// 🔒 Novo helper: comparação estrita de matches
function isStrictMatch(base, candidate) {
  if (!base?.title || !base?.artist || !candidate?.title || !candidate?.artist) return false;

  const rawBase = String(base.title || '');
  const rawCand = String(candidate.title || '');

  const hasLive   = (s) => /\b(ao vivo|live)\b/i.test(s);
  const hasAcoust = (s) => /\b(ac[uú]stic[ao]|acoustic)\b/i.test(s);

  const baseLive   = hasLive(rawBase);
  const candLive   = hasLive(rawCand);
  const baseAcoust = hasAcoust(rawBase);
  const candAcoust = hasAcoust(rawCand);

  // HARD apenas quando AMBOS explicitam e divergem
  if ((baseLive || baseAcoust) && (candLive || candAcoust)) {
    if (baseLive !== candLive || baseAcoust !== candAcoust) return false;
  }

  const stripParens = (t) => (t || '').replace(/\(.*?\)|\[.*?]|{.*?}/g, '').trim();
  const stripPerf = (t) => (t || '')
    .replace(/\b(ao vivo|live|ac[uú]stic[ao]|acoustic)\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const prep = (t) => normalizeTitle(stripPerf(reduceTitle(stripParens(t))));

  const baseTitle = prep(rawBase);
  const candTitle = prep(rawCand);
  const baseArtist = normalizeArtist(base.artist);
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
  let ytAlbum = null; // ← album inferido do YouTube (usado como fallback)

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
  } else if (platform && platform.toLowerCase() === 'youtube' && youtubeUrl) {
    // Canonizar youtubeUrl (remover parâmetros extras e manter somente watch?v=ID)
    const idMatch = youtubeUrl.match(/v=([a-zA-Z0-9_\-]+)/);
    if (idMatch) {
      youtubeUrl = `https://www.youtube.com/watch?v=${idMatch[1]}`;
    }

    const ytData = await fetchFromYouTube(youtubeUrl);
    if (ytData.title && ytData.artist) {
      referenceData = { title: ytData.title, artist: ytData.artist };
      title = ytData.title;
      artist = ytData.artist;
      if (!coverUrl) coverUrl = ytData.coverUrl;
      ytAlbum = ytData.album || null; // ← guarda álbum do YouTube (se houver)
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

  // 🔧 Reinsere busca cruzada para YouTube
if (platform !== 'youtube' && (!youtubeUrl || youtubeUrl === '')) {
  try {
    const ytCandidate = await fetchFromYouTubeBySearch(title, artist);
    if (ytCandidate?.youtubeUrl) {
      youtubeUrl = ytCandidate.youtubeUrl;
      console.log('[Enrichment] ✅ YouTube link complementar encontrado:', youtubeUrl);
    }
  } catch (err) {
    console.warn('[Enrichment] ⚠️ Falha ao buscar YouTube complementar:', err?.message);
  }
}

  const finalSpotifyUrl = spotifyData.spotifyUrl || spotifyUrl || null;
  const key = finalSpotifyUrl ? await fetchKeyFromSpotify(finalSpotifyUrl) : null;

  // Buscar YouTube quando ainda não houver youtubeUrl e houver referência
  // 🔧 Só confiar em youtubeUrl informado quando a plataforma for YouTube
  let finalYoutubeUrl = null;
  if (platform && platform.toLowerCase() === 'youtube' && typeof youtubeUrl === 'string' && youtubeUrl.trim()) {
    finalYoutubeUrl = youtubeUrl.trim();
  }
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
      album: ytAlbum || null,
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
    album: spotifyData.album || deezerData.album || ytAlbum || null,
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
