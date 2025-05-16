const express = require('express');
const router = express.Router();
const { authenticate, isCoordinator } = require('../middleware/auth');
const { getEventsWithScales, getEventById } = require('../controllers/eventController');
const Event = require('../models/Event');

router.get('/', authenticate, getEventsWithScales);
router.get('/:id', authenticate, getEventById);

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

router.patch('/:id', authenticate, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

    const isMember = event.members?.some(m => m.user.toString() === req.user.id);

    if (req.user.role === 'coordenador' || (req.user.role === 'dm' && isMember)) {
      const updatedEvent = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
      return res.json(updatedEvent);
    }

    return res.status(403).json({ error: 'Permissão negada para editar este evento' });
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