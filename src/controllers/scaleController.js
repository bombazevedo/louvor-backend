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

    if (!eventId || !members || !Array.isArray(members)) {
      return res.status(400).json({ message: "Dados inválidos. 'eventId' e 'members[]' são obrigatórios." });
    }

    const validatedMembers = [];
    for (const item of members) {
      const user = await User.findById(item.user);
      if (!user) {
        return res.status(404).json({ message: `Usuário não encontrado: ${item.user}` });
      }

      validatedMembers.push({
        user: user._id,
        function: item.function,
        confirmed: false,
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

// Buscar escala por ID do evento
exports.getScaleByEventId = async (req, res) => {
  const { eventId } = req.params;
  try {
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

// Buscar escala por ID da escala
exports.getScaleById = async (req, res) => {
  try {
    const scale = await Scale.findById(req.params.id)
      .populate("event", "title date")
      .populate("members.user", "name email")
      .populate("createdBy", "name");

    if (!scale) {
      return res.status(404).json({ message: "Escala não encontrada." });
    }

    res.status(200).json(scale);
  } catch (error) {
    console.error("Erro ao buscar escala:", error);
    res.status(500).json({ message: "Erro ao buscar escala." });
  }
};

// Listar todas as escalas
exports.getAllScales = async (req, res) => {
  try {
    const scales = await Scale.find()
      .populate("event", "title date")
      .populate("members.user", "name email")
      .populate("createdBy", "name");

    res.status(200).json(scales);
  } catch (error) {
    console.error("Erro ao listar escalas:", error);
    res.status(500).json({ message: "Erro ao listar escalas." });
  }
};

// Atualizar escala
exports.updateScale = async (req, res) => {
  try {
    const scaleId = req.params.id;
    const { members, notes } = req.body;

    const validatedMembers = [];
    for (const item of members) {
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

    const updatedScale = await Scale.findByIdAndUpdate(
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

    if (!updatedScale) {
      return res.status(404).json({ message: "Escala não encontrada para atualizar." });
    }

    res.status(200).json(updatedScale);
  } catch (error) {
    console.error("Erro ao atualizar escala:", error);
    res.status(500).json({ message: "Erro ao atualizar escala." });
  }
};

// Deletar escala
exports.deleteScale = async (req, res) => {
  try {
    const deleted = await Scale.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Escala não encontrada para exclusão." });
    }

    res.status(200).json({ message: "Escala excluída com sucesso." });
  } catch (error) {
    console.error("Erro ao deletar escala:", error);
    res.status(500).json({ message: "Erro ao deletar escala." });
  }
};
