// src/controllers/scaleController.js
const Scale = require('../models/Scale');
const User = require('../models/User');
const BandRole = require('../models/BandRole');

// POST /api/scales
exports.createScale = async (req, res) => {
  try {
    const { eventId, members = [], notes = '' } = req.body;

    const validatedMembers = await Promise.all(members.map(async (member) => {
      const userExists = await User.findById(member.user);
      const roleExists = await BandRole.findById(member.role);
      if (!userExists || !roleExists) return null;

      return {
        user: userExists._id,
        function: roleExists.name,
        confirmed: member.confirmed || false
      };
    }));

    const filtered = validatedMembers.filter(m => m !== null);

    const scale = new Scale({ eventId, members: filtered, notes });
    await scale.save();
    res.status(201).json(scale);
  } catch (error) {
    console.error('❌ Erro ao criar escala:', error);
    res.status(500).json({ error: 'Erro ao criar escala' });
  }
};

// GET /api/scales/event/:eventId
exports.getScaleByEventId = async (req, res) => {
  try {
    const scale = await Scale.findOne({ eventId: req.params.eventId })
      .populate('members.user', 'name email');

    if (!scale) return res.status(404).json({ error: 'Escala não encontrada' });
    res.json(scale);
  } catch (error) {
    console.error('❌ Erro ao buscar escala:', error);
    res.status(500).json({ error: 'Erro ao buscar escala' });
  }
};

// PATCH /api/scales/:id
exports.updateScale = async (req, res) => {
  try {
    const { members = [], notes = '' } = req.body;

    const validatedMembers = await Promise.all(members.map(async (member) => {
      const userExists = await User.findById(member.user);
      const roleExists = await BandRole.findById(member.role);
      if (!userExists || !roleExists) return null;

      return {
        user: userExists._id,
        function: roleExists.name,
        confirmed: member.confirmed || false
      };
    }));

    const filtered = validatedMembers.filter(m => m !== null);

    const updatedScale = await Scale.findByIdAndUpdate(
      req.params.id,
      { members: filtered, notes },
      { new: true }
    );

    if (!updatedScale) return res.status(404).json({ error: 'Escala não encontrada' });
    res.json(updatedScale);
  } catch (error) {
    console.error('❌ Erro ao atualizar escala:', error);
    res.status(500).json({ error: 'Erro ao atualizar escala' });
  }
};

// DELETE /api/scales/:id
exports.deleteScale = async (req, res) => {
  try {
    const deleted = await Scale.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Escala não encontrada' });
    res.status(204).end();
  } catch (error) {
    console.error('❌ Erro ao deletar escala:', error);
    res.status(500).json({ error: 'Erro ao deletar escala' });
  }
};
