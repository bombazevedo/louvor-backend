const Chord = require('../models/Chord');

const gerarSlug = (texto) =>
  texto.normalize('NFD')
       .replace(/[\u0300-\u036f]/g, '')
       .toLowerCase()
       .replace(/[^a-z0-9\s]/g, '')
       .trim()
       .replace(/\s+/g, '-');

const getChord = async (req, res) => {
  const { name, artist } = req.query;
  if (!name || !artist) return res.status(400).json({ error: 'Missing parameters' });

  const slug = `${gerarSlug(artist)}__${gerarSlug(name)}`;
  const chord = await Chord.findOne({ slug });

  if (chord) {
    return res.json({ source: 'internal', chord: chord.chordsText });
  }

  const externalUrl = `https://www.cifraclub.com.br/${gerarSlug(artist)}/${gerarSlug(name)}/`;
  return res.json({ source: 'external', url: externalUrl });
};

const saveChord = async (req, res) => {
  const { name, artist, chordsText } = req.body;
  if (!name || !artist || !chordsText) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const slug = `${gerarSlug(artist)}__${gerarSlug(name)}`;

  const newChord = await Chord.create({
    name,
    artist,
    slug,
    chordsText,
    createdBy: req.user.id
  });

  res.status(201).json(newChord);
};

module.exports = { getChord, saveChord };
