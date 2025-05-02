const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');

// @route   GET api/notifications
// @desc    Obter notificações do usuário logado
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   GET api/notifications/unread
// @desc    Obter notificações não lidas do usuário logado
// @access  Private
router.get('/unread', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ 
      user: req.user.id,
      read: false
    }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   POST api/notifications
// @desc    Criar uma notificação (apenas para admin)
// @access  Private/Admin
router.post('/', auth, async (req, res) => {
  try {
    // Verificar se o usuário é admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Acesso negado. Permissão de administrador necessária.' });
    }
    
    const { user, title, message, type, relatedId } = req.body;
    
    // Validar campos obrigatórios
    if (!user || !title || !message) {
      return res.status(400).json({ message: 'Usuário, título e mensagem são obrigatórios' });
    }
    
    const newNotification = new Notification({
      user,
      title,
      message,
      type: type || 'info',
      relatedId,
      read: false
    });
    
    const notification = await newNotification.save();
    
    res.json(notification);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   PUT api/notifications/:id/read
// @desc    Marcar notificação como lida
// @access  Private
router.put('/:id/read', auth, async (req, res) => {
  try {
    let notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notificação não encontrada' });
    }
    
    // Verificar se a notificação pertence ao usuário
    if (notification.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Acesso negado' });
    }
    
    notification.read = true;
    await notification.save();
    
    res.json(notification);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   PUT api/notifications/read-all
// @desc    Marcar todas as notificações como lidas
// @access  Private
router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, read: false },
      { $set: { read: true } }
    );
    
    res.json({ message: 'Todas as notificações foram marcadas como lidas' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   DELETE api/notifications/:id
// @desc    Excluir uma notificação
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: 'Notificação não encontrada' });
    }
    
    // Verificar se a notificação pertence ao usuário ou se é admin
    if (notification.user.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Acesso negado' });
    }
    
    await Notification.findByIdAndRemove(req.params.id);
    
    res.json({ message: 'Notificação removida' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

module.exports = router;
