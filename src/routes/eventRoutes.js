const express = require('express');
const router = express.Router();
const { authenticate, isCoordinator } = require('../middleware/auth');
const {
  getEventsWithScales,
  getEventById,
  createEvent,
  updateEvent,
  updateEventSongOverrides // ⬅️ ✅ ADIÇÃO CIRÚRGICA: importa o PATCH de overrides
} = require('../controllers/eventController');

// ✅ Adicione esta linha
const Event = require('../models/Event');

// 🔍 Buscar todos os eventos com escalas
router.get('/', authenticate, getEventsWithScales);

// ➕ Criar novo evento com lógica de Song
router.post('/', authenticate, isCoordinator, createEvent);

// 🔍 Buscar evento por ID
router.get('/:id', authenticate, getEventById);

// ✏️ Atualizar evento com lógica de Song
router.patch('/:id', authenticate, updateEvent);

// ⬇️⬇️⬇️ ✅ ADIÇÃO CIRÚRGICA: aplicar overrides (key/bpm/link) no CONTEXTO do evento
router.patch('/:eventId/songs/:songId/overrides', authenticate, updateEventSongOverrides);

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
