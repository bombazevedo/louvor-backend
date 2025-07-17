const Song = require('../models/Song');
const axios = require('axios');

// 🔧 Função de enriquecimento (após salvar)
const enrichSongData = async (songId) => {
  try {
    const song = await Song.findById(songId);
    if (!song) return;

    let updates = {};

    // Deezer (se houver)
    if (song.deezerUrl) {
      const deezerMatch = song.deezerUrl.match(/track\/(\d+)/);
      if (deezerMatch) {
        const trackId = deezerMatch[1];
        try {
          const deezerRes = await axios.get(`https://api.deezer.com/track/${trackId}`);
          if (deezerRes.data) {
            updates.bpm = deezerRes.data.bpm || song.bpm;
            updates.album = deezerRes.data.album?.title || song.album;
            updates.key = deezerRes.data.key || song.key;
          }
        } catch (err) {
          console.error('[enrichSongData] Deezer erro:', err.response?.data || err.message);
        }
      }
    }

    // Spotify (se houver)
    if (song.spotifyUrl) {
      try {
        const spotifyMeta = await axios.get(`https://open.spotify.com/oembed?url=${song.spotifyUrl}`);
        if (spotifyMeta.data) {
          updates.album = updates.album || spotifyMeta.data.title;
        }
      } catch (err) {
        console.error('[enrichSongData] Spotify erro:', err.response?.data || err.message);
      }
    }

    // CifraClub fallback (se nada mais disponível)
    if (!song.chordText && song.title && song.artist) {
      const query = encodeURIComponent(`${song.title} ${song.artist}`);
      updates.externalChordUrl = `https://www.cifraclub.com.br/busca/?q=${query}`;
    }

    await Song.findByIdAndUpdate(songId, updates, { new: true });
  } catch (err) {
    console.error('[enrichSongData] Erro geral:', err);
  }
};

// Criar nova música
exports.createSong = async (req, res) => {
  try {
    let coverUrl = null;
    let extraData = {};

    // YouTube
    if (req.body.youtubeUrl) {
      const match = req.body.youtubeUrl.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
      if (match) {
        coverUrl = `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
      }
      extraData.title = req.body.title || 'Sem título';
      extraData.artist = req.body.artist || 'Desconhecido';
    }

    // Deezer
    else if (req.body.deezerUrl) {
      const deezerMatch = req.body.deezerUrl.match(/track\/(\d+)/);
      if (deezerMatch) {
        const trackId = deezerMatch[1];
        try {
          const deezerRes = await axios.get(`https://api.deezer.com/track/${trackId}`);
          if (deezerRes.data) {
            if (deezerRes.data.album?.cover_medium) {
              coverUrl = deezerRes.data.album.cover_medium;
            }
            extraData = {
              bpm: deezerRes.data.bpm,
              duration: deezerRes.data.duration,
              title: deezerRes.data.title || 'Sem título',
              artist: deezerRes.data.artist?.name || 'Desconhecido',
            };
          }
        } catch (err) {
          console.error('Erro ao buscar dados no Deezer:', err.response?.data || err.message);
          extraData.title = 'Sem título';
          extraData.artist = 'Desconhecido';
        }
      }
    }

    // Spotify
    else if (req.body.spotifyUrl) {
      try {
        const spotifyRes = await axios.get(`https://open.spotify.com/oembed?url=${req.body.spotifyUrl}`);
        if (spotifyRes.data?.thumbnail_url) {
          coverUrl = spotifyRes.data.thumbnail_url;
          extraData = {
            title: spotifyRes.data.title || 'Sem título',
            artist: spotifyRes.data.author_name || 'Desconhecido',
          };
        } else {
          extraData.title = 'Sem título';
          extraData.artist = 'Desconhecido';
        }
      } catch (err) {
        console.error('Erro ao buscar dados no Spotify:', err.response?.data || err.message);
        extraData.title = 'Sem título';
        extraData.artist = 'Desconhecido';
      }
    }

    // Já vem completo
    else if (req.body.coverUrl) {
      coverUrl = req.body.coverUrl;
      extraData.title = req.body.title || 'Sem título';
      extraData.artist = req.body.artist || 'Desconhecido';
    }

    // Segurança final
    if (!extraData.title) extraData.title = 'Sem título';
    if (!extraData.artist) extraData.artist = 'Desconhecido';

    const newSong = new Song({
      ...req.body,
      coverUrl,
      ...extraData,
    });

    const savedSong = await newSong.save();

    // ✅ Enriquecimento pós-criação
    await enrichSongData(savedSong._id);

    // Recarrega música com dados atualizados
    const enrichedSong = await Song.findById(savedSong._id);
    res.status(201).json(enrichedSong);
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

// Buscar música por ID (usado no GET /api/songs/:id)
exports.getSongById = async (id) => {
  const song = await Song.findById(id);
  if (!song) throw new Error('Song não encontrado');
  return song;
};
