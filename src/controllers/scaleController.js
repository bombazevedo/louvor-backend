const Scale = require('../models/Scale');
const User = require('../models/User');

// Criar escala
exports.createScale = async (req, res) => {
  try {
    const { eventId, members, notes } = req.body;
    const role = req.user?.role;
    const userId = req.user?.id;

    if (!eventId || !Array.isArray(members)) {
      return res.status(400).json({ message: 'Dados inválidos. É necessário eventId e lista de membros.' });
    }

    const validatedMembers = await Promise.all(
      members.map(async m => {
        const userExists = await User.findById(m.user);
        if (!userExists) throw new Error(`Usuário não encontrado: ${m.user}`);
        return {
          user: m.user,
          function: m.function || '',
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

    const scale = new Scale({ eventId, members: validatedMembers, notes: notes || '' });
    const savedScale = await scale.save();
    res.status(201).json(savedScale);
  } catch (error) {
    console.error('Erro ao criar escala:', error);
    res.status(500).json({ message: 'Erro ao criar escala.', error: error.message });
  }
};

// Atualizar escala
exports.updateScale = async (req, res) => {
  try {
    const scaleId = req.params.id;
    const { members, notes } = req.body;
    const role = req.user?.role;
    const userId = req.user?.id;

    if (!Array.isArray(members)) {
      return res.status(400).json({ message: 'Lista de membros inválida.' });
    }

    const validatedMembers = await Promise.all(
      members.map(async m => {
        const userExists = await User.findById(m.user);
        if (!userExists) throw new Error(`Usuário não encontrado: ${m.user}`);
        return {
          user: m.user,
          function: m.function || '',
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

    const updated = await Scale.findByIdAndUpdate(
      scaleId,
      { members: validatedMembers, notes: notes || '', updatedAt: Date.now() },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: 'Escala não encontrada.' });

    res.status(200).json(updated);
  } catch (error) {
    console.error('Erro ao atualizar escala:', error);
    res.status(500).json({ message: 'Erro ao atualizar escala.', error: error.message });
  }
};

// Buscar escala por evento
exports.getScaleByEventId = async (req, res) => {
  try {
    const scale = await Scale.findOne({ eventId: req.params.eventId }).populate('members.user', 'name email');
    if (!scale) return res.status(404).json({ message: 'Escala não encontrada para este evento.' });
    res.status(200).json(scale);
  } catch (err) {
    console.error('Erro ao buscar escala por evento:', err.message);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};

// Buscar todas as escalas
exports.getAllScales = async (req, res) => {
  try {
    const scales = await Scale.find().populate('members.user', 'name email');
    res.status(200).json(scales);
  } catch (err) {
    console.error('Erro ao buscar escalas:', err.message);
    res.status(500).json({ message: 'Erro ao buscar escalas.' });
  }
};

// Buscar escala por ID
exports.getScaleById = async (req, res) => {
  try {
    const scale = await Scale.findById(req.params.id).populate('members.user', 'name email');
    if (!scale) return res.status(404).json({ message: 'Escala não encontrada.' });
    res.status(200).json(scale);
  } catch (err) {
    console.error('Erro ao buscar escala por ID:', err.message);
    res.status(500).json({ message: 'Erro interno ao buscar escala.' });
  }
};

// Deletar escala
exports.deleteScale = async (req, res) => {
  try {
    const deleted = await Scale.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Escala não encontrada para exclusão.' });
    res.status(200).json({ message: 'Escala excluída com sucesso.' });
  } catch (err) {
    console.error('Erro ao deletar escala:', err.message);
    res.status(500).json({ message: 'Erro ao deletar escala.' });
  }
};
