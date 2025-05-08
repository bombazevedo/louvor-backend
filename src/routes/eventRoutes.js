const express = require('express');
const router = express.Router();

// ✅ Corrigido o caminho e exportações esperadas
const { authenticate, isCoordinator } = require('../middlewares/auth');

const Event = require('../models/Event');

// Criar evento
router.post('/', authenticate, isCoordinator, async (req, res) => {
  try {
    const event = new Event(req.body);
    await event.save();
    res.status(201).json(event);
  } catch (error) {
    console.error('Erro ao criar evento:', error);
    res.status(500).json({ error: 'Erro ao criar evento' });
  }
});

// Buscar todos os eventos
router.get('/', authenticate, async (req, res) => {
  try {
    const events = await Event.find().populate('members.user');
    res.json(events);
  } catch (error) {
    console.error('Erro ao buscar eventos:', error);
    res.status(500).json({ error: 'Erro ao buscar eventos' });
  }
});

// Buscar evento por ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('members.user');
    if (!event) return res.status(404).json({ error: 'Evento não encontrado' });
    res.json(event);
  } catch (error) {
    console.error('Erro ao buscar evento:', error);
    res.status(500).json({ error: 'Erro ao buscar evento' });
  }
});

// Atualizar evento
router.patch('/:id', authenticate, isCoordinator, async (req, res) => {
  try {
    const updatedEvent = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedEvent);
  } catch (error) {
    console.error('Erro ao atualizar evento:', error);
    res.status(500).json({ error: 'Erro ao atualizar evento' });
  }
});

// Deletar evento
router.delete('/:id', authenticate, isCoordinator, async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch (error) {
    console.error('Erro ao deletar evento:', error);
    res.status(500).json({ error: 'Erro ao deletar evento' });
  }
});

module.exports = router;
