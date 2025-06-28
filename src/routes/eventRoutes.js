const express = require('express');
const router = express.Router();
const { authenticate, isCoordinator } = require('../middleware/auth');
const { getEventsWithScales, getEventById, updateEvent } = require('../controllers/eventController');
const Event = require('../models/Event');
const Scale = require('../models/Scale'); // ✅ Importa o model Scale

// 🔍 Buscar todos os eventos com escalas
router.get('/', authenticate, getEventsWithScales);

// ➕ Criar novo evento e escala vazia (apenas coordenador)
router.post('/', authenticate, isCoordinator, async (req, res) => {
  try {
    const event = new Event(req.body);
    await event.save();

    // ✅ Criar a escala associada, mesmo sem membros
    const scale = new Scale({
      eventId: event._id,
      members: []
    });
    await scale.save();

    res.status(201).json(event);
  } catch (error) {
    console.error('❌ Erro ao criar evento:', error);
    res.status(500).json({ error: 'Erro ao criar evento' });
  }
});

// 🔍 Buscar evento por ID
router.get('/:id', authenticate, getEventById);

// ✏️ Atualizar evento
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { musicLinks, attachments, ...rest } = req.body;

    if (musicLinks && !Array.isArray(musicLinks)) {
      return res.status(400).json({ error: 'musicLinks deve ser um array' });
    }
    if (musicLinks && musicLinks.some(link => typeof link !== 'object' || !link.url)) {
      return res.status(400).json({ error: 'Cada item em musicLinks deve ser um objeto com pelo menos a propriedade url' });
    }

    if (attachments && !Array.isArray(attachments)) {
      return res.status(400).json({ error: 'attachments deve ser um array' });
    }
    if (attachments && attachments.some(att => typeof att !== 'object' || !att.url || !att.name)) {
      return res.status(400).json({ error: 'Cada anexo deve conter name e url válidos' });
    }

    const event = await Event.findByIdAndUpdate(
      req.params.id,
      {
        ...rest,
        ...(musicLinks ? { musicLinks } : {}),
        ...(attachments ? { attachments } : {})
      },
      { new: true }
    );

    if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

    res.json(event);
  } catch (error) {
    console.error('❌ Erro ao atualizar evento:', error);
    res.status(500).json({ error: 'Erro ao atualizar evento' });
  }
});

// 🗑️ Deletar evento (apenas coordenador)
router.delete('/:id', authenticate, isCoordinator, async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch (error) {
    console.error('❌ Erro ao deletar evento:', error);
    res.status(500).json({ error: 'Erro ao deletar evento' });
  }
});

module.exports = router;
