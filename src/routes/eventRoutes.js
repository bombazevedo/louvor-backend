const express = require('express');
const router = express.Router();
const { authenticate, isCoordinator } = require('../middleware/auth');
const { getEventsWithScales } = require('../controllers/eventController');
const Event = require('../models/Event');

// 📋 Listar eventos com escalas (todos que pode visualizar)
router.get('/', authenticate, async (req, res) => {
  console.log('📥 GET /events requisitado por:', req.user.email, '| role:', req.user.role);
  return getEventsWithScales(req, res);
});

// ✅ Criar evento (somente coordenador)
router.post('/', authenticate, isCoordinator, async (req, res) => {
  try {
    console.log('🆕 Criando novo evento:', req.body.title);
    const event = new Event(req.body);
    await event.save();
    res.status(201).json(event);
  } catch (error) {
    console.error('❌ Erro ao criar evento:', error);
    res.status(500).json({ error: 'Erro ao criar evento' });
  }
});

// 🔍 Buscar evento por ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    console.log(`🔍 Buscando evento ID: ${req.params.id}`);
    const event = await Event.findById(req.params.id).populate('members.user');
    if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

    if (req.user.role !== 'coordenador') {
      const isMember = event.members?.some(m => m.user._id?.toString() === req.user.id);
      if (!isMember) {
        console.log('⛔ Acesso negado ao evento para:', req.user.email);
        return res.status(403).json({ error: 'Acesso negado a este evento' });
      }
    }

    res.json(event);
  } catch (error) {
    console.error('❌ Erro ao buscar evento:', error);
    res.status(500).json({ error: 'Erro ao buscar evento' });
  }
});

// 🛠 Atualizar evento
router.patch('/:id', authenticate, async (req, res) => {
  try {
    console.log(`📝 Atualizando evento ID: ${req.params.id}`);
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Evento não encontrado' });

    const isMember = event.members?.some(m => m.user.toString() === req.user.id);

    if (req.user.role === 'coordenador' || (req.user.role === 'dm' && isMember)) {
      const updatedEvent = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('members.user');
      return res.json(updatedEvent);
    }

    return res.status(403).json({ error: 'Permissão negada para editar este evento' });
  } catch (error) {
    console.error('❌ Erro ao atualizar evento:', error);
    res.status(500).json({ error: 'Erro ao atualizar evento' });
  }
});

// 🗑️ Deletar evento (coordenador)
router.delete('/:id', authenticate, isCoordinator, async (req, res) => {
  try {
    console.log(`🗑️ Tentando excluir evento ID: ${req.params.id}`);
    const deleted = await Event.findByIdAndDelete(req.params.id);

    if (!deleted) {
      console.warn('⚠️ Evento não encontrado para exclusão');
      return res.status(404).json({ error: 'Evento não encontrado' });
    }

    console.log('✅ Evento excluído:', deleted.title);
    res.status(200).json({ message: 'Evento excluído com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar evento:', error);
    res.status(500).json({ error: 'Erro ao deletar evento' });
  }
});

module.exports = router;
