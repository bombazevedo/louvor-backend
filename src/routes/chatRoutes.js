const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // ✅ Corrigido
const Chat = require('../models/Chat');

// @route   GET api/chats/event/:eventId
// @desc    Obter mensagens de chat de um evento
// @access  Private
router.get('/event/:eventId', auth, async (req, res) => {
  try {
    const messages = await Chat.find({ eventId: req.params.eventId })
      .populate('sender', 'name')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   POST api/chats
// @desc    Enviar uma mensagem de chat
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { eventId, message } = req.body;

    if (!eventId || !message) {
      return res.status(400).json({ message: 'ID do evento e mensagem são obrigatórios' });
    }

    const newMessage = new Chat({
      eventId,
      sender: req.user.id,
      message
    });

    const chatMessage = await newMessage.save();
    await chatMessage.populate('sender', 'name');

    res.json(chatMessage);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   DELETE api/chats/:id
// @desc    Excluir uma mensagem de chat
// @access  Private/Admin
router.delete('/:id', auth, async (req, res) => {
  try {
    const message = await Chat.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: 'Mensagem não encontrada' });
    }

    if (message.sender.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    await Chat.findByIdAndRemove(req.params.id);
    res.json({ message: 'Mensagem removida' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

module.exports = router;
