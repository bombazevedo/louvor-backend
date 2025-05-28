const express = require('express');
const router = express.Router();
const { authenticate, isCoordinator } = require('../middleware/auth');
const { getEventsWithScales, getEventById } = require('../controllers/eventController');
const Event = require('../models/Event');

router.get('/', authenticate, getEventsWithScales);

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

router.get('/:id', authenticate, getEventById);

// Atualizado para validar e aceitar anexos via PATCH
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { musicLinks, ...rest } = req.body;

    if (musicLinks && !Array.isArray(musicLinks)) {
      return res.status(400).json({ error: 'musicLinks deve ser um array' });
    }

    if (musicLinks && musicLinks.some(link => typeof link !== 'object' || !link.url)) {
      return res.status(400).json({ error: 'Cada item em musicLinks deve ser um objeto com pelo menos a propriedade url' });
    }

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { ...rest, ...(musicLinks ? { musicLinks } : {}) },
      { new: true }
    );

    if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

    res.json(event);
  } catch (error) {
    console.error('Erro ao atualizar evento:', error);
    res.status(500).json({ error: 'Erro ao atualizar evento' });
  }
});

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
