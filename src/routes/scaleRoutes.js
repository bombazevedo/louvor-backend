
const express = require('express');
const router = express.Router();
const { authenticate, isCoordinator } = require('../middleware/auth');
const Scale = require('../models/Scale');
const User = require('../models/User');
const BandRole = require('../models/BandRole');

// GET /api/scales/event/:eventId
router.get('/event/:eventId', authenticate, async (req, res) => {
  try {
    const scale = await Scale.findOne({ eventId: req.params.eventId }).lean();

    if (!scale) {
      return res.status(404).json({ error: 'Escala não encontrada' });
    }

    const populatedMembers = await Promise.all(scale.members.map(async (member) => {
      const user = await User.findById(member.user).select('name email');
      const role = await BandRole.findById(member.role).select('name');
      return {
        ...member,
        user: user || null,
        role: role || null
      };
    }));

    scale.members = populatedMembers;

    res.status(200).json(scale);
  } catch (error) {
    console.error('Erro ao buscar escala:', error);
    res.status(500).json({ error: 'Erro ao buscar escala' });
  }
});

// POST /api/scales
router.post('/', authenticate, isCoordinator, async (req, res) => {
  try {
    const { eventId, members, notes } = req.body;
    const newScale = new Scale({ eventId, members, notes });
    await newScale.save();
    res.status(201).json(newScale);
  } catch (error) {
    console.error('Erro ao criar escala:', error);
    res.status(500).json({ error: 'Erro ao criar escala' });
  }
});

// PATCH /api/scales/:id
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const scale = await Scale.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(scale);
  } catch (error) {
    console.error('Erro ao atualizar escala:', error);
    res.status(500).json({ error: 'Erro ao atualizar escala' });
  }
});

// DELETE /api/scales/:id
router.delete('/:id', authenticate, isCoordinator, async (req, res) => {
  try {
    await Scale.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch (error) {
    console.error('Erro ao deletar escala:', error);
    res.status(500).json({ error: 'Erro ao deletar escala' });
  }
});

module.exports = router;
