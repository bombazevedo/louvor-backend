const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Event = require('../models/Event');

// @route   GET api/events
// @desc    Obter todos os eventos
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    res.json(events);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   GET api/events/:id
// @desc    Obter evento por ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Evento não encontrado' });
    }
    
    res.json(event);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Evento não encontrado' });
    }
    res.status(500).send('Erro no servidor');
  }
});

// @route   POST api/events
// @desc    Criar um evento
// @access  Private/Admin
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado. Permissão de administrador necessária.' });
    }
    
    const { title, description, date, location, type, repertoireId } = req.body;
    
    if (!title || !date || !type) {
      return res.status(400).json({ message: 'Por favor, preencha os campos obrigatórios' });
    }
    
    const newEvent = new Event({
      title,
      description,
      date,
      location,
      type,
      repertoireId,
      createdBy: req.user.id
    });
    
    const event = await newEvent.save();
    res.json(event);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   PUT api/events/:id
// @desc    Atualizar um evento
// @access  Private/Admin
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado. Permissão de administrador necessária.' });
    }
    
    const { title, description, date, location, type, repertoireId, status } = req.body;
    
    const eventFields = {};
    if (title) eventFields.title = title;
    if (description !== undefined) eventFields.description = description;
    if (date) eventFields.date = date;
    if (location !== undefined) eventFields.location = location;
    if (type) eventFields.type = type;
    if (repertoireId !== undefined) eventFields.repertoireId = repertoireId;
    if (status !== undefined) eventFields.status = status;
    
    let event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Evento não encontrado' });
    }
    
    event = await Event.findByIdAndUpdate(
      req.params.id,
      { $set: eventFields },
      { new: true }
    );
    
    res.json(event);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   DELETE api/events/:id
// @desc    Excluir um evento
// @access  Private/Admin
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado. Permissão de administrador necessária.' });
    }
    
    const event = await Event.findById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ message: 'Evento não encontrado' });
    }
    
    await Event.findByIdAndRemove(req.params.id);
    
    res.json({ message: 'Evento removido' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

module.exports = router;
