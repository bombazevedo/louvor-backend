const Scale = require("../models/Scale");
const Event = require("../models/Event");
const User = require("../models/User");

// Criar nova escala
exports.createScale = async (req, res) => {
  try {
    const { eventId, members, notes } = req.body;
    const createdBy = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'coordenador') {
      return res.status(403).json({ message: "Apenas coordenadores podem criar escalas." });
    }

    if (!eventId || !members || !Array.isArray(members)) {
      return res.status(400).json({ message: "Dados inválidos. 'eventId' e 'members[]' são obrigatórios." });
    }

    const validatedMembers = [];
    for (const item of members) {
      const user = await User.findById(item.userId);
      if (!user) {
        return res.status(404).json({ message: `Usuário não encontrado: ${item.userId}` });
      }

      validatedMembers.push({
        userId: user._id,
        function: item.function,
        confirmed: false,
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
      .populate("members.userId", "name email")
      .populate("createdBy", "name");

    res.status(201).json(result);
  } catch (error) {
    console.error("Erro ao criar escala:", error);
    res.status(500).json({ message: "Erro ao criar escala." });
  }
};