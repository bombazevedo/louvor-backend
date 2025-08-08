const Song = require('../models/Song');
const axios = require('axios');
const { enrichSong } = require('../services/musicEnrichmentService');
const { normalizeSongTitle, normalizeArtistName } = require('../utils/normalizeUtils');

// Criar nova música (com enrich único)
exports.createSong = async (req, res) => {
  try {
    const urls = [
      req.body.youtubeUrl, req.body.spotifyUrl, req.body.deezerUrl
    ].filter(Boolean);

    let existing = null;
    if (urls.length) {
      existing = await Song.findOne({
        $or: [
          req.body.youtubeUrl ? { youtubeUrl: req.body.youtubeUrl } : null,
          req.body.spotifyUrl ? { spotifyUrl: req.body.spotifyUrl } : null,
          req.body.deezerUrl ? { deezerUrl: req.body.deezerUrl } : null
        ].filter(q => q !== null)
      });
    }

    if (existing) {
      console.log('[SongController] Song já existente:', existing);
      return res.status(200).json(existing);
    }

    let coverUrl = null;
    let extraData = {};

    if (req.body.youtubeUrl) {
      const match = req.body.youtubeUrl.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
      if (match) {
        coverUrl = `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
      }
      extraData.title = req.body.title || 'Sem título';
      extraData.artist = req.body.artist || 'Desconhecido';
    }

    else if (req.body.deezerUrl || req.body.deezerTrackId) {
      const deezerId = req.body.deezerTrackId || (req.body.deezerUrl?.match(/track\/(\d+)/)?.[1]);
      if (deezerId) {
        try {
          const deezerRes = await axios.get(`https://api.deezer.com/track/${deezerId}`);
          if (deezerRes.data) {
            if (deezerRes.data.album?.cover_medium) {
              coverUrl = deezerRes.data.album.cover_medium;
            }
            extraData = {
              bpm: deezerRes.data.bpm,
              duration: deezerRes.data.duration,
              title: deezerRes.data.title || 'Sem título',
              artist: deezerRes.data.artist?.name || 'Desconhecido',
              deezerUrl: deezerRes.data.link,
              deezerTrackId: deezerRes.data.id
            };
          }
        } catch (err) {
          console.error('Erro ao buscar dados no Deezer:', err.response?.data || err.message);
          extraData.title = 'Sem título';
          extraData.artist = 'Desconhecido';
        }
      }
    }

    else if (req.body.spotifyUrl || req.body.spotifyTrackId) {
      const spotifyId = req.body.spotifyTrackId || (req.body.spotifyUrl?.match(/track\/([a-zA-Z0-9]+)/)?.[1]);
      if (spotifyId) {
        try {
          const tokenRes = await axios.post(
            'https://accounts.spotify.com/api/token',
            'grant_type=client_credentials',
            {
              headers: {
                Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            }
          );

          const token = tokenRes.data.access_token;

          const trackRes = await axios.get(`https://api.spotify.com/v1/tracks/${spotifyId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          const track = trackRes.data;

          coverUrl = track.album?.images?.[0]?.url || null;
          extraData = {
            title: track.name || 'Sem título',
            artist: track.artists?.[0]?.name || 'Desconhecido',
            duration: track.duration_ms ? Math.floor(track.duration_ms / 1000) : null,
            spotifyUrl: track.external_urls?.spotify,
            spotifyTrackId: track.id
          };
        } catch (err) {
          console.error('Erro ao buscar dados no Spotify:', err.response?.data || err.message);
          extraData.title = 'Sem título';
          extraData.artist = 'Desconhecido';
        }
      }
    }

    else if (req.body.coverUrl) {
      coverUrl = req.body.coverUrl;
      extraData.title = req.body.title || 'Sem título';
      extraData.artist = req.body.artist || 'Desconhecido';
    }

    if (!extraData.title) extraData.title = 'Sem título';
    if (!extraData.artist) extraData.artist = 'Desconhecido';

    const cleanBody = { ...req.body };
    if (cleanBody.deezerUrl === '') delete cleanBody.deezerUrl;
    if (cleanBody.spotifyUrl === '') delete cleanBody.spotifyUrl;
    if (cleanBody.youtubeUrl === '') delete cleanBody.youtubeUrl;

    const newSong = new Song({
      ...cleanBody,
      coverUrl,
      ...extraData
    });

    const savedSong = await newSong.save();

    // 🧠 Normalização aplicada antes do enrichment
    const normalizedTitle = normalizeSongTitle(savedSong.title);
    const normalizedArtist = normalizeArtistName(savedSong.artist);

    try {
      const enriched = await enrichSong({
        ...savedSong.toObject(),
        title: normalizedTitle,
        artist: normalizedArtist,
        platform: req.body.platform || null,
        id: req.body.id || null
      });

      console.log('[SongController] [🔍 Enriched Result]', enriched);

      const enrichedFields = {};
      if (enriched.bpm !== undefined && enriched.bpm !== null) enrichedFields.bpm = enriched.bpm;
      if (enriched.key !== undefined && enriched.key !== null) enrichedFields.key = enriched.key;
      if (enriched.album !== undefined && enriched.album !== null) enrichedFields.album = enriched.album;
      if (enriched.duration !== undefined && enriched.duration !== null) enrichedFields.duration = enriched.duration;
      if (enriched.coverUrl !== undefined && enriched.coverUrl !== null) enrichedFields.coverUrl = enriched.coverUrl;
      if (typeof enriched.spotifyUrl === 'string' && enriched.spotifyUrl.trim()) {
        enrichedFields.spotifyUrl = enriched.spotifyUrl;
      }
      if (typeof enriched.deezerUrl === 'string' && enriched.deezerUrl.trim()) {
        enrichedFields.deezerUrl = enriched.deezerUrl;
      }

      const enrichedResult = await Song.findByIdAndUpdate(
        savedSong._id,
        { $set: enrichedFields },
        { new: true }
      );

      console.log('[SongController] [✅ Enrichment final salvo no Song]:', enrichedResult);
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
    const enriched = await enrichSong(song);
    console.log('[SongController] [🔍 Enriched Result - MANUAL]', enriched);

    const enrichedFields = {};
    if (enriched.bpm !== undefined && enriched.bpm !== null) enrichedFields.bpm = enriched.bpm;
    if (enriched.key !== undefined && enriched.key !== null) enrichedFields.key = enriched.key;
    if (enriched.album !== undefined && enriched.album !== null) enrichedFields.album = enriched.album;
    if (enriched.duration !== undefined && enriched.duration !== null) enrichedFields.duration = enriched.duration;
    if (enriched.coverUrl !== undefined && enriched.coverUrl !== null) enrichedFields.coverUrl = enriched.coverUrl;
    if (typeof enriched.spotifyUrl === 'string' && enriched.spotifyUrl.trim()) {
      enrichedFields.spotifyUrl = enriched.spotifyUrl;
    }
    if (typeof enriched.deezerUrl === 'string' && enriched.deezerUrl.trim()) {
      enrichedFields.deezerUrl = enriched.deezerUrl;
    }

    const enrichedResult = await Song.findByIdAndUpdate(
      song._id,
      { $set: enrichedFields },
      { new: true }
    );

    console.log('[SongController] [✅ Enrichment manual salvo no Song]:', enrichedResult);
    return res.status(200).json(enrichedResult);
  } catch (error) {
    console.error('Erro ao atualizar metadados da música:', error);
    res.status(500).json({ message: 'Erro ao atualizar metadados da música' });
  }
};
