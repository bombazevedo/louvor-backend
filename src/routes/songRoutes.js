const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Song = require('../models/Song');

// @route   GET api/songs
// @desc    Obter todas as músicas
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const songs = await Song.find().sort({ title: 1 });
    res.json(songs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   GET api/songs/:id
// @desc    Obter música por ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    
    if (!song) {
      return res.status(404).json({ message: 'Música não encontrada' });
    }
    
    res.json(song);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Música não encontrada' });
    }
    res.status(500).send('Erro no servidor');
  }
});

// @route   POST api/songs
// @desc    Criar uma música
// @access  Private/Admin
router.post('/', auth, async (req, res) => {
  try {
    // Verificar se o usuário é admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Acesso negado. Permissão de administrador necessária.' });
    }
    
    const { title, artist, key, tempo, timeSignature, lyrics, chords, youtubeLink, tags } = req.body;
    
    // Validar campos obrigatórios
    if (!title || !artist) {
      return res.status(400).json({ message: 'Título e artista são obrigatórios' });
    }
    
    // Verificar se a música já existe
    let song = await Song.findOne({ title, artist });
    if (song) {
      return res.status(400).json({ message: 'Esta música já existe no sistema' });
    }
    
    const newSong = new Song({
      title,
      artist,
      key,
      tempo,
      timeSignature,
      lyrics,
      chords,
      youtubeLink,
      tags,
      createdBy: req.user.id
    });
    
    song = await newSong.save();
    
    res.json(song);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   PUT api/songs/:id
// @desc    Atualizar uma música
// @access  Private/Admin
router.put('/:id', auth, async (req, res) => {
  try {
    // Verificar se o usuário é admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Acesso negado. Permissão de administrador necessária.' });
    }
    
    const { title, artist, key, tempo, timeSignature, lyrics, chords, youtubeLink, tags } = req.body;
    
    // Construir objeto de atualização
    const songFields = {};
    if (title) songFields.title = title;
    if (artist) songFields.artist = artist;
    if (key) songFields.key = key;
    if (tempo) songFields.tempo = tempo;
    if (timeSignature) songFields.timeSignature = timeSignature;
    if (lyrics !== undefined) songFields.lyrics = lyrics;
    if (chords !== undefined) songFields.chords = chords;
    if (youtubeLink !== undefined) songFields.youtubeLink = youtubeLink;
    if (tags) songFields.tags = tags;
    
    let song = await Song.findById(req.params.id);
    
    if (!song) {
      return res.status(404).json({ message: 'Música não encontrada' });
    }
    
    song = await Song.findByIdAndUpdate(
      req.params.id,
      { $set: songFields },
      { new: true }
    );
    
    res.json(song);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   DELETE api/songs/:id
// @desc    Excluir uma música
// @access  Private/Admin
router.delete('/:id', auth, async (req, res) => {
  try {
    // Verificar se o usuário é admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Acesso negado. Permissão de administrador necessária.' });
    }
    
    const song = await Song.findById(req.params.id);
    
    if (!song) {
      return res.status(404).json({ message: 'Música não encontrada' });
    }
    
    await Song.findByIdAndRemove(req.params.id);
    
    res.json({ message: 'Música removida' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   GET api/songs/search/:term
// @desc    Pesquisar músicas por termo
// @access  Private
router.get('/search/:term', auth, async (req, res) => {
  try {
    const term = req.params.term;
    const regex = new RegExp(term, 'i');
    
    const songs = await Song.find({
      $or: [
        { title: regex },
        { artist: regex },
        { tags: regex }
      ]
    }).sort({ title: 1 });
    
    res.json(songs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

module.exports = router;
