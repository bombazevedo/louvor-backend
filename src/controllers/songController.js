// src/controllers/songController.js
const Song = require('../models/Song');
const axios = require('axios');

// Criar nova música
exports.createSong = async (req, res) => {
  try {
    let coverUrl = null;

    // YouTube
    if (req.body.youtubeUrl) {
      const match = req.body.youtubeUrl.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
      if (match) {
        coverUrl = `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
      }
    }

    // Deezer
    else if (req.body.deezerUrl) {
      const deezerMatch = req.body.deezerUrl.match(/track\/(\d+)/);
      if (deezerMatch) {
        const trackId = deezerMatch[1];
        try {
          const deezerRes = await axios.get(`https://api.deezer.com/track/${trackId}`);
          if (deezerRes.data && deezerRes.data.album && deezerRes.data.album.cover_medium) {
            coverUrl = deezerRes.data.album.cover_medium;
          }
        } catch (err) {
          console.error('Erro ao buscar capa no Deezer:', err.response?.data || err.message);
        }
      }
    }

    // Spotify
    else if (req.body.coverUrl) {
      // Se já vem pronto, usa
      coverUrl = req.body.coverUrl;
    }

    const newSong = new Song({
      ...req.body,
      coverUrl
    });

    const savedSong = await newSong.save();
    res.status(201).json(savedSong);
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
