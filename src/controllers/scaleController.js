const Scale = require('../models/Scale');
const User = require('../models/User');

exports.createScale = async (req, res) => {
  try {
    const { eventId, members, notes } = req.body;
    const role = req.user?.role;

    if (role !== 'coordenador') {
      return res.status(403).json({ message: 'Apenas coordenadores podem criar escalas.' });
    }

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

    const scale = new Scale({
      eventId,
      members: validatedMembers,
      notes: notes || ''
    });

    const savedScale = await scale.save();
    res.status(201).json(savedScale);
  } catch (error) {
    console.error('Erro ao criar escala:', error);
    res.status(500).json({ message: 'Erro ao criar escala.', error: error.message });
  }
};

exports.updateScale = async (req, res) => {
  try {
    const scaleId = req.params.id;
    const { members, notes } = req.body;

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

    const updated = await Scale.findByIdAndUpdate(
      scaleId,
      {
        members: validatedMembers,
        notes: notes || '',
        updatedAt: Date.now()
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Escala não encontrada.' });
    }

    res.status(200).json(updated);
  } catch (error) {
    console.error('Erro ao atualizar escala:', error);
    res.status(500).json({ message: 'Erro ao atualizar escala.', error: error.message });
  }
};

exports.getScaleByEventId = async (req, res) => {
  try {
    const eventId = req.params.eventId;

    if (!eventId) {
      return res.status(400).json({ message: 'ID do evento é obrigatório.' });
    }

    const scale = await Scale.findOne({ eventId });

    if (!scale) {
      return res.status(404).json({ message: 'Escala não encontrada para este evento.' });
    }

    return res.status(200).json(scale);
  } catch (error) {
    console.error('Erro ao buscar escala por evento:', error);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
};
