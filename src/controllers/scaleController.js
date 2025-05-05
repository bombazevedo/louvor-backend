const Scale = require("../models/Scale");
const Event = require("../models/Event");
const User = require("../models/User");

// Criar nova escala
exports.createScale = async (req, res) => {
  try {
    const { eventId, members, notes } = req.body;
    const createdBy = req.user.id;
    const userRole = req.user.role;

    if (userRole.toLowerCase() !== 'coordenador') {
      return res.status(403).json({ message: "Apenas coordenadores podem criar escalas." });
    }

    if (!eventId || !Array.isArray(members)) {
      return res.status(400).json({ message: "Dados inválidos. 'eventId' e 'members[]' são obrigatórios." });
    }

    const validatedMembers = [];

    for (const item of members) {
      if (!item.user || !item.function) {
        return res.status(400).json({ message: "Cada membro precisa de 'user' e 'function'." });
      }

      const user = await User.findById(item.user);
      if (!user) {
        return res.status(404).json({ message: `Usuário não encontrado: ${item.user}` });
      }

      validatedMembers.push({
        user: user._id,
        function: item.function,
        confirmed: item.confirmed || false,
        notes: item.notes || ''
      });
    }

    const existing = await Scale.findOne({ event: eventId });
    if (existing) {
      return res.status(409).json({ message: "Já existe uma escala para este evento." });
    }

    const newScale = new Scale({
      event: eventId,
      members: validatedMembers,
      notes,
      createdBy
    });

    const saved = await newScale.save();

    const result = await Scale.findById(saved._id)
      .populate("event", "title date")
      .populate("members.user", "name email")
      .populate("createdBy", "name");

    res.status(201).json(result);
  } catch (error) {
    console.error("Erro ao criar escala:", error);
    res.status(500).json({ message: "Erro ao criar escala." });
  }
};

// Buscar escala pelo ID do Evento
exports.getScaleByEventId = async (req, res) => {
  try {
    const { eventId } = req.params;

    const scale = await Scale.findOne({ event: eventId })
      .populate("event", "title date")
      .populate("members.user", "name email")
      .populate("createdBy", "name");

    if (!scale) {
      return res.status(404).json({ message: "Escala não encontrada para este evento." });
    }

    res.status(200).json(scale);
  } catch (err) {
    console.error("Erro ao buscar escala por evento:", err);
    res.status(500).json({ message: "Erro ao buscar escala." });
  }
};

// Atualizar escala
exports.updateScale = async (req, res) => {
  try {
    const scaleId = req.params.id;
    const { members, notes } = req.body;

    if (!Array.isArray(members)) {
      return res.status(400).json({ message: "'members[]' obrigatório para atualizar escala." });
    }

    const validatedMembers = [];

    for (const item of members) {
      if (!item.user || !item.function) {
        return res.status(400).json({ message: "Cada membro precisa de 'user' e 'function'." });
      }

      const user = await User.findById(item.user);
      if (!user) {
        return res.status(404).json({ message: `Usuário não encontrado: ${item.user}` });
      }

      validatedMembers.push({
        user: user._id,
        function: item.function,
        confirmed: item.confirmed || false,
        notes: item.notes || ''
      });
    }

    const updated = await Scale.findByIdAndUpdate(
      scaleId,
      {
        members: validatedMembers,
        notes,
        updatedAt: Date.now()
      },
      { new: true }
    )
      .populate("event", "title date")
      .populate("members.user", "name email")
      .populate("createdBy", "name");

    if (!updated) {
      return res.status(404).json({ message: "Escala não encontrada para atualizar." });
    }

    res.status(200).json(updated);
  } catch (error) {
    console.error("Erro ao atualizar escala:", error);
    res.status(500).json({ message: "Erro ao atualizar escala." });
  }
};
