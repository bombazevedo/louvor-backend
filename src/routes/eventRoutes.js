const express = require('express');
const router = express.Router();
const orgContext = require('../middleware/orgContext');
const licenseGuard = require('../middleware/licenseGuard');
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
router.get('/', authenticate, orgContext, getEventsWithScales);
router.patch('/:eventId/songs/:songId/overrides', authenticate, orgContext, licenseGuard, updateEventSongOverrides);

// ➕ Criar novo evento com lógica de Song
router.post('/', authenticate, orgContext, isCoordinator, licenseGuard, createEvent);

// 🔍 Buscar evento por ID
router.get('/:id', authenticate, orgContext, getEventById);

// ✏️ Atualizar evento com lógica de Song
router.patch('/:id', authenticate, orgContext, licenseGuard, updateEvent);

// ⬇️⬇️⬇️ ✅ ADIÇÃO CIRÚRGICA: aplicar overrides (key/bpm/link) no CONTEXTO do evento

// 🗑️ Deletar evento (apenas coordenador)
router.delete('/:id', authenticate, orgContext, isCoordinator, async (req, res) => {
  try {
    await Event.findOneAndDelete({ _id: req.params.id, org: req.orgId });
    res.status(204).end();
  } catch (error) {
    console.error('❌ Erro ao deletar evento:', error);
    res.status(500).json({ error: 'Erro ao deletar evento' });
  }
});

module.exports = router;
