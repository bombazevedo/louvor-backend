// src/controllers/chordController.js

const Chord = require('../models/Chord');

console.log('[ChordController] ✅ Controller carregado com sucesso');

const gerarSlug = (texto) =>
  texto.normalize('NFD')
       .replace(/[\u0300-\u036f]/g, '')
       .toLowerCase()
       .replace(/[^a-z0-9\\s]/g, '')
       .trim()
       .replace(/\\s+/g, '-');

const getChord = async (req, res) => {
  try {
    const { name, artist } = req.query;
    if (!name || !artist) {
      return res.status(400).json({ error: 'Missing parameters: name and artist are required' });
    }

    const slug = `${gerarSlug(artist)}__${gerarSlug(name)}`;
    const chord = await Chord.findOne({ slug });

    if (chord) {
      return res.status(200).json({ source: 'internal', chord: chord.chordsText });
    }

    // 🔄 Atualização: redirecionar para página de busca no CifraClub
    const searchQuery = encodeURIComponent(`${artist} ${name}`);
    const externalUrl = `https://www.cifraclub.com.br/?q=${searchQuery}`;
    
    return res.status(200).json({ source: 'external', url: externalUrl });
  } catch (error) {
    console.error('[ChordController] Erro em getChord:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const saveChord = async (req, res) => {
  try {
    const { name, artist, chordsText } = req.body;
    if (!name || !artist || !chordsText) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const slug = `${gerarSlug(artist)}__${gerarSlug(name)}`;

    const newChord = await Chord.create({
      name,
      artist,
      slug,
      chordsText,
      createdBy: req.user?.id || null
    });

    return res.status(201).json(newChord);
  } catch (error) {
    console.error('[ChordController] Erro em saveChord:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getChord,
  saveChord
};
