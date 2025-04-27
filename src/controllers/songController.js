const Song = require('../models/Song');

exports.addSong = async (req, res) => {
  try {
    const { name, url } = req.body;

    if (!name || !url) {
      return res.status(400).json({ message: 'Nome e URL são obrigatórios.' });
    }

    const newSong = new Song({ name, url });
    await newSong.save();

    res.status(201).json({ message: 'Música adicionada com sucesso!', song: newSong });
  } catch (error) {
    console.error('Erro ao adicionar música:', error.message);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};
