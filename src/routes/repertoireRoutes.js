const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Repertoire = require('../models/Repertoire');

// @route   GET api/repertoires
// @desc    Obter todos os repertórios
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const repertoires = await Repertoire.find()
      .populate('songs.songId', 'title artist key')
      .sort({ createdAt: -1 });
    res.json(repertoires);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   GET api/repertoires/:id
// @desc    Obter repertório por ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const repertoire = await Repertoire.findById(req.params.id)
      .populate('songs.songId', 'title artist key lyrics chords');
    
    if (!repertoire) {
      return res.status(404).json({ message: 'Repertório não encontrado' });
    }
    
    res.json(repertoire);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Repertório não encontrado' });
    }
    res.status(500).send('Erro no servidor');
  }
});

// @route   POST api/repertoires
// @desc    Criar um repertório
// @access  Private/Admin
router.post('/', auth, async (req, res) => {
  try {
    // Verificar se o usuário é admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Acesso negado. Permissão de administrador necessária.' });
    }
    
    const { name, description, songs } = req.body;
    
    // Validar campos obrigatórios
    if (!name) {
      return res.status(400).json({ message: 'Por favor, forneça um nome para o repertório' });
    }
    
    const newRepertoire = new Repertoire({
      name,
      description,
      songs: songs || [],
      createdBy: req.user.id
    });
    
    const repertoire = await newRepertoire.save();
    
    res.json(repertoire);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   PUT api/repertoires/:id
// @desc    Atualizar um repertório
// @access  Private/Admin
router.put('/:id', auth, async (req, res) => {
  try {
    // Verificar se o usuário é admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Acesso negado. Permissão de administrador necessária.' });
    }
    
    const { name, description, songs } = req.body;
    
    // Construir objeto de atualização
    const repertoireFields = {};
    if (name) repertoireFields.name = name;
    if (description !== undefined) repertoireFields.description = description;
    if (songs) repertoireFields.songs = songs;
    
    let repertoire = await Repertoire.findById(req.params.id);
    
    if (!repertoire) {
      return res.status(404).json({ message: 'Repertório não encontrado' });
    }
    
    repertoire = await Repertoire.findByIdAndUpdate(
      req.params.id,
      { $set: repertoireFields },
      { new: true }
    );
    
    res.json(repertoire);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   DELETE api/repertoires/:id
// @desc    Excluir um repertório
// @access  Private/Admin
router.delete('/:id', auth, async (req, res) => {
  try {
    // Verificar se o usuário é admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Acesso negado. Permissão de administrador necessária.' });
    }
    
    const repertoire = await Repertoire.findById(req.params.id);
    
    if (!repertoire) {
      return res.status(404).json({ message: 'Repertório não encontrado' });
    }
    
    await Repertoire.findByIdAndRemove(req.params.id);
    
    res.json({ message: 'Repertório removido' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   PUT api/repertoires/:id/songs
// @desc    Adicionar música ao repertório
// @access  Private/Admin
router.put('/:id/songs', auth, async (req, res) => {
  try {
    // Verificar se o usuário é admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Acesso negado. Permissão de administrador necessária.' });
    }
    
    const { songId, order, key, notes } = req.body;
    
    // Validar campos obrigatórios
    if (!songId) {
      return res.status(400).json({ message: 'ID da música é obrigatório' });
    }
    
    const repertoire = await Repertoire.findById(req.params.id);
    
    if (!repertoire) {
      return res.status(404).json({ message: 'Repertório não encontrado' });
    }
    
    // Verificar se a música já está no repertório
    const songIndex = repertoire.songs.findIndex(
      song => song.songId.toString() === songId
    );
    
    if (songIndex !== -1) {
      return res.status(400).json({ message: 'Esta música já está no repertório' });
    }
    
    // Adicionar música ao repertório
    repertoire.songs.push({
      songId,
      order: order || repertoire.songs.length + 1,
      key,
      notes
    });
    
    await repertoire.save();
    
    res.json(repertoire);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   DELETE api/repertoires/:id/songs/:songId
// @desc    Remover música do repertório
// @access  Private/Admin
router.delete('/:id/songs/:songId', auth, async (req, res) => {
  try {
    // Verificar se o usuário é admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Acesso negado. Permissão de administrador necessária.' });
    }
    
    const repertoire = await Repertoire.findById(req.params.id);
    
    if (!repertoire) {
      return res.status(404).json({ message: 'Repertório não encontrado' });
    }
    
    // Remover música do repertório
    repertoire.songs = repertoire.songs.filter(
      song => song.songId.toString() !== req.params.songId
    );
    
    await repertoire.save();
    
    res.json(repertoire);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

module.exports = router;
