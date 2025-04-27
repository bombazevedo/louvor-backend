const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Scale = require('../models/Scale');
const User = require('../models/User');

// @route   GET api/scales
// @desc    Obter todas as escalas
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const scales = await Scale.find()
      .populate('eventId', 'title date')
      .populate('members.userId', 'name email')
      .sort({ date: 1 });
    res.json(scales);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   GET api/scales/user
// @desc    Obter escalas do usuário logado
// @access  Private
router.get('/user', auth, async (req, res) => {
  try {
    const scales = await Scale.find({ 'members.userId': req.user.id })
      .populate('eventId', 'title date')
      .populate('members.userId', 'name email')
      .sort({ date: 1 });
    res.json(scales);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   GET api/scales/:id
// @desc    Obter escala por ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const scale = await Scale.findById(req.params.id)
      .populate('eventId', 'title date location')
      .populate('members.userId', 'name email phone instruments');
    
    if (!scale) {
      return res.status(404).json({ message: 'Escala não encontrada' });
    }
    
    res.json(scale);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ message: 'Escala não encontrada' });
    }
    res.status(500).send('Erro no servidor');
  }
});

// @route   POST api/scales
// @desc    Criar uma escala
// @access  Private/Admin
router.post('/', auth, async (req, res) => {
  try {
    // Verificar se o usuário é admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Acesso negado. Permissão de administrador necessária.' });
    }
    
    const { eventId, members, notes } = req.body;
    
    // Validar campos obrigatórios
    if (!eventId || !members || members.length === 0) {
      return res.status(400).json({ message: 'Por favor, preencha os campos obrigatórios' });
    }
    
    const newScale = new Scale({
      eventId,
      members,
      notes,
      createdBy: req.user.id
    });
    
    const scale = await newScale.save();
    
    // Enviar notificações para os membros escalados
    // Implementação de notificações pode ser adicionada aqui
    
    res.json(scale);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   PUT api/scales/:id
// @desc    Atualizar uma escala
// @access  Private/Admin
router.put('/:id', auth, async (req, res) => {
  try {
    // Verificar se o usuário é admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Acesso negado. Permissão de administrador necessária.' });
    }
    
    const { eventId, members, notes, status } = req.body;
    
    // Construir objeto de atualização
    const scaleFields = {};
    if (eventId) scaleFields.eventId = eventId;
    if (members) scaleFields.members = members;
    if (notes !== undefined) scaleFields.notes = notes;
    if (status) scaleFields.status = status;
    
    let scale = await Scale.findById(req.params.id);
    
    if (!scale) {
      return res.status(404).json({ message: 'Escala não encontrada' });
    }
    
    scale = await Scale.findByIdAndUpdate(
      req.params.id,
      { $set: scaleFields },
      { new: true }
    );
    
    res.json(scale);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   DELETE api/scales/:id
// @desc    Excluir uma escala
// @access  Private/Admin
router.delete('/:id', auth, async (req, res) => {
  try {
    // Verificar se o usuário é admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Acesso negado. Permissão de administrador necessária.' });
    }
    
    const scale = await Scale.findById(req.params.id);
    
    if (!scale) {
      return res.status(404).json({ message: 'Escala não encontrada' });
    }
    
    await Scale.findByIdAndRemove(req.params.id);
    
    res.json({ message: 'Escala removida' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

// @route   PUT api/scales/:id/confirm
// @desc    Confirmar participação em uma escala
// @access  Private
router.put('/:id/confirm', auth, async (req, res) => {
  try {
    const scale = await Scale.findById(req.params.id);
    
    if (!scale) {
      return res.status(404).json({ message: 'Escala não encontrada' });
    }
    
    // Verificar se o usuário está na escala
    const memberIndex = scale.members.findIndex(
      member => member.userId.toString() === req.user.id
    );
    
    if (memberIndex === -1) {
      return res.status(400).json({ message: 'Você não está nesta escala' });
    }
    
    // Atualizar status de confirmação
    scale.members[memberIndex].confirmed = true;
    
    await scale.save();
    
    res.json(scale);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Erro no servidor');
  }
});

module.exports = router;
