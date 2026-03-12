const Song = require('../models/Song');
const axios = require('axios');
const { enrichSong } = require('../services/musicEnrichmentService');
const { normalizeSongTitle, normalizeArtistName } = require('../utils/normalizeUtils');

const YT_ID_RE = /(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/;
const SPOTIFY_ID_RE = /track\/([a-zA-Z0-9]+)/;
const DEEZER_ID_RE = /track\/(\d+)/;

function safeTrim(str) {
  return typeof str === 'string' ? str.trim() : str;
}

function pick(obj, keys) {
  return keys.reduce((acc, k) => {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') acc[k] = obj[k];
    return acc;
  }, {});
}

// Criar nova música
exports.createSong = async (req, res) => {
  try {
    const body = {
      title: safeTrim(req.body.title),
      artist: safeTrim(req.body.artist),
      youtubeUrl: safeTrim(req.body.youtubeUrl),
      spotifyUrl: safeTrim(req.body.spotifyUrl),
      deezerUrl: safeTrim(req.body.deezerUrl),
      spotifyTrackId: safeTrim(req.body.spotifyTrackId),
      deezerTrackId: safeTrim(req.body.deezerTrackId),
      coverUrl: safeTrim(req.body.coverUrl),
      platform: safeTrim(req.body.platform),
      id: req.body.id || null,
    };

    const urlOrs = [
      body.youtubeUrl ? { youtubeUrl: body.youtubeUrl } : null,
      body.spotifyUrl ? { spotifyUrl: body.spotifyUrl } : null,
      body.deezerUrl ? { deezerUrl: body.deezerUrl } : null,
    ].filter(Boolean);

    let existing = null;
    if (urlOrs.length) {
      existing = await Song.findOne({ $or: urlOrs });
    }

    if (!existing) {
      const idOrs = [
        body.spotifyTrackId ? { spotifyTrackId: body.spotifyTrackId } : null,
        body.deezerTrackId ? { deezerTrackId: body.deezerTrackId } : null,
      ].filter(Boolean);
      if (idOrs.length) existing = await Song.findOne({ $or: idOrs });
    }

    if (!existing && (body.title || body.artist)) {
      const normTitle = body.title ? normalizeSongTitle(body.title) : null;
      const normArtist = body.artist ? normalizeArtistName(body.artist) : null;

      if (normTitle && normArtist) {
        existing = await Song.findOne({
          normalizedTitle: normTitle,
          normalizedArtist: normArtist,
        });
      }
    }

    if (existing) {
      console.log('[SongController] ♻️ Song já existente:', existing._id);
      return res.status(200).json(existing);
    }

    let coverUrl = body.coverUrl || null;
    let extraData = {};

    if (body.youtubeUrl) {
      const match = body.youtubeUrl.match(YT_ID_RE);
      if (match) coverUrl = `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
      extraData.title = body.title || 'Sem título';
      extraData.artist = body.artist || 'Desconhecido';
    }
    else if (body.deezerUrl || body.deezerTrackId) {
      const deezerId =
        body.deezerTrackId || (body.deezerUrl ? (body.deezerUrl.match(DEEZER_ID_RE) || [])[1] : null);
      if (deezerId) {
        try {
          const deezerRes = await axios.get(`https://api.deezer.com/track/${deezerId}`);
          const d = deezerRes.data || {};
          coverUrl = d.album?.cover_medium || coverUrl || null;
          extraData = {
            bpm: d.bpm ?? null,
            duration: d.duration ?? null,
            title: d.title || body.title || 'Sem título',
            artist: d.artist?.name || body.artist || 'Desconhecido',
            deezerUrl: d.link || body.deezerUrl || null,
            deezerTrackId: d.id || deezerId,
          };
        } catch (err) {
          console.error('Erro ao buscar dados no Deezer:', err.response?.data || err.message);
          extraData.title = body.title || 'Sem título';
          extraData.artist = body.artist || 'Desconhecido';
        }
      }
    }
    else if (body.spotifyUrl || body.spotifyTrackId) {
      const spotifyId =
        body.spotifyTrackId || (body.spotifyUrl ? (body.spotifyUrl.match(SPOTIFY_ID_RE) || [])[1] : null);
      if (spotifyId) {
        try {
          const tokenRes = await axios.post(
            'https://accounts.spotify.com/api/token',
            'grant_type=client_credentials',
            {
              headers: {
                Authorization: `Basic ${Buffer.from(
                  `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
                ).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            }
          );
          const token = tokenRes.data.access_token;
          const trackRes = await axios.get(`https://api.spotify.com/v1/tracks/${spotifyId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const track = trackRes.data;
          coverUrl = track.album?.images?.[0]?.url || coverUrl || null;
          extraData = {
            title: track.name || body.title || 'Sem título',
            artist: (track.artists && track.artists[0]?.name) || body.artist || 'Desconhecido',
            duration: track.duration_ms ? Math.floor(track.duration_ms / 1000) : null,
            spotifyUrl: track.external_urls?.spotify || body.spotifyUrl || null,
            spotifyTrackId: track.id || spotifyId,
            album: track.album?.name || null,
          };
        } catch (err) {
          console.error('Erro ao buscar dados no Spotify:', err.response?.data || err.message);
          extraData.title = body.title || 'Sem título';
          extraData.artist = body.artist || 'Desconhecido';
        }
      }
    }
    else if (body.coverUrl || body.title || body.artist) {
      coverUrl = body.coverUrl || coverUrl;
      extraData.title = body.title || 'Sem título';
      extraData.artist = body.artist || 'Desconhecido';
    }

    if (!extraData.title) extraData.title = 'Sem título';
    if (!extraData.artist) extraData.artist = 'Desconhecido';

    const cleanBody = pick(body, [
      'title',
      'artist',
      'youtubeUrl',
      'spotifyUrl',
      'deezerUrl',
      'spotifyTrackId',
      'deezerTrackId',
      'coverUrl',
    ]);

    const baseDoc = {
      ...cleanBody,
      coverUrl: coverUrl || cleanBody.coverUrl || null,
      ...extraData,
    };

    baseDoc.normalizedTitle = normalizeSongTitle(baseDoc.title);
    baseDoc.normalizedArtist = normalizeArtistName(baseDoc.artist);

    const newSong = new Song(baseDoc);
    const savedSong = await newSong.save();

    try {
      const enriched = await enrichSong({
        ...savedSong.toObject(),
        platform: body.platform || null,
        id: body.id || null
      });

      console.log('[SongController] [🔍 Enriched Result]', enriched);

      const enrichedFields = {};
      if (enriched.bpm !== undefined && enriched.bpm !== null) enrichedFields.bpm = enriched.bpm;
      if (enriched.key !== undefined && enriched.key !== null) enrichedFields.key = enriched.key;
      if (enriched.album !== undefined && enriched.album !== null) enrichedFields.album = enriched.album;
      if (enriched.duration !== undefined && enriched.duration !== null) enrichedFields.duration = enriched.duration;
      if (enriched.coverUrl) enrichedFields.coverUrl = enriched.coverUrl;
      if (typeof enriched.spotifyUrl === 'string' && enriched.spotifyUrl.trim()) {
        enrichedFields.spotifyUrl = enriched.spotifyUrl;
      }
      if (typeof enriched.deezerUrl === 'string' && enriched.deezerUrl.trim()) {
        enrichedFields.deezerUrl = enriched.deezerUrl;
      }
      if (typeof enriched.youtubeUrl === 'string' && enriched.youtubeUrl.trim()) {
        enrichedFields.youtubeUrl = enriched.youtubeUrl;
      }
      if (typeof enriched.spotifyTrackId === 'string' && enriched.spotifyTrackId.trim()) {
        enrichedFields.spotifyTrackId = enriched.spotifyTrackId;
      }
      if (enriched.deezerTrackId) {
        enrichedFields.deezerTrackId = enriched.deezerTrackId;
      }

      // ⬇️ AJUSTE CIRÚRGICO: propagar title/artist confiáveis do enrichment + normalizados
      if (typeof enriched.title === 'string' && enriched.title.trim()) {
        enrichedFields.title = enriched.title.trim();
      }
      if (typeof enriched.artist === 'string' && enriched.artist.trim()) {
        enrichedFields.artist = enriched.artist.trim();
      }
      if (enrichedFields.title || enrichedFields.artist) {
        const t = enrichedFields.title || savedSong.title || '';
        const a = enrichedFields.artist || savedSong.artist || '';
        enrichedFields.normalizedTitle = normalizeSongTitle(t);
        enrichedFields.normalizedArtist = normalizeArtistName(a);
      }
      // ⬆️ FIM DO AJUSTE

      const enrichedResult = await Song.findByIdAndUpdate(
        savedSong._id,
        { $set: enrichedFields },
        { new: true }
      );

      console.log('[SongController] [✅ Enrichment final salvo no Song]:', enrichedResult?._id);
      return res.status(201).json(enrichedResult);
    } catch (enrichmentError) {
      console.error('[SongController] Enriquecimento falhou:', enrichmentError.message);
      return res.status(201).json(savedSong);
    }
  } catch (error) {
    console.error('Erro ao criar música:', error);
    res.status(500).json({ message: 'Erro ao criar música' });
  }
};

// Listar todas as músicas
exports.getAllSongs = async (req, res) => {
  try {
    const songs = await Song.find();
    res.status(200).json(songs);
  } catch (error) {
    console.error('Erro ao buscar músicas:', error);
    res.status(500).json({ message: 'Erro ao buscar músicas' });
  }
};

// Buscar música por ID
exports.getSongById = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ message: 'Song não encontrado' });
    res.status(200).json(song);
  } catch (error) {
    console.error('Erro ao buscar música:', error);
    res.status(500).json({ message: 'Erro ao buscar música' });
  }
};

// Atualizar metadados manualmente
exports.updateSongEnrichment = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ message: 'Song não encontrado' });

    console.log('[SongController] Iniciando enrichment manual:', song._id, song.title);

    const enriched = await enrichSong({
      ...song.toObject(),
      platform: req.body.platform || null,
      id: req.body.id || null
    });

    console.log('[SongController] [🔍 Enriched Result - MANUAL]', enriched);

    const enrichedFields = {};
    if (enriched.bpm !== undefined && enriched.bpm !== null) enrichedFields.bpm = enriched.bpm;
    if (enriched.key !== undefined && enriched.key !== null) enrichedFields.key = enriched.key;
    if (enriched.album !== undefined && enriched.album !== null) enrichedFields.album = enriched.album;
    if (enriched.duration !== undefined && enriched.duration !== null) enrichedFields.duration = enriched.duration;
    if (enriched.coverUrl) enrichedFields.coverUrl = enriched.coverUrl;
    if (typeof enriched.spotifyUrl === 'string' && enriched.spotifyUrl.trim()) {
      enrichedFields.spotifyUrl = enriched.spotifyUrl;
    }
    if (typeof enriched.deezerUrl === 'string' && enriched.deezerUrl.trim()) {
      enrichedFields.deezerUrl = enriched.deezerUrl;
    }
    if (typeof enriched.youtubeUrl === 'string' && enriched.youtubeUrl.trim()) {
      enrichedFields.youtubeUrl = enriched.youtubeUrl;
    }
    if (typeof enriched.spotifyTrackId === 'string' && enriched.spotifyTrackId.trim()) {
      enrichedFields.spotifyTrackId = enriched.spotifyTrackId;
    }
    if (enriched.deezerTrackId) {
      enrichedFields.deezerTrackId = enriched.deezerTrackId;
    }

    // ⬇️ AJUSTE CIRÚRGICO (mesmo do create): aplicar title/artist + normalizados se vierem do enrichment
    if (typeof enriched.title === 'string' && enriched.title.trim()) {
      enrichedFields.title = enriched.title.trim();
    }
    if (typeof enriched.artist === 'string' && enriched.artist.trim()) {
      enrichedFields.artist = enriched.artist.trim();
    }
    if (enrichedFields.title || enrichedFields.artist) {
      const t = enrichedFields.title || song.title || '';
      const a = enrichedFields.artist || song.artist || '';
      enrichedFields.normalizedTitle = normalizeSongTitle(t);
      enrichedFields.normalizedArtist = normalizeArtistName(a);
    }
    // ⬆️ FIM DO AJUSTE

    if (!song.normalizedTitle || !song.normalizedArtist) {
      enrichedFields.normalizedTitle = enrichedFields.normalizedTitle || song.normalizedTitle || normalizeSongTitle(song.title || '');
      enrichedFields.normalizedArtist = enrichedFields.normalizedArtist || song.normalizedArtist || normalizeArtistName(song.artist || '');
    }

    const enrichedResult = await Song.findByIdAndUpdate(song._id, { $set: enrichedFields }, { new: true });

    console.log('[SongController] [✅ Enrichment manual salvo no Song]:', enrichedResult?._id);
    return res.status(200).json(enrichedResult);
  } catch (error) {
    console.error('Erro ao atualizar metadados da música:', error);
    res.status(500).json({ message: 'Erro ao atualizar metadados da música' });
  }
};
