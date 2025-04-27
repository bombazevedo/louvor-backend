// src/controllers/songController.js
const Song = require('../models/Song');

// Criar nova música
exports.createSong = async (req, res) => {
  try {
    const newSong = new Song(req.body);
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
