
// src/controllers/messageController.js
const Message = require('../models/Message');

exports.sendMessage = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { content } = req.body;

    const newMessage = new Message({
      eventId,
      content,
      sender: {
        id: req.user.id,
        name: req.user.name,
      },
    });

    await newMessage.save();
    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
};

exports.getMessagesByEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const messages = await Message.find({ eventId }).sort({ timestamp: 1 });
    res.status(200).json(messages);
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
};
