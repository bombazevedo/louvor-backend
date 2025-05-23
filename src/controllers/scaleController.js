const Scale = require('../models/Scale');
const User = require('../models/User');
const BandRole = require('../models/BandRole');

// Criar ou atualizar escala (inteligente)
exports.createScale = async (req, res) => {
  try {
    const { eventId, members, notes } = req.body;
    const role = req.user?.function;
    const userId = req.user?.id;

    if (!eventId || !Array.isArray(members)) {
      return res.status(400).json({ message: 'Dados inválidos. É necessário eventId e lista de membros.' });
    }

    const validatedMembers = await Promise.all(
      members.map(async m => {
        const userExists = await User.findById(m.user);
        const roleDoc = await BandRole.findById(m.function);
        if (!userExists) throw new Error(`Usuário não encontrado: ${m.user}`);
        if (!roleDoc) throw new Error(`Função de banda não encontrada: ${m.function}`);
        return {
          user: m.user,
          function: m.function,
          confirmed: m.confirmed || false
        };
      })
    );

    if (role === 'usuario') {
      return res.status(403).json({ message: 'Usuário comum não pode criar escalas.' });
    }

    if (role === 'dm') {
      const escalado = validatedMembers.some(m => m.user.toString() === userId);
      if (!escalado) {
        return res.status(403).json({ message: 'DM só pode criar ou editar escalas onde está escalado.' });
      }
    }

    let scale = await Scale.findOne({ eventId });

    if (scale) {
      scale.members = validatedMembers;
      scale.notes = notes || '';
      await scale.save();
      const populated = await Scale.findById(scale._id).populate('members.user', 'name email');
      return res.status(200).json(populated);
    } else {
      scale = new Scale({ eventId, members: validatedMembers, notes: notes || '' });
      const savedScale = await scale.save();
      const populated = await Scale.findById(savedScale._id).populate('members.user', 'name email');
      return res.status(201).json(populated);
    }
  } catch (error) {
    console.error('Erro ao criar/atualizar escala:', error);
    res.status(500).json({ message: 'Erro ao salvar escala.', error: error.message });
  }
};

exports.updateScale = async (req, res) => {
  try {
    const scaleId = req.params.id;
    const { members, notes } = req.body;
    const role = req.user?.function;
    const userId = req.user?.id;

    if (!Array.isArray(members)) {
      return res.status(400).json({ message: 'Lista de membros inválida.' });
    }

    const validatedMembers = await Promise.all(
      members.map(async m => {
        const userExists = await User.findById(m.user);
        const roleDoc = await BandRole.findById(m.function);
        if (!userExists) throw new Error(`Usuário não encontrado: ${m.user}`);
        if (!roleDoc) throw new Error(`Função de banda não encontrada: ${m.function}`);
        return {
          user: m.user,
          function: m.function,
          confirmed: m.confirmed || false
        };
      })
    );

    if (role === 'usuario') {
      return res.status(403).json({ message: 'Usuário comum não pode editar escalas.' });
    }

    if (role === 'dm') {
      const escalado = validatedMembers.some(m => m.user.toString() === userId);
      if (!escalado) {
        return res.status(403).json({ message: 'DM só pode editar escalas onde está escalado.' });
      }
    }

    await Scale.findByIdAndUpdate(
      scaleId,
      { members: validatedMembers, notes: notes || '', updatedAt: Date.now() },
      { new: true }
    );

    const updated = await Scale.findById(scaleId).populate('members.user', 'name email');

    if (!updated) return res.status(404).json({ message: 'Escala não encontrada.' });

    res.status(200).json(updated);
  } catch (error) {
    console.error('Erro ao atualizar escala:', error);
    res.status(500).json({ message: 'Erro ao atualizar escala.', error: error.message });
  }
};

// GET /scales/event/:eventId
exports.getScaleByEventId = async (req, res) => {
  try {
    const scale = await Scale.findOne({ eventId: req.params.eventId })
      .populate('members.user', 'name email');

    if (!scale) return res.status(404).json({ error: 'Escala não encontrada' });

    res.json(scale);
  } catch (err) {
    console.error('Erro em getScaleByEventId:', err);
    res.status(500).json({ error: 'Erro ao buscar escala' });
  }
};