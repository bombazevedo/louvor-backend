const express = require('express');
const router = express.Router();
const { authenticate, isCoordinator } = require('../middleware/auth');
const {
  getEventsWithScales,
  getEventById,
  createEvent,
  updateEvent
} = require('../controllers/eventController');

// 🔍 Buscar todos os eventos com escalas
router.get('/', authenticate, getEventsWithScales);

// ➕ Criar novo evento com lógica de Song
router.post('/', authenticate, isCoordinator, createEvent);

// 🔍 Buscar evento por ID
router.get('/:id', authenticate, getEventById);

// ✏️ Atualizar evento com lógica de Song
router.patch('/:id', authenticate, updateEvent);

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
