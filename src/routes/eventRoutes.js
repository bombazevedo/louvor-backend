
const express = require('express');
const router = express.Router();
const { authenticate, isCoordinator } = require('../middleware/auth');
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

// Buscar todos os eventos (restrito por role)
router.get('/', authenticate, async (req, res) => {
  try {
    let events = [];

    if (req.user.role === 'coordenador') {
      events = await Event.find().populate('members.user');
    } else {
      events = await Event.find({ 'members.user': req.user.id }).populate('members.user');
    }

    res.json(events);
  } catch (error) {
    console.error('Erro ao buscar eventos:', error);
    res.status(500).json({ error: 'Erro ao buscar eventos' });
  }
});

// Buscar evento por ID (restrito por escala)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('members.user');
    if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

    if (req.user.role !== 'coordenador') {
      const isMember = event.members.some(m => m.user._id.toString() === req.user.id);
      if (!isMember) return res.status(403).json({ error: 'Acesso negado a este evento' });
    }

    res.json(event);
  } catch (error) {
    console.error('Erro ao buscar evento:', error);
    res.status(500).json({ error: 'Erro ao buscar evento' });
  }
});

// Atualizar evento (coordenador ou DM escalado)
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

    const isMember = event.members.some(m => m.user.toString() === req.user.id);

    if (req.user.role === 'coordenador' || (req.user.role === 'dm' && isMember)) {
      const updatedEvent = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('members.user');
      return res.json(updatedEvent);
    }

    return res.status(403).json({ error: 'Permissão negada para editar este evento' });
  } catch (error) {
    console.error('Erro ao atualizar evento:', error);
    res.status(500).json({ error: 'Erro ao atualizar evento' });
  }
});

// Deletar evento (apenas coordenador)
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
