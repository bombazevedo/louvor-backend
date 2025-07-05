// src/controllers/songController.js
const Song = require('../models/Song');
const axios = require('axios');

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
    }

    // Deezer
    else if (req.body.deezerUrl) {
      const deezerMatch = req.body.deezerUrl.match(/track\/(\d+)/);
      if (deezerMatch) {
        const trackId = deezerMatch[1];
        try {
          const deezerRes = await axios.get(`https://api.deezer.com/track/${trackId}`);
          if (deezerRes.data) {
            if (deezerRes.data.album && deezerRes.data.album.cover_medium) {
              coverUrl = deezerRes.data.album.cover_medium;
            }
            // Extras Deezer
            extraData = {
              bpm: deezerRes.data.bpm,
              duration: deezerRes.data.duration,
              title: deezerRes.data.title,
              artist: deezerRes.data.artist?.name,
            };
          }
        } catch (err) {
          console.error('Erro ao buscar dados no Deezer:', err.response?.data || err.message);
        }
      }
    }

    // Spotify
    else if (req.body.spotifyUrl) {
      // Usa o oEmbed do Spotify
      try {
        const spotifyRes = await axios.get(`https://open.spotify.com/oembed?url=${req.body.spotifyUrl}`);
        if (spotifyRes.data && spotifyRes.data.thumbnail_url) {
          coverUrl = spotifyRes.data.thumbnail_url;
          // Spotify oEmbed não retorna BPM ou duração, esses podem ficar null
          extraData = {
            title: spotifyRes.data.title,
            artist: spotifyRes.data.author_name,
          };
        }
      } catch (err) {
        console.error('Erro ao buscar dados no Spotify:', err.response?.data || err.message);
      }
    }

    // Caso já venha pronto (ex: Spotify já salvo)
    else if (req.body.coverUrl) {
      coverUrl = req.body.coverUrl;
    }

    const newSong = new Song({
      ...req.body,
      coverUrl,
      ...extraData
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
